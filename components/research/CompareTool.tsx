'use client';

/**
 * Compare Tool — comprehensive side-by-side comparison of up to three compounds,
 * grouped into Identity, Evidence & Regulatory, Pharmacology, and Handling
 * sections. Pure presentation over an in-memory Compound[] from the parent
 * server component. Research-use-only: factual lab and literature fields only.
 */

import { useMemo, useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Search, X, PlusCircle } from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { type Compound, evidenceTier, wadaLabel, researchAreaLabel, RISK_META } from '@/lib/compounds';

const MAX_COLUMNS = 3;

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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [selectedSlugs, setSelectedSlugs] = useState<string[]>(() =>
    initialSlugs.filter((s) => compounds.some((c) => c.slug === s)).slice(0, MAX_COLUMNS),
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Sync state to URL without reloading page
  useEffect(() => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    if (selectedSlugs.length > 0) {
      params.set('add', selectedSlugs.join(','));
    } else {
      params.delete('add');
    }
    const target = `${pathname}?${params.toString()}`;
    router.replace(target, { scroll: false });
  }, [selectedSlugs, pathname, searchParams, router]);

  // Click outside to close search
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const bySlug = useMemo(() => {
    const map = new Map<string, Compound>();
    for (const c of compounds) map.set(c.slug, c);
    return map;
  }, [compounds]);

  const selected = useMemo(
    () => selectedSlugs.map((s) => bySlug.get(s)).filter((c): c is Compound => Boolean(c)),
    [selectedSlugs, bySlug],
  );

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const lower = searchQuery.toLowerCase();
    return compounds.filter((c) => 
      !selectedSlugs.includes(c.slug) && 
      (c.display_name.toLowerCase().includes(lower) || c.category.toLowerCase().includes(lower) || c.slug.toLowerCase().includes(lower))
    ).slice(0, 10); // Limit to 10 suggestions
  }, [compounds, searchQuery, selectedSlugs]);

  function addCompound(slug: string) {
    if (!slug) return;
    setSelectedSlugs((prev) => (prev.includes(slug) || prev.length >= MAX_COLUMNS ? prev : [...prev, slug]));
    setSearchQuery('');
    setIsSearchOpen(false);
  }

  function removeCompound(slug: string) {
    setSelectedSlugs((prev) => prev.filter((s) => s !== slug));
  }

  const canAdd = selected.length < MAX_COLUMNS;
  const colSpan = selected.length + 1;
  const colors = ['#00C4BC', '#FF6B6B', '#FCA311']; // Teal, Red, Orange

  return (
    <div>
      {/* Search / Add Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-4, 16px)',
          alignItems: 'center',
          marginBottom: 'var(--space-5, 24px)',
          position: 'relative',
          zIndex: 50,
        }}
        ref={searchRef}
      >
        <div style={{ position: 'relative', flex: 1, maxWidth: 500 }}>
          <div style={{ position: 'relative' }}>
            <Search style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--silver, #A8B4C0)' }} size={18} />
            <input
              type="text"
              placeholder={canAdd ? "Search for a compound to compare..." : "Maximum of three compounds selected"}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
              }}
              onFocus={() => setIsSearchOpen(true)}
              disabled={!canAdd}
              style={{
                width: '100%',
                background: 'var(--grey-400, #162230)',
                color: 'var(--white, #FFFFFF)',
                border: '1px solid rgba(168,180,192,0.25)',
                borderRadius: 'var(--radius-md, 8px)',
                padding: '12px 16px 12px 42px',
                fontSize: '1rem',
                outline: 'none',
                opacity: canAdd ? 1 : 0.5,
              }}
            />
          </div>

          {/* Autocomplete Dropdown */}
          {isSearchOpen && searchQuery.trim() && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0,
              marginTop: 8,
              background: '#162230',
              border: '1px solid rgba(168,180,192,0.25)',
              borderRadius: '8px',
              overflow: 'hidden',
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            }}>
              {searchResults.length > 0 ? (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: 300, overflowY: 'auto' }}>
                  {searchResults.map((c) => {
                    const tier = evidenceTier(c.evidence_tier);
                    return (
                      <li key={c.slug}>
                        <button
                          type="button"
                          onClick={() => addCompound(c.slug)}
                          style={{
                            width: '100%',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '12px 16px',
                            background: 'transparent', border: 'none',
                            borderBottom: '1px solid rgba(168,180,192,0.1)',
                            color: 'var(--white, #FFFFFF)',
                            textAlign: 'left',
                            cursor: 'pointer',
                          }}
                          onMouseOver={(e) => e.currentTarget.style.background = 'rgba(0,196,188,0.1)'}
                          onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{c.display_name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--silver, #A8B4C0)', marginTop: 2 }}>{c.category}</div>
                          </div>
                          <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: 999, background: `${tier.color}20`, color: tier.color, fontWeight: 700 }}>
                            {tier.label}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--silver, #A8B4C0)', fontSize: '0.9rem' }}>
                  No compounds found matching "{searchQuery}"
                </div>
              )}
            </div>
          )}
        </div>
        
        <span style={{ color: 'var(--silver, #A8B4C0)', fontSize: '0.85rem', fontWeight: 700 }}>
          {selected.length} Of {MAX_COLUMNS} Selected
        </span>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={() => setSelectedSlugs([])}
            style={{
              background: 'rgba(229,62,62,0.1)', border: '1px solid rgba(229,62,62,0.3)',
              color: '#F08A8A', borderRadius: 8, padding: '8px 16px',
              fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
            }}
          >
            Clear All
          </button>
        )}
      </div>

      {/* Visual Empty State */}
      {selected.length === 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4, 16px)' }}>
          {[1, 2, 3].map((num) => (
            <div key={num} className="glass-panel" style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16,
              height: 300,
              border: '2px dashed rgba(168,180,192,0.2)',
              borderRadius: 'var(--radius-lg, 12px)',
              background: 'rgba(22, 34, 48, 0.4)',
            }}>
              <PlusCircle size={48} color="rgba(168,180,192,0.2)" />
              <div style={{ color: 'var(--silver, #A8B4C0)', fontWeight: 700, fontSize: '1.1rem' }}>
                Compound {num}
              </div>
              <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '0.85rem', textAlign: 'center', padding: '0 24px', opacity: 0.7 }}>
                Use the search bar above to select a compound and begin building your comparison matrix.
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6, 32px)' }}>
          
          {/* Radar Chart */}
          {selected.length > 0 && (
            <div className="glass-panel" style={{ borderRadius: 'var(--radius-lg, 12px)', padding: 'var(--space-4, 16px)', overflow: 'hidden' }}>
              <h3 style={{ fontSize: '1.2rem', color: 'var(--white, #FFFFFF)', marginBottom: 'var(--space-4, 16px)', textAlign: 'center', fontWeight: 800 }}>
                Profile Comparison
              </h3>
              <div style={{ height: 400, width: '100%', minWidth: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="65%" data={[
                    { 
                      subject: 'Evidence Level', 
                      ...selected.reduce((acc, c) => {
                        let score = 1;
                        if (c.evidence_tier === 'A_APPROVED') score = 5;
                        else if (c.evidence_tier === 'B_CLINICAL') score = 4;
                        else if (c.evidence_tier === 'C_IN_VIVO') score = 3;
                        else if (c.evidence_tier === 'D_IN_VITRO') score = 2;
                        acc[c.display_name] = score;
                        return acc;
                      }, {} as Record<string, number>)
                    },
                    { 
                      subject: 'Safety Profile', 
                      ...selected.reduce((acc, c) => {
                        let score = 3;
                        if (c.risk_level === 'low') score = 5;
                        else if (c.risk_level === 'high') score = 1;
                        acc[c.display_name] = score;
                        return acc;
                      }, {} as Record<string, number>)
                    },
                    { 
                      subject: 'Citations', 
                      ...selected.reduce((acc, c) => {
                        const count = c.pubmed_citation_count || 0;
                        const score = count > 1000 ? 5 : count > 500 ? 4 : count > 100 ? 3 : count > 10 ? 2 : 1;
                        acc[c.display_name] = score;
                        return acc;
                      }, {} as Record<string, number>)
                    },
                    { 
                      subject: 'Clinical Trials', 
                      ...selected.reduce((acc, c) => {
                        const count = (c.active_trial_count || 0) + (c.completed_trial_count || 0);
                        const score = count > 20 ? 5 : count > 10 ? 4 : count > 3 ? 3 : count > 0 ? 2 : 1;
                        acc[c.display_name] = score;
                        return acc;
                      }, {} as Record<string, number>)
                    }
                  ]}>
                    <PolarGrid stroke="rgba(168,180,192,0.2)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--silver, #A8B4C0)', fontSize: 13, fontWeight: 700 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 5]} tick={false} axisLine={false} />
                    <RechartsTooltip 
                      contentStyle={{ background: '#162230', borderColor: 'rgba(168,180,192,0.2)', borderRadius: '12px', color: '#FFF', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}
                      itemStyle={{ fontWeight: 700 }}
                      formatter={(value: number) => {
                        // Return human-readable label based on score
                        if (value === 5) return 'Very High';
                        if (value === 4) return 'High';
                        if (value === 3) return 'Moderate';
                        if (value === 2) return 'Low';
                        return 'Very Low';
                      }}
                    />
                    <Legend wrapperStyle={{ paddingTop: 20 }} />
                    {selected.map((c, idx) => {
                      const color = colors[idx % colors.length];
                      return (
                        <Radar key={c.slug} name={c.display_name} dataKey={c.display_name} stroke={color} strokeWidth={2} fill={color} fillOpacity={0.3} />
                      );
                    })}
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="glass-panel" style={{ borderRadius: 'var(--radius-lg, 12px)', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '480px' }}>
              <thead>
                <tr>
                  <th style={{ ...labelCellStyle, textAlign: 'left', width: '20%' }} scope="col">
                    Attribute
                  </th>
                  {selected.map((c, idx) => {
                    const color = colors[idx % colors.length];
                    return (
                      <th key={c.slug} style={{ ...cellStyle, textAlign: 'left', width: `${80 / selected.length}%` }} scope="col">
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
                              color: color,
                              fontWeight: 900,
                              textDecoration: 'none',
                              fontSize: '1.1rem',
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
                              padding: 4,
                              borderRadius: 4,
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <X size={18} />
                          </button>
                        </div>
                      </th>
                    );
                  })}
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
                    <tr key={row.label} style={{ transition: 'background 0.2s' }} onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
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
        </div>
      )}
    </div>
  );
}
