/**
 * GET /api/cron/shippo-reconcile
 *
 * Weekly reconciliation cron (runs Sunday 22:00 UTC per vercel.json).
 *
 * For each agent with label purchases in the trailing 7-day window,
 * compares:
 *   SUM(shipping_label_purchases.agent_charged_cents)  — what we paid Shippo
 *   SUM(orders.shipping_cost * 100)                    — what we charged customers
 *
 * A variance > 5% OR > $50 triggers an admin_audit_log entry flagged as
 * 'shippo_reconcile_variance' so staff can investigate.
 *
 * Dedup: hourly partition key (cron fires once a week, so this effectively
 * means "don't re-run within 60 minutes of a previous successful run").
 */

import type { NextRequest } from 'next/server';
import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const VARIANCE_PCT_THRESHOLD = 0.05; // 5%
const VARIANCE_CENTS_THRESHOLD = 5000; // $50

function hourPartitionKey(d: Date = new Date()): string {
  return d.toISOString().slice(0, 13);
}

export async function GET(req: NextRequest) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  const partitionKey = hourPartitionKey();
  const claim = await claimCronRun('shippo_reconcile', partitionKey);
  if (!claim) {
    return Response.json({ skipped: true, reason: 'already_ran_this_hour' });
  }

  let agentsChecked = 0;
  let variancesFound = 0;
  let errorNote: string | null = null;

  try {
    const supabase = await createServiceClient();
    const windowStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Get all label purchases in the window, grouped by agent.
    const { data: purchases, error: pErr } = await supabase
      .from('shipping_label_purchases')
      .select('agent_id, agent_charged_cents, order_id')
      .gte('created_at', windowStart)
      .eq('refunded', false);

    if (pErr) {
      errorNote = `fetch_purchases_failed: ${pErr.message}`.slice(0, 300);
    } else {
      // Group by agent_id.
      const byAgent = new Map<string, { chargedCents: number; orderIds: Set<string> }>();
      for (const row of (purchases ?? [])) {
        const agentId = String(row.agent_id || 'platform');
        const existing = byAgent.get(agentId) ?? { chargedCents: 0, orderIds: new Set() };
        existing.chargedCents += Number(row.agent_charged_cents) || 0;
        if (row.order_id) existing.orderIds.add(String(row.order_id));
        byAgent.set(agentId, existing);
      }

      for (const [agentId, { chargedCents, orderIds }] of byAgent) {
        agentsChecked++;

        // Sum what was charged to customers (orders.shipping_cost) for those orders.
        const orderIdList = Array.from(orderIds);
        let customerChargedCents = 0;

        if (orderIdList.length > 0) {
          const { data: orders } = await supabase
            .from('orders')
            .select('shipping_cost')
            .in('id', orderIdList);

          for (const o of (orders ?? [])) {
            customerChargedCents += Math.round(Number(o.shipping_cost || 0) * 100);
          }
        }

        // Calculate variance.
        const varianceCents = Math.abs(chargedCents - customerChargedCents);
        const baseForPct = Math.max(chargedCents, customerChargedCents, 1);
        const variancePct = varianceCents / baseForPct;

        if (variancePct > VARIANCE_PCT_THRESHOLD || varianceCents > VARIANCE_CENTS_THRESHOLD) {
          variancesFound++;

          await supabase.from('admin_audit_log').insert({
            actor_id: null,
            action: 'shippo_reconcile_variance',
            entity_type: 'agent_profiles',
            entity_id: agentId === 'platform' ? null : agentId,
            changes: {
              window_start: windowStart,
              agent_id: agentId,
              paid_to_shippo_cents: chargedCents,
              charged_to_customers_cents: customerChargedCents,
              variance_cents: varianceCents,
              variance_pct: (variancePct * 100).toFixed(2) + '%',
              order_count: orderIdList.length,
              threshold_pct: (VARIANCE_PCT_THRESHOLD * 100) + '%',
              threshold_cents: VARIANCE_CENTS_THRESHOLD,
            },
          });
        }
      }
    }
  } catch (err: unknown) {
    errorNote = err instanceof Error ? err.message.slice(0, 300) : 'unknown_error';
  }

  const summary = `agents_checked=${agentsChecked} variances_found=${variancesFound}${errorNote ? ` err=${errorNote}` : ''}`;
  await finishCronRun(claim.id, errorNote ? 'failed' : 'succeeded', summary);

  return Response.json({
    ok: !errorNote,
    agentsChecked,
    variancesFound,
    partitionKey,
    error: errorNote,
  });
}
