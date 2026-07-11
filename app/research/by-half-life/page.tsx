/**
 * Browse compounds by half-life bucket. Server component.
 * Uses COALESCE(measured_half_life_hours, predicted_half_life_hours).
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllCompounds } from '@/lib/compounds-server';
import { evidenceTier } from '@/lib/compounds';
import BrowseFilterShell from '@/components/research/BrowseFilterShell';

export const metadata: Metadata = {
  title: 'Browse Peptides By Half-Life | Short vs Long Acting | Pep Nation Lab',
  description: 'Compare research peptides by pharmacokinetic half-life. Filter from short-acting compounds (minutes) to long-acting variants (days). Research use only.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://pepnationlab.com/research/by-half-life' },
  openGraph: {
    title: 'Peptides By Half-Life | Pep Nation Lab',
    description: 'Compare research peptides by half-life from short-acting to long-acting variants.',
    url: 'https://pepnationlab.com/research/by-half-life',
    type: 'website',
    images: [{ url: '/og-card.png', width: 1200, height: 630, alt: 'Peptides By Half-Life' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@PepNationLab',
    creator: '@PepNationLab',
    title: 'Browse Peptides By Half-Life | Short vs Long Acting | Pep Nation Lab',
    description: 'Compare research peptides by pharmacokinetic half-life. Filter from short-acting compounds (minutes) to long-acting variants (days). Research use only.',
    images: ['https://pepnationlab.com/images/og-card.jpg'],
  },
};

// ISR: data comes from unstable_cache'd helpers (60s); render once, revalidate hourly.
export const revalidate = 3600;

interface HalfLifeRow {
  slug: string;
  display_name: string;
  evidence_tier: string;
  plain_summary: string | null;
  measured_half_life_hours: number | null;
  predicted_half_life_hours: number | null;
}

const BUCKETS: Array<{ key: string; label: string; range: string; test: (h: number) => boolean }> = [
  { key: 'acute', label: 'Acute (< 2 h)', range: 'Less Than 2h', test: (h) => h < 2 },
  { key: 'short', label: 'Short (2-12 h)', range: '2 To 12h', test: (h) => h >= 2 && h < 12 },
  { key: 'medium', label: 'Medium (12-72 h)', range: '12 To 72h', test: (h) => h >= 12 && h < 72 },
  { key: 'long', label: 'Long (72 h-2 wk)', range: '72 To 336h', test: (h) => h >= 72 && h < 336 },
  { key: 'depot', label: 'Depot (> 2 wk)', range: 'Over 336h', test: (h) => h >= 336 },
];

function CompoundCard({ c }: { c: HalfLifeRow }) {
  const t = evidenceTier(c.evidence_tier);
  const hl = c.measured_half_life_hours ?? c.predicted_half_life_hours;
  const measured = c.measured_half_life_hours !== null;
  return (
    <Link
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
      <span
        style={{ fontSize: '0.7rem', color: t.color, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}
      >
        {t.label}
      </span>
      <span style={{ fontSize: '1rem', fontWeight: 700 }}>{c.display_name}</span>
      {hl !== null && (
        <span style={{ fontSize: '0.78rem', color: 'var(--teal, #00C4BC)' }}>
          Half-Life: {hl.toFixed(1)} h {!measured && '(predicted)'}
        </span>
      )}
    </Link>
  );
}

export default async function ResearchByHalfLifePage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': 'https://pepnationlab.com/research/by-half-life#webpage',
        url: 'https://pepnationlab.com/research/by-half-life',
        name: 'Browse Peptides By Half-Life | Short vs Long Acting | Pep Nation Lab',
        description: 'Compare research peptides by pharmacokinetic half-life. Filter from short-acting compounds (minutes) to long-acting variants (days). Research use only.',
        isPartOf: { '@id': 'https://pepnationlab.com/#website' },
        publisher: { '@id': 'https://pepnationlab.com/#organization' }
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://pepnationlab.com' },
          { '@type': 'ListItem', position: 2, name: 'Research Library', item: 'https://pepnationlab.com/research' },
          { '@type': 'ListItem', position: 3, name: 'by half life', item: 'https://pepnationlab.com/research/by-half-life' }
        ]
      }
    ]
  };

  const rows = (await getAllCompounds()) as unknown as HalfLifeRow[];

  const groups = BUCKETS.map((b) => ({ ...b, compounds: [] as HalfLifeRow[] }));
  const unknown: HalfLifeRow[] = [];
  for (const r of rows) {
    const hl = r.measured_half_life_hours ?? r.predicted_half_life_hours;
    if (hl === null || hl === undefined || !isFinite(hl)) {
      unknown.push(r);
      continue;
    }
    const target = groups.find((g) => g.test(hl));
    if (target) target.compounds.push(r);
  }

  const shellGroups = [
    ...groups.map((g) => ({
      key: g.key,
      label: g.label,
      count: g.compounds.length,
      children: (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 'var(--space-3, 12px)' }}>
          {g.compounds.map((c) => <CompoundCard key={c.slug} c={c} />)}
        </div>
      ),
    })),
    ...(unknown.length > 0
      ? [
          {
            key: 'unknown',
            label: 'Awaiting Data',
            count: unknown.length,
            children: (
              <div>
                <p style={{ fontSize: '0.85rem', color: 'var(--silver, #A8B4C0)', marginBottom: 'var(--space-3, 12px)' }}>
                  Half-Life Data Not Yet Available For These Compounds.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2, 8px)' }}>
                  {unknown.map((c) => (
                    <Link
                      key={c.slug}
                      href={`/research/${c.slug}`}
                      className="glass-panel"
                      style={{ padding: '6px 12px', borderRadius: 'var(--radius-md, 8px)', textDecoration: 'none', color: 'var(--white, #FFFFFF)', fontSize: '0.85rem' }}
                    >
                      {c.display_name}
                    </Link>
                  ))}
                </div>
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: 'var(--space-6, 32px) var(--space-4, 16px)' }}>
      <nav style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Link href="/research" style={{ color: 'var(--teal, #00C4BC)', fontSize: '0.9rem', textDecoration: 'none' }}>
          Back To Research Library
        </Link>
      </nav>
      <header style={{ marginBottom: 'var(--space-5, 24px)' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--white, #FFFFFF)', margin: 0 }}>
          Browse By Half-Life
        </h1>
        <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1.05rem', marginTop: 'var(--space-2, 8px)', maxWidth: '760px' }}>
          Compounds Grouped By Measured Or Predicted Plasma Half-Life. Select A Duration Category Below.
        </p>
      </header>

      <BrowseFilterShell groups={shellGroups} emptyMessage="No Compounds In This Half-Life Range Yet." />
    </div>
      </>
  );
}
