/**
 * Historical timeline — every compound plotted by decade.
 * Server component wraps BrowseFilterShell for progressive disclosure.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllCompounds } from '@/lib/compounds-server';
import { evidenceTier } from '@/lib/compounds';
import BrowseFilterShell from '@/components/research/BrowseFilterShell';

export const metadata: Metadata = {
  title: 'Historical Timeline | Research Library | Pep Nation Lab',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const ORDER = [
  '1960s',
  '1970s',
  '1980s',
  '1990s',
  '2000s',
  '2010s',
  '2020s',
  'Era Unknown',
];

function decadeOf(year: number): string {
  if (year < 1960) return '1960s'; // early; group with 60s
  if (year < 1970) return '1960s';
  if (year < 1980) return '1970s';
  if (year < 1990) return '1980s';
  if (year < 2000) return '1990s';
  if (year < 2010) return '2000s';
  if (year < 2020) return '2010s';
  return '2020s';
}

export default async function ResearchTimelinePage() {
  const all = await getAllCompounds();

  type C = (typeof all)[0] & {
    year_discovered?: number | null;
    year_first_human_trial?: number | null;
  };

  const buckets = new Map<string, C[]>();
  for (const decade of ORDER) buckets.set(decade, []);

  for (const c of all as C[]) {
    const year = c.year_discovered ?? c.year_first_human_trial ?? null;
    const key = year ? decadeOf(year) : 'Era Unknown';
    buckets.get(key)!.push(c);
  }

  const shellGroups = ORDER.filter((d) => (buckets.get(d) ?? []).length > 0).map((decade) => {
    const items = buckets.get(decade)!;
    return {
      key: decade,
      label: decade,
      count: items.length,
      children: (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 'var(--space-3, 12px)' }}>
          {items.map((c) => {
            const t = evidenceTier(c.evidence_tier);
            const yr = c.year_discovered ?? c.year_first_human_trial ?? null;
            return (
              <Link
                key={c.slug}
                href={`/research/${c.slug}`}
                className="glass-panel"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-1, 4px)',
                  padding: 'var(--space-3, 12px) var(--space-4, 16px)',
                  borderRadius: 'var(--radius-lg, 12px)',
                  textDecoration: 'none',
                  color: 'var(--white, #FFFFFF)',
                }}
              >
                <span style={{ fontSize: '0.7rem', color: t.color, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
                  {t.label}
                </span>
                <span style={{ fontSize: '1rem', fontWeight: 700 }}>{c.display_name}</span>
                {yr && <span style={{ fontSize: '0.75rem', color: 'var(--silver, #A8B4C0)' }}>Year {yr}</span>}
                {c.category && <span style={{ fontSize: '0.72rem', color: 'var(--teal, #00C4BC)' }}>{c.category}</span>}
              </Link>
            );
          })}
        </div>
      ),
    };
  });

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: 'var(--space-6, 32px) var(--space-4, 16px)' }}>
      <nav style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Link href="/research" style={{ color: 'var(--teal, #00C4BC)', fontSize: '0.9rem', textDecoration: 'none' }}>
          Back To Research Library
        </Link>
      </nav>
      <header style={{ marginBottom: 'var(--space-5, 24px)' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--white, #FFFFFF)', margin: 0 }}>
          Historical Timeline
        </h1>
        <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1.05rem', marginTop: 'var(--space-2, 8px)', maxWidth: '760px' }}>
          Every Compound Plotted By Decade Of Discovery Or First Human Trial. Select A Decade Below.
        </p>
      </header>

      <BrowseFilterShell groups={shellGroups} emptyMessage="No Compounds In This Decade Yet." />
    </div>
  );
}
