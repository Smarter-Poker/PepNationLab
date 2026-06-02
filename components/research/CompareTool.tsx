'use client';

/**
 * Compare Tool — side-by-side comparison of up to three compounds.
 * Pure presentation over an in-memory Compound[] passed by the parent server
 * component. Research-use-only: presents factual lab and literature fields.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { type Compound, evidenceTier, wadaLabel } from '@/lib/compounds';

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

type RowDef = { label: string; render: (c: Compound) => React.ReactNode };

const ROWS: RowDef[] = [
  {
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
  { label: 'Class', render: (c) => c.compound_class || 'Not Listed' },
  { label: 'Molecular Target', render: (c) => c.molecular_target || 'Not Listed' },
  {
    label: 'Studied For',
    render: (c) => ((c.studied_for ?? []).length ? c.studied_for.join(', ') : 'Not Listed'),
  },
  { label: 'Reported Findings', render: (c) => c.benefits || 'Not Listed' },
  { label: 'Side Effects', render: (c) => c.side_effects || 'Not Listed' },
  { label: 'Storage Form', render: (c) => c.handling?.form || 'Not Listed' },
  { label: 'WADA Status', render: (c) => wadaLabel(c.wada_status) },
];

export default function CompareTool({ compounds }: { compounds: Compound[] }) {
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);

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
          className="card-glass"
          style={{
            padding: 'var(--space-6, 32px)',
            textAlign: 'center',
            color: 'var(--silver, #A8B4C0)',
            borderRadius: 'var(--radius-lg, 12px)',
          }}
        >
          Select Up To Three Compounds To Compare Them Side By Side.
        </div>
      ) : (
        <div className="card-glass" style={{ borderRadius: 'var(--radius-lg, 12px)', overflowX: 'auto' }}>
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
              {ROWS.map((row) => (
                <tr key={row.label}>
                  <td style={labelCellStyle}>{row.label}</td>
                  {selected.map((c) => (
                    <td key={c.slug} style={cellStyle}>
                      {row.render(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
