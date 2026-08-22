import { NextResponse } from 'next/server';
import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/cron/analytics-retention
 *
 * Daily purge of aged first-party telemetry via the purge_analytics_data()
 * SECURITY DEFINER function (migration 20260711300000_analytics_hardening.sql):
 *   - agent_storefront_events older than 90 days
 *   - web_vitals older than 30 days
 *   - client_error_events older than 90 days
 *   - faq_clicks and missed_searches older than 180 days
 *   - search_queries older than 365 days
 *
 * These windows are the retention periods disclosed in the privacy policy;
 * without this sweep every telemetry table grows unbounded and the 30d
 * rollup views scan ever-larger tables.
 *
 * Auth: Vercel cron Authorization: Bearer ${CRON_SECRET}.
 * Schedule: vercel.json - daily at 03:15 UTC (low-traffic window).
 */
export async function GET(req: Request) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  const startedAt = new Date();
  const partitionKey = startedAt.toISOString().slice(0, 10);
  const claim = await claimCronRun('analytics-retention', partitionKey);
  if (!claim) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'already_ran_today' });
  }

  const admin = createAdminClient();
  try {
    const { data, error } = await admin.rpc('purge_analytics_data');
    if (error) throw new Error(error.message);

    const purged: Record<string, number> = {};
    for (const row of (data ?? []) as Array<{ purged_table: string; deleted_rows: number }>) {
      purged[row.purged_table] = Number(row.deleted_rows) || 0;
    }

    await finishCronRun(claim.id, 'succeeded', JSON.stringify(purged));
    return NextResponse.json({ ok: true, purged });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[cron/analytics-retention] failed:', message);
    await finishCronRun(claim.id, 'failed', message.slice(0, 500));
    return NextResponse.json({ ok: false, error: 'Purge Failed' }, { status: 500 });
  }
}
