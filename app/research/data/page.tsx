/**
 * Full Data Table — a sortable, filterable database grid of the entire catalog.
 * Server component maps every compound to a lightweight row and hands it to the
 * client CompoundDataTable. Research-use-only reference data.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { Table2 } from 'lucide-react';
import { getAllCompounds } from '@/lib/compounds-server';
import { evidenceTier, wadaLabel, RISK_META } from '@/lib/compounds';
import CompoundDataTable, { type DataRow } from '@/components/research/CompoundDataTable';

export const metadata: Metadata = {
  title: 'Full Data Table | Research Library | Pep Nation Lab',
  robots: { index: false, follow: false },
};

const dash = (v: unknown) => {
  const s = (v ?? '').toString().trim();
  return s || '—';
};

// Columns added in research_v3 foundation; not yet on the Compound TS type.
type CompoundExtras = {
  molecular_weight_da?: number | null;
  pubmed_citation_count?: number | null;
  active_trial_count?: number | null;
  completed_trial_count?: number | null;
  year_discovered?: number | null;
};

export default async function ResearchDataPage() {
  const compounds = await getAllCompounds();

  const rows: DataRow[] = compounds.map((c) => {
    const tier = evidenceTier(c.evidence_tier);
    const risk = RISK_META[c.risk_level];
    const x = c as unknown as CompoundExtras;
    const trials = (x.active_trial_count ?? 0) + (x.completed_trial_count ?? 0);
    return {
      slug: c.slug,
      name: c.display_name,
      category: dash(c.category),
      klass: dash(c.compound_class),
      tierLabel: tier.label,
      tierColor: tier.color,
      target: dash(c.molecular_target),
      halfLife: dash(c.half_life),
      wada: wadaLabel(c.wada_status),
      risk: risk?.label ?? '—',
      riskColor: risk?.color ?? '#A8B4C0',
      mw: x.molecular_weight_da ?? null,
      citations: x.pubmed_citation_count ?? null,
      trials: trials > 0 ? trials : null,
      year: x.year_discovered ?? null,
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
          <Table2 size={24} aria-hidden="true" style={{ verticalAlign: '-3px', marginRight: 10, color: 'var(--teal, #00C4BC)' }} />
          Full Data Table
        </h1>
        <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1.05rem', marginTop: 'var(--space-2, 8px)', maxWidth: '760px' }}>
          Every Compound In One Sortable, Filterable Grid — Category, Class, Evidence Tier, Molecular Target, Molecular
          Weight, Half-Life, PubMed Citations, Clinical Trials, Year Discovered, WADA Status, And Risk. Click Any Column
          To Sort. For Laboratory Research Only.
        </p>
      </header>

      <CompoundDataTable rows={rows} />
    </div>
  );
}
