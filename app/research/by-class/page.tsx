/**
 * Browse compounds bucketed by compound_class. Server component wraps the
 * BrowseFilterShell client component for progressive disclosure.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllCompounds } from '@/lib/compounds-server';
import { evidenceTier } from '@/lib/compounds';
import BrowseFilterShell from '@/components/research/BrowseFilterShell';

export const metadata: Metadata = {
  title: 'Browse By Class | Research Library | Pep Nation Lab',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function ResearchByClassPage() {
  const all = await getAllCompounds();
  const sorted = [...all].sort((a, b) => a.display_name.localeCompare(b.display_name));

  const buckets = new Map<string, typeof sorted>();
  for (const c of sorted) {
    const key = (c.compound_class && c.compound_class.trim()) || 'Unclassified';
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(c);
  }
  const classNames = Array.from(buckets.keys()).sort((a, b) => a.localeCompare(b));

  const groups = classNames.map((name) => {
    const items = buckets.get(name)!;
    return {
      key: name,
      label: name,
      count: items.length,
      children: (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 'var(--space-3, 12px)',
          }}
        >
          {items.map((c) => {
            const t = evidenceTier(c.evidence_tier);
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
                <span
                  style={{
                    fontSize: '0.7rem',
                    color: t.color,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    fontWeight: 700,
                  }}
                >
                  {t.label}
                </span>
                <span style={{ fontSize: '1rem', fontWeight: 700 }}>{c.display_name}</span>
                {c.plain_summary && (
                  <span
                    style={{
                      fontSize: '0.78rem',
                      color: 'var(--silver, #A8B4C0)',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {c.plain_summary}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ),
    };
  });

  return (
    <div
      style={{
        maxWidth: '1100px',
        margin: '0 auto',
        padding: 'var(--space-6, 32px) var(--space-4, 16px)',
      }}
    >
      <nav style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Link href="/research" style={{ color: 'var(--teal, #00C4BC)', fontSize: '0.9rem', textDecoration: 'none' }}>
          Back To Research Library
        </Link>
      </nav>
      <header style={{ marginBottom: 'var(--space-5, 24px)' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--white, #FFFFFF)', margin: 0 }}>
          Browse By Compound Class
        </h1>
        <p
          style={{
            color: 'var(--silver, #A8B4C0)',
            fontSize: '1.05rem',
            marginTop: 'var(--space-2, 8px)',
            maxWidth: '760px',
          }}
        >
          Compounds Grouped By Pharmacological Class. Select A Class Below To View Its Compounds.
        </p>
      </header>

      <BrowseFilterShell groups={groups} emptyMessage="No Compounds In This Class Yet." />
    </div>
  );
}
