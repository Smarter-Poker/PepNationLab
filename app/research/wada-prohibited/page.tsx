/**
 * WADA-prohibited compounds. Progressive disclosure: status + category filter tabs.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/server';
import { getAllCompounds } from '@/lib/compounds-server';
import { evidenceTier, wadaLabel } from '@/lib/compounds';
import BrowseFilterShell from '@/components/research/BrowseFilterShell';

export const metadata: Metadata = {
  title: 'WADA-Prohibited Compounds | Research Library | Pep Nation Lab',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

interface WadaHistoryRow {
  compound_slug: string;
  year: number;
  status: string;
  notes: string | null;
  source_url: string | null;
}

interface WadaCompoundCardProps {
  c: { slug: string; display_name: string; category: string | null; evidence_tier: string; wada_status: string };
  hist: WadaHistoryRow[];
}

function WadaCompoundCard({ c, hist }: WadaCompoundCardProps) {
  const t = evidenceTier(c.evidence_tier);
  return (
    <article
      className="card-metal"
      style={{
        padding: 'var(--space-4, 16px) var(--space-5, 24px)',
        borderRadius: 'var(--radius-lg, 12px)',
        borderLeft: '3px solid var(--red-600, #E53E3E)',
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
        <span style={{ fontSize: '0.78rem', color: 'var(--red-600, #E53E3E)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
          {wadaLabel(c.wada_status)}
        </span>
      </div>
      {hist.length > 0 && (
        <div style={{ marginTop: 'var(--space-3, 12px)' }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--silver-light, #D0DAE4)', margin: 0, marginBottom: 'var(--space-2, 8px)' }}>
            Prohibition History
          </h3>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {hist.map((h, hi) => (
              <li key={`${h.year}-${hi}`} style={{ fontSize: '0.8rem', color: 'var(--silver, #A8B4C0)' }}>
                <strong style={{ color: 'var(--white, #FFFFFF)' }}>{h.year}</strong>: {h.status}
                {h.notes ? ` — ${h.notes}` : ''}
                {h.source_url && (
                  <>{' '}<a href={h.source_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--teal, #00C4BC)', textDecoration: 'none' }}>Source</a></>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

export default async function ResearchWadaProhibitedPage() {
  const supabase = await createServiceClient();
  const { data: history } = await supabase
    .from('compound_wada_history')
    .select('compound_slug, year, status, notes, source_url')
    .order('year', { ascending: false });

  const historyBySlug = new Map<string, WadaHistoryRow[]>();
  for (const h of (history ?? []) as WadaHistoryRow[]) {
    if (!historyBySlug.has(h.compound_slug)) historyBySlug.set(h.compound_slug, []);
    historyBySlug.get(h.compound_slug)!.push(h);
  }

  const all = await getAllCompounds();
  const compounds = all.filter(
    (c) => c.wada_status === 'prohibited' || c.wada_status === 'prohibited_males'
  );

  // Group by WADA status
  const statusGroups = new Map<string, typeof compounds>();
  for (const c of compounds) {
    const label = wadaLabel(c.wada_status);
    if (!statusGroups.has(label)) statusGroups.set(label, []);
    statusGroups.get(label)!.push(c);
  }

  // Group by category
  const categoryMap = new Map<string, typeof compounds>();
  for (const c of compounds) {
    const cat = c.category || 'Uncategorized';
    if (!categoryMap.has(cat)) categoryMap.set(cat, []);
    categoryMap.get(cat)!.push(c);
  }
  const sortedCategories = Array.from(categoryMap.keys()).sort((a, b) => a.localeCompare(b));

  const shellGroups = [
    {
      key: 'all',
      label: 'All Prohibited',
      count: compounds.length,
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4, 16px)' }}>
          {compounds.map((c) => (
            <WadaCompoundCard key={c.slug} c={c} hist={historyBySlug.get(c.slug) ?? []} />
          ))}
        </div>
      ),
    },
    ...Array.from(statusGroups.entries()).map(([label, items]) => ({
      key: label,
      label,
      count: items.length,
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4, 16px)' }}>
          {items.map((c) => (
            <WadaCompoundCard key={c.slug} c={c} hist={historyBySlug.get(c.slug) ?? []} />
          ))}
        </div>
      ),
    })),
    ...sortedCategories.map((cat) => {
      const items = categoryMap.get(cat)!;
      return {
        key: `cat-${cat}`,
        label: cat,
        count: items.length,
        children: (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4, 16px)' }}>
            {items.map((c) => (
              <WadaCompoundCard key={c.slug} c={c} hist={historyBySlug.get(c.slug) ?? []} />
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
          WADA-Prohibited Compounds
        </h1>
        <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1.05rem', marginTop: 'var(--space-2, 8px)', maxWidth: '760px' }}>
          Compounds On The World Anti-Doping Agency Prohibited List. Filter By Status Or Category Below.
        </p>
      </header>

      {compounds.length === 0 ? (
        <div className="card-metal" style={{ padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)', color: 'var(--silver, #A8B4C0)' }}>
          No WADA-Prohibited Compounds Currently In The Catalog.
        </div>
      ) : (
        <BrowseFilterShell groups={shellGroups} emptyMessage="No Compounds In This Category." />
      )}
    </div>
  );
}
