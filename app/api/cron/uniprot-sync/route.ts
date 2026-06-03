/**
 * GET /api/cron/uniprot-sync
 * Weekly UniProt sync. Batched to 20 compounds, 350ms inter-request gap.
 * Writes orthologs to compound_orthologs and refreshes receptors[].
 */
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';
import { searchByName, getOrthologs } from '@/lib/research/uniprot';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BATCH = 20;
const GAP_MS = 400;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pk = () => new Date().toISOString().slice(0, 10);

export async function GET(req: Request) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;
  const claim = await claimCronRun('uniprot_sync', pk());
  if (!claim) return NextResponse.json({ skipped: true, reason: 'already_ran_today' });

  let processed = 0, errored = 0, deferred = 0;
  try {
    const supabase = await createServiceClient();
    const { data } = await supabase
      .from('compounds')
      .select('slug, display_name')
      .or('uniprot_last_synced_at.is.null,uniprot_last_synced_at.lt.' + new Date(Date.now() - 7 * 86400000).toISOString())
      .limit(BATCH);
    const rows = (data ?? []) as Array<{ slug: string; display_name: string }>;
    for (const row of rows) {
      processed += 1;
      const hits = await searchByName(row.display_name);
      if (hits.length === 0) { deferred += 1; await sleep(GAP_MS); continue; }
      const primary = hits[0];
      const orthologs = await getOrthologs(primary.primaryAccession);
      const now = new Date().toISOString();
      if (orthologs.length > 0) {
        const toInsert = orthologs.map((o) => ({
          compound_slug: row.slug,
          uniprot_id: o.uniprot_id,
          organism: o.organism,
          taxon_id: o.taxon_id,
          sequence_identity: o.sequence_identity,
          notes: o.notes,
          fetched_at: now,
        }));
        const { error } = await supabase
          .from('compound_orthologs')
          .upsert(toInsert, { onConflict: 'compound_slug,uniprot_id' });
        if (error) errored += 1;
      }
      await supabase
        .from('compounds')
        .update({ uniprot_last_synced_at: now })
        .eq('slug', row.slug);
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
