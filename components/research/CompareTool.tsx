'use client';

/**
 * Compare Tool — comprehensive side-by-side comparison of up to three compounds,
 * grouped into Identity, Evidence & Regulatory, Pharmacology, and Handling
 * sections. Pure presentation over an in-memory Compound[] from the parent
 * server component. Research-use-only: factual lab and literature fields only.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { type Compound, evidenceTier, wadaLabel, researchAreaLabel, RISK_META } from '@/lib/compounds';

const MAX_COLUMNS = 3;

const selectStyle: React.CSSProperties = {
  background: 'var(--grey-400, #162230)',
  color: 'var(--white, #FFFFFF)',
  border: '1px solid rgba(168,180,192,0.25)',
  borderRadius: 'var(--radius-md, 8px)',
  padding: 'var(--space-2, 8px) var(--space-3, 12px)',
  fontSize: '0.9rem',
};

const cellStyle: React.CSSProperties = {
  padding: 'var(--space-3, 12px)',
  borderBottom: '1px solid rgba(168,180,192,0.18)',
  verticalAlign: 'top',
  fontSize: '0.88rem',
  color: 'var(--white, #FFFFFF)',
};

const labelCellStyle: React.CSSProperties = {
  ...cellStyle,
  color: 'var(--silver, #A8B4C0)',
  fontWeight: 700,
  whiteSpace: 'nowrap',
};

const groupCellStyle: React.CSSProperties = {
  padding: 'var(--space-3, 12px)',
  background: 'rgba(0,196,188,0.08)',
  borderTop: '1px solid rgba(0,196,188,0.3)',
  borderBottom: '1px solid rgba(0,196,188,0.3)',
  color: 'var(--teal, #00C4BC)',
  fontWeight: 800,
  fontSize: '0.72rem',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
};

const NL = 'Not Listed';
function txt(v: unknown): string {
  const s = (v ?? '').toString().trim();
  return s || NL;
}

type Row =
  | { kind: 'group'; label: string }
  | { kind: 'data'; label: string; render: (c: Compound) => React.ReactNode };

const ROWS: Row[] = [
  { kind: 'group', label: 'Identity' },
  { kind: 'data', label: 'Category', render: (c) => txt(c.category) },
  { kind: 'data', label: 'Class', render: (c) => txt(c.compound_class) },
  { kind: 'data', label: 'Molecular Target', render: (c) => txt(c.molecular_target) },
  { kind: 'data', label: 'Sequence', render: (c) => txt(c.identity?.sequence) },
  { kind: 'data', label: 'Molecular Weight', render: (c) => c.molecular_weight_da ? `${c.molecular_weight_da} Da` : txt(c.identity?.molecular_weight) },
  { kind: 'data', label: 'CAS Number', render: (c) => txt(c.identity?.cas) },

  { kind: 'group', label: 'Evidence & Regulatory' },
  {
    kind: 'data',
    label: 'Evidence Tier',
    render: (c) => {
      const t = evidenceTier(c.evidence_tier);
      return (
        <span
          style={{
            display: 'inline-block',
            fontSize: '0.72rem',
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
      );
    },
  },
  {
    kind: 'data',
    label: 'Risk Level',
    render: (c) => {
      const r = RISK_META[c.risk_level];
      return r ? <span style={{ color: r.color, fontWeight: 700 }}>{r.label}</span> : NL;
    },
  },
  { kind: 'data', label: 'Studied For', render: (c) => ((c.studied_for ?? []).length ? c.studied_for.join(', ') : NL) },
  {
    kind: 'data',
    label: 'Research Areas',
    render: (c) => ((c.research_areas ?? []).length ? c.research_areas.map(researchAreaLabel).join(', ') : NL),
  },
  { kind: 'data', label: 'Discovered', render: (c) => txt(c.year_discovered) },
  { kind: 'data', label: 'PubMed Citations', render: (c) => c.pubmed_citation_count ? c.pubmed_citation_count.toLocaleString() : NL },
  { 
    kind: 'data', 
    label: 'Clinical Trials', 
    render: (c) => {
      const trials = (c.active_trial_count ?? 0) + (c.completed_trial_count ?? 0);
      return trials > 0 ? trials.toLocaleString() : NL;
    }
  },
  { kind: 'data', label: 'Regulatory', render: (c) => txt(c.regulatory) },
  { kind: 'data', label: 'WADA Status', render: (c) => wadaLabel(c.wada_status) },

  { kind: 'group', label: 'Pharmacology' },
  {
    kind: 'data',
    label: 'Half-Life',
    render: (c) => (c.half_life ? <span style={{ color: 'var(--teal, #00C4BC)', fontWeight: 700 }}>{c.half_life}</span> : NL),
  },
  { kind: 'data', label: 'PK Summary', render: (c) => txt(c.pk_summary) },
  { kind: 'data', label: 'Reported Findings', render: (c) => txt(c.benefits) },
  { kind: 'data', label: 'Side Effects', render: (c) => txt(c.side_effects) },
  { kind: 'data', label: 'Warnings', render: (c) => txt(c.warnings) },

  { kind: 'group', label: 'Handling & Storage' },
  { kind: 'data', label: 'Form', render: (c) => txt(c.handling?.form) },
  { kind: 'data', label: 'Diluent', render: (c) => txt(c.handling?.diluent) },
  { kind: 'data', label: 'Storage Temperature', render: (c) => txt(c.handling?.storage_temp) },
  {
    kind: 'data',
    label: 'Light Sensitive',
    render: (c) => (c.handling?.light_sensitive == null ? NL : c.handling.light_sensitive ? 'Yes' : 'No'),
  },
  { kind: 'data', label: 'Freeze / Thaw', render: (c) => txt(c.handling?.freeze_thaw) },
  {
    kind: 'data',
    label: 'Reconstituted Shelf Life',
    render: (c) => {
      const d = c.reconstitution_shelf_days ?? c.handling?.reconstituted_days;
      return d != null ? `${d} Days Refrigerated` : NL;
    },
  },
];

export default function CompareTool({
  compounds,
  initialSlugs = [],
}: {
  compounds: Compound[];
  initialSlugs?: string[];
}) {
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>(() =>
    initialSlugs.filter((s) => compounds.some((c) => c.slug === s)).slice(0, MAX_COLUMNS),
  );

  const bySlug = useMemo(() => {
    const map = new Map<string, Compound>();
    for (const c of compounds) map.set(c.slug, c);
    return map;
  }, [compounds]);

  const selected = useMemo(
    () => selectedSlugs.map((s) => bySlug.get(s)).filter((c): c is Compound => Boolean(c)),
    [selectedSlugs, bySlug],
  );

  const available = useMemo(
    () => compounds.filter((c) => !selectedSlugs.includes(c.slug)),
    [compounds, selectedSlugs],
  );

  function addCompound(slug: string) {
    if (!slug) return;
    setSelectedSlugs((prev) => (prev.includes(slug) || prev.length >= MAX_COLUMNS ? prev : [...prev, slug]));
  }

  function removeCompound(slug: string) {
    setSelectedSlugs((prev) => prev.filter((s) => s !== slug));
  }

  const canAdd = selected.length < MAX_COLUMNS;
  const colSpan = selected.length + 1;

  return (
    <div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-3, 12px)',
          alignItems: 'center',
          marginBottom: 'var(--space-5, 24px)',
        }}
      >
        <select
          aria-label="Add A Compound To Compare"
          value=""
          disabled={!canAdd || available.length === 0}
          onChange={(e) => addCompound(e.target.value)}
          style={{ ...selectStyle, opacity: canAdd ? 1 : 0.5 }}
        >
          <option value="">
            {canAdd ? 'Add A Compound To Compare' : 'Maximum Of Three Selected'}
          </option>
          {available.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.display_name}
            </option>
          ))}
        </select>
        <span style={{ color: 'var(--silver, #A8B4C0)', fontSize: '0.85rem' }}>
          {selected.length} Of {MAX_COLUMNS} Selected
        </span>
      </div>

      {selected.length === 0 ? (
        <div
          className="glass-panel"
          style={{
            padding: 'var(--space-6, 32px)',
            textAlign: 'center',
            color: 'var(--silver, #A8B4C0)',
            borderRadius: 'var(--radius-lg, 12px)',
          }}
        >
          Select Up To Three Compounds To Compare Every Attribute Side By Side.
        </div>
      ) : (
        <div className="glass-panel" style={{ borderRadius: 'var(--radius-lg, 12px)', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '480px' }}>
            <thead>
              <tr>
                <th style={{ ...labelCellStyle, textAlign: 'left' }} scope="col">
                  Attribute
                </th>
                {selected.map((c) => (
                  <th key={c.slug} style={{ ...cellStyle, textAlign: 'left' }} scope="col">
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: 'var(--space-2, 8px)',
                      }}
                    >
                      <Link
                        href={`/research/${c.slug}`}
                        style={{
                          color: 'var(--teal, #00C4BC)',
                          fontWeight: 700,
                          textDecoration: 'none',
                          fontSize: '1rem',
                        }}
                      >
                        {c.display_name}
                      </Link>
                      <button
                        type="button"
                        onClick={() => removeCompound(c.slug)}
                        aria-label={`Remove ${c.display_name}`}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--silver, #A8B4C0)',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          padding: 0,
                        }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) =>
                row.kind === 'group' ? (
                  <tr key={`g-${row.label}`}>
                    <td style={groupCellStyle} colSpan={colSpan}>
                      {row.label}
                    </td>
                  </tr>
                ) : (
                  <tr key={row.label}>
                    <td style={labelCellStyle}>{row.label}</td>
                    {selected.map((c) => (
                      <td key={c.slug} style={cellStyle}>
                        {row.render(c)}
                      </td>
                    ))}
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
