// @ts-nocheck
/**
 * GET /api/cron/fda-drugs-sync
 * Weekly openFDA sync. Refreshes compounds.faers_event_count and writes
 * any new FAERS-derived alerts into compound_recall_alerts.
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';
import { searchFaersAdverseEvents, getApprovalRecords } from '@/lib/research/fda-drugs';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BATCH = 20;
const GAP_MS = 350;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pk = () => new Date().toISOString().slice(0, 10);

export async function GET(req: Request) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;
  const claim = await claimCronRun('fda_drugs_sync', pk());
  if (!claim) return NextResponse.json({ skipped: true, reason: 'already_ran_today' });

  let processed = 0, errored = 0, deferred = 0;
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('compounds')
      .select('slug, display_name, faers_event_count')
      .or('faers_last_synced_at.is.null,faers_last_synced_at.lt.' + new Date(Date.now() - 7 * 86400000).toISOString())
      .limit(BATCH);
    const rows = (data ?? []) as Array<{ slug: string; display_name: string; faers_event_count: number | null }>;
    for (const row of rows) {
      processed += 1;
      const faers = await searchFaersAdverseEvents(row.display_name, 100);
      const approvals = await getApprovalRecords(row.display_name);
      const now = new Date().toISOString();
      const previousCount = row.faers_event_count ?? 0;
      const update: Record<string, unknown> = {
        faers_event_count: faers.total,
        faers_last_synced_at: now,
      };
      if (approvals.length > 0) {
        const earliest = approvals
          .map((a) => a.approval_year)
          .filter((y): y is number => typeof y === 'number')
          .sort()[0];
        if (earliest) update.fda_approval_year = earliest;
      }
      await supabase.from('compounds').update(update).eq('slug', row.slug);

      // Write a recall_alerts row when the FAERS total jumps by 25 or more.
      if (faers.total > 0 && faers.total - previousCount >= 25) {
        const { error } = await supabase.from('compound_recall_alerts').insert({
          compound_slug: row.slug,
          alert_type: 'safety_signal',
          summary: `FAERS Event Count Rose To ${faers.total} (Previous ${previousCount})`,
          url: `https://api.fda.gov/drug/event.json?search=patient.drug.openfda.generic_name:%22${encodeURIComponent(row.display_name)}%22`,
          alert_date: now,
        });
        if (error) errored += 1;
      }
      if (faers.total === 0 && approvals.length === 0) deferred += 1;
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
