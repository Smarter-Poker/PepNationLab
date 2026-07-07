/**
 * Browse compounds by mechanism keyword cluster.
 * Progressive disclosure: mechanism filter tabs.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllCompounds } from '@/lib/compounds-server';
import { evidenceTier } from '@/lib/compounds';
import BrowseFilterShell from '@/components/research/BrowseFilterShell';

export const metadata: Metadata = {
  title: 'Browse Peptides By Mechanism Of Action | Research Library | Pep Nation Lab',
  description: 'Browse research-grade peptides organized by their mechanism of action - receptor agonists, antagonists, signal modulators, and more. Research use only.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://pepnationlab.com/research/by-mechanism' },
  openGraph: {
    title: 'Browse Peptides By Mechanism | Pep Nation Lab',
    description: 'Research peptides organized by mechanism of action - receptor agonists, antagonists, and modulators.',
    url: 'https://pepnationlab.com/research/by-mechanism',
    type: 'website',
    images: [{ url: '/og-card.png', width: 1200, height: 630, alt: 'Peptides By Mechanism' }],
  },
};

export const dynamic = 'force-dynamic';

function toTitleCase(str: string) {
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
}

function extractMechanismKey(mechanism: string | null | undefined): string {
  if (!mechanism) return 'Unclassified';
  const words = mechanism.trim().split(/\s+/).slice(0, 3).join(' ');
  return toTitleCase(words);
}

export default async function ResearchByMechanismPage() {
  const all = await getAllCompounds();

  const buckets = new Map<string, typeof all>();
  for (const c of all) {
    const key = extractMechanismKey((c as unknown as { mechanism?: string }).mechanism);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(c);
  }

  // Sort by descending compound count, then alpha
  const keys = Array.from(buckets.keys()).sort((a, b) => {
    const diff = (buckets.get(b)?.length ?? 0) - (buckets.get(a)?.length ?? 0);
    return diff !== 0 ? diff : a.localeCompare(b);
  });

  const shellGroups = keys.map((key) => {
    const items = buckets.get(key)!;
    return {
      key,
      label: key,
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
                <span style={{ fontSize: '0.7rem', color: t.color, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
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
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: 'var(--space-6, 32px) var(--space-4, 16px)' }}>
      <nav style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Link href="/research" style={{ color: 'var(--teal, #00C4BC)', fontSize: '0.9rem', textDecoration: 'none' }}>
          Back To Research Library
        </Link>
      </nav>
      <header style={{ marginBottom: 'var(--space-5, 24px)' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--white, #FFFFFF)', margin: 0 }}>
          Browse By Mechanism
        </h1>
        <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1.05rem', marginTop: 'var(--space-2, 8px)', maxWidth: '760px' }}>
          Compounds Clustered By Primary Mechanism Of Action. Select A Mechanism Below.
        </p>
      </header>

      {shellGroups.length === 0 ? (
        <div className="glass-panel" style={{ padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)', color: 'var(--silver, #A8B4C0)' }}>
          Mechanism Data Will Populate As The Catalog Is Enriched.
        </div>
      ) : (
        <BrowseFilterShell groups={shellGroups} emptyMessage="No Compounds In This Mechanism Category." />
      )}
    </div>
  );
}
