/**
 * GET /api/cron/pubmed-sync
 *
 * Weekly NCBI E-utilities sync. Walks compounds whose evidence has not
 * been refreshed in 7 days, queries PubMed for the display_name + alias
 * list, caches the PMID set in compound_pubmed_cache, and updates the
 * citation counter + sync timestamp on the compounds row.
 *
 * Batched to 20 compounds per invocation with a 350ms inter-request
 * gap so we stay under the public E-utils rate ceiling (3 req/sec).
 * The cron schedule is Mon 03:00 UTC (see vercel.json).
 */

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';
import { esearch } from '@/lib/research/pubmed';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BATCH_SIZE = 20;
const INTER_REQUEST_MS = 350;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildTerm(displayName: string, aliases: string[] | null): string {
  const parts = [displayName, ...(aliases ?? [])]
    .map((s) => (s || '').trim())
    .filter((s) => s.length >= 3)
    .slice(0, 6)
    .map((s) => `"${s.replace(/"/g, '')}"`);
  return parts.length > 0 ? `(${parts.join(' OR ')})` : `"${displayName}"`;
}

function partitionKey(): string {
  const d = new Date();
  // YYYY-MM-DD in UTC.
  return d.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  const claim = await claimCronRun('pubmed_sync', partitionKey());
  if (!claim) {
    return NextResponse.json({ skipped: true, reason: 'already_ran_today' });
  }

  let processed = 0;
  let updated = 0;
  let failed = 0;

  try {
    const supabase = await createServiceClient();
    const cutoff = new Date(Date.now() - SEVEN_DAYS_MS).toISOString();

    const { data: stale } = await supabase
      .from('compounds')
      .select('slug, display_name, aliases, last_evidence_synced_at')
      .or(`last_evidence_synced_at.is.null,last_evidence_synced_at.lt.${cutoff}`)
      .limit(BATCH_SIZE);

    const rows = (stale ?? []) as Array<{
      slug: string;
      display_name: string;
      aliases: string[] | null;
      last_evidence_synced_at: string | null;
    }>;

    for (const row of rows) {
      processed += 1;
      const term = buildTerm(row.display_name, row.aliases);
      const result = await esearch(term, { retmax: 50, sort: 'pub_date' });
      if (!result) {
        failed += 1;
      } else {
        const nowIso = new Date().toISOString();
        // Cache the PMID set.
        await supabase
          .from('compound_pubmed_cache')
          .upsert(
            {
              compound_slug: row.slug,
              query: term,
              pmid_list: result.pmids,
              total_count: result.total,
              fetched_at: nowIso,
              raw_response: result.raw,
            },
            { onConflict: 'compound_slug,query' },
          );
        // Update the compounds row counters.
        await supabase
          .from('compounds')
          .update({
            pubmed_citation_count: result.total,
            last_evidence_synced_at: nowIso,
          })
          .eq('slug', row.slug);
        updated += 1;
      }
      await sleep(INTER_REQUEST_MS);
    }

    await finishCronRun(
      claim.id,
      'succeeded',
      `processed=${processed} updated=${updated} failed=${failed}`,
    );

    return NextResponse.json({
      ok: true,
      processed,
      updated,
      failed,
      ranAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await finishCronRun(claim.id, 'failed', message.slice(0, 500));
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
