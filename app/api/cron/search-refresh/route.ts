/**
 * GET /api/cron/search-refresh
 *
 * Authenticated via CRON_SECRET (constant-time compare). Refreshes the
 * compound_search materialized view concurrently so the search index
 * stays fresh after a catalog edit, alias change, or evidence-tier
 * update.
 */

import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  // Partition by hour so a re-trigger within the same scheduling window
  // short-circuits cleanly rather than hammering the materialized view refresh.
  const partitionKey = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
  const claim = await claimCronRun('search_refresh', partitionKey);
  if (!claim) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'already_ran_this_hour' });
  }

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.rpc('refresh_compound_search');
    if (error) {
      await finishCronRun(claim.id, 'failed', error.message.slice(0, 500));
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 },
      );
    }
    const refreshedAt = new Date().toISOString();
    await finishCronRun(claim.id, 'succeeded', `refreshed at ${refreshedAt}`);
    // The search view only refreshes after catalog/alias/tier edits, so expire
    // the shared 'compounds' Data Cache tag too - the cached readers in
    // lib/compounds-server.ts should reflect those same edits immediately
    // instead of waiting out the 1-hour TTL. Next 16 form: { expire: 0 }.
    try {
      revalidateTag('compounds', { expire: 0 });
    } catch { /* best-effort cache refresh */ }
    return NextResponse.json({ ok: true, refreshedAt });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await finishCronRun(claim.id, 'failed', message.slice(0, 500));
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
