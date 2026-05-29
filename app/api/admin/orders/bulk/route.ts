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
import { purchaseLabelForOrder } from '@/lib/shippo';
import { enqueueOrderSms, shortOrderId, type OrderSmsEvent } from '@/lib/sms-enqueue';
import { enqueueOrderPush } from '@/lib/push-enqueue';

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
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((x): x is string => typeof x === 'string' && x.length > 0)
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

  const supabase = await createServiceClient();

  const { data: orders, error: ordersErr } = await supabase
    .from('orders')
    .select('id, status, agent_id, fulfillment_method, label_url, buyer_id, tracking_number')
    .in('id', ids);

  if (ordersErr) {
    return NextResponse.json({ error: ordersErr.message }, { status: 500 });
  }

  const orderMap = new Map<string, any>();
  for (const o of orders || []) orderMap.set(o.id, o);

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
      const updates: Record<string, any> = {
        status: target,
        updated_at: new Date().toISOString(),
      };
      if (target === 'approved_ship' || target === 'approved_pickup') {
        updates.agent_approved_at = new Date().toISOString();
      }
      const { error: upErr } = await supabase.from('orders').update(updates).eq('id', id);
      if (upErr) {
        failed.push({ id, reason: upErr.message });
        continue;
      }
      succeeded.push(id);

      // SMS notification (fire-and-forget) for bulk transitions.
      try {
        if (order.buyer_id) {
          const short = shortOrderId(id);
          let event: OrderSmsEvent | null = null;
          let body = '';
          if (target === 'approved_ship' || target === 'approved_pickup') {
            event = 'order_approved';
            body = `Your Order #${short} Has Been Approved. Get Ready For Shipping.`;
          } else if (target === 'shipped') {
            event = 'order_shipped';
            body = order.tracking_number
              ? `Your Order #${short} Shipped. Tracking: ${order.tracking_number}`
              : `Your Order #${short} Shipped.`;
          } else if (target === 'delivered') {
            event = 'order_delivered';
            body = `Your Order #${short} Has Been Delivered. Thank You.`;
          }
          if (event && body) {
            await enqueueOrderSms(supabase, {
              userId: order.buyer_id,
              orderId: id,
              event,
              body,
            });
            try {
              await enqueueOrderPush(supabase, {
                userId: order.buyer_id,
                orderId: id,
                event,
                tracking: order.tracking_number ?? null,
              });
            } catch { /* push must not block bulk response */ }
          }
        }
      } catch { /* never block bulk response on SMS */ }
    }

    return NextResponse.json({
      processed: ids.length,
      succeeded: succeeded.length,
      succeeded_ids: succeeded,
      failed,
      labels,
    });
  }

  // ---- generate_labels ---------------------------------------------------
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
    if (order.fulfillment_method !== 'ship') {
      failed.push({ id, reason: 'Order Is Not A Shipping Order.' });
      continue;
    }

    const { data: ap } = await supabase
      .from('agent_profiles')
      .select('shippo_api_key')
      .eq('id', order.agent_id)
      .maybeSingle();
    if (!ap?.shippo_api_key) {
      failed.push({ id, reason: 'Agent Has No Shippo API Key Configured.' });
      continue;
    }

    const result = await purchaseLabelForOrder(supabase, {
      orderId: id,
      agentId: order.agent_id,
    });
    if (!result.ok) {
      failed.push({ id, reason: result.error });
      continue;
    }
    succeeded.push(id);
    labels.push({ order_id: id, label_url: result.labelUrl });
  }

  return NextResponse.json({
    processed: ids.length,
    succeeded: succeeded.length,
    succeeded_ids: succeeded,
    failed,
    labels,
  });
}
