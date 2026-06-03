/**
 * Orphan drug designations. Progressive disclosure: category/indication filter tabs.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { evidenceTier, wadaLabel } from '@/lib/compounds';
import BrowseFilterShell from '@/components/research/BrowseFilterShell';

export const metadata: Metadata = {
  title: 'Orphan Drug Designations | Research Library | Pep Nation Lab',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

interface OrphanRow {
  slug: string;
  display_name: string;
  evidence_tier: string;
  wada_status: string;
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
      className="card-metal"
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
            {c.wada_status && c.wada_status !== 'not_listed' ? ` · ${wadaLabel(c.wada_status)}` : ''}
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
  const supabase = await createClient();
  const { data } = await supabase
    .from('compounds')
    .select(
      'slug, display_name, evidence_tier, wada_status, category, plain_summary, orphan_indications, fda_approval_year, ema_approval_year'
    )
    .eq('is_orphan_drug', true)
    .order('display_name', { ascending: true });

  const rows = (data ?? []) as OrphanRow[];

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
        <div className="card-glass" style={{ padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)', color: 'var(--silver, #A8B4C0)' }}>
          No Orphan Drug Designations Currently In The Catalog.
        </div>
      ) : (
        <BrowseFilterShell groups={shellGroups} emptyMessage="No Compounds In This Category." />
      )}
    </div>
  );
}
