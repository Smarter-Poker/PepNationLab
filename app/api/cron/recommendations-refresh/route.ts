import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';

/**
 * GET /api/cron/recommendations-refresh
 *
 * Daily refresh of the two recommendation materialized views:
 *   - product_copurchase_pairs
 *   - product_popular_60d
 *
 * Auth: CRON_SECRET bearer (assertCronAuth, constant-time compare).
 * Idempotency: cron_runs partition keyed to the UTC date — replays inside
 * the same day short-circuit instead of refreshing again.
 *
 * Strategy: try the CONCURRENTLY refresh wrapper first; if it fails (which
 * happens on the very first run because there is no prior data to diff
 * against), fall back to refresh_recommendation_views_plain which does
 * non-concurrent REFRESH MATERIALIZED VIEW. After the first successful
 * plain refresh, future concurrent refreshes will succeed.
 *
 * Scheduled by vercel.json at "0 4 * * *" (04:00 UTC daily).
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  const partition = new Date().toISOString().slice(0, 10);
  const claim = await claimCronRun('recommendations_refresh', partition);
  if (!claim) {
    // Already ran today — short-circuit cleanly.
    return NextResponse.json({ ok: true, skipped: true, reason: 'already_ran_today' });
  }

  const supabase = await createServiceClient();
  let mode: 'concurrent' | 'plain' | 'none' = 'none';
  let lastError: string | null = null;

  // Try concurrent refresh first.
  const { error: concurrentErr } = await supabase.rpc('refresh_recommendation_views');
  if (!concurrentErr) {
    mode = 'concurrent';
  } else {
    lastError = concurrentErr.message;
    // Fall back to plain (non-concurrent) refresh.
    const { error: plainErr } = await supabase.rpc(
      'refresh_recommendation_views_plain'
    );
    if (!plainErr) {
      mode = 'plain';
      lastError = null;
    } else {
      lastError = `${lastError}; plain: ${plainErr.message}`;
    }
  }

  if (mode === 'none') {
    await finishCronRun(claim.id, 'failed', lastError ?? 'unknown');
    return NextResponse.json(
      { ok: false, error: lastError ?? 'unknown' },
      { status: 500 }
    );
  }

  await finishCronRun(claim.id, 'succeeded', `refreshed mode=${mode}`);
  return NextResponse.json({ ok: true, mode, partition });
}
