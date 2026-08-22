/**
 * Orphan drug designations. Progressive disclosure: category/indication filter tabs.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllCompounds } from '@/lib/compounds-server';
import { evidenceTier } from '@/lib/compounds';
import BrowseFilterShell from '@/components/research/BrowseFilterShell';

export const metadata: Metadata = {
  title: 'Orphan Drug Peptides | Rare Disease Research Compounds | Pep Nation Lab',
  description: 'Research peptides and compounds with orphan drug designation for rare disease research. Full reference data on FDA orphan-designated peptide therapeutics. Research use only.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://pepnationlab.com/research/orphan-drugs' },
  openGraph: {
    title: 'Orphan Drug Peptides | Pep Nation Lab',
    description: 'Research peptides with FDA orphan drug designation for rare disease applications.',
    url: 'https://pepnationlab.com/research/orphan-drugs',
    type: 'website',
    images: [{ url: '/og-card.png', width: 1200, height: 630, alt: 'Orphan Drug Research Peptides' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@PepNationLab',
    creator: '@PepNationLab',
    title: 'Orphan Drug Peptides | Rare Disease Research Compounds | Pep Nation Lab',
    description: 'Research peptides and compounds with orphan drug designation for rare disease research. Full reference data on FDA orphan-designated peptide therapeutics. Research use only.',
    images: ['https://pepnationlab.com/og-card.png'],
  },
};

// ISR: data comes from unstable_cache'd helpers (60s); render once, revalidate hourly.
export const revalidate = 3600;

interface OrphanRow {
  slug: string;
  display_name: string;
  evidence_tier: string;
  category: string | null;
  plain_summary: string | null;
  orphan_indications: string[] | null;
  fda_approval_year: number | null;
  ema_approval_year: number | null;
}

function CompoundCard({ c }: { c: OrphanRow }) {
  const t = evidenceTier(c.evidence_tier);
  return (
    <article
      className="glass-panel"
      style={{
        padding: 'var(--space-4, 16px) var(--space-5, 24px)',
        borderRadius: 'var(--radius-lg, 12px)',
        borderLeft: '3px solid var(--teal, #00C4BC)',
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
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
          {c.fda_approval_year && (
            <span style={{ fontSize: '0.75rem', color: '#68D391', fontWeight: 700 }}>FDA {c.fda_approval_year}</span>
          )}
          {c.ema_approval_year && (
            <span style={{ fontSize: '0.75rem', color: '#63B3ED', fontWeight: 700 }}>EMA {c.ema_approval_year}</span>
          )}
        </div>
      </div>
      {(c.orphan_indications ?? []).length > 0 && (
        <ul style={{ margin: 'var(--space-3, 12px) 0 0', padding: '0 0 0 var(--space-4, 16px)', color: 'var(--silver, #A8B4C0)', fontSize: '0.85rem', lineHeight: 1.6 }}>
          {c.orphan_indications!.map((ind, i) => <li key={i}>{ind}</li>)}
        </ul>
      )}
      {c.plain_summary && (
        <p style={{ marginTop: 'var(--space-2, 8px)', marginBottom: 0, fontSize: '0.85rem', color: 'var(--silver-light, #D0DAE4)', lineHeight: 1.6 }}>
          {c.plain_summary}
        </p>
      )}
    </article>
  );
}

export default async function ResearchOrphanDrugsPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': 'https://pepnationlab.com/research/orphan-drugs#webpage',
        url: 'https://pepnationlab.com/research/orphan-drugs',
        name: 'Orphan Drug Peptides | Rare Disease Research Compounds | Pep Nation Lab',
        description: 'Research peptides and compounds with orphan drug designation for rare disease research. Full reference data on FDA orphan-designated peptide therapeutics. Research use only.',
        isPartOf: { '@id': 'https://pepnationlab.com/#website' },
        publisher: { '@id': 'https://pepnationlab.com/#organization' }
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://pepnationlab.com' },
          { '@type': 'ListItem', position: 2, name: 'Research Library', item: 'https://pepnationlab.com/research' },
          { '@type': 'ListItem', position: 3, name: 'orphan drugs', item: 'https://pepnationlab.com/research/orphan-drugs' }
        ]
      }
    ]
  };

  const all = await getAllCompounds();
  const rows = all.filter((c) => ((c as unknown) as { is_orphan_drug?: boolean }).is_orphan_drug === true) as unknown as OrphanRow[];

  // Group by category
  const categoryMap = new Map<string, OrphanRow[]>();
  for (const r of rows) {
    const cat = r.category || 'Uncategorized';
    if (!categoryMap.has(cat)) categoryMap.set(cat, []);
    categoryMap.get(cat)!.push(r);
  }
  const sortedCategories = Array.from(categoryMap.keys()).sort((a, b) => a.localeCompare(b));

  // Group by approval body
  const fdaApproved = rows.filter((r) => r.fda_approval_year);
  const emaApproved = rows.filter((r) => r.ema_approval_year);


  const shellGroups = [
    {
      key: 'all',
      label: 'All Orphan Drugs',
      count: rows.length,
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4, 16px)' }}>
          {rows.map((c) => <CompoundCard key={c.slug} c={c} />)}
        </div>
      ),
    },
    ...(fdaApproved.length > 0
      ? [
          {
            key: 'fda',
            label: 'FDA Approved',
            count: fdaApproved.length,
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4, 16px)' }}>
                {fdaApproved.map((c) => <CompoundCard key={c.slug} c={c} />)}
              </div>
            ),
          },
        ]
      : []),
    ...(emaApproved.length > 0
      ? [
          {
            key: 'ema',
            label: 'EMA Approved',
            count: emaApproved.length,
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4, 16px)' }}>
                {emaApproved.map((c) => <CompoundCard key={c.slug} c={c} />)}
              </div>
            ),
          },
        ]
      : []),
    ...sortedCategories.map((cat) => {
      const items = categoryMap.get(cat)!;
      return {
        key: cat,
        label: cat,
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
          Orphan Drug Designations
        </h1>
        <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1.05rem', marginTop: 'var(--space-2, 8px)', maxWidth: '760px' }}>
          Compounds Granted Orphan Drug Status By FDA Or EMA For Rare Disease Indications. Filter Below.
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="glass-panel" style={{ padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)', color: 'var(--silver, #A8B4C0)' }}>
          No Orphan Drug Designations Currently In The Catalog.
        </div>
      ) : (
        <BrowseFilterShell groups={shellGroups} emptyMessage="No Compounds In This Category." />
      )}
    </div>
      </>
  );
}
