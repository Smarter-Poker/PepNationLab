export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireOrdersAccess } from '@/lib/admin-auth';
import { canTransition, type OrderStatus } from '@/lib/order-states';
import { enqueueOrderPush, shortOrderId } from '@/lib/push-enqueue';
import { enqueueWebhook, fetchOrderForWebhook, type WebhookEventType } from '@/lib/webhook-dispatch';
import { assertSameOrigin } from '@/lib/csrf';
import { notifyAdminOrderStatusChange } from '@/lib/notify';

type OrderPushEvent = 'order_approved' | 'order_shipped' | 'order_delivered';

// GET: List all orders with buyer profile join
export async function GET(req: NextRequest) {
  const gate = await requireOrdersAccess();
  if (!gate.ok) return gate.response;

  const supabase = await createServiceClient();
  const searchParams = req.nextUrl.searchParams;
  const status = searchParams.get('status');
  const query = searchParams.get('query');

  let dbQuery = supabase
    .from('orders')
    .select('*, profiles!orders_buyer_id_fkey(full_name, email, phone)');

  if (status) {
    dbQuery = dbQuery.eq('status', status);
  }

  // Sort by created_at desc. Safety-valve cap against an unbounded full-table
  // fetch (search/filter below run in memory over the returned rows).
  dbQuery = dbQuery.order('created_at', { ascending: false }).limit(5000);

  const { data, error } = await dbQuery;

  if (error) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }

  interface OrderRow {
    id: string;
    agent_id: string | null;
    status: string;
    profiles: {
      full_name: string | null;
      email: string;
      phone: string | null;
    } | null;
  }

  const typedData = (data as unknown) as OrderRow[] | null;

  // Filter out pending_customer_payment and agent_approval_pending orders that belong to an external agent.
  // The Admin should only see them if they are direct (agent_id is null) or if the Admin is the agent.
  let filteredData = (typedData || []).filter((order) => {
    if (order.status === 'pending_customer_payment' || order.status === 'agent_approval_pending') {
      if (order.agent_id && order.agent_id !== gate.userId) {
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

  return NextResponse.json({ data: filteredData });
}

// POST: Process / Update an order state
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireOrdersAccess();
  if (!gate.ok) return gate.response;

  const supabase = await createServiceClient();
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

  // Fetch the current status so we can validate the transition.
  const { data: existingOrder, error: fetchErr } = await supabase
    .from('orders')
    .select('status')
    .eq('id', id)
    .single();

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

  const { error: updateError } = await supabase
    .from('orders')
    .update(updates)
    .eq('id', id);

  if (updateError) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }

  // Admin released the order to shipping — enqueue the Shippo label job now.
  // This is deferred from agent approval (the agent now parks orders at
  // admin_approval_pending) so labels are only ever created AFTER the admin
  // gate, never for an order an agent approved but an admin has not released.
  if (status === 'approved_ship') {
    try {
      await supabase.rpc('shippo_enqueue_label_job', { p_order_id: id });
    } catch { /* label enqueue must not break the admin response */ }
  }

  // Credit-line agents: debit their running credit balance (credit_used) for this
  // order's COGS + shipping now that an admin has released it to fulfillment.
  // No-op for prepaid agents (already debited at agent approval) and idempotent
  // per order, so re-releasing or double-calls never double-charge.
  if (status === 'approved_ship' || status === 'approved_pickup') {
    try {
      await supabase.rpc('charge_order_credit_line', { p_order_id: id, p_created_by: gate.userId });
    } catch { /* credit-line ledger must not break the release */ }
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
  } catch { /* ignore audit failure */ }

  // In-app + push notifications (awaited)
  try {
    const { data: orderRow } = await supabase
      .from('orders')
      .select('buyer_id, tracking_number')
      .eq('id', id)
      .maybeSingle();

    if (orderRow?.buyer_id) {
      const short = shortOrderId(id);
      const trk = orderRow.tracking_number || tracking_number || null;
      // In-app notification — writes to notifications table → shows in bell immediately
      await notifyAdminOrderStatusChange(supabase, orderRow.buyer_id, id, short, status, trk);

      // Web push for supported statuses
      let event: OrderPushEvent | null = null;
      if (status === 'approved_ship' || status === 'approved_pickup') event = 'order_approved';
      else if (status === 'shipped') event = 'order_shipped';
      else if (status === 'delivered') event = 'order_delivered';
      if (event) {
        await enqueueOrderPush(supabase, { userId: orderRow.buyer_id, orderId: id, event, tracking: trk });
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
    if (webhookEvent) {
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
}
