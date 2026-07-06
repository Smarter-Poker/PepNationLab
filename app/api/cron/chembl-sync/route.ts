/**
 * GET /api/cron/chembl-sync
 * Weekly ChEMBL sync. Writes binding-affinity rows to
 * compound_chembl_bindings (target_chembl_id, pchembl_value, etc).
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';
import { searchMolecule, getActivities } from '@/lib/research/chembl';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BATCH = 20;
const GAP_MS = 350;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pk = () => new Date().toISOString().slice(0, 10);

export async function GET(req: Request) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;
  const claim = await claimCronRun('chembl_sync', pk());
  if (!claim) return NextResponse.json({ skipped: true, reason: 'already_ran_today' });

  let processed = 0, errored = 0, deferred = 0;
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('compounds')
      .select('slug, display_name')
      .or('chembl_last_synced_at.is.null,chembl_last_synced_at.lt.' + new Date(Date.now() - 7 * 86400000).toISOString())
      .limit(BATCH);
    const rows = (data ?? []) as Array<{ slug: string; display_name: string }>;
    for (const row of rows) {
      processed += 1;
      const mols = await searchMolecule(row.display_name);
      if (mols.length === 0) { deferred += 1; await sleep(GAP_MS); continue; }
      const acts = await getActivities(mols[0].molecule_chembl_id);
      const now = new Date().toISOString();
      if (acts.length > 0) {
        const toInsert = acts.map((a) => ({
          compound_slug: row.slug,
          activity_id: a.activity_id,
          target_chembl_id: a.target_chembl_id,
          // Write the target's preferred name into the existing `target_name`
          // column that the by-target page and lib/compounds-server read.
          target_name: a.target_pref_name,
          target_organism: a.target_organism,
          standard_type: a.standard_type,
          standard_value: a.standard_value,
          standard_units: a.standard_units,
          pchembl_value: a.pchembl_value,
          document_chembl_id: a.document_chembl_id,
          assay_type: a.assay_type,
          fetched_at: now,
        }));
        const { error } = await supabase
          .from('compound_chembl_bindings')
          .upsert(toInsert, { onConflict: 'compound_slug,activity_id' });
        if (error) errored += 1;
      }
      await supabase
        .from('compounds')
        .update({ chembl_last_synced_at: now })
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
