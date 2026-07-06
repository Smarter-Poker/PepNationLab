/**
 * GET /api/cron/patents-sync
 * Monthly Google Patents search. Writes patent hits to
 * compound_references with source_type='patent'.
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';
import { searchPatents } from '@/lib/research/google-patents';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BATCH = 20;
const GAP_MS = 500;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pk = () => new Date().toISOString().slice(0, 7);

export async function GET(req: Request) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;
  const claim = await claimCronRun('patents_sync', pk());
  if (!claim) return NextResponse.json({ skipped: true, reason: 'already_ran_this_month' });

  let processed = 0, errored = 0, deferred = 0;
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('compounds')
      .select('slug, display_name')
      .limit(BATCH);
    const rows = (data ?? []) as Array<{ slug: string; display_name: string }>;
    for (const row of rows) {
      processed += 1;
      const hits = await searchPatents(row.display_name);
      if (hits.length === 0) { deferred += 1; await sleep(GAP_MS); continue; }
      const now = new Date().toISOString();
      const refs = hits.map((h) => ({
        compound_slug: row.slug,
        source_type: 'patent',
        external_id: h.patent_number,
        title: h.title ?? h.patent_number,
        url: h.url,
        published_date: h.publication_date,
        added_at: now,
      }));
      const { error } = await supabase
        .from('compound_references')
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
