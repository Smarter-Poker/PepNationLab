
/**
 * GET /api/cron/broken-link-crawler
 * Weekly external-link probe. Walks compound_references.url with a HEAD
 * request; any 4xx/5xx/non-network result drops a label_change alert.
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';
import { isSsrfTarget } from '@/lib/ssrf-guard';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BATCH = 100;
const GAP_MS = 250;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pk = () => new Date().toISOString().slice(0, 10);

export async function GET(req: Request) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;
  const claim = await claimCronRun('broken_link_crawler', pk());
  if (!claim) return NextResponse.json({ skipped: true, reason: 'already_ran_today' });

  let processed = 0, broken = 0, errored = 0;
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('compound_references')
      .select('id, compound_slug, url, source')
      .not('url', 'is', null)
      .limit(BATCH);
    const rows = (data ?? []) as Array<{ id: string; compound_slug: string; url: string | null; source: string }>;
    const now = new Date().toISOString();
    for (const row of rows) {
      processed += 1;
      if (!row.url) continue;
      let ok = false;
      try {
        // SSRF guard: never probe a reference URL that resolves to an internal
        // host, and never hang on a slow/unresponsive endpoint.
        const host = new URL(row.url).hostname;
        if (await isSsrfTarget(host)) {
          ok = true; // skip internal/unresolvable hosts -- do not probe or alert
        } else {
          const resp = await fetch(row.url, {
            method: 'HEAD',
            redirect: 'follow',
            signal: AbortSignal.timeout(5000),
          });
          ok = resp.status < 400;
        }
      } catch {
        ok = false;
      }
      if (!ok) {
        broken += 1;
        // @ts-expect-error Database schema mismatch from generated types
        const { error } = await supabase.from('compound_recall_alerts').insert({
          compound_slug: row.compound_slug,
          alert_type: 'label_change',
          summary: `Broken External Link (${row.source})`,
          url: row.url,
          alert_date: now,
        });
        if (error) errored += 1;
      }
      await sleep(GAP_MS);
    }
    await finishCronRun(claim.id, 'succeeded', `processed=${processed} broken=${broken} errored=${errored}`);
    return NextResponse.json({ ok: true, processed, broken, errored });
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    await finishCronRun(claim.id, 'failed', m.slice(0, 500));
    return NextResponse.json({ ok: false, error: m }, { status: 500 });
  }
}
