/**
 * Approved drugs — compounds with FDA/EMA/other regulatory approval.
 * Progressive disclosure: category filter tabs.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllCompounds } from '@/lib/compounds-server';
import { evidenceTier, wadaLabel } from '@/lib/compounds';
import BrowseFilterShell from '@/components/research/BrowseFilterShell';

export const metadata: Metadata = {
  title: 'Approved Drugs | Research Library | Pep Nation Lab',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

interface ApprovedDrug {
  slug: string;
  display_name: string;
  evidence_tier: string;
  wada_status: string;
  category: string | null;
  plain_summary: string | null;
  year_first_approved?: number | null;
  [key: string]: unknown;
}

function ApprovalCard({ c }: { c: ApprovedDrug }) {
  const t = evidenceTier(c.evidence_tier);
  return (
    <Link
      href={`/research/${c.slug}`}
      className="card-metal"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-1, 4px)',
        padding: 'var(--space-4, 16px)',
        borderRadius: 'var(--radius-lg, 12px)',
        textDecoration: 'none',
        color: 'var(--white, #FFFFFF)',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignSelf: 'flex-start',
          fontSize: '0.7rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          color: t.color,
          border: `1px solid ${t.color}`,
          borderRadius: '999px',
          padding: '2px 10px',
        }}
      >
        {t.label}
      </span>
      <span style={{ fontSize: '1.05rem', fontWeight: 700 }}>{c.display_name}</span>
      {c.category && <span style={{ fontSize: '0.78rem', color: 'var(--teal, #00C4BC)' }}>{c.category}</span>}
      {c.year_first_approved && (
        <span style={{ fontSize: '0.75rem', color: 'var(--silver, #A8B4C0)' }}>Approved {c.year_first_approved}</span>
      )}
      {c.plain_summary && (
        <span style={{ fontSize: '0.78rem', color: 'var(--silver-light, #D0DAE4)', marginTop: '4px' }}>
          {c.plain_summary}
        </span>
      )}
      {c.wada_status && c.wada_status !== 'not_listed' && (
        <span style={{ fontSize: '0.72rem', color: 'var(--silver, #A8B4C0)' }}>{wadaLabel(c.wada_status)}</span>
      )}
    </Link>
  );
}

  const compounds = (await getAllCompounds()).filter((c) => c.evidence_tier === 'approved_drug') as ApprovedDrug[];
  const sorted = [...compounds].sort((a, b) => {
    const ay = a.year_first_approved ?? 0;
    const by = b.year_first_approved ?? 0;
    if (by !== ay) return by - ay;
    return a.display_name.localeCompare(b.display_name);
  });

  const sortedCategories = Array.from(categoryMap.keys()).sort((a, b) => a.localeCompare(b));
    {
      key: 'all',
      label: 'All Approved',
      count: sorted.length,
      children: (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-3, 12px)' }}>
          {sorted.map((c) => <ApprovalCard key={c.slug} c={c} />)}
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-3, 12px)' }}>
            {items.map((c) => <ApprovalCard key={c.slug} c={c} />)}
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
          Approved Drugs
        </h1>
        <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1.05rem', marginTop: 'var(--space-2, 8px)', maxWidth: '760px' }}>
          Compounds With FDA, EMA, Or Other Regulatory Approval. Filter By Category Below.
        </p>
      </header>

      {sorted.length === 0 ? (
        <div className="card-glass" style={{ padding: 'var(--space-5, 24px)', borderRadius: 'var(--radius-lg, 12px)', color: 'var(--silver, #A8B4C0)' }}>
          No Approved Drugs In The Catalog.
        </div>
      ) : (
        <BrowseFilterShell groups={shellGroups} emptyMessage="No Approved Drugs In This Category." />
      )}
    </div>
  );
}
