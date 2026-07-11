/**
 * Browse compounds by receptor target. Server component.
 * Builds an alphabetized index of every unique receptor across the catalog.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllCompounds } from '@/lib/compounds-server';

export const metadata: Metadata = {
  title: 'Browse By Receptor Target | Research Library | Pep Nation Lab',
  description:
    'Browse research compounds by receptor target. An alphabetized index of every annotated receptor in the Pep Nation Lab research library — select a target to see every compound studied against it. Research Use Only.',
  alternates: { canonical: 'https://pepnationlab.com/research/by-target' },
  openGraph: {
    title: 'Browse By Receptor Target | Research Library | Pep Nation Lab',
    description: 'Browse research compounds by receptor target. An alphabetized index of every annotated receptor in the Pep Nation Lab research library.',
    url: 'https://pepnationlab.com/research/by-target',
    type: 'website',
    images: [{ url: '/og-card.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@PepNationLab',
    creator: '@PepNationLab',
    title: 'Browse By Receptor Target | Research Library | Pep Nation Lab',
    description: 'Browse research compounds by receptor target. An alphabetized index of every annotated receptor in the Pep Nation Lab research library.',
    images: ['https://pepnationlab.com/images/og-card.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large', 'max-video-preview': -1 },
  },
};

// ISR: data comes from unstable_cache'd helpers (60s); render once, revalidate hourly.
export const revalidate = 3600;

interface CompoundReceptorRow {
  slug: string;
  display_name: string;
  receptors: string[] | null;
}

export default async function ResearchByTargetPage() {
  const rows = (await getAllCompounds()) as unknown as CompoundReceptorRow[];

  const targetCounts = new Map<string, number>();
  for (const r of rows) {
    for (const t of r.receptors ?? []) {
      if (!t || !t.trim()) continue;
      const key = t.trim();
      targetCounts.set(key, (targetCounts.get(key) ?? 0) + 1);
    }
  }
  const targets = Array.from(targetCounts.keys()).sort((a, b) => a.localeCompare(b));

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': 'https://pepnationlab.com/research/by-target#webpage',
        url: 'https://pepnationlab.com/research/by-target',
        name: 'Browse By Receptor Target | Research Library | Pep Nation Lab',
        description: 'Browse research compounds by receptor target. An alphabetized index of every annotated receptor in the Pep Nation Lab research library.',
        isPartOf: { '@id': 'https://pepnationlab.com/#website' },
        publisher: { '@id': 'https://pepnationlab.com/#organization' }
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://pepnationlab.com' },
          { '@type': 'ListItem', position: 2, name: 'Research Library', item: 'https://pepnationlab.com/research' },
          { '@type': 'ListItem', position: 3, name: 'By Target', item: 'https://pepnationlab.com/research/by-target' }
        ]
      }
    ]
  };

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
          Browse By Receptor Target
        </h1>
        <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1.05rem', marginTop: 'var(--space-2, 8px)', maxWidth: '760px' }}>
          Every Annotated Receptor In The Catalog. Click A Target To See Every Compound That Binds It.
        </p>
      </header>

      {targets.length === 0 ? (
        <div className="glass-panel" style={{ padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)', color: 'var(--silver, #A8B4C0)' }}>
          Receptor Annotations Will Populate Once The IUPHAR And ChEMBL Sync Crons Run.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--space-3, 12px)' }}>
          {targets.map((t) => (
            <Link
              key={t}
              href={`/research/by-target/${encodeURIComponent(t)}`}
              className="glass-panel"
              style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: 'var(--space-3, 12px) var(--space-4, 16px)', borderRadius: 'var(--radius-lg, 12px)', textDecoration: 'none', color: 'var(--white, #FFFFFF)' }}
            >
              <span style={{ fontSize: '1rem', fontWeight: 700 }}>{t}</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--teal, #00C4BC)' }}>{targetCounts.get(t)} Compounds</span>
            </Link>
          ))}
        </div>
      )}
    </div>
    </>
  );
}
