/**
 * Most-studied compounds in 2026 -- ranked by active_trial_count + completed_trial_count.
 * Progressive disclosure: All + category filter tabs.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllCompounds } from '@/lib/compounds-server';
import { evidenceTier } from '@/lib/compounds';
import BrowseFilterShell from '@/components/research/BrowseFilterShell';

export const metadata: Metadata = {
  title: 'Most Studied Research Peptides 2026 | Trending Compounds | Pep Nation Lab',
  description: 'The most studied and searched research peptides in 2026. Data-driven rankings of trending research compounds based on research activity and publication velocity. Research use only.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://pepnationlab.com/research/most-studied-2026' },
  openGraph: {
    title: 'Most Studied Peptides 2026 | Pep Nation Lab',
    description: 'Trending research peptides ranked by research activity and publication velocity in 2026.',
    url: 'https://pepnationlab.com/research/most-studied-2026',
    type: 'website',
    images: [{ url: '/og-card.png', width: 1200, height: 630, alt: 'Most Studied Peptides 2026' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Most Studied Peptides 2026 | Pep Nation Lab',
    description: 'Trending research peptides ranked by research activity and publication velocity in 2026.',
    images: ['/og-card.png'],
  },
};

// ISR: data comes from unstable_cache'd helpers (60s); render once, revalidate hourly.
export const revalidate = 3600;

interface TrialRow {
  slug: string;
  display_name: string;
  evidence_tier: string;
  category: string | null;
  active_trial_count: number | null;
  completed_trial_count: number | null;
}

interface TrialCompound extends TrialRow {
  total_trials: number;
}

function TrialCard({ c, rank }: { c: TrialCompound; rank: number }) {
  const t = evidenceTier(c.evidence_tier);
  return (
    <Link
      href={`/research/${c.slug}`}
      className="glass-panel"
      style={{
        display: 'grid',
        gridTemplateColumns: '40px 1fr auto auto',
        alignItems: 'center',
        gap: 'var(--space-3, 12px)',
        padding: 'var(--space-3, 12px) var(--space-4, 16px)',
        borderRadius: 'var(--radius-lg, 12px)',
        textDecoration: 'none',
        color: 'var(--white, #FFFFFF)',
      }}
    >
      <span style={{ fontSize: '0.85rem', color: 'var(--silver, #A8B4C0)', fontWeight: 700 }}>#{rank}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
        <span style={{ fontSize: '1.05rem', fontWeight: 700 }}>{c.display_name}</span>
        <span style={{ fontSize: '0.78rem', color: 'var(--silver, #A8B4C0)' }}>
          {c.category} · <span style={{ color: t.color }}>{t.label}</span>
        </span>
      </div>
      <span style={{ fontSize: '0.82rem', color: '#00E5FF', fontWeight: 700, whiteSpace: 'nowrap' }}>
        Active: {c.active_trial_count ?? 0}
      </span>
      <span style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--teal, #00C4BC)', whiteSpace: 'nowrap' }}>
        {c.total_trials}
      </span>
    </Link>
  );
}

export default async function ResearchMostStudied2026Page() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': 'https://pepnationlab.com/research/most-studied-2026#webpage',
        url: 'https://pepnationlab.com/research/most-studied-2026',
        name: 'Most Studied Research Peptides 2026 | Trending Compounds | Pep Nation Lab',
        description: 'The most studied and searched research peptides in 2026. Data-driven rankings of trending research compounds based on research activity and publication velocity. Research use only.',
        isPartOf: { '@id': 'https://pepnationlab.com/#website' },
        publisher: { '@id': 'https://pepnationlab.com/#organization' }
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://pepnationlab.com' },
          { '@type': 'ListItem', position: 2, name: 'Research Library', item: 'https://pepnationlab.com/research' },
          { '@type': 'ListItem', position: 3, name: 'most studied 2026', item: 'https://pepnationlab.com/research/most-studied-2026' }
        ]
      }
    ]
  };

  const compounds = await getAllCompounds();
  const ranked = [...compounds]
    .map((r) => ({
      ...r,
      active_trial_count: r.active_trial_count ?? null,
      completed_trial_count: r.completed_trial_count ?? null,
      total_trials: (r.active_trial_count ?? 0) + (r.completed_trial_count ?? 0),
    } as TrialCompound))
    .sort((a, b) => b.total_trials - a.total_trials);

  const withTrials = ranked.filter((c) => c.total_trials > 0);
  const withoutTrials = ranked.filter((c) => c.total_trials === 0);

  // Group by category
  const categoryMap = new Map<string, typeof withTrials>();
  for (const c of withTrials) {
    const cat = c.category || 'Uncategorized';
    if (!categoryMap.has(cat)) categoryMap.set(cat, []);
    categoryMap.get(cat)!.push(c);
  }
  const sortedCategories = Array.from(categoryMap.keys()).sort((a, b) => {
    const aTop = categoryMap.get(a)![0].total_trials;
    const bTop = categoryMap.get(b)![0].total_trials;
    return bTop - aTop;
  });


  const shellGroups = [
    {
      key: 'all',
      label: 'All Compounds',
      count: withTrials.length,
      children:
        withTrials.length === 0 ? (
          <div className="glass-panel" style={{ padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)', color: 'var(--silver, #A8B4C0)' }}>
            Trial Counts Will Populate Once The ClinicalTrials.gov Sync Cron Runs.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3, 12px)' }}>
            {withTrials.map((c, i) => <TrialCard key={c.slug} c={c} rank={i + 1} />)}
          </div>
        ),
    },
    ...sortedCategories.map((cat) => {
      const items = categoryMap.get(cat)!;
      return {
        key: cat,
        label: cat,
        count: items.length,
        children: (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3, 12px)' }}>
            {items.map((c, i) => <TrialCard key={c.slug} c={c} rank={i + 1} />)}
          </div>
        ),
      };
    }),
    ...(withoutTrials.length > 0
      ? [
          {
            key: 'awaiting',
            label: 'Awaiting Sync',
            count: withoutTrials.length,
            children: (
              <div>
                <p style={{ fontSize: '0.85rem', color: 'var(--silver, #A8B4C0)', marginBottom: 'var(--space-3, 12px)' }}>
                  These Compounds Have Not Yet Been Indexed By The ClinicalTrials.gov Sync Cron.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2, 8px)' }}>
                  {withoutTrials.map((c) => (
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
          Most Studied Compounds (2026)
        </h1>
        <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1.05rem', marginTop: 'var(--space-2, 8px)', maxWidth: '760px' }}>
          Ranked By Total Clinical Trial Activity From ClinicalTrials.gov. Filter By Category Below.
        </p>
      </header>

      <BrowseFilterShell groups={shellGroups} emptyMessage="No Data In This Category." />
    </div>
      </>
  );
}
