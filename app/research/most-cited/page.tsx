/**
 * Most-cited compounds in the literature. Sorted by pubmed_citation_count.
 * Progressive disclosure: top-N ranked view + category filter tabs.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllCompounds } from '@/lib/compounds-server';
import { evidenceTier } from '@/lib/compounds';
import { compoundItemListJsonLd } from '@/lib/research/schema';
import BrowseFilterShell from '@/components/research/BrowseFilterShell';

export const metadata: Metadata = {
  title: 'Most Cited Research Peptides | Top Referenced Compounds | Pep Nation Lab',
  description: 'The most-cited and referenced research peptides ranked by publication count and scientific evidence. Discover the most-studied compounds in research literature. Research use only.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://pepnationlab.com/research/most-cited' },
  openGraph: {
    title: 'Most Cited Research Peptides | Pep Nation Lab',
    description: 'Top research peptides ranked by citation count and scientific evidence in published literature.',
    url: 'https://pepnationlab.com/research/most-cited',
    type: 'website',
    images: [{ url: '/og-card.png', width: 1200, height: 630, alt: 'Most Cited Research Peptides' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@PepNationLab',
    creator: '@PepNationLab',
    title: 'Most Cited Research Peptides | Top Referenced Compounds | Pep Nation Lab',
    description: 'The most-cited and referenced research peptides ranked by publication count and scientific evidence. Discover the most-studied compounds in research literature. Research use only.',
    images: ['https://pepnationlab.com/og-card.png'],
  },
};

// ISR: data comes from unstable_cache'd helpers (60s); render once, revalidate hourly.
export const revalidate = 3600;

interface CitedCompound {
  slug: string;
  display_name: string;
  evidence_tier: string;
  category: string | null;
  citation_count: number;
  [key: string]: unknown;
}

function RankCard({ c, rank }: { c: CitedCompound; rank: number }) {
  const t = evidenceTier(c.evidence_tier);
  return (
    <Link
      href={`/research/${c.slug}`}
      className="glass-panel"
      style={{
        display: 'grid',
        gridTemplateColumns: '40px 1fr auto',
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
      <span style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--teal, #00C4BC)', whiteSpace: 'nowrap' }}>
        {c.citation_count.toLocaleString()}
      </span>
    </Link>
  );
}

export default async function ResearchMostCitedPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': 'https://pepnationlab.com/research/most-cited#webpage',
        url: 'https://pepnationlab.com/research/most-cited',
        name: 'Most Cited Research Peptides | Top Referenced Compounds | Pep Nation Lab',
        description: 'The most-cited and referenced research peptides ranked by publication count and scientific evidence. Discover the most-studied compounds in research literature. Research use only.',
        isPartOf: { '@id': 'https://pepnationlab.com/#website' },
        publisher: { '@id': 'https://pepnationlab.com/#organization' }
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://pepnationlab.com' },
          { '@type': 'ListItem', position: 2, name: 'Research Library', item: 'https://pepnationlab.com/research' },
          { '@type': 'ListItem', position: 3, name: 'most cited', item: 'https://pepnationlab.com/research/most-cited' }
        ]
      }
    ] as Record<string, unknown>[]
  };

  const compounds = await getAllCompounds();
  const ranked = [...compounds]
    .map((c) => ({
      ...c,
      citation_count: (c as unknown as { pubmed_citation_count?: number }).pubmed_citation_count ?? 0,
    }))
    .sort((a, b) => b.citation_count - a.citation_count);

  const withCitations = ranked.filter((c) => c.citation_count > 0);
  const withoutCitations = ranked.filter((c) => c.citation_count === 0);

  // Item-level structure for the ranked list this page already renders.
  jsonLd['@graph'].push(
    compoundItemListJsonLd({
      name: 'Most Cited Research Peptides',
      pageUrl: 'https://pepnationlab.com/research/most-cited',
      items: withCitations,
      order: 'descending',
    }),
  );

  // Group by category for tabs
  const categoryMap = new Map<string, typeof withCitations>();
  for (const c of withCitations) {
    const cat = c.category || 'Uncategorized';
    if (!categoryMap.has(cat)) categoryMap.set(cat, []);
    categoryMap.get(cat)!.push(c);
  }
  const sortedCategories = Array.from(categoryMap.keys()).sort((a, b) => {
    // Sort categories by their highest-cited compound
    const aTop = categoryMap.get(a)![0].citation_count;
    const bTop = categoryMap.get(b)![0].citation_count;
    return bTop - aTop;
  });


  const shellGroups = [
    {
      key: 'all',
      label: 'All Compounds',
      count: withCitations.length,
      children:
        withCitations.length === 0 ? (
          <div className="glass-panel" style={{ padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)', color: 'var(--silver, #A8B4C0)' }}>
            Citation Counts Will Populate When The Weekly PubMed Cron Has Run. Check Back Soon.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3, 12px)' }}>
            {withCitations.map((c, i) => (
              <RankCard key={c.slug} c={c} rank={i + 1} />
            ))}
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
            {items.map((c, i) => <RankCard key={c.slug} c={c} rank={i + 1} />)}
          </div>
        ),
      };
    }),
    ...(withoutCitations.length > 0
      ? [
          {
            key: 'awaiting',
            label: 'Awaiting Sync',
            count: withoutCitations.length,
            children: (
              <div>
                <p style={{ fontSize: '0.85rem', color: 'var(--silver, #A8B4C0)', marginBottom: 'var(--space-3, 12px)' }}>
                  These Compounds Have Not Yet Been Scanned By The PubMed Cron Or Have No Indexed References.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2, 8px)' }}>
                  {withoutCitations.map((c) => (
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
          Most Cited Compounds
        </h1>
        <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1.05rem', marginTop: 'var(--space-2, 8px)', maxWidth: '760px' }}>
          Ranked By Peer-Reviewed PubMed Citation Count. Updated Weekly. Filter By Category Below.
        </p>
      </header>

      <BrowseFilterShell groups={shellGroups} emptyMessage="No Data In This Category." />
    </div>
      </>
  );
}
