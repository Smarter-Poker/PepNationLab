/**
 * /research/most-cited -- compounds ranked by pubmed_citation_count DESC. The
 * citation count is populated by the daily PubMed cron the backend agent
 * shipped, so on first render counts may be zero until the cron has run.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllCompounds } from '@/lib/compounds-server';
import { evidenceTier } from '@/lib/compounds';
import GlobalSearchBar from '@/components/research/GlobalSearchBar';
import BrowseSurfaceNav from '@/components/research/BrowseSurfaceNav';

export const metadata: Metadata = {
  title: 'Most Cited Compounds | Research Library | Pep Nation Lab',
  robots: { index: false, follow: false },
};

interface Cited {
  slug: string;
  display_name: string;
  evidence_tier: string;
  category: string | null;
  count: number;
  plain_summary: string | null;
}

export default async function MostCitedPage() {
  const all = await getAllCompounds();
  const enriched: Cited[] = all.map((c) => ({
    slug: c.slug,
    display_name: c.display_name,
    evidence_tier: c.evidence_tier,
    category: c.category,
    count: ((c as unknown as { pubmed_citation_count?: number | null }).pubmed_citation_count ?? 0) as number,
    plain_summary: c.plain_summary,
  }));
  enriched.sort((a, b) => b.count - a.count || a.display_name.localeCompare(b.display_name));

  const hasAnyCounts = enriched.some((r) => r.count > 0);

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '32px 16px 64px' }}>
      <nav style={{ marginBottom: 16 }}>
        <Link href="/research" style={{ color: '#00C4BC', fontSize: 13, textDecoration: 'none' }}>
          Back To Research Library
        </Link>
      </nav>
      <header style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 32, fontWeight: 900, color: '#FFFFFF', margin: 0 }}>
          Most Cited Compounds
        </h1>
        <p style={{ color: '#A8B4C0', fontSize: 16, marginTop: 8, maxWidth: 760 }}>
          Ranked By Live PubMed Citation Count. The Daily Enrichment Cron Refreshes Counts
          Automatically. New Compounds Begin At Zero Until The Cron Has Indexed Them.
        </p>
      </header>

      <div style={{ marginBottom: 20 }}>
        <GlobalSearchBar compact />
      </div>

      {!hasAnyCounts && (
        <div className="card-glass" style={{ padding: 16, borderRadius: 12, color: '#A8B4C0', marginBottom: 16, fontSize: 14 }}>
          Citation Counts Will Populate Within Twenty-Four Hours Of The PubMed Cron Run. The List
          Below Is Sorted Alphabetically Until Then.
        </div>
      )}

      <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
        {enriched.map((r, i) => {
          const t = evidenceTier(r.evidence_tier);
          return (
            <li key={r.slug}>
              <Link
                href={`/research/${r.slug}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '12px 16px',
                  borderRadius: 12,
                  background: 'rgba(15,25,35,0.55)',
                  border: '1px solid rgba(168,180,192,0.18)',
                  textDecoration: 'none',
                  color: '#FFFFFF',
                }}
              >
                <span style={{ fontSize: 13, color: '#A8B4C0', width: 32, textAlign: 'right' }}>#{i + 1}</span>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 16, fontWeight: 700 }}>{r.display_name}</span>
                  {r.plain_summary && (
                    <span style={{ fontSize: 12, color: '#A8B4C0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.plain_summary}
                    </span>
                  )}
                </span>
                <span style={{
                  fontSize: 10, color: t.color, border: `1px solid ${t.color}`,
                  padding: '2px 8px', borderRadius: 999, fontWeight: 700,
                }}>{t.label}</span>
                <span style={{ fontSize: 14, color: '#00C4BC', fontWeight: 800, minWidth: 64, textAlign: 'right' }}>
                  {r.count.toLocaleString()} Cited
                </span>
              </Link>
            </li>
          );
        })}
      </ol>

      <div style={{ marginTop: 24 }}>
        <BrowseSurfaceNav />
      </div>
    </div>
  );
}
