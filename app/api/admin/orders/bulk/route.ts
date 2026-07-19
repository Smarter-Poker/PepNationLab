import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import {
  canTransition,
  bulkActionToStatus,
  type BulkAction,
  type OrderStatus,
} from '@/lib/order-states';
import { shortOrderId } from '@/lib/push-enqueue';
import { enqueueWebhook, fetchOrderForWebhook, type WebhookEventType } from '@/lib/webhook-dispatch';
import { notifyAdminOrderStatusChange, notifyOrderShipped } from '@/lib/notify';
import { withIdempotency, readIdempotencyKey } from '@/lib/idempotency';
import { purchaseLabelForOrder } from '@/lib/shipping';
import { emailConfigured, sendOrderShippedEmail, sendOrderDeliveredEmail, sendOrderCancelledEmail } from '@/lib/email';
import { logOrderEvent } from '@/lib/order-events';

// Labels are purchased synchronously from EasyPost in this request (manual, on
// admin click) - never via a background cron - so allow extra wall-clock time.
export const maxDuration = 60;

interface BulkBody {
  ids?: unknown;
  action?: unknown;
  reason?: unknown;
}

const VALID_ACTIONS: BulkAction[] = [
  'approve_ship',
  'approve_pickup',
  'mark_shipped',
  'mark_delivered',
  'cancel',
  'generate_labels',
];

export async function POST(req: NextRequest) {
  const csrfFail = assertSameOrigin(req);
  if (csrfFail) return csrfFail;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const body = (await req.json().catch(() => ({}))) as BulkBody;
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((x): x is string => typeof x === 'string' && UUID_REGEX.test(x))
    : [];
  const action = body.action as BulkAction;
  const bulkReason =
    typeof body.reason === 'string' && body.reason.trim()
      ? body.reason.trim().slice(0, 300)
      : 'Bulk admin cancellation';

  if (ids.length === 0) {
    return NextResponse.json({ error: 'At Least One Order ID Is Required.' }, { status: 400 });
  }
  if (!VALID_ACTIONS.includes(action)) {
    return NextResponse.json({ error: 'Invalid Action.' }, { status: 400 });
  }
  if (ids.length > 200) {
    return NextResponse.json({ error: 'Too Many Orders In One Request (Max 200).' }, { status: 400 });
  }

  return withIdempotency({
    userId: gate.userId,
    route: '/api/admin/orders/bulk',
    key: readIdempotencyKey(req),
    request: { ids, action },
    handler: async () => {
  const supabase = createAdminClient();

  const { data: orders, error: ordersErr } = await supabase
    .from('orders')
    .select('id, status, agent_id, fulfillment_method, label_url, buyer_id, tracking_number')
    .in('id', ids);

  if (ordersErr) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }

  const orderMap = new Map<string, Record<string, unknown>>();
  for (const o of orders || []) orderMap.set(o.id as string, o as Record<string, unknown>);

  const succeeded: string[] = [];
  const failed: Array<{ id: string; reason: string }> = [];
  const labels: Array<{ order_id: string; label_url: string }> = [];

  if (action !== 'generate_labels') {
    const target = bulkActionToStatus(action);
    if (!target) {
      return NextResponse.json({ error: 'Invalid Action.' }, { status: 400 });
    }

    for (const id of ids) {
      const order = orderMap.get(id);
      if (!order) {
        failed.push({ id, reason: 'Order Not Found.' });
        continue;
      }
      const current = order.status as OrderStatus;
      if (!canTransition(current, target, 'admin')) {
        failed.push({ id, reason: `Cannot Move From ${current} To ${target}.` });
        continue;
      }
      let upErr: { message: string } | null = null;
      if (target === 'cancelled') {
        // Mirror the single-order cancel route: route through cancel_order so
        // agent commissions are voided and reserved inventory is released. A
        // plain status UPDATE (the old behavior) left commission rows pending
        // and local stock reserved on every bulk-cancelled order.
        const { error } = await supabase.rpc('cancel_order', {
          p_order_id: id,
          p_reason: bulkReason,
          p_refund_type: 'none',
          p_actor_id: gate.userId,
        });
        upErr = error ? { message: error.message } : null;
      } else {
        const updates: Record<string, string | boolean> = {
          status: target,
          updated_at: new Date().toISOString(),
        };
        if (target === 'approved_ship' || target === 'approved_pickup') {
          (updates as Record<string, string>).agent_approved_at = new Date().toISOString();
        }
        // Optimistic lock: condition on the status we validated so a concurrent
        // transition on the same order fails this row cleanly instead of
        // overwriting it (mirrors the single-order route).
        const { data: updatedRows, error } = await supabase
          .from('orders')
          .update(updates)
          .eq('id', id)
          .eq('status', current)
          .select('id');
        upErr = error ? { message: error.message } : null;
        if (!error && (!updatedRows || updatedRows.length === 0)) {
          failed.push({ id, reason: 'Order Status Changed Concurrently.' });
          continue;
        }
      }
      if (upErr) {
        failed.push({ id, reason: 'An Unexpected Error Occurred While Updating This Order.' });
        continue;
      }
      succeeded.push(id);

      // Order timeline event for every bulk-driven transition.
      try {
        await logOrderEvent(supabase, {
          orderId: id,
          event: target === 'cancelled' ? 'cancelled'
            : target === 'shipped' ? 'shipped'
            : target === 'delivered' ? 'delivered'
            : 'approved',
          actorId: gate.userId ?? undefined,
          actorRole: 'admin',
          payload: { from: current, to: target, bulk: true },
        });
      } catch { /* timeline must not break the bulk response */ }

      // Credit-line agents: debit their running credit balance for this order's
      // COGS + shipping on approval. The single-order route does this (see
      // app/api/admin/orders/route.ts approve branch); the bulk path previously
      // skipped it, so any order approved via the bulk action never consumed the
      // agent's credit headroom - a path-dependent under-billing / revenue leak.
      // charge_order_credit_line is idempotent (skips if a charge row exists).
      if (target === 'approved_ship' || target === 'approved_pickup') {
        try {
          await supabase.rpc('charge_order_credit_line', { p_order_id: id, p_created_by: gate.userId });
        } catch { /* credit-line ledger must not break the bulk release */ }
      }

      // In-app + push notifications (awaited) for bulk transitions.
      try {
        const buyerId = typeof order.buyer_id === 'string' ? order.buyer_id : null;
        const trackingNum = typeof order.tracking_number === 'string' ? order.tracking_number : null;
        if (buyerId) {
          const short = shortOrderId(id);
          // In-app notification - shows in bell immediately via Realtime
          await notifyAdminOrderStatusChange(supabase, buyerId, id, short, target, trackingNum);
          // Transactional email for shipped/delivered/cancelled. Best-effort,
          // non-blocking, verified email only. canTransition already blocks
          // no-op transitions, and current !== target is asserted again so no
          // duplicate sends.
          if ((target === 'shipped' || target === 'delivered' || target === 'cancelled') && current !== target && emailConfigured()) {
            const { data: buyer } = await supabase
              .from('profiles')
              .select('contact_email, email_verified, full_name')
              .eq('id', buyerId)
              .maybeSingle();
            if (buyer?.contact_email && buyer.email_verified) {
              if (target === 'shipped') {
                void sendOrderShippedEmail({ to: buyer.contact_email, fullName: buyer.full_name, orderId: id, trackingNumber: trackingNum }).catch(() => {});
              } else if (target === 'delivered') {
                void sendOrderDeliveredEmail({ to: buyer.contact_email, fullName: buyer.full_name, orderId: id }).catch(() => {});
              } else {
                void sendOrderCancelledEmail({ to: buyer.contact_email, fullName: buyer.full_name, orderId: id }).catch(() => {});
              }
            }
          }
        }
      } catch { /* notifications must not block bulk response */ }

      // Awaited webhook for bulk admin transitions.
      try {
        let webhookEvent: WebhookEventType | null = null;
        if (target === 'approved_ship' || target === 'approved_pickup') webhookEvent = 'order.approved';
        else if (target === 'shipped') webhookEvent = 'order.shipped';
        else if (target === 'delivered') webhookEvent = 'order.delivered';
        else if (target === 'cancelled') webhookEvent = 'order.cancelled';
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
      } catch { /* webhook must not break bulk response */ }
    }

    // Audit every bulk status change (mirrors the generate_labels audit path).
    if (succeeded.length > 0) {
      try {
        await supabase.from('admin_audit_log').insert({
          actor_id: gate.userId,
          action: 'bulk_order_status_change',
          entity_type: 'orders',
          entity_id: succeeded.join(','),
          changes: {
            target_status: target,
            count: succeeded.length,
            order_ids: succeeded,
            ...(target === 'cancelled' ? { reason: bulkReason } : {}),
          },
        });
      } catch { /* audit failures must not block response */ }
    }

    return NextResponse.json({
      processed: ids.length,
      succeeded: succeeded.length,
      succeeded_ids: succeeded,
      failed,
      labels,
    });
  }

  // ---- generate_labels (SYNCHRONOUS / MANUAL) ----------------------------
  // Labels are purchased on-demand right here, the moment the admin clicks
  // "Generate Labels" - never queued for a background cron. Each label is
  // bought from EasyPost synchronously and its URL returned in this response.
  // Capped per request so the synchronous EasyPost calls stay within the
  // function timeout; the admin runs another batch for more.
  if (ids.length > 30) {
    return NextResponse.json(
      { error: 'Generate Labels In Batches Of 30 Or Fewer.' },
      { status: 400 },
    );
  }

  for (const id of ids) {
    const order = orderMap.get(id);
    if (!order) {
      failed.push({ id, reason: 'Order Not Found.' });
      continue;
    }
    if (order.label_url) {
      failed.push({ id, reason: 'Label Already Exists.' });
      continue;
    }
    if (!order.agent_id) {
      failed.push({ id, reason: 'Order Has No Assigned Agent.' });
      continue;
    }
    if ((order.fulfillment_method as string) !== 'ship') {
      failed.push({ id, reason: 'Order Is Not A Shipping Order.' });
      continue;
    }
    // Never buy postage for an order that is not approved for shipping. Without
    // this, a mixed batch that included a cancelled or unpaid order would spend
    // real money on a label AND fire a bogus "shipped" push to that buyer.
    const labelStatus = order.status as OrderStatus;
    if (!(['approved_ship', 'in_fulfillment', 'shipped'] as OrderStatus[]).includes(labelStatus)) {
      failed.push({ id, reason: 'Order Is Not Approved For Shipping.' });
      continue;
    }

    // Purchase the label NOW (manual, synchronous) via the platform EasyPost
    // account. purchaseLabelForOrder is idempotent per order_id, so a repeat
    // click returns the existing label instead of double-buying.
    const result = await purchaseLabelForOrder(supabase, {
      orderId: id,
      agentId: order.agent_id as string,
      preferredServiceLevel: null,
    });

    if (!result.ok) {
      failed.push({ id, reason: result.error });
      continue;
    }

    succeeded.push(id);
    labels.push({ order_id: id, label_url: result.labelUrl });

    // Buyer notifications + order.shipped webhook (mirrors the single-order
    // manual purchase route). Never block the label response.
    try {
      const buyerId = typeof order.buyer_id === 'string' ? order.buyer_id : null;
      if (buyerId) {
        await notifyOrderShipped(supabase, buyerId, id, shortOrderId(id), result.trackingNumber ?? undefined);
      }
    } catch { /* notifications must not block the label response */ }

    try {
      await logOrderEvent(supabase, {
        orderId: id,
        event: 'shipped',
        actorRole: 'admin',
        payload: { tracking_number: result.trackingNumber ?? null, via: 'bulk_label_purchase' },
      });
    } catch { /* timeline must not block the label response */ }

    try {
      const orderPayload = await fetchOrderForWebhook(supabase, id);
      if (orderPayload) {
        await enqueueWebhook(supabase, {
          event: 'order.shipped',
          agentId: (orderPayload as { agent_id?: string | null }).agent_id ?? null,
          payload: { order: orderPayload },
          relatedOrderId: id,
        });
      }
    } catch { /* webhook must not block the label response */ }
  }

  await supabase.from('admin_audit_log').insert({
    actor_id: gate.userId,
    action: 'bulk_generate_labels',
    entity_type: 'orders',
    entity_id: null,
    changes: { order_ids: succeeded, failed_count: failed.length },
  });

  return NextResponse.json({
    processed: ids.length,
    succeeded: succeeded.length,
    succeeded_ids: succeeded,
    labels,
    failed,
  });
    },
  });
}
