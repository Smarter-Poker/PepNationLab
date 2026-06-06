'use client';

/**
 * CompoundDataTable — a sortable, filterable "database" grid of the whole
 * catalog. Click any column header to sort (numeric columns sort by value,
 * empty values sink to the bottom); type to filter across name, category,
 * class, and target. Each row links to the full monograph and can be added to
 * the side-by-side Compare tool. Research-use-only.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowUpDown, GitCompare, X } from 'lucide-react';

const MAX_COMPARE = 3;

export interface DataRow {
  slug: string;
  name: string;
  category: string;
  klass: string;
  tierLabel: string;
  tierColor: string;
  target: string;
  halfLife: string;
  wada: string;
  risk: string;
  riskColor: string;
  // Numeric / structured fields (null when not applicable, e.g. blends).
  mw: number | null;
  citations: number | null;
  trials: number | null;
  year: number | null;
}

type SortKey =
  | 'name' | 'category' | 'klass' | 'tierLabel' | 'target'
  | 'mw' | 'halfLife' | 'citations' | 'trials' | 'year' | 'wada' | 'risk';

const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: 'name', label: 'Compound' },
  { key: 'category', label: 'Category' },
  { key: 'klass', label: 'Class' },
  { key: 'tierLabel', label: 'Evidence' },
  { key: 'target', label: 'Molecular Target' },
  { key: 'mw', label: 'Mol. Weight', numeric: true },
  { key: 'halfLife', label: 'Half-Life' },
  { key: 'citations', label: 'Citations', numeric: true },
  { key: 'trials', label: 'Trials', numeric: true },
  { key: 'year', label: 'Discovered', numeric: true },
  { key: 'risk', label: 'Risk' },
];

const NUMERIC_KEYS = new Set<SortKey>(COLUMNS.filter((c) => c.numeric).map((c) => c.key));

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 12px',
  borderBottom: '2px solid rgba(0,196,188,0.3)',
  color: 'var(--silver, #A8B4C0)',
  fontSize: '0.72rem',
  fontWeight: 800,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
  cursor: 'pointer',
  position: 'sticky',
  top: 0,
  background: '#0F1923',
};

const td: React.CSSProperties = {
  padding: '10px 12px',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
  fontSize: '0.85rem',
  color: 'var(--white, #FFFFFF)',
  verticalAlign: 'top',
};

const num = (n: number) => n.toLocaleString('en-US');
const mwDisp = (n: number | null) => (n == null ? '—' : `${n.toLocaleString('en-US', { maximumFractionDigits: 1 })} Da`);
const countDisp = (n: number | null) => (n == null || n === 0 ? '—' : num(n));
const yearDisp = (n: number | null) => (n == null ? '—' : String(n));

export default function CompoundDataTable({ rows }: { rows: DataRow[] }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [asc, setAsc] = useState(true);
  const [compareSlugs, setCompareSlugs] = useState<string[]>([]);

  const nameBySlug = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) m.set(r.slug, r.name);
    return m;
  }, [rows]);

  function toggleCompare(slug: string) {
    setCompareSlugs((prev) =>
      prev.includes(slug)
        ? prev.filter((s) => s !== slug)
        : prev.length >= MAX_COMPARE
          ? prev
          : [...prev, slug],
    );
  }

  function goCompare() {
    if (compareSlugs.length > 0) router.push(`/research/compare?add=${compareSlugs.join(',')}`);
  }

  const view = useMemo(() => {
    const term = q.trim().toLowerCase();
    const filtered = term
      ? rows.filter(
          (r) =>
            r.name.toLowerCase().includes(term) ||
            r.category.toLowerCase().includes(term) ||
            r.klass.toLowerCase().includes(term) ||
            r.target.toLowerCase().includes(term),
        )
      : rows;
    const numeric = NUMERIC_KEYS.has(sortKey);
    const sorted = [...filtered].sort((a, b) => {
      if (numeric) {
        const av = a[sortKey] as number | null;
        const bv = b[sortKey] as number | null;
        // Empty values always sink to the bottom, regardless of direction.
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        return asc ? av - bv : bv - av;
      }
      const c = String(a[sortKey]).localeCompare(String(b[sortKey]), 'en', { numeric: true, sensitivity: 'base' });
      return asc ? c : -c;
    });
    return sorted;
  }, [rows, q, sortKey, asc]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setAsc((v) => !v);
    else {
      setSortKey(key);
      // Numeric columns are most useful highest-first.
      setAsc(!NUMERIC_KEYS.has(key));
    }
  }

  return (
    <div>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Filter By Name, Category, Class, Or Target"
        aria-label="Filter The Data Table"
        style={{
          width: '100%',
          background: 'var(--surface-1, #0F1923)',
          border: '1px solid rgba(0,196,188,0.35)',
          borderRadius: '12px',
          color: '#FFFFFF',
          padding: '13px 16px',
          fontSize: '16px',
          marginBottom: 'var(--space-3, 12px)',
        }}
      />
      <p style={{ fontSize: '0.8rem', color: 'var(--silver, #A8B4C0)', margin: '0 0 var(--space-3, 12px)' }}>
        {view.length} Of {rows.length} Compounds
      </p>

      <div className="glass-panel" style={{ borderRadius: 'var(--radius-lg, 12px)', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1180px' }}>
          <thead>
            <tr>
              {COLUMNS.map((col) => (
                <th key={col.key} style={{ ...th, textAlign: col.numeric ? 'right' : 'left' }} onClick={() => toggleSort(col.key)}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    {col.label}
                    <ArrowUpDown size={11} aria-hidden="true" style={{ opacity: sortKey === col.key ? 1 : 0.35 }} />
                  </span>
                </th>
              ))}
              <th style={{ ...th, cursor: 'default', textAlign: 'center' }}>Compare</th>
            </tr>
          </thead>
          <tbody>
            {view.map((r) => (
              <tr key={r.slug}>
                <td style={td}>
                  <Link href={`/research/${r.slug}`} style={{ color: 'var(--teal, #00C4BC)', fontWeight: 700, textDecoration: 'none' }}>
                    {r.name}
                  </Link>
                </td>
                <td style={{ ...td, textTransform: 'capitalize' }}>{r.category}</td>
                <td style={{ ...td, color: 'var(--silver, #A8B4C0)' }}>{r.klass}</td>
                <td style={td}>
                  <span style={{ color: r.tierColor, fontWeight: 700 }}>{r.tierLabel}</span>
                </td>
                <td style={{ ...td, color: 'var(--silver, #A8B4C0)' }}>{r.target}</td>
                <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>{mwDisp(r.mw)}</td>
                <td style={td}>{r.halfLife}</td>
                <td style={{ ...td, textAlign: 'right', color: r.citations ? 'var(--teal, #00C4BC)' : 'var(--silver, #A8B4C0)', fontWeight: r.citations ? 700 : 400 }}>{countDisp(r.citations)}</td>
                <td style={{ ...td, textAlign: 'right', color: 'var(--silver, #A8B4C0)' }}>{countDisp(r.trials)}</td>
                <td style={{ ...td, textAlign: 'right', color: 'var(--silver, #A8B4C0)' }}>{yearDisp(r.year)}</td>
                <td style={td}>
                  <span style={{ color: r.riskColor, fontWeight: 700 }}>{r.risk}</span>
                </td>
                <td style={{ ...td, textAlign: 'center' }}>
                  {(() => {
                    const on = compareSlugs.includes(r.slug);
                    const full = !on && compareSlugs.length >= MAX_COMPARE;
                    return (
                      <button
                        type="button"
                        onClick={() => toggleCompare(r.slug)}
                        disabled={full}
                        aria-pressed={on}
                        aria-label={on ? `Remove ${r.name} From Compare` : `Add ${r.name} To Compare`}
                        title={full ? 'Maximum Of Three Selected' : on ? 'Selected For Compare' : 'Add To Compare'}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          background: on ? 'rgba(0,196,188,0.16)' : 'transparent',
                          border: `1px solid ${on ? 'var(--teal, #00C4BC)' : 'rgba(168,180,192,0.35)'}`,
                          color: on ? 'var(--teal, #00C4BC)' : 'var(--silver, #A8B4C0)',
                          borderRadius: '999px',
                          padding: '4px 10px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: full ? 'not-allowed' : 'pointer',
                          opacity: full ? 0.4 : 1,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <GitCompare size={12} aria-hidden="true" />
                        {on ? 'Added' : 'Compare'}
                      </button>
                    );
                  })()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {view.length === 0 && (
        <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '0.95rem', marginTop: 'var(--space-4, 16px)' }}>
          No Compounds Matched That Filter.
        </p>
      )}

      {compareSlugs.length > 0 && (
        <div
          style={{
            position: 'sticky',
            bottom: '16px',
            marginTop: 'var(--space-4, 16px)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 'var(--space-2, 8px)',
            padding: 'var(--space-3, 12px) var(--space-4, 16px)',
            background: '#0F1923',
            border: '1px solid rgba(0,196,188,0.4)',
            borderRadius: '14px',
            boxShadow: '0 14px 40px rgba(0,0,0,0.55)',
            zIndex: 5,
          }}
        >
          <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--silver, #A8B4C0)', letterSpacing: '0.03em' }}>
            Compare ({compareSlugs.length}/{MAX_COMPARE}):
          </span>
          {compareSlugs.map((slug) => (
            <span
              key={slug}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                background: 'rgba(0,196,188,0.12)',
                border: '1px solid rgba(0,196,188,0.4)',
                color: 'var(--teal, #00C4BC)',
                borderRadius: '999px',
                padding: '4px 6px 4px 11px',
                fontSize: '0.78rem',
                fontWeight: 700,
              }}
            >
              {nameBySlug.get(slug) ?? slug}
              <button
                type="button"
                onClick={() => toggleCompare(slug)}
                aria-label={`Remove ${nameBySlug.get(slug) ?? slug}`}
                style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', display: 'inline-flex', padding: 0 }}
              >
                <X size={13} />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={goCompare}
            className="btn-primary"
            style={{
              marginLeft: 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.82rem',
              padding: '8px 16px',
            }}
          >
            <GitCompare size={15} aria-hidden="true" />
            Compare {compareSlugs.length === 1 ? 'Selected' : `These ${compareSlugs.length}`}
          </button>
        </div>
      )}
    </div>
  );
}
