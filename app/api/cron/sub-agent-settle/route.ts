import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';
import { createAdminClient } from '@/lib/supabase/server';
import { chicagoMidnightIso, previousCompletedWeekStartCst } from '@/lib/time-cst';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/cron/sub-agent-settle
 *
 * SACA Phase 7: Weekly sub-agent commission settlement cron.
 *
 * Schedule (vercel.json): 49 5 * * 1  (Monday 05:49 UTC = Sunday 23:49 CST /
 * Monday 00:49 CDT in America/Chicago), 10 min before the invoices cron at
 * 59 5 * * 1 so commission settles before the weekly invoice math runs.
 *
 * The billing week is the just-COMPLETED America/Chicago week, computed with
 * the SAME DST-safe helpers the invoices cron uses (previousCompletedWeekStartCst
 * + chicagoMidnightIso). This matters: the cron fires early Monday in UTC, so
 * the old "current Monday 00:00 UTC" math resolved to the week that had just
 * STARTED (empty), leaving the completed week's ledger rows outside
 * [week_start, week_end) so they never settled. Anchoring to the previous
 * completed Chicago week fixes that and keeps settlement aligned with the
 * invoice it precedes.
 *
 * For each sub-agent with at least one pending ledger row inside the
 * window, the SECDEF RPC settle_sub_agent_week handles the rest:
 *   - sums eligible pending rows where the linked order has reached
 *     approved_ship+ (cancelled or pending_customer_payment orders are
 *     excluded, so commission only settles on confirmed sales)
 *   - creates one sub_agent_settlements row (UNIQUE on
 *     sub_agent_id+week_start makes the cron safely re-runnable)
 *   - marks the ledger rows settled with the new settlement_id
 *   - credits sub-agent's prepaid_balance by the total
 *   - writes balance_transactions + admin_audit_log rows
 */
function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  // Settle the just-COMPLETED America/Chicago billing week, matching the
  // invoices cron so commission settles for exactly the week being invoiced
  // 10 minutes later. weekStartDate is a Chicago Monday (YYYY-MM-DD); the
  // window boundaries are Chicago-midnight timestamptz, DST-safe.
  const now = new Date();
  const weekStartDate = previousCompletedWeekStartCst(now);
  const weekStartIso = chicagoMidnightIso(weekStartDate);
  const weekEndIso = chicagoMidnightIso(addDays(weekStartDate, 7));

  // Outer idempotency gate: prevent double-settlement if cron fires twice.
  // The settle_sub_agent_week RPC also has UNIQUE(sub_agent_id, week_start)
  // as defense-in-depth, but this outer claim is the primary dedup layer.
  const partitionKey = weekStartDate;
  const claim = await claimCronRun('sub_agent_settle', partitionKey);
  if (!claim) {
    return NextResponse.json({ skipped: true, reason: 'already_ran_this_week', week_start: weekStartIso });
  }

  const admin = createAdminClient();
  let processed = 0;
  let settled = 0;
  let skipped = 0;
  const errors: { sub_agent_id: string; error: string }[] = [];
  let finishStatus: 'succeeded' | 'failed' = 'succeeded';

  try {
    // Pull distinct sub-agent ids with pending ledger rows in the window.
    // We do this in a single query and then iterate so each RPC call gets
    // its own row-level locks via FOR UPDATE inside the RPC.
    const { data: pendingRows, error: fetchErr } = await admin
      .from('sub_agent_commission_ledger')
      .select('sub_agent_id')
      .eq('status', 'pending')
      // No lower bound on accrued_at: settle_sub_agent_week deliberately sweeps
      // every pending row with accrued_at < week_end (catch-up), so a commission
      // accrued in a prior week but only approved now is still settled. Bounding
      // the fetch to [weekStart, weekEnd) defeated that sweep.
      .lt('accrued_at', weekEndIso);

    if (fetchErr) {
      console.error('[sub-agent-settle] fetch error:', fetchErr.message);
      return NextResponse.json(
        { ok: false, error: 'Failed To Fetch Pending Ledger Rows.', week_start: weekStartIso, week_end: weekEndIso },
        { status: 500 },
      );
    }

    const subAgentIds = Array.from(new Set((pendingRows ?? []).map((r) => r.sub_agent_id as string)));

    for (const subAgentId of subAgentIds) {
      processed += 1;
      try {
        const { data: settlementId, error: settleErr } = await admin.rpc('settle_sub_agent_week', {
          p_sub_agent_id: subAgentId,
          p_week_start: weekStartIso,
          p_week_end: weekEndIso,
        });

        if (settleErr) {
          errors.push({ sub_agent_id: subAgentId, error: settleErr.message.slice(0, 300) });
          continue;
        }

        if (settlementId) {
          settled += 1;
        } else {
          // RPC returned NULL - either nothing eligible (all rows had orders
          // still in pending_customer_payment) or already settled this slot.
          skipped += 1;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message.slice(0, 300) : 'unknown';
        errors.push({ sub_agent_id: subAgentId, error: msg });
      }
    }

    if (errors.length > 0) finishStatus = 'failed';
  } catch (err) {
    finishStatus = 'failed';
    const msg = err instanceof Error ? err.message : 'unknown_error';
    console.error('[sub-agent-settle] unexpected:', err);
    await finishCronRun(claim.id, 'failed', msg.slice(0, 500));
    return NextResponse.json(
      {
        ok: false,
        error: 'Internal Server Error.',
        detail: msg.slice(0, 200),
        week_start: weekStartIso,
        week_end: weekEndIso,
      },
      { status: 500 },
    );
  }

  const summary = `processed=${processed} settled=${settled} skipped=${skipped} errors=${errors.length}`;
  await finishCronRun(claim.id, finishStatus, summary.slice(0, 500));
  return NextResponse.json({
    ok: errors.length === 0,
    processed,
    settled,
    skipped,
    error_count: errors.length,
    errors: errors.slice(0, 20), // cap in case of bulk failure
    week_start: weekStartIso,
    week_end: weekEndIso,
  });
}
