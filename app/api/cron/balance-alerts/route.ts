import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';
import { notifyAccountAlert } from '@/lib/notify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const THROTTLE_HOURS = 24;
const UTILIZATION_THRESHOLD = 0.8;
const PREPAID_THRESHOLD = 500;

export async function GET(req: Request) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  const now = new Date();
  const partitionKey = now.toISOString().slice(0, 10); // YYYY-MM-DD

  const claim = await claimCronRun('balance_alerts', partitionKey);
  if (!claim) {
    return NextResponse.json({ skipped: true, reason: 'already_ran' });
  }

  let alertsWritten = 0;
  let finishStatus: 'succeeded' | 'failed' = 'succeeded';
  let finishNotes: string | undefined;

  try {
    const service = await createServiceClient();
    const throttleCutoff = new Date(now.getTime() - THROTTLE_HOURS * 60 * 60 * 1000).toISOString();

    // Find agents who might need an alert.
    // 1. Credit account: we need to check their unbilled + unfulfilled orders vs credit limit.
    // 2. Prepaid account: we check prepaid_balance.
    // We only alert if last_balance_alert_at is null or older than THROTTLE_HOURS.
    const { data: eligibleProfiles, error: fetchErr } = await service
      .from('profiles')
      .select('id, full_name, account_type, credit_limit, prepaid_balance, last_balance_alert_at')
      .in('account_type', ['credit', 'prepaid'])
      .eq('is_active', true)
      .or(`last_balance_alert_at.is.null,last_balance_alert_at.lt.${throttleCutoff}`);

    if (fetchErr) {
      throw fetchErr;
    }

    const profiles = eligibleProfiles ?? [];

    for (const p of profiles) {
      let needsAlert = false;
      let title = '';
      let body = '';

      if (p.account_type === 'credit' && p.credit_limit) {
        // Compute current utilization
        const { data: orders, error: ordersErr } = await service
          .from('orders')
          .select('id, total, status')
          .eq('agent_id', p.id);

        if (ordersErr) {
          console.error(`Failed to fetch orders for ${p.id}:`, ordersErr);
          continue;
        }

        // An order is "invoiced" once it is attached to a weekly statement
        // (statement_orders). orders has no is_invoiced column.
        const orderIds = (orders ?? []).map((o) => o.id);
        const invoicedSet = new Set<string>();
        if (orderIds.length > 0) {
          const { data: stmtRows } = await service
            .from('statement_orders')
            .select('order_id')
            .in('order_id', orderIds);
          for (const r of (stmtRows ?? []) as Array<{ order_id: string }>) {
            invoicedSet.add(r.order_id);
          }
        }

        let currentUnbilled = 0;
        let inFlight = 0;

        for (const o of orders ?? []) {
          if (o.status === 'cancelled') continue;
          const total = Number(o.total) || 0;
          if (['delivered', 'shipped', 'approved_ship', 'approved_pickup'].includes(o.status)) {
            if (!invoicedSet.has(o.id)) {
              currentUnbilled += total;
            }
          } else {
            inFlight += total;
          }
        }

        const utilized = currentUnbilled + inFlight;
        const limit = Number(p.credit_limit);
        if (limit > 0 && utilized / limit >= UTILIZATION_THRESHOLD) {
          needsAlert = true;
          const pct = Math.round((utilized / limit) * 100);
          title = 'High Credit Utilization';
          body = `Your account is at ${pct}% of its credit limit ($${utilized.toFixed(2)} / $${limit.toFixed(2)}). Please make a payment soon to avoid order interruptions.`;
        }
      } else if (p.account_type === 'prepaid') {
        const bal = Number(p.prepaid_balance) || 0;
        if (bal < PREPAID_THRESHOLD) {
          needsAlert = true;
          title = 'Low Prepaid Balance';
          body = `Your prepaid balance is running low ($${bal.toFixed(2)}). Please recharge to ensure orders continue processing.`;
        }
      }

      if (needsAlert) {
        await notifyAccountAlert(service, p.id, title, body);
        
        // Update last_balance_alert_at
        await service
          .from('profiles')
          .update({ last_balance_alert_at: new Date().toISOString() })
          .eq('id', p.id);

        alertsWritten++;
      }
    }
  } catch (err) {
    finishStatus = 'failed';
    finishNotes = err instanceof Error ? err.message.slice(0, 500) : 'unknown';
  } finally {
    await finishCronRun(claim.id, finishStatus, finishNotes);
  }

  return NextResponse.json({
    status: finishStatus,
    alertsWritten,
    notes: finishNotes,
  });
}
