/**
 * Browse compounds bucketed by molecular weight (Da). Server component.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllCompounds } from '@/lib/compounds-server';
import { evidenceTier, wadaLabel } from '@/lib/compounds';
import BrowseFilterShell from '@/components/research/BrowseFilterShell';

export const metadata: Metadata = {
  title: 'Browse By Molecular Weight | Research Library | Pep Nation Lab',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

interface MwRow {
  slug: string;
  display_name: string;
  evidence_tier: string;
  wada_status: string;
  plain_summary: string | null;
  molecular_weight_da: number | null;
}

const BUCKETS = [
  { key: 'small', label: 'Small (< 2,000 Da)', test: (mw: number) => mw < 2000 },
  { key: 'medium', label: 'Medium (2,000–5,000 Da)', test: (mw: number) => mw >= 2000 && mw < 5000 },
  { key: 'large', label: 'Large (> 5,000 Da)', test: (mw: number) => mw >= 5000 },
];

function CompoundCard({ c }: { c: MwRow }) {
  const t = evidenceTier(c.evidence_tier);
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
      <span style={{ fontSize: '0.7rem', color: t.color, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
        {t.label}
      </span>
      <span style={{ fontSize: '1rem', fontWeight: 700 }}>{c.display_name}</span>
      <span style={{ fontSize: '0.78rem', color: 'var(--teal, #00C4BC)' }}>
        MW: {c.molecular_weight_da?.toFixed(1)} Da
      </span>
      {c.wada_status && c.wada_status !== 'not_listed' && (
        <span style={{ fontSize: '0.7rem', color: 'var(--silver, #A8B4C0)' }}>{wadaLabel(c.wada_status)}</span>
      )}
    </Link>
  );
}

export default async function ResearchByMwPage() {
  const rows = (await getAllCompounds()) as unknown as MwRow[];

  const groups = BUCKETS.map((b) => ({ ...b, compounds: [] as MwRow[] }));
  const unknown: MwRow[] = [];
  for (const r of rows) {
    const mw = r.molecular_weight_da;
    if (mw === null || mw === undefined || !isFinite(mw)) {
      unknown.push(r);
      continue;
    }
    const target = groups.find((g) => g.test(mw));
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
                  Molecular Weight Not Yet Available For These Compounds.
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
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: 'var(--space-6, 32px) var(--space-4, 16px)' }}>
      <nav style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Link href="/research" style={{ color: 'var(--teal, #00C4BC)', fontSize: '0.9rem', textDecoration: 'none' }}>
          Back To Research Library
        </Link>
      </nav>
      <header style={{ marginBottom: 'var(--space-5, 24px)' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--white, #FFFFFF)', margin: 0 }}>
          Browse By Molecular Weight
        </h1>
        <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1.05rem', marginTop: 'var(--space-2, 8px)', maxWidth: '760px' }}>
          Compounds Grouped By Molecular Weight In Daltons. Select A Size Category Below.
        </p>
      </header>

      <BrowseFilterShell groups={shellGroups} emptyMessage="No Compounds In This Weight Range Yet." />
    </div>
  );
}
