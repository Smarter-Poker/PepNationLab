/**
 * New additions — the 40 most recently added compounds.
 * Progressive disclosure: category filter tabs + chronological "All" view.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/service';
import { evidenceTier } from '@/lib/compounds';
import BrowseFilterShell from '@/components/research/BrowseFilterShell';

export const metadata: Metadata = {
  title: 'New Additions | Research Library | Pep Nation Lab',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

interface NewRow {
  slug: string;
  display_name: string;
  evidence_tier: string;
  category: string | null;
  plain_summary: string | null;
  created_at: string;
}

export default async function ResearchNewAdditionsPage() {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from('compounds')
    .select('slug, display_name, evidence_tier, category, plain_summary, created_at')
    .order('created_at', { ascending: false })
    .limit(40);

  const items = (data ?? []) as NewRow[];

  // Group by category
  const categoryMap = new Map<string, NewRow[]>();
  for (const c of items) {
    const cat = c.category || 'Uncategorized';
    if (!categoryMap.has(cat)) categoryMap.set(cat, []);
    categoryMap.get(cat)!.push(c);
  }
  const sortedCategories = Array.from(categoryMap.keys()).sort((a, b) => {
    const ac = categoryMap.get(a)!.length;
    const bc = categoryMap.get(b)!.length;
    return bc - ac;
  });

  function ItemCard({ c }: { c: NewRow }) {
    const t = evidenceTier(c.evidence_tier);
    const added = new Date(c.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    return (
      <Link
        href={`/research/${c.slug}`}
        className="card-metal"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 'var(--space-3, 12px)',
          padding: 'var(--space-3, 12px) var(--space-4, 16px)',
          borderRadius: 'var(--radius-lg, 12px)',
          textDecoration: 'none',
          color: 'var(--white, #FFFFFF)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
          <span style={{ fontSize: '1.05rem', fontWeight: 700 }}>{c.display_name}</span>
          <span style={{ fontSize: '0.78rem', color: 'var(--silver, #A8B4C0)' }}>
            {c.category} · <span style={{ color: t.color }}>{t.label}</span>
          </span>
          {c.plain_summary && (
            <span
              style={{
                fontSize: '0.78rem',
                color: 'var(--silver-light, #D0DAE4)',
                marginTop: '4px',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {c.plain_summary}
            </span>
          )}
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--silver, #A8B4C0)', whiteSpace: 'nowrap' }}>Added {added}</span>
      </Link>
    );
  }

  const shellGroups = [
    {
      key: 'all',
      label: 'All Recent',
      count: items.length,
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3, 12px)' }}>
          {items.map((c) => <ItemCard key={c.slug} c={c} />)}
        </div>
      ),
    },
    ...sortedCategories.map((cat) => {
      const catItems = categoryMap.get(cat)!;
      return {
        key: cat,
        label: cat,
        count: catItems.length,
        children: (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3, 12px)' }}>
            {catItems.map((c) => <ItemCard key={c.slug} c={c} />)}
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
          Recent Catalog Additions
        </h1>
        <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1.05rem', marginTop: 'var(--space-2, 8px)', maxWidth: '760px' }}>
          The Forty Most Recently Added Compounds. Filter By Category Below.
        </p>
      </header>

      {items.length === 0 ? (
        <div className="card-glass" style={{ padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)', color: 'var(--silver, #A8B4C0)' }}>
          No Compounds In The Catalog Yet.
        </div>
      ) : (
        <BrowseFilterShell groups={shellGroups} emptyMessage="No Compounds In This Category." />
      )}
    </div>
  );
}
