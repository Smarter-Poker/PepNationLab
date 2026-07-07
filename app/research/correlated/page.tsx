/**
 * Citation co-occurrence network. Progressive disclosure via letter tabs.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getAllCompounds } from '@/lib/compounds-server';
import BrowseFilterShell from '@/components/research/BrowseFilterShell';

export const metadata: Metadata = {
  title: 'Correlated Peptides | Research Compound Correlations | Pep Nation Lab',
  description: 'Explore research peptides with correlated mechanisms and overlapping therapeutic applications. Identify compound relationships for advanced research protocols. Research use only.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://pepnationlab.com/research/correlated' },
  openGraph: {
    title: 'Correlated Peptides | Pep Nation Lab',
    description: 'Research peptides with correlated mechanisms and overlapping therapeutic applications.',
    url: 'https://pepnationlab.com/research/correlated',
    type: 'website',
    images: [{ url: '/og-card.png', width: 1200, height: 630, alt: 'Correlated Research Peptides' }],
  },
};

export const dynamic = 'force-dynamic';

interface CompanionRow {
  compound_slug: string;
  companion_slug: string;
  co_occurrence_count: number;
}

interface CompoundRow {
  slug: string;
  display_name: string;
}

interface CompoundBlockProps {
  slug: string;
  name: string;
  companions: CompanionRow[];
  nameBySlug: Map<string, string>;
}

function CompoundBlock({ slug, name, companions, nameBySlug }: CompoundBlockProps) {
  return (
    <article
      className="glass-panel"
      style={{ padding: 'var(--space-4, 16px) var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)' }}
    >
      <div style={{ marginBottom: 'var(--space-3, 12px)' }}>
        <Link href={`/research/${slug}`} style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--white, #FFFFFF)', textDecoration: 'none' }}>
          {name}
        </Link>
        <span style={{ display: 'block', fontSize: '0.82rem', color: 'var(--silver, #A8B4C0)', marginTop: '2px' }}>
          Most Frequently Co-Cited With:
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2, 8px)' }}>
        {companions.map((co) => (
          <Link
            key={co.companion_slug}
            href={`/research/${co.companion_slug}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: 'var(--radius-md, 8px)',
              background: 'rgba(0,196,188,0.10)',
              border: '1px solid rgba(0,196,188,0.25)',
              textDecoration: 'none',
              color: 'var(--white, #FFFFFF)',
              fontSize: '0.85rem',
            }}
          >
            {nameBySlug.get(co.companion_slug) ?? co.companion_slug}
            <span style={{ color: 'var(--teal, #00C4BC)', fontWeight: 700 }}>{co.co_occurrence_count}</span>
          </Link>
        ))}
      </div>
    </article>
  );
}

export default async function ResearchCorrelatedPage() {
  const supabase = await createClient();
  const { data: companions } = await supabase
    .from('compound_companion_papers')
    .select('compound_slug, companion_slug, co_occurrence_count')
    .order('co_occurrence_count', { ascending: false });

  const compoundRows = (await getAllCompounds()) as unknown as CompoundRow[];

  const companionRows = (companions ?? []) as CompanionRow[];

  const nameBySlug = new Map<string, string>();
  for (const c of compoundRows) nameBySlug.set(c.slug, c.display_name);

  const grouped = new Map<string, CompanionRow[]>();
  for (const row of companionRows) {
    if (!grouped.has(row.compound_slug)) grouped.set(row.compound_slug, []);
    if (grouped.get(row.compound_slug)!.length < 5) {
      grouped.get(row.compound_slug)!.push(row);
    }
  }

  const allSlugs = Array.from(grouped.keys()).sort((a, b) => {
    const an = nameBySlug.get(a) ?? a;
    const bn = nameBySlug.get(b) ?? b;
    return an.localeCompare(bn);
  });

  // Group by first letter of compound name
  const letterMap = new Map<string, string[]>();
  for (const slug of allSlugs) {
    const name = nameBySlug.get(slug) ?? slug;
    const letter = name.charAt(0).toUpperCase();
    if (!letterMap.has(letter)) letterMap.set(letter, []);
    letterMap.get(letter)!.push(slug);
  }
  const letters = Array.from(letterMap.keys()).sort();


  const shellGroups = [
    // All
    {
      key: 'all',
      label: 'All',
      count: allSlugs.length,
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4, 16px)' }}>
          {allSlugs.map((slug) => (
            <CompoundBlock
              key={slug}
              slug={slug}
              name={nameBySlug.get(slug) ?? slug}
              companions={grouped.get(slug)!}
              nameBySlug={nameBySlug}
            />
          ))}
        </div>
      ),
    },
    // By letter
    ...letters.map((letter) => {
      const slugs = letterMap.get(letter)!;
      return {
        key: letter,
        label: letter,
        count: slugs.length,
        children: (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4, 16px)' }}>
            {slugs.map((slug) => (
              <CompoundBlock
                key={slug}
                slug={slug}
                name={nameBySlug.get(slug) ?? slug}
                companions={grouped.get(slug)!}
                nameBySlug={nameBySlug}
              />
            ))}
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
          Correlated Compounds
        </h1>
        <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1.05rem', marginTop: 'var(--space-2, 8px)', maxWidth: '760px' }}>
          Citation Co-Occurrence Network. Compounds That Frequently Appear In The Same Papers Often Share Mechanism, Pathway, Or Research Area. Browse By Letter Below.
        </p>
      </header>

      {allSlugs.length === 0 ? (
        <div className="glass-panel" style={{ padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)', color: 'var(--silver, #A8B4C0)' }}>
          Will Populate Once PubMed Sync Runs. The Co-Occurrence Index Is Rebuilt Weekly From The Citation Corpus.
        </div>
      ) : (
        <BrowseFilterShell groups={shellGroups} emptyMessage="No Correlated Compounds Found." />
      )}
    </div>
  );
}
