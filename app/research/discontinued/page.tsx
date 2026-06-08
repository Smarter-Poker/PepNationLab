/**
 * Discontinued compounds -- WHERE is_discontinued = true.
 * Progressive disclosure: category filter tabs.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllCompounds } from '@/lib/compounds-server';
import { evidenceTier } from '@/lib/compounds';
import BrowseFilterShell from '@/components/research/BrowseFilterShell';

export const metadata: Metadata = {
  title: 'Discontinued Compounds | Research Library | Pep Nation Lab',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

interface DiscontinuedRow {
  slug: string;
  display_name: string;
  evidence_tier: string;
  category: string | null;
  plain_summary: string | null;
  discontinuation_reason: string | null;
  discontinuation_year: number | null;
}

function decadeLabel(year: number | null) {
  if (!year) return 'Year Unknown';
  if (year < 1980) return 'Pre-1980s';
  if (year < 1990) return '1980s';
  if (year < 2000) return '1990s';
  if (year < 2010) return '2000s';
  if (year < 2020) return '2010s';
  return '2020s';
}

function CompoundCard({ c }: { c: DiscontinuedRow }) {
  const t = evidenceTier(c.evidence_tier);
  return (
    <article
      className="glass-panel"
      style={{
        padding: 'var(--space-4, 16px) var(--space-5, 24px)',
        borderRadius: 'var(--radius-lg, 12px)',
        borderLeft: '3px solid var(--red-600, #E53E3E)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-3, 12px)', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
          <Link href={`/research/${c.slug}`} style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--white, #FFFFFF)', textDecoration: 'none' }}>
            {c.display_name}
          </Link>
          <span style={{ fontSize: '0.82rem', color: 'var(--silver, #A8B4C0)' }}>
            {c.category} · <span style={{ color: t.color }}>{t.label}</span>
          </span>
        </div>
        {c.discontinuation_year && (
          <span style={{ fontSize: '0.85rem', color: 'var(--red-600, #E53E3E)', fontWeight: 700, whiteSpace: 'nowrap' }}>
            Discontinued {c.discontinuation_year}
          </span>
        )}
      </div>
      {c.discontinuation_reason && (
        <p style={{ marginTop: 'var(--space-3, 12px)', marginBottom: 0, fontSize: '0.9rem', color: 'var(--silver-light, #D0DAE4)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--white, #FFFFFF)' }}>Reason:</strong> {c.discontinuation_reason}
        </p>
      )}
      {c.plain_summary && (
        <p style={{ marginTop: 'var(--space-2, 8px)', marginBottom: 0, fontSize: '0.85rem', color: 'var(--silver, #A8B4C0)', lineHeight: 1.6 }}>
          {c.plain_summary}
        </p>
      )}
    </article>
  );
}

export default async function ResearchDiscontinuedPage() {
  const all = await getAllCompounds();
  const rows = all
    .filter((c) => ((c as unknown) as { is_discontinued?: boolean }).is_discontinued === true)
    .sort((a, b) => (((b as unknown) as { discontinuation_year?: number }).discontinuation_year ?? 0) - (((a as unknown) as { discontinuation_year?: number }).discontinuation_year ?? 0)) as unknown as DiscontinuedRow[];


  const decadeOrder = ['2020s', '2010s', '2000s', '1990s', '1980s', 'Pre-1980s', 'Year Unknown'];
  const decadeMap = new Map<string, DiscontinuedRow[]>();
  for (const d of decadeOrder) decadeMap.set(d, []);
  for (const r of rows) {
    const d = decadeLabel(r.discontinuation_year);
    if (!decadeMap.has(d)) decadeMap.set(d, []);
    decadeMap.get(d)!.push(r);
  }

  const shellGroups = [
    {
      key: 'all',
      label: 'All Discontinued',
      count: rows.length,
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4, 16px)' }}>
          {rows.map((c) => <CompoundCard key={c.slug} c={c} />)}
        </div>
      ),
    },
    ...decadeOrder
      .filter((d) => (decadeMap.get(d) ?? []).length > 0)
      .map((d) => {
        const items = decadeMap.get(d)!;
        return {
          key: d,
          label: d,
          count: items.length,
          children: (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4, 16px)' }}>
              {items.map((c) => <CompoundCard key={c.slug} c={c} />)}
            </div>
          ),
        };
      }),
  ];

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: 'var(--space-6, 32px) var(--space-4, 16px)' }}>
      <nav style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Link href="/research" style={{ color: 'var(--teal, #00C4BC)', fontSize: '0.9rem', textDecoration: 'none' }}>
          Back To Research Library
        </Link>
      </nav>
      <header style={{ marginBottom: 'var(--space-5, 24px)' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--white, #FFFFFF)', margin: 0 }}>
          Discontinued Compounds
        </h1>
        <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1.05rem', marginTop: 'var(--space-2, 8px)', maxWidth: '760px' }}>
          Compounds Pulled From Development Or Marketed Use. Select A Time Period Below.
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="glass-panel" style={{ padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)', color: 'var(--silver, #A8B4C0)' }}>
          No Discontinued Compounds Currently In The Catalog.
        </div>
      ) : (
        <BrowseFilterShell groups={shellGroups} emptyMessage="No Compounds In This Period." />
      )}
    </div>
  );
}
