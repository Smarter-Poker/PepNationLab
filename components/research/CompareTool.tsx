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
import { Search, X, PlusCircle, Check, Printer, Share2, Download, ChevronDown, ChevronRight, GripHorizontal, ChevronLeft } from 'lucide-react';
import { type Compound, evidenceTier, wadaLabel, researchAreaLabel, RISK_META } from '@/lib/compounds';
import AttributeRadarChart, { type RadarDataPoint } from './AttributeRadarChart';
import InCellGlossaryTooltip from './InCellGlossaryTooltip';

const MAX_COLUMNS = 4; // increased to 4 for desktop

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
  position: 'sticky',
  left: 0,
  zIndex: 10,
  boxShadow: 'inset -1px 0 0 rgba(168,180,192,0.18)',
};

const groupCellStyle: React.CSSProperties = {
  padding: 'var(--space-3, 12px)',
  background: 'linear-gradient(rgba(0,196,188,0.1), rgba(0,196,188,0.1)), #162230',
  borderTop: '1px solid rgba(0,196,188,0.3)',
  borderBottom: '1px solid rgba(0,196,188,0.3)',
  color: 'var(--teal, #00C4BC)',
  fontWeight: 800,
  fontSize: '0.72rem',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  userSelect: 'none',
};

const NL = 'Not Listed';
function txt(v: unknown): string {
  const s = (v ?? '').toString().trim();
  return s || NL;
}

function parseHalfLifeHours(hl: string | null | undefined): number {
  if (!hl) return 0;
  const s = hl.toLowerCase();
  const match = s.match(/(\d+(?:\.\d+)?)/);
  if (!match) return 0;
  const num = parseFloat(match[1]);
  if (s.includes('min')) return num / 60;
  if (s.includes('day')) return num * 24;
  if (s.includes('week')) return num * 24 * 7;
  return num; // assume hours by default
}



type Row =
  | { kind: 'group'; label: string }
  | { 
      kind: 'data'; 
      label: string; 
      glossaryTerm?: string;
      bestLogic?: 'max' | 'min';
      getRawScore?: (c: Compound) => number;
      getValue: (c: Compound) => unknown; 
      render: (c: Compound, maxHl?: number) => React.ReactNode 
    };

const ROWS: Row[] = [
  { kind: 'group', label: 'Identity' },
  { kind: 'data', label: 'Category', getValue: c => c.category, render: (c) => txt(c.category) },
  { kind: 'data', label: 'Class', getValue: c => c.compound_class, render: (c) => txt(c.compound_class) },
  { kind: 'data', label: 'Molecular Target', getValue: c => c.molecular_target, render: (c) => txt(c.molecular_target) },
  { kind: 'data', label: 'Sequence', getValue: c => c.identity?.sequence, render: (c) => txt(c.identity?.sequence) },
  { 
    kind: 'data', 
    label: 'Molecular Weight', 
    glossaryTerm: 'Molecular Weight',
    bestLogic: 'min', // smaller is more bioavailable typically
    getRawScore: c => c.molecular_weight_da ? Number(c.molecular_weight_da) : Number(c.identity?.molecular_weight) || Infinity,
    getValue: c => c.molecular_weight_da ?? c.identity?.molecular_weight, 
    render: (c) => c.molecular_weight_da ? `${c.molecular_weight_da} Da` : txt(c.identity?.molecular_weight) 
  },
  { kind: 'data', label: 'CAS Number', getValue: c => c.identity?.cas, render: (c) => txt(c.identity?.cas) },

  { kind: 'group', label: 'Evidence & Regulatory' },
  {
    kind: 'data',
    label: 'Evidence Tier',
    glossaryTerm: 'Evidence Tier',
    bestLogic: 'max',
    getRawScore: c => {
      if (c.evidence_tier === 'approved_drug') return 5;
      if (c.evidence_tier === 'investigational') return 4;
      if (c.evidence_tier === 'preclinical') return 3;
      if (c.evidence_tier === 'research_chemical') return 2;
      return 1;
    },
    getValue: c => c.evidence_tier,
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
    bestLogic: 'min',
    getRawScore: c => {
      if (c.risk_level === 'low') return 1;
      if (c.risk_level === 'moderate') return 2;
      if (c.risk_level === 'high') return 3;
      if (c.risk_level === 'critical') return 4;
      return 5;
    },
    getValue: c => c.risk_level,
    render: (c) => {
      const r = RISK_META[c.risk_level];
      return r ? <span style={{ color: r.color, fontWeight: 700 }}>{r.label}</span> : NL;
    },
  },
  { kind: 'data', label: 'Studied For', getValue: c => c.studied_for?.join(','), render: (c) => ((c.studied_for ?? []).length ? c.studied_for.join(', ') : NL) },
  {
    kind: 'data',
    label: 'Research Areas',
    getValue: c => c.research_areas?.join(','),
    render: (c) => ((c.research_areas ?? []).length ? c.research_areas.map(researchAreaLabel).join(', ') : NL),
  },
  { kind: 'data', label: 'Discovered', getValue: c => c.year_discovered, render: (c) => txt(c.year_discovered) },
  { 
    kind: 'data', 
    label: 'PubMed Citations', 
    bestLogic: 'max',
    getRawScore: c => c.pubmed_citation_count || 0,
    getValue: c => c.pubmed_citation_count, 
    render: (c) => c.pubmed_citation_count ? c.pubmed_citation_count.toLocaleString() : NL 
  },
  { 
    kind: 'data', 
    label: 'Clinical Trials', 
    bestLogic: 'max',
    getRawScore: c => (c.active_trial_count ?? 0) + (c.completed_trial_count ?? 0),
    getValue: c => (c.active_trial_count ?? 0) + (c.completed_trial_count ?? 0),
    render: (c) => {
      const trials = (c.active_trial_count ?? 0) + (c.completed_trial_count ?? 0);
      return trials > 0 ? trials.toLocaleString() : NL;
    }
  },
  { kind: 'data', label: 'Regulatory', getValue: c => c.regulatory, render: (c) => txt(c.regulatory) },
  { kind: 'data', label: 'WADA Status', getValue: c => c.wada_status, render: (c) => wadaLabel(c.wada_status) },

  { kind: 'group', label: 'Pharmacology' },
  {
    kind: 'data',
    label: 'Half-Life',
    glossaryTerm: 'Half-Life',
    bestLogic: 'max',
    getRawScore: c => parseHalfLifeHours(c.half_life),
    getValue: c => c.half_life,
    render: (c, maxHl) => {
      if (!c.half_life) return NL;
      const hlVal = parseHalfLifeHours(c.half_life);
      const pct = maxHl && maxHl > 0 ? (hlVal / maxHl) * 100 : 0;
      return (
        <div>
          <div style={{ color: 'var(--teal, #00C4BC)', fontWeight: 700, marginBottom: 4 }}>{c.half_life}</div>
          {pct > 0 && (
            <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden', width: '100%', maxWidth: 150 }}>
              <div style={{ height: '100%', width: `${pct}%`, background: 'var(--teal, #00C4BC)' }} />
            </div>
          )}
        </div>
      );
    },
  },
  { kind: 'data', label: 'Mechanism', glossaryTerm: 'Mechanism', getValue: c => c.pk_summary, render: (c) => txt(c.pk_summary) },
  { kind: 'data', label: 'Reported Findings', getValue: c => c.benefits, render: (c) => txt(c.benefits) },
  { kind: 'data', label: 'Side Effects', getValue: c => c.side_effects, render: (c) => txt(c.side_effects) },
  { kind: 'data', label: 'Warnings', getValue: c => c.warnings, render: (c) => txt(c.warnings) },

  { kind: 'group', label: 'Handling & Storage' },
  { kind: 'data', label: 'Form', getValue: c => c.handling?.form, render: (c) => txt(c.handling?.form) },
  { kind: 'data', label: 'Diluent', glossaryTerm: 'Reconstitution', getValue: c => c.handling?.diluent, render: (c) => txt(c.handling?.diluent) },
  { kind: 'data', label: 'Storage Temperature', glossaryTerm: 'Storage', getValue: c => c.handling?.storage_temp, render: (c) => txt(c.handling?.storage_temp) },
  {
    kind: 'data',
    label: 'Light Sensitive',
    getValue: c => c.handling?.light_sensitive,
    render: (c) => (c.handling?.light_sensitive == null ? NL : c.handling.light_sensitive ? 'Yes' : 'No'),
  },
  { kind: 'data', label: 'Freeze / Thaw', getValue: c => c.handling?.freeze_thaw, render: (c) => txt(c.handling?.freeze_thaw) },
  {
    kind: 'data',
    label: 'Reconstituted Shelf Life',
    bestLogic: 'max',
    getRawScore: c => c.reconstitution_shelf_days ?? c.handling?.reconstituted_days ?? 0,
    getValue: c => c.reconstitution_shelf_days ?? c.handling?.reconstituted_days,
    render: (c) => {
      const d = c.reconstitution_shelf_days ?? c.handling?.reconstituted_days;
      return d != null ? `${d} Days Refrigerated` : NL;
    },
  },
];

const KNOWN_SYNERGIES = [
  { pairs: ['bpc-157', 'tb-500'], message: 'Synergy Detected: BPC-157 and TB-500 act highly synergistically for combined systemic and localized tissue/tendon repair.' },
  { pairs: ['cjc-1295-without-dac', 'ipamorelin'], message: 'Synergy Detected: CJC-1295 + Ipamorelin stack amplifies GH pulse amplitude without spiking cortisol or prolactin.' },
  { pairs: ['tirzepatide', 'retatrutide'], message: 'Warning: Compounding GLP-1/GIP agonists may lead to severe gastrointestinal distress.' }
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

  // Initialize from URL ?compare= or initialSlugs
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>(() => {
    let slugsToLoad = initialSlugs;
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      const urlCompare = sp.get('compare');
      if (urlCompare) slugsToLoad = urlCompare.split(',').filter(Boolean);
    }
    return slugsToLoad.filter((s) => compounds.some((c) => c.slug === s)).slice(0, MAX_COLUMNS);
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [diffMode, setDiffMode] = useState(false);
  const [copied, setCopied] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Accordion State
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Mobile View Anchor UX State
  const [mobileViewIndex, setMobileViewIndex] = useState<number>(1);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sync state to URL without reloading page
  useEffect(() => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    if (selectedSlugs.length > 0) {
      params.set('compare', selectedSlugs.join(','));
      params.delete('add'); // cleanup old param if exists
    } else {
      params.delete('compare');
      params.delete('add');
    }
    const target = `${pathname}?${params.toString()}`;
    router.replace(target, { scroll: false });
  }, [selectedSlugs, pathname, searchParams, router]);

  let clampedMobileIndex = mobileViewIndex;
  if (clampedMobileIndex >= selectedSlugs.length && selectedSlugs.length > 1) {
    clampedMobileIndex = selectedSlugs.length - 1;
  }

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

  const displayedSelected = useMemo(() => {
    return isMobile && selected.length > 1 
      ? [selected[0], selected[clampedMobileIndex]]
      : selected;
  }, [isMobile, selected, clampedMobileIndex]);

  const maxHalfLife = useMemo(() => {
    return Math.max(...displayedSelected.map(c => parseHalfLifeHours(c.half_life)), 0);
  }, [displayedSelected]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const lower = searchQuery.toLowerCase();
    return compounds.filter((c) => 
      !selectedSlugs.includes(c.slug) && 
      (c.display_name.toLowerCase().includes(lower) || (c.category && c.category.toLowerCase().includes(lower)) || c.slug.toLowerCase().includes(lower))
    ).slice(0, 10);
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

  const toggleGroup = (label: string) => {
    setCollapsedGroups(prev => {
      const n = new Set(prev);
      if (n.has(label)) n.delete(label);
      else n.add(label);
      return n;
    });
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString());
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (sourceIndex === targetIndex || isNaN(sourceIndex)) return;
    
    setSelectedSlugs(prev => {
      const next = [...prev];
      const [removed] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, removed);
      return next;
    });
  };

  function handleShare() {
    if (typeof window === 'undefined') return;
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleExportCSV() {
    if (selected.length === 0) return;
    
    let csv = 'Attribute,';
    csv += selected.map(c => `"${c.display_name}"`).join(',') + '\n';
    
    for (const row of ROWS) {
      if (row.kind === 'group') {
        csv += `"${row.label}"\n`;
      } else {
        csv += `"${row.label}",`;
        csv += selected.map(c => {
          const v = String(row.getValue(c)).replace(/"/g, '""');
          return `"${v}"`;
        }).join(',') + '\n';
      }
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `pepnationlab_compare_${selectedSlugs.join('_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  const canAdd = selected.length < MAX_COLUMNS;
  const colSpan = displayedSelected.length + 1;
  const colors = ['#00C4BC', '#FF6B6B', '#FCA311', '#9F7AEA'];

  // Radar Data
  const radarData: RadarDataPoint[] = useMemo(() => {
    if (selected.length === 0) return [];
    return [
      { 
        label: 'Evidence', 
        scores: selected.map(c => {
          const t = evidenceTier(c.evidence_tier);
          return t.label === 'FDA Approved' ? 100 : t.label === 'Investigational' ? 80 : t.label === 'Preclinical' ? 60 : 40;
        })
      },
      { 
        label: 'Safety', 
        scores: selected.map(c => {
          if (c.risk_level === 'low') return 100;
          if (c.risk_level === 'moderate') return 70;
          if (c.risk_level === 'high') return 40;
          return 20;
        })
      },
      { 
        label: 'Citations', 
        scores: selected.map(c => {
          const ct = c.pubmed_citation_count || 0;
          return Math.min(100, Math.max(10, (ct / 2000) * 100));
        })
      },
      { 
        label: 'Half-Life', 
        scores: selected.map(c => {
          if (!maxHalfLife) return 20;
          return Math.min(100, Math.max(10, (parseHalfLifeHours(c.half_life) / maxHalfLife) * 100));
        })
      }
    ];
  }, [selected, maxHalfLife]);

  // Synergy Detection
  const activeSynergies = KNOWN_SYNERGIES.filter(syn => 
    syn.pairs.every(slug => selectedSlugs.includes(slug))
  );

  // Smart Summary
  const smartSummary = useMemo(() => {
    if (selected.length !== 2) return null;
    const [a, b] = selected;
    const aHl = parseHalfLifeHours(a.half_life);
    const bHl = parseHalfLifeHours(b.half_life);
    let hlText = '';
    if (aHl && bHl) {
      if (aHl > bHl) hlText = `${a.display_name} has a ${(aHl/bHl).toFixed(1)}x longer half-life than ${b.display_name}.`;
      else if (bHl > aHl) hlText = `${b.display_name} has a ${(bHl/aHl).toFixed(1)}x longer half-life than ${a.display_name}.`;
    }
    return hlText;
  }, [selected]);

  return (
    <div>
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body { background: #fff !important; color: #000 !important; }
          .no-print { display: none !important; }
          .glass-panel { background: #fff !important; border: 1px solid #ccc !important; padding: 0 !important; margin: 0 !important; box-shadow: none !important; }
          td, th { color: #000 !important; background: #fff !important; border-bottom: 1px solid #ddd !important; }
          .print-group { background: #f5f5f5 !important; color: #000 !important; border-top: 2px solid #ccc !important; }
          a { color: #000 !important; text-decoration: none !important; }
          span[style*="border"] { border: 1px solid #000 !important; color: #000 !important; background: transparent !important; }
        }
      `}} />

      {/* Search / Add Bar */}
      <div
        className="no-print"
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
              placeholder={canAdd ? "Search for a compound to compare..." : `Maximum of ${MAX_COLUMNS} compounds selected`}
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
                  No compounds found matching &quot;{searchQuery}&quot;
                </div>
              )}
            </div>
          )}
        </div>
        
        <span style={{ color: 'var(--silver, #A8B4C0)', fontSize: '0.85rem', fontWeight: 700 }}>
          {selected.length} Of {MAX_COLUMNS} Selected
        </span>

        {selected.length >= 2 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: 'var(--silver)', fontSize: '0.85rem', fontWeight: 800, userSelect: 'none' }}>
              <input 
                type="checkbox" 
                checked={diffMode} 
                onChange={(e) => setDiffMode(e.target.checked)} 
                style={{ accentColor: '#00C4BC', width: 16, height: 16 }}
              />
              Highlight Differences
            </label>
            <button
              type="button"
              onClick={handleExportCSV}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                color: 'var(--white)', borderRadius: 8, padding: '8px 12px',
                fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
              }}
            >
              <Download size={14} /> Export
            </button>
            <button
              type="button"
              onClick={handleShare}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                color: 'var(--white)', borderRadius: 8, padding: '8px 12px',
                fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
              }}
            >
              {copied ? <Check size={14} color="#00C4BC" /> : <Share2 size={14} />}
              {copied ? 'Copied!' : 'Share'}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                color: 'var(--white)', borderRadius: 8, padding: '8px 12px',
                fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
              }}
            >
              <Printer size={14} />
              Print
            </button>
          </div>
        )}

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

      {activeSynergies.map((syn, idx) => (
        <div key={idx} style={{ background: 'rgba(104,211,145,0.1)', border: '1px solid rgba(104,211,145,0.3)', color: '#68D391', padding: '12px 16px', borderRadius: 8, marginBottom: 24, fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>🔥</span> {syn.message}
        </div>
      ))}

      {smartSummary && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px 16px', borderRadius: 8, marginBottom: 24, fontSize: '0.9rem', fontWeight: 600, color: 'var(--silver)' }}>
          <span style={{ color: 'var(--teal)' }}>Smart Summary:</span> {smartSummary}
        </div>
      )}

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
          {selected.length > 2 && (
            <div className="glass-panel no-print" style={{ borderRadius: 'var(--radius-lg, 12px)', padding: 'var(--space-4, 16px)', overflow: 'hidden' }}>
              <h3 style={{ fontSize: '1.2rem', color: 'var(--white, #FFFFFF)', marginBottom: 'var(--space-4, 16px)', textAlign: 'center', fontWeight: 800 }}>
                Profile Comparison
              </h3>
              <AttributeRadarChart data={radarData} colors={colors} size={300} />
            </div>
          )}

          <div className="glass-panel" style={{ borderRadius: 'var(--radius-lg, 12px)', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '480px', position: 'relative' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 20 }}>
                <tr>
                  <th className="print-th" style={{ ...labelCellStyle, textAlign: 'left', width: '20%', background: '#162230', zIndex: 30 }} scope="col">
                    Attribute
                  </th>
                  {displayedSelected.map((c) => {
                    const originalIndex = selected.findIndex(x => x.slug === c.slug);
                    const color = colors[originalIndex % colors.length];
                    
                    return (
                      <th 
                        key={c.slug} 
                        className="print-th" 
                        style={{ ...cellStyle, textAlign: 'left', width: `${80 / displayedSelected.length}%`, background: '#162230' }} 
                        scope="col"
                        draggable={!isMobile}
                        onDragStart={(e) => handleDragStart(e, originalIndex)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleDrop(e, originalIndex)}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: 'space-between',
                            gap: 'var(--space-2, 8px)',
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {!isMobile && <GripHorizontal size={14} color="rgba(255,255,255,0.2)" style={{ cursor: 'grab' }} />}
                              
                              {/* Mobile Navigation */}
                              {isMobile && originalIndex !== 0 && selected.length > 2 && (
                                <button
                                  onClick={() => setMobileViewIndex(prev => prev > 1 ? prev - 1 : selected.length - 1)}
                                  style={{ background: 'none', border: 'none', color: 'var(--silver)', cursor: 'pointer', padding: 0 }}
                                >
                                  <ChevronLeft size={18} />
                                </button>
                              )}

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

                              {isMobile && originalIndex !== 0 && selected.length > 2 && (
                                <button
                                  onClick={() => setMobileViewIndex(prev => prev < selected.length - 1 ? prev + 1 : 1)}
                                  style={{ background: 'none', border: 'none', color: 'var(--silver)', cursor: 'pointer', padding: 0 }}
                                >
                                  <ChevronRight size={18} />
                                </button>
                              )}
                            </div>
                            
                            {/* Badges */}
                            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                              {c.evidence_tier === 'approved_drug' && <span style={{ background: 'rgba(104,211,145,0.15)', color: '#68D391', padding: '2px 6px', borderRadius: 4, fontSize: '0.65rem', fontWeight: 800 }}>FDA</span>}
                              {c.wada_status !== 'Permitted' && <span style={{ background: 'rgba(229,62,62,0.15)', color: '#FC8181', padding: '2px 6px', borderRadius: 4, fontSize: '0.65rem', fontWeight: 800 }}>WADA 🚫</span>}
                              {c.regulatory?.toLowerCase().includes('orphan') && <span style={{ background: 'rgba(246,173,85,0.15)', color: '#F6AD55', padding: '2px 6px', borderRadius: 4, fontSize: '0.65rem', fontWeight: 800 }}>ORPHAN</span>}
                            </div>
                          </div>

                          <button
                            type="button"
                            className="no-print"
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
                {ROWS.map((row) => {
                  if (row.kind === 'group') {
                    const isCollapsed = collapsedGroups.has(row.label);
                    return (
                      <tr key={`g-${row.label}`} onClick={() => toggleGroup(row.label)}>
                        <td className="print-group" style={{ ...groupCellStyle, position: 'sticky', left: 0, zIndex: 10 }} colSpan={colSpan}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                            {row.label}
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  // Find which group this data row belongs to (by looking backwards in ROWS array)
                  let currentGroupLabel = '';
                  const rowIdx = ROWS.indexOf(row);
                  for (let i = rowIdx; i >= 0; i--) {
                    if (ROWS[i].kind === 'group') {
                      currentGroupLabel = ROWS[i].label;
                      break;
                    }
                  }

                  if (collapsedGroups.has(currentGroupLabel)) {
                    return null;
                  }

                  const values = displayedSelected.map(c => row.getValue(c));
                  const allSame = values.every(v => v === values[0]);
                  const isDiff = !allSame && displayedSelected.length > 1;

                  const trStyle: React.CSSProperties = { transition: 'background 0.2s' };
                  const tdLabelStyle: React.CSSProperties = { ...labelCellStyle, background: '#162230', transition: 'color 0.2s' };
                  const valueCellStyle: React.CSSProperties = { ...cellStyle, transition: 'opacity 0.2s' };

                  if (diffMode) {
                    if (isDiff) {
                      trStyle.background = `rgba(0,196,188,0.08)`;
                      tdLabelStyle.background = `linear-gradient(rgba(0,196,188,0.08), rgba(0,196,188,0.08)), #162230`;
                    } else {
                      tdLabelStyle.color = 'rgba(168,180,192,0.3)';
                      valueCellStyle.opacity = 0.3;
                    }
                  }

                  // Winner Engine Calculation
                  const bestIndices: number[] = [];
                  if (row.bestLogic && displayedSelected.length > 1 && !allSame) {
                    const scores = displayedSelected.map(c => row.getRawScore ? row.getRawScore(c) : 0);
                    const validScores = scores.filter(s => typeof s === 'number' && !isNaN(s) && s !== Infinity);
                    if (validScores.length > 0) {
                      const bestValue = row.bestLogic === 'max' ? Math.max(...validScores) : Math.min(...validScores);
                      scores.forEach((s, idx) => {
                        if (s === bestValue) bestIndices.push(idx);
                      });
                    }
                  }

                  return (
                    <tr key={row.label} style={trStyle}>
                      <td style={tdLabelStyle}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          {row.label}
                          {row.glossaryTerm && <InCellGlossaryTooltip term={row.glossaryTerm} />}
                        </div>
                      </td>
                      {displayedSelected.map((c, idx) => {
                        const isWinner = bestIndices.includes(idx);
                        return (
                          <td key={c.slug} style={{ ...valueCellStyle, position: 'relative' }}>
                            {isWinner && (
                              <div style={{ position: 'absolute', top: 4, right: 4, fontSize: '0.65rem', background: 'var(--teal)', color: '#04221F', padding: '2px 6px', borderRadius: 4, fontWeight: 800 }}>
                                TOP PICK 👑
                              </div>
                            )}
                            <div style={isWinner ? { borderLeft: '2px solid var(--teal)', paddingLeft: 8, marginLeft: -10 } : {}}>
                              {row.render(c, maxHalfLife)}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
