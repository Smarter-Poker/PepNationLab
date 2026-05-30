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
import { enqueueOrderPush } from '@/lib/push-enqueue';
import { enqueueWebhook, fetchOrderForWebhook, type WebhookEventType } from '@/lib/webhook-dispatch';

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

  const orderMap = new Map<string, Record<string, unknown>>();
  for (const o of orders || []) orderMap.set(o.id as string, o as Record<string, unknown>);

  const succeeded: string[] = [];
  const failed: Array<{ id: string; reason: string }> = [];
  const labels: Array<{ order_id: string; label_url: string }> = [];
  const jobIds: string[] = [];

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
      const updates: Record<string, string | boolean> = {
        status: target,
        updated_at: new Date().toISOString(),
      };
      if (target === 'approved_ship' || target === 'approved_pickup') {
        (updates as Record<string, string>).agent_approved_at = new Date().toISOString();
      }
      const { error: upErr } = await supabase.from('orders').update(updates).eq('id', id);
      if (upErr) {
        failed.push({ id, reason: upErr.message });
        continue;
      }
      succeeded.push(id);

      // Push notification (fire-and-forget) for bulk transitions.
      try {
        const buyerId = typeof order.buyer_id === 'string' ? order.buyer_id : null;
        const trackingNum = typeof order.tracking_number === 'string' ? order.tracking_number : null;
        if (buyerId) {
          let event: BulkPushEvent | null = null;
          if (target === 'approved_ship' || target === 'approved_pickup') {
            event = 'order_approved';
          } else if (target === 'shipped') {
            event = 'order_shipped';
          } else if (target === 'delivered') {
            event = 'order_delivered';
          }
          if (event) {
            try {
              await enqueueOrderPush(supabase, {
                userId: buyerId,
                orderId: id,
                event,
                tracking: trackingNum,
              });
            } catch { /* push must not block bulk response */ }
          }
        }
      } catch { /* never block bulk response on push */ }

      // Fire-and-forget webhook for bulk admin transitions.
      void (async () => {
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
      })();
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
  // Bulk-insert label_jobs rows instead of calling Shippo synchronously.
  // The label-jobs cron (every 5 min) will drain and process them.
  // Returns job_ids so the UI can poll /api/cron/label-jobs status.
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

    // Idempotent: call the server-side RPC which checks for an existing active job.
    const { data: job, error: enqueueErr } = await supabase
      .rpc('shippo_enqueue_label_job', {
        p_order_id: id,
        p_preferred_service_level: null,
        p_origin_id: null,
      })
      .single();

    if (enqueueErr || !job) {
      failed.push({ id, reason: enqueueErr?.message ?? 'Enqueue Failed.' });
      continue;
    }

    succeeded.push(id);
    jobIds.push((job as { id: string }).id);
  }

  await supabase.from('admin_audit_log').insert({
    actor_id: gate.userId,
    action: 'bulk_generate_labels',
    target_type: 'orders',
    target_id: null,
    details: { order_ids: succeeded, job_ids: jobIds, failed_count: failed.length },
  });

  return NextResponse.json({
    processed: ids.length,
    queued: succeeded.length,
    queued_ids: succeeded,
    job_ids: jobIds,
    failed,
    note: 'Label Jobs Queued. Labels Will Be Generated Within 5 Minutes By The Background Processor.',
  });
}
