
/**
 * GET /api/cron/biorxiv-watch
 * Daily bioRxiv + medRxiv watch. Surfaces brand-new preprints (last 7
 * days) and writes them as compound_references with source_type='preprint'.
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';
import { searchPreprints } from '@/lib/research/biorxiv';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BATCH = 20;
const GAP_MS = 350;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pk = () => new Date().toISOString().slice(0, 10);

export async function GET(req: Request) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;
  const claim = await claimCronRun('biorxiv_watch', pk());
  if (!claim) return NextResponse.json({ skipped: true, reason: 'already_ran_today' });

  let processed = 0, errored = 0, deferred = 0;
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('compounds')
      .select('slug, display_name')
      .limit(BATCH);
    const rows = (data ?? []) as Array<{ slug: string; display_name: string }>;
    const now = new Date().toISOString();
    for (const row of rows) {
      processed += 1;
      const hits = await searchPreprints(row.display_name, 7);
      if (hits.length === 0) { deferred += 1; await sleep(GAP_MS); continue; }
      const refs = hits.map((h) => ({
        compound_slug: row.slug,
        source_type: 'preprint',
        external_id: h.doi,
        title: h.title,
        url: `https://doi.org/${h.doi}`,
        published_date: h.posted_date || null,
        metadata: { server: h.server, authors: h.authors },
        added_at: now,
      }));
      const { error } = await supabase
        .from('compound_references')
        //  Database schema mismatch from generated types
        .upsert(refs, { onConflict: 'compound_slug,source_type,external_id' });
      if (error) errored += 1;
      await sleep(GAP_MS);
    }
    await finishCronRun(claim.id, 'succeeded', `processed=${processed} errored=${errored} deferred=${deferred}`);
    return NextResponse.json({ ok: true, processed, errored, deferred });
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    await finishCronRun(claim.id, 'failed', m.slice(0, 500));
    return NextResponse.json({ ok: false, error: m }, { status: 500 });
  }
}
