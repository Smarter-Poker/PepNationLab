/**
 * GET /api/cron/dailymed-sync
 * Weekly DailyMed sync. Updates compounds.dailymed_setid and writes a
 * provenance row to compound_references for each new SPL setid.
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';
import { searchSpl } from '@/lib/research/dailymed';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BATCH = 20;
const GAP_MS = 350;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pk = () => new Date().toISOString().slice(0, 10);

export async function GET(req: Request) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;
  const claim = await claimCronRun('dailymed_sync', pk());
  if (!claim) return NextResponse.json({ skipped: true, reason: 'already_ran_today' });

  let processed = 0, errored = 0, deferred = 0;
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('compounds')
      .select('slug, display_name, dailymed_setid, dailymed_last_synced_at')
      .or('dailymed_last_synced_at.is.null,dailymed_last_synced_at.lt.' + new Date(Date.now() - 7 * 86400000).toISOString())
      .limit(BATCH);
    const rows = (data ?? []) as Array<{ slug: string; display_name: string; dailymed_setid: string | null }>;
    for (const row of rows) {
      processed += 1;
      const hits = await searchSpl(row.display_name);
      const now = new Date().toISOString();
      if (hits.length === 0) {
        deferred += 1;
        await supabase.from('compounds').update({ dailymed_last_synced_at: now }).eq('slug', row.slug);
        await sleep(GAP_MS);
        continue;
      }
      const newSetid = hits[0].setid;
      const update: Record<string, unknown> = { dailymed_last_synced_at: now };
      if (newSetid && newSetid !== row.dailymed_setid) update.dailymed_setid = newSetid;
      await supabase.from('compounds').update(update).eq('slug', row.slug);

      // Add or refresh the label-source reference row.
      const { error } = await supabase.from('compound_references').upsert({
        compound_slug: row.slug,
        source_type: 'fda_label',
        external_id: newSetid,
        title: hits[0].title ?? `DailyMed SPL ${newSetid}`,
        url: `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${newSetid}`,
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
