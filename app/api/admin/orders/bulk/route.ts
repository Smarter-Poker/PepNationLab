import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import {
  canTransition,
  bulkActionToStatus,
  type BulkAction,
  type OrderStatus,
} from '@/lib/order-states';
import { enqueueOrderPush, shortOrderId } from '@/lib/push-enqueue';
import { enqueueWebhook, fetchOrderForWebhook, type WebhookEventType } from '@/lib/webhook-dispatch';
import { notifyAdminOrderStatusChange, notifyOrderShipped } from '@/lib/notify';
import { withIdempotency, readIdempotencyKey } from '@/lib/idempotency';
import { purchaseLabelForOrder } from '@/lib/shippo';

// Labels are purchased synchronously from Shippo in this request (manual, on
// admin click) - never via a background cron - so allow extra wall-clock time.
export const maxDuration = 60;

type BulkPushEvent = 'order_approved' | 'order_shipped' | 'order_delivered';

interface BulkBody {
  ids?: unknown;
  action?: unknown;
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
  const supabase = await createServiceClient();

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
          p_reason: 'Bulk admin cancellation',
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
        const { error } = await supabase.from('orders').update(updates).eq('id', id);
        upErr = error ? { message: error.message } : null;
      }
      if (upErr) {
        failed.push({ id, reason: upErr.message });
        continue;
      }
      succeeded.push(id);

      // In-app + push notifications (awaited) for bulk transitions.
      try {
        const buyerId = typeof order.buyer_id === 'string' ? order.buyer_id : null;
        const trackingNum = typeof order.tracking_number === 'string' ? order.tracking_number : null;
        if (buyerId) {
          const short = shortOrderId(id);
          // In-app notification - shows in bell immediately via Realtime
          await notifyAdminOrderStatusChange(supabase, buyerId, id, short, target, trackingNum);
          // Web push
          let event: BulkPushEvent | null = null;
          if (target === 'approved_ship' || target === 'approved_pickup') event = 'order_approved';
          else if (target === 'shipped') event = 'order_shipped';
          else if (target === 'delivered') event = 'order_delivered';
          if (event) {
            await enqueueOrderPush(supabase, { userId: buyerId, orderId: id, event, tracking: trackingNum });
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
  // bought from Shippo synchronously and its URL returned in this response.
  // Capped per request so the synchronous Shippo calls stay within the
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

    // Purchase the label NOW (manual, synchronous) via the platform Shippo
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
        await enqueueOrderPush(supabase, { userId: buyerId, orderId: id, event: 'order_shipped', tracking: result.trackingNumber });
      }
    } catch { /* notifications must not block the label response */ }

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
