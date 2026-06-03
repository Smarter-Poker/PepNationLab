/**
 * GET /api/cron/wada-archive-sync
 * Monthly WADA archive sync. Walks the curated per-year PDF list and
 * adds a reference row when a new year drops or an URL changes. Never
 * mutates compounds.wada_status (that is admin-curated).
 */
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';
import { listArchive, probeReachable } from '@/lib/research/wada-archive';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const GAP_MS = 500;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pk = () => new Date().toISOString().slice(0, 7); // YYYY-MM (monthly)

export async function GET(req: Request) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;
  const claim = await claimCronRun('wada_archive_sync', pk());
  if (!claim) return NextResponse.json({ skipped: true, reason: 'already_ran_this_month' });

  let processed = 0, errored = 0, deferred = 0;
  try {
    const supabase = await createServiceClient();
    const entries = await listArchive();
    const now = new Date().toISOString();
    const { data } = await supabase
      .from('compounds')
      .select('slug')
      .in('wada_status', ['prohibited_in_competition', 'prohibited_at_all_times']);
    const slugs = ((data ?? []) as Array<{ slug: string }>).map((r) => r.slug);
    for (const entry of entries) {
      processed += 1;
      const reachable = await probeReachable(entry.peptide_section_url);
      if (!reachable) { deferred += 1; await sleep(GAP_MS); continue; }
      // Stamp a per-year archive row on every WADA-prohibited compound.
      const refs = slugs.map((slug) => ({
        compound_slug: slug,
        source_type: 'wada_archive',
        external_id: String(entry.year),
        title: `WADA Prohibited List ${entry.year}`,
        url: entry.peptide_section_url,
        added_at: now,
      }));
      if (refs.length > 0) {
        const { error } = await supabase
          .from('compound_references')
          .upsert(refs, { onConflict: 'compound_slug,source_type,external_id' });
        if (error) errored += 1;
      }
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
