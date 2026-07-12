
/**
 * GET /api/cron/companion-papers-compute
 * Weekly recompute of compound_companion_papers using PMID co-occurrence
 * across compound_pubmed_cache.pmid_list. Naive Jaccard - cheap and
 * defensible at this corpus size.
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const pk = () => new Date().toISOString().slice(0, 10);
const TOP_N = 10;

export async function GET(req: Request) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;
  const claim = await claimCronRun('companion_papers_compute', pk());
  if (!claim) return NextResponse.json({ skipped: true, reason: 'already_ran_today' });

  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('compound_pubmed_cache')
      .select('compound_slug, pmid_list');
    const rows = (data ?? []) as Array<{ compound_slug: string; pmid_list: string[] | null }>;
    const sets: Array<{ slug: string; set: Set<string> }> = rows.map((r) => ({
      slug: r.compound_slug,
      set: new Set((r.pmid_list ?? []).map(String)),
    }));
    let written = 0;
    const now = new Date().toISOString();
    for (const a of sets) {
      if (a.set.size < 3) continue;
      const scored: Array<{ slug: string; jaccard: number; shared: number }> = [];
      for (const b of sets) {
        if (b.slug === a.slug || b.set.size < 3) continue;
        let inter = 0;
        for (const p of a.set) if (b.set.has(p)) inter += 1;
        if (inter === 0) continue;
        const union = a.set.size + b.set.size - inter;
        scored.push({ slug: b.slug, jaccard: inter / union, shared: inter });
      }
      scored.sort((x, y) => y.jaccard - x.jaccard);
      const top = scored.slice(0, TOP_N);
      if (top.length === 0) continue;
      const toUpsert = top.map((t) => ({
        compound_slug: a.slug,
        related_slug: t.slug,
        jaccard: t.jaccard,
        shared_pmid_count: t.shared,
        computed_at: now,
      }));
      const { error } = await supabase
        .from('compound_companion_papers')
        // @ts-expect-error Database schema mismatch from generated types
        .upsert(toUpsert, { onConflict: 'compound_slug,related_slug' });
      if (!error) written += toUpsert.length;
    }
    await finishCronRun(claim.id, 'succeeded', `pairs=${written}`);
    return NextResponse.json({ ok: true, processed: rows.length, written });
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    await finishCronRun(claim.id, 'failed', m.slice(0, 500));
    return NextResponse.json({ ok: false, error: m }, { status: 500 });
  }
}
