
/**
 * GET /api/cron/retraction-watch
 * Weekly retraction sweep. Walks the cached PMIDs in
 * compound_pubmed_cache and writes a recall alert when a PMID is now
 * marked Retracted Publication.
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';
import { checkPmidForRetraction } from '@/lib/research/retraction-watch';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const BATCH = 20;
const PMIDS_PER_COMPOUND = 10;
const GAP_MS = 350;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pk = () => new Date().toISOString().slice(0, 10);

export async function GET(req: Request) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;
  const claim = await claimCronRun('retraction_watch', pk());
  if (!claim) return NextResponse.json({ skipped: true, reason: 'already_ran_today' });

  let processed = 0, errored = 0, deferred = 0, retracted = 0;
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('compound_pubmed_cache')
      .select('compound_slug, pmid_list')
      .order('fetched_at', { ascending: true })
      .limit(BATCH);
    const rows = (data ?? []) as Array<{ compound_slug: string; pmid_list: string[] | null }>;
    const now = new Date().toISOString();
    for (const row of rows) {
      processed += 1;
      const pmids = (row.pmid_list ?? []).slice(0, PMIDS_PER_COMPOUND);
      if (pmids.length === 0) { deferred += 1; continue; }
      for (const pmid of pmids) {
        const status = await checkPmidForRetraction(pmid);
        if (status.retracted) {
          retracted += 1;
          // @ts-expect-error Database schema mismatch from generated types
          const { error } = await supabase.from('compound_recall_alerts').insert({
            compound_slug: row.compound_slug,
            alert_type: 'retraction',
            summary: `PubMed PMID ${pmid} Has Been Retracted`,
            url: status.notice_url ?? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
            alert_date: status.retraction_date ?? now,
          });
          if (error) errored += 1;
        }
        await sleep(GAP_MS);
      }
    }
    await finishCronRun(claim.id, 'succeeded', `processed=${processed} retracted=${retracted} errored=${errored}`);
    return NextResponse.json({ ok: true, processed, errored, deferred, retracted });
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    await finishCronRun(claim.id, 'failed', m.slice(0, 500));
    return NextResponse.json({ ok: false, error: m }, { status: 500 });
  }
}
