import type { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';
import { notify, notifyOrderCancelled } from '@/lib/notify';
import { logOrderEvent } from '@/lib/order-events';
import { shortOrderId } from '@/lib/push-enqueue';
import { recomputeBillingForCancelledOrder } from '@/lib/statement-recompute';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/cron/auto-cancel-stale (daily, 09:30 UTC)
 *
 * Platform rule: an order whose payment was NEVER confirmed does not sit in
 * the queue forever. After AUTO_CANCEL_UNCONFIRMED_DAYS (default 15) with no
 * payment-receipt confirmation, pre-approval orders are auto-CANCELLED via
 * the cancel_order RPC - which keeps the full record (order, items, events)
 * and reverses any credit charge. Nothing is ever hard-deleted: orders feed
 * statements, ledgers, and audit history.
 *
 * Deliberately scoped to PRE-APPROVAL statuses only. An approved order is in
 * (or headed to) fulfillment; yanking it automatically risks cancelling
 * something already being packed. Approved-but-unconfirmed orders keep
 * getting the 12-hour "Did You Receive Payment?" nudges instead.
 */
const CANCELLABLE_STALE_STATUSES = ['pending_customer_payment', 'agent_approval_pending', 'admin_approval_pending'];

export async function GET(req: NextRequest) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  const partitionKey = new Date().toISOString().slice(0, 10);
  const claim = await claimCronRun('auto_cancel_stale', partitionKey);
  if (!claim) {
    return Response.json({ skipped: true, reason: 'already_ran_today' });
  }

  const days = Math.max(1, Number(process.env.AUTO_CANCEL_UNCONFIRMED_DAYS) || 15);
  let cancelled = 0;
  let failures = 0;
  let errorNote: string | null = null;

  try {
    const svc = createAdminClient();
    const cutoffIso = new Date(Date.now() - days * 24 * 3600_000).toISOString();

    const { data: stale, error: staleErr } = await svc
      .from('orders')
      .select('id, buyer_id, agent_id, total, created_at, status')
      .in('status', CANCELLABLE_STALE_STATUSES)
      .is('payment_confirmed_at', null)
      .lt('created_at', cutoffIso)
      .order('created_at', { ascending: true })
      .limit(100);
    if (staleErr) throw new Error(`stale fetch: ${staleErr.message}`);

    const reason = `Auto-Cancelled: No Payment Confirmation After ${days} Days`;

    for (const o of stale ?? []) {
      const { error: cancelErr } = await svc.rpc('cancel_order', {
        p_order_id: o.id,
        p_reason: reason,
        p_refund_type: 'none',
        p_actor_id: null,
      });
      if (cancelErr) {
        failures++;
        console.error('[auto-cancel-stale] cancel_order failed:', o.id, cancelErr.message);
        continue;
      }
      cancelled++;

      // Re-settle any weekly bill this order was already rolled into. Stale
      // sweeps run daily and can easily catch an order from a week that has
      // already been billed.
      await recomputeBillingForCancelledOrder(svc, o.id, null).catch(() => { /* best-effort */ });

      const short = shortOrderId(o.id);
      try {
        await logOrderEvent(svc, {
          orderId: o.id,
          event: 'cancelled',
          actorId: null,
          actorRole: 'system',
          payload: { auto_cancelled: true, days_waited: days, previous_status: o.status },
        });
        if (o.buyer_id) {
          await notifyOrderCancelled(svc, o.buyer_id, o.id, short);
        }
        if (o.agent_id) {
          await notify(svc, {
            userId: o.agent_id,
            type: 'order_cancelled',
            title: `Order #${short} Auto-Cancelled`,
            body: `Order #${short} Sat ${days} Days With No Payment Confirmation And Was Auto-Cancelled. The Buyer Can Reorder Any Time.`,
            url: `/dashboard/agent?tab=Orders&order=${short}`,
          });
        }
      } catch (err) {
        console.error('[auto-cancel-stale] post-cancel notify failed:', o.id, err);
      }
    }
  } catch (err: unknown) {
    errorNote = err instanceof Error ? err.message.slice(0, 300) : 'unknown_error';
  }

  const summary = `cancelled=${cancelled} failures=${failures} days=${days}${errorNote ? ` err=${errorNote}` : ''}`;
  await finishCronRun(claim.id, errorNote ? 'failed' : 'succeeded', summary);

  return Response.json({ ok: !errorNote, cancelled, failures, days, error: errorNote });
}
