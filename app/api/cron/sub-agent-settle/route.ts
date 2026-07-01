import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/cron/sub-agent-settle
 *
 * SACA Phase 7: Weekly sub-agent commission settlement cron.
 *
 * Schedule (vercel.json): 50 23 * * 0  (Sundays 23:50 UTC, 10 min before
 * the existing invoices cron at 23:59 Sunday so commission settles before
 * the weekly invoice math runs).
 *
 * The week window is the ISO week boundary in UTC:
 *   week_start = current Monday 00:00:00 UTC
 *   week_end   = week_start + 7 days
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
export async function GET(req: NextRequest) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  // Compute the current ISO week window in UTC. JS getUTCDay() returns 0..6
  // where 0 = Sunday. ISO week starts Monday, so subtract days accordingly.
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0=Sun, 1=Mon, ... 6=Sat
  const daysSinceMonday = (dayOfWeek + 6) % 7; // 0=Mon -> 0, 1=Tue -> 1, ... 0=Sun -> 6
  const weekStart = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysSinceMonday,
    0, 0, 0, 0
  ));
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Outer idempotency gate: prevent double-settlement if cron fires twice.
  // The settle_sub_agent_week RPC also has UNIQUE(sub_agent_id, week_start)
  // as defense-in-depth, but this outer claim is the primary dedup layer.
  const partitionKey = `${weekStart.toISOString().slice(0, 10)}`;
  const claim = await claimCronRun('sub_agent_settle', partitionKey);
  if (!claim) {
    return NextResponse.json({ skipped: true, reason: 'already_ran_this_week', week_start: weekStart.toISOString() });
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
      .gte('accrued_at', weekStart.toISOString())
      .lt('accrued_at', weekEnd.toISOString());

    if (fetchErr) {
      console.error('[sub-agent-settle] fetch error:', fetchErr.message);
      return NextResponse.json(
        { ok: false, error: 'Failed To Fetch Pending Ledger Rows.', week_start: weekStart.toISOString(), week_end: weekEnd.toISOString() },
        { status: 500 },
      );
    }

    const subAgentIds = Array.from(new Set((pendingRows ?? []).map((r) => r.sub_agent_id as string)));

    for (const subAgentId of subAgentIds) {
      processed += 1;
      try {
        const { data: settlementId, error: settleErr } = await admin.rpc('settle_sub_agent_week', {
          p_sub_agent_id: subAgentId,
          p_week_start: weekStart.toISOString(),
          p_week_end: weekEnd.toISOString(),
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
        week_start: weekStart.toISOString(),
        week_end: weekEnd.toISOString(),
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
    week_start: weekStart.toISOString(),
    week_end: weekEnd.toISOString(),
  });
}
