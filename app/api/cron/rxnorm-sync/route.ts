
/**
 * GET /api/cron/rxnorm-sync
 * Weekly RxNorm sync. Stashes the RxCUI + NDC count on compounds via a
 * companion JSON column in compound_references (source_type='rxnorm').
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';
import { findRxcuiByName, getNdcByRxcui } from '@/lib/research/rxnorm';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BATCH = 20;
const GAP_MS = 300;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pk = () => new Date().toISOString().slice(0, 10);

export async function GET(req: Request) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;
  const claim = await claimCronRun('rxnorm_sync', pk());
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
      const rx = await findRxcuiByName(row.display_name);
      if (!rx) { deferred += 1; await sleep(GAP_MS); continue; }
      const ndcs = await getNdcByRxcui(rx.rxcui);
      const { error } = await supabase
        .from('compound_references')
        // @ts-expect-error Database schema mismatch from generated types
        .upsert({
          compound_slug: row.slug,
          source_type: 'rxnorm',
          external_id: rx.rxcui,
          title: `RxNorm ${rx.rxcui} (${rx.name})`,
          url: `https://mor.nlm.nih.gov/RxNav/search?searchBy=RXCUI&searchTerm=${rx.rxcui}`,
          metadata: { ndc_count: ndcs.length, ndcs: ndcs.slice(0, 25).map((n) => n.ndc) },
          added_at: now,
        }, { onConflict: 'compound_slug,source_type,external_id' });
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
