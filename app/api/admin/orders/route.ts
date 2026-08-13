export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireOrdersAccess } from '@/lib/admin-auth';
import { canTransition, type OrderStatus } from '@/lib/order-states';
import { shortOrderId } from '@/lib/push-enqueue';
import { enqueueWebhook, fetchOrderForWebhook, type WebhookEventType } from '@/lib/webhook-dispatch';
import { assertSameOrigin } from '@/lib/csrf';
import { notifyAdminOrderStatusChange, notify } from '@/lib/notify';
import { emailConfigured, sendOrderShippedEmail, sendOrderDeliveredEmail, sendOrderCancelledEmail } from '@/lib/email';
import { logOrderEvent } from '@/lib/order-events';

// GET: List all orders with buyer profile join
export async function GET(req: NextRequest) {
  const gate = await requireOrdersAccess();
  if (!gate.ok) return gate.response;

  try {
    const supabase = createAdminClient();
    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get('status');
    const query = searchParams.get('query');

    // Explicit column list instead of '*': this fetch is capped at 5000 rows
    // and the wildcard shipped every order column to the admin client. The
    // list below covers every field the consumer (app/admin/orders/page.tsx)
    // reads, plus every column referenced by the in-memory status-visibility
    // filter and text search below (status, agent_id, id, joined profiles).
    let dbQuery = supabase
      .from('orders')
      .select(
        'id, buyer_id, agent_id, status, fulfillment_method, payment_method, shipping_address, ' +
        'shipping_cost, subtotal, discount_amount, coupon_code, total, tracking_number, ' +
        'agent_approved_at, agent_approval_notes, created_at, is_wholesale_restock, ' +
        'buyer_name, buyer_email, ' +
        'profiles!orders_buyer_id_fkey(full_name, email, contact_email, phone), ' +
        'agent:profiles!orders_agent_id_fkey(full_name, parent:parent_agent_id(full_name))',
      );

    if (status) {
      dbQuery = dbQuery.eq('status', status);
    }

    // Sort by created_at desc. Safety-valve cap against an unbounded full-table
    // fetch (search/filter below run in memory over the returned rows).
    dbQuery = dbQuery.order('created_at', { ascending: false }).limit(5000);

    const { data, error } = await dbQuery;

    if (error) {
      return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
    }

    interface OrderRow {
      id: string;
      agent_id: string | null;
      status: string;
      profiles: {
        full_name: string | null;
        email: string;
        contact_email: string | null;
        phone: string | null;
      } | null;
      agent: {
        full_name: string | null;
        parent: {
          full_name: string | null;
        } | null;
      } | null;
    }

    const typedData = (data as unknown) as OrderRow[] | null;

    // Filter out pending_customer_payment and agent_approval_pending orders that belong to an external agent,
    // EXCEPT for platform admins who have full control over all orders.
    let filteredData = (typedData || []).filter((order) => {
      if (order.status === 'pending_customer_payment' || order.status === 'agent_approval_pending') {
        if (!gate.isAdmin && order.agent_id && order.agent_id !== gate.userId) {
          return false;
        }
      }
      return true;
    });

    // Filter in memory for fuzzy text search across joined profile fields
    if (query) {
      const q = query.toLowerCase();
      filteredData = filteredData.filter((order) => {
        const buyer = order.profiles;
        return (
          order.id.toLowerCase().includes(q) ||
          (buyer?.full_name || '').toLowerCase().includes(q) ||
          (buyer?.email || '').toLowerCase().includes(q) ||
          (buyer?.phone || '').toLowerCase().includes(q)
        );
      });
    }

    return NextResponse.json({ data: filteredData }, {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    });
  } catch (err) {
    console.error('[admin/orders] GET error:', err);
    return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
  }
}

// POST: Process / Update an order state
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireOrdersAccess();
  if (!gate.ok) return gate.response;

  try {
    const supabase = createAdminClient();
    const body = await req.json().catch(() => ({}));

    const {
      id,
      status,
      tracking_number,
      agent_approval_notes,
    } = body;

    if (!id || !status) {
      return NextResponse.json({ error: 'Missing Order ID Or New Status' }, { status: 400 });
    }

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(String(id))) {
      return NextResponse.json({ error: 'Invalid Order ID Format' }, { status: 400 });
    }

    // Fetch the current status so we can validate the transition.
    const { data: existingOrder, error: fetchErr } = await supabase
      .from('orders')
      .select('status')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !existingOrder) {
      return NextResponse.json({ error: 'Order Not Found' }, { status: 404 });
    }

    const currentStatus = existingOrder.status as OrderStatus;
    const nextStatus = status as OrderStatus;

    if (!canTransition(currentStatus, nextStatus, gate.role)) {
      return NextResponse.json(
        { error: `Invalid Status Transition From ${currentStatus} To ${nextStatus}` },
        { status: 422 }
      );
    }

    const updates: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (tracking_number !== undefined) {
      updates.tracking_number = tracking_number || null;
    }

    if (agent_approval_notes !== undefined) {
      updates.agent_approval_notes = agent_approval_notes || null;
    }

    // If approved, set approval timestamp
    if (status === 'approved_ship' || status === 'approved_pickup') {
      updates.agent_approved_at = new Date().toISOString();
    }

    let updateError;
    if (status === 'cancelled') {
      // Route cancellations through cancel_order so the coupon redemption slot is
      // restored and sub-agent commission is voided.
      const { error } = await supabase.rpc('cancel_order', {
        p_order_id: id,
        p_reason: (typeof agent_approval_notes === 'string' && agent_approval_notes) || 'Cancelled By Admin',
        p_refund_type: 'none',
        p_actor_id: gate.userId,
      });
      updateError = error;
    } else {
      // Optimistic lock: only apply the transition if the status is still the
      // one we validated against. A concurrent cancel/approve on the same order
      // loses this race cleanly (0 rows) instead of overwriting a terminal
      // state (e.g. a stale "mark shipped" clobbering a just-committed cancel).
      const { data: isSuccess, error } = await supabase.rpc('admin_force_update_order', {
        p_order_id: id,
        p_current_status: currentStatus,
        p_status: status,
        p_tracking_number: tracking_number ?? null,
        p_agent_approval_notes: agent_approval_notes ?? null
      });
      updateError = error;
      if (!error && !isSuccess) {
        return NextResponse.json(
          { error: 'Order Status Changed Concurrently. Please Refresh And Retry.' },
          { status: 409 },
        );
      }
    }

    if (updateError) {
      console.error('[admin/orders] POST updateError:', updateError);
      return NextResponse.json({ error: `Database Error: ${updateError.message || JSON.stringify(updateError)}` }, { status: 500 });
    }

    // NOTE: Shipping labels are created MANUALLY (on-demand) only.

    // Credit-line agents: debit their running credit balance for this order's COGS + shipping.
    if (status === 'approved_ship' || status === 'approved_pickup') {
      try {
        await supabase.rpc('charge_order_credit_line', { p_order_id: id, p_created_by: gate.userId });
      } catch (creditErr) {
        // Log so it surfaces in Vercel logs / Sentry — does not block the release
        console.error('[admin/orders] charge_order_credit_line failed for order', id, creditErr);
      }
    }

    // Write audit log entry (awaited).
    try {
      await supabase.from('admin_audit_log').insert({
        actor_id: gate.userId,
        action: 'order_status_updated',
        entity_type: 'order',
        entity_id: id,
        changes: {
          from: currentStatus,
          to: status,
          ...(tracking_number !== undefined ? { tracking_number } : {}),
          ...(agent_approval_notes !== undefined ? { agent_approval_notes } : {}),
        },
      });
    } catch (auditErr) { console.error('[admin/orders] audit log insert failed', id, auditErr); }

    // Order timeline event for every admin-driven transition.
    try {
      await logOrderEvent(supabase, {
        orderId: id,
        event: status === 'cancelled' ? 'cancelled'
          : status === 'shipped' ? 'shipped'
          : status === 'delivered' ? 'delivered'
          : (status === 'approved_ship' || status === 'approved_pickup') ? 'approved'
          : 'status_changed',
        actorId: gate.userId,
        actorRole: 'admin',
        payload: { from: currentStatus, to: status, tracking_number: tracking_number ?? null },
      });
    } catch { /* timeline must not break admin response */ }

    // In-app + push notifications (awaited)
    try {
      const { data: orderRow } = await supabase
        .from('orders')
        .select('buyer_id, agent_id, tracking_number')
        .eq('id', id)
        .maybeSingle();

      if (orderRow?.buyer_id) {
        const short = shortOrderId(id);
        const trk = orderRow.tracking_number || tracking_number || null;
        // Only on a real transition -- re-saving the same status must not
        // re-notify. notify() also queues the buyer web push (prefs-gated),
        // so no separate enqueueOrderPush call is needed.
        if (currentStatus !== status) {
          await notifyAdminOrderStatusChange(supabase, orderRow.buyer_id, id, short, status, trk);
        }

        // The storefront owner was previously never told when an admin moved
        // one of their orders (ship / deliver / cancel). Keep them in the loop
        // on real transitions so their dashboard is never a surprise.
        if (orderRow.agent_id && orderRow.agent_id !== gate.userId && currentStatus !== status
            && ['approved_ship', 'approved_pickup', 'shipped', 'delivered', 'cancelled'].includes(status)) {
          const agentBodies: Record<string, string> = {
            approved_ship: `Order #${short} On Your Store Was Approved For Shipping By Admin.`,
            approved_pickup: `Order #${short} On Your Store Was Approved For Pickup By Admin.`,
            shipped: `Order #${short} On Your Store Was Marked Shipped${trk ? ` (Tracking: ${trk})` : ''}.`,
            delivered: `Order #${short} On Your Store Was Delivered.`,
            cancelled: `Order #${short} On Your Store Was Cancelled By Admin.`,
          };
          await notify(supabase, {
            userId: orderRow.agent_id,
            type: 'system',
            title: `Order #${short} Update`,
            body: agentBodies[status],
            url: '/dashboard?tab=Orders',
          });
        }

        // Buyer email on an admin cancel (previously in-app only).
        if (status === 'cancelled' && currentStatus !== status && emailConfigured()) {
          const { data: buyerProf } = await supabase
            .from('profiles')
            .select('contact_email, email_verified, full_name')
            .eq('id', orderRow.buyer_id)
            .maybeSingle();
          if (buyerProf?.contact_email && buyerProf.email_verified) {
            void sendOrderCancelledEmail({ to: buyerProf.contact_email, fullName: buyerProf.full_name, orderId: id }).catch(() => {});
          }
        }

        // Transactional email for shipped/delivered. Best-effort, non-blocking,
        // only to a verified contact email, and only on an actual transition so
        // re-saving the same status cannot re-send. Never breaks the response.
        if ((status === 'shipped' || status === 'delivered') && currentStatus !== status && emailConfigured()) {
          const { data: buyer } = await supabase
            .from('profiles')
            .select('contact_email, email_verified, full_name')
            .eq('id', orderRow.buyer_id)
            .maybeSingle();
          if (buyer?.contact_email && buyer.email_verified) {
            if (status === 'shipped') {
              void sendOrderShippedEmail({ to: buyer.contact_email, fullName: buyer.full_name, orderId: id, trackingNumber: trk }).catch(() => {});
            } else {
              void sendOrderDeliveredEmail({ to: buyer.contact_email, fullName: buyer.full_name, orderId: id }).catch(() => {});
            }
          }
        }
      }
    } catch { /* notifications must not break admin response */ }

    // Awaited webhook for status transitions admins drive.
    try {
      let webhookEvent: WebhookEventType | null = null;
      if (status === 'approved_ship' || status === 'approved_pickup') webhookEvent = 'order.approved';
      else if (status === 'shipped') webhookEvent = 'order.shipped';
      else if (status === 'delivered') webhookEvent = 'order.delivered';
      else if (status === 'cancelled') webhookEvent = 'order.cancelled';
      // Only dispatch on an actual transition, so a no-op re-save cannot
      // re-fire an order.* webhook to the agent's endpoint.
      if (webhookEvent && currentStatus !== status) {
        const orderPayload = await fetchOrderForWebhook(supabase, id);
        if (orderPayload) {
          await enqueueWebhook(supabase, {
            event: webhookEvent,
            agentId: (orderPayload as { agent_id?: string | null }).agent_id ?? null,
            payload: { order: orderPayload },
            relatedOrderId: id,
          });
        }
      }
    } catch { /* webhook must not break admin response */ }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[admin/orders] POST error:', err);
    return NextResponse.json({ error: `Server Error: ${err instanceof Error ? err.message : 'Unknown'}` }, { status: 500 });
  }
}
