'use client';

/**
 * R35 Phase 3 & 4 — Compare drawer for agent storefronts.
 *
 * Fixed, bottom-anchored drawer that lets a researcher pin up to 3 products
 * from the modal's "Pin To Compare" button and view them side by side.
 *
 * Includes a full-screen StorefrontCompareModal that renders the attributes matrix.
 */

import { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Scale, ChevronDown, ChevronRight, GripHorizontal, ChevronLeft, ThumbsUp, ThumbsDown, Trophy, AlertTriangle, Info } from 'lucide-react';
import { evidenceTier, type Compound, RISK_META, researchAreaLabel, wadaLabel } from '@/lib/compounds';
import InCellGlossaryTooltip from '../research/InCellGlossaryTooltip';
import AttributeRadarChart from '../research/AttributeRadarChart';

interface PinnedItem {
  productName: string;
  imageUrl: string | null;
  pricePerVialDollars: number | null;
  compoundSlug: string | null;
  evidenceTierKey: string | null;
  pinnedAt: number;
}

const STORAGE_KEY = 'pnl:compare';
const MAX_PINNED = 4; // bumped to 4

function readPinned(): PinnedItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY) || '[]';
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.slice(-MAX_PINNED);
  } catch {
    return [];
  }
}

function writePinned(list: PinnedItem[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(-MAX_PINNED)));
  } catch {
    // localStorage may be unavailable; ignore.
  }
}

function dispatchAddToCart(productName: string) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent('pnl:add-to-cart-by-name', {
      detail: { name: productName },
    }));
  } catch {
    // ignore
  }
}

function dispatchAddAllToCart(items: PinnedItem[]) {
  for (const item of items) {
    dispatchAddToCart(item.productName);
  }
}

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
  background: 'linear-gradient(rgba(192,197,206,0.1), rgba(192,197,206,0.1)), #0F161E',
  borderTop: '1px solid rgba(192,197,206,0.3)',
  borderBottom: '1px solid rgba(192,197,206,0.3)',
  color: 'var(--teal, #C0C5CE)',
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

const KNOWN_SYNERGIES = [
  { pairs: ['bpc-157', 'tb-500'], type: 'synergy', message: 'BPC-157 + TB-500 act highly synergistically for combined systemic and localized tissue/tendon repair.' },
  { pairs: ['cjc-1295-without-dac', 'ipamorelin'], type: 'synergy', message: 'CJC-1295 + Ipamorelin amplifies GH pulse amplitude without spiking cortisol or prolactin.' },
  { pairs: ['bpc-157', 'ghk-cu'], type: 'synergy', message: 'BPC-157 + GHK-Cu offers complementary wound healing — GHK-Cu drives collagen synthesis while BPC-157 supports vascular repair.' },
  { pairs: ['sermorelin', 'ipamorelin'], type: 'synergy', message: 'Sermorelin + Ipamorelin provides dual-pathway GH stimulation (GHRH + GHSR) for amplified secretagogue effect.' },
  { pairs: ['epitalon', 'dsip'], type: 'synergy', message: 'Epitalon + DSIP may complement each other for circadian rhythm regulation and sleep architecture.' },
  { pairs: ['pt-141', 'kisspeptin-10'], type: 'synergy', message: 'PT-141 + Kisspeptin-10 provides complementary central and peripheral sexual health pathways.' },
  { pairs: ['tirzepatide', 'retatrutide'], type: 'conflict', message: 'Warning: Compounding GLP-1/GIP agonists may lead to severe gastrointestinal distress.' },
  { pairs: ['semaglutide', 'tirzepatide'], type: 'conflict', message: 'Warning: Stacking two incretin agents is not recommended — compounding GI effects and unclear additive benefit.' },
];

// ── Weighted Scoring Engine ──────────────────────────────────────────────────
interface CompoundScore {
  total: number;
  breakdown: { evidence: number; safety: number; coverage: number; science: number; handling: number };
  verdict: string;
}

function scoreCompoundFromPinned(p: PinnedItem, compoundsBySlug: Record<string, Compound>): CompoundScore {
  const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null;
  const evidenceScore =
    p.evidenceTierKey === 'approved_drug' ? 30 :
    p.evidenceTierKey === 'investigational' ? 22 :
    p.evidenceTierKey === 'preclinical' ? 14 :
    p.evidenceTierKey === 'research_chemical' ? 6 : 3;
  const safetyScore =
    c?.risk_level === 'low' ? 25 :
    c?.risk_level === 'moderate' ? 18 :
    c?.risk_level === 'high' ? 9 :
    c?.risk_level === 'critical' ? 2 : 10;
  const areaCount = (c?.research_areas ?? []).length;
  const coverageScore = Math.min(15, areaCount * 2.5);
  const citeScore = Math.min(8, ((c?.pubmed_citation_count ?? 0) / 500) * 8);
  const trialScore = Math.min(7, (((c?.active_trial_count ?? 0) + (c?.completed_trial_count ?? 0)) / 20) * 7);
  const scienceScore = citeScore + trialScore;
  const hlHours = (() => { if (!c?.half_life) return 0; const s = c.half_life.toLowerCase(); const m = s.match(/(\d+(?:\.\d+)?)/); if (!m) return 0; const n = parseFloat(m[1]); if (s.includes('min')) return n/60; if (s.includes('day')) return n*24; if (s.includes('week')) return n*24*7; return n; })();
  const hlScore = hlHours > 0 ? Math.min(8, (hlHours / 168) * 8) : 2;
  const shelfDays = c?.reconstitution_shelf_days ?? c?.handling?.reconstituted_days ?? 0;
  const shelfScore = shelfDays > 0 ? Math.min(7, (shelfDays / 60) * 7) : 2;
  const handlingScore = hlScore + shelfScore;
  const total = Math.round(evidenceScore + safetyScore + coverageScore + scienceScore + handlingScore);
  const dims = [
    { name: 'evidence strength', val: evidenceScore / 30 },
    { name: 'safety profile', val: safetyScore / 25 },
    { name: 'research coverage', val: coverageScore / 15 },
    { name: 'scientific backing', val: scienceScore / 15 },
    { name: 'handling practicality', val: handlingScore / 15 },
  ];
  const topDim = [...dims].sort((a, b) => b.val - a.val)[0];
  return { total, breakdown: { evidence: Math.round(evidenceScore), safety: Math.round(safetyScore), coverage: Math.round(coverageScore), science: Math.round(scienceScore), handling: Math.round(handlingScore) }, verdict: `Leads in ${topDim.name}` };
}

// ── Pros/Cons Generator ──────────────────────────────────────────────────────
function generateProsConsPinned(p: PinnedItem, compoundsBySlug: Record<string, Compound>): { pros: string[]; cons: string[] } {
  const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null;
  const pros: string[] = [];
  const cons: string[] = [];
  if (p.evidenceTierKey === 'approved_drug') pros.push('FDA/EMA Approved — highest evidence tier');
  else if (p.evidenceTierKey === 'investigational') pros.push('Active human clinical trials underway');
  else if (p.evidenceTierKey === 'preclinical') cons.push('Only preclinical (animal/in-vitro) evidence so far');
  else cons.push('Research compound only — no approved human use');
  if (c?.risk_level === 'low') pros.push('Low risk profile in available literature');
  else if (c?.risk_level === 'moderate') cons.push('Moderate risk — careful handling protocols recommended');
  else if (c?.risk_level === 'high') cons.push('High risk level — significant adverse event reports');
  else if (c?.risk_level === 'critical') cons.push('Critical risk designation — exercise extreme caution');
  if (c?.wada_status === 'prohibited' || c?.wada_status === 'prohibited_males') cons.push('WADA Prohibited — not permitted in tested competitive sport');
  else if (c?.wada_status === 'permitted') pros.push('WADA Permitted — compliant for tested athletes');
  const cites = c?.pubmed_citation_count ?? 0;
  if (cites >= 1000) pros.push(`Extensive scientific literature (${cites.toLocaleString()} PubMed citations)`);
  else if (cites >= 200) pros.push(`Good literature base (${cites.toLocaleString()} PubMed citations)`);
  else if (cites < 50) cons.push('Limited peer-reviewed literature available');
  const trials = (c?.active_trial_count ?? 0) + (c?.completed_trial_count ?? 0);
  if (trials >= 10) pros.push(`Substantial clinical trial history (${trials} trials)`);
  else if (trials > 0) pros.push(`${trials} clinical trial${trials > 1 ? 's' : ''} on record`);
  else cons.push('No registered clinical trials found');
  if (p.pricePerVialDollars != null && p.pricePerVialDollars < 30) pros.push('Competitively priced per vial');
  else if (p.pricePerVialDollars != null && p.pricePerVialDollars > 150) cons.push('Premium price point — factor into protocol cost');
  const areaCount = (c?.research_areas ?? []).length;
  if (areaCount >= 4) pros.push(`Broad research interest across ${areaCount} application areas`);
  else if (areaCount === 1) cons.push('Narrow research scope — one primary application area');
  if ((c?.best_stacked_with ?? []).length > 0) pros.push(`Known synergistic partners: ${c!.best_stacked_with!.join(', ')}`);
  if (c?.is_temp_sensitive) cons.push('Temperature-sensitive — requires cold-chain handling');
  return { pros, cons };
}

export default function StorefrontCompareDrawer({ 
  primaryColor,
  compoundsBySlug = {}
}: { 
  primaryColor: string;
  compoundsBySlug?: Record<string, Compound>;
}) {
  const [pinned, setPinned] = useState<PinnedItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [showMatrix, setShowMatrix] = useState(false);
  const [diffMode, setDiffMode] = useState(false);
  
  // Accordion State
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Mobile View UX
  const [mobileViewIndex, setMobileViewIndex] = useState<number>(1);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);



  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    setPinned(readPinned());

    const onAdd = (e: Event) => {
      const detail = (e as CustomEvent<PinnedItem>).detail;
      if (!detail || !detail.productName) return;
      setPinned((prev) => {
        const filtered = prev.filter((p) => p.productName !== detail.productName);
        const next = [...filtered, detail].slice(-MAX_PINNED);
        writePinned(next);
        return next;
      });
      setCollapsed(false);
    };

    const onRemove = (e: Event) => {
      const detail = (e as CustomEvent<{ productName: string }>).detail;
      if (!detail || !detail.productName) return;
      setPinned((prev) => {
        const next = prev.filter((p) => p.productName !== detail.productName);
        writePinned(next);
        return next;
      });
    };

    const onClear = () => {
      setPinned([]);
      writePinned([]);
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setPinned(readPinned());
    };

    window.addEventListener('pnl:compare-add', onAdd as EventListener);
    window.addEventListener('pnl:compare-remove', onRemove as EventListener);
    window.addEventListener('pnl:compare-clear', onClear as EventListener);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('pnl:compare-add', onAdd as EventListener);
      window.removeEventListener('pnl:compare-remove', onRemove as EventListener);
      window.removeEventListener('pnl:compare-clear', onClear as EventListener);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  function removeAt(i: number) {
    setPinned((prev) => {
      const next = prev.filter((_, idx) => idx !== i);
      writePinned(next);
      return next;
    });
  }

  function clearAll() {
    setPinned([]);
    writePinned([]);
  }

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString());
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (sourceIndex === targetIndex || isNaN(sourceIndex)) return;
    
    setPinned(prev => {
      const next = [...prev];
      const [removed] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, removed);
      writePinned(next);
      return next;
    });
  };

  const toggleGroup = (label: string) => {
    setCollapsedGroups(prev => {
      const n = new Set(prev);
      if (n.has(label)) n.delete(label);
      else n.add(label);
      return n;
    });
  };

  type RowDef =
    | { kind: 'group'; label: string }
    | { 
        kind: 'data'; 
        label: string; 
        glossaryTerm?: string;
        bestLogic?: 'max' | 'min';
        getRawScore?: (p: PinnedItem) => number;
        getValue: (p: PinnedItem) => unknown; 
        render: (p: PinnedItem, maxHalfLife?: number) => React.ReactNode 
      };

  const ROWS: RowDef[] = useMemo(() => {
    return [
      { kind: 'group', label: 'Commercial' },
      {
        kind: 'data', label: 'Price Per Vial',
        bestLogic: 'min',
        getRawScore: (p) => p.pricePerVialDollars ?? Infinity,
        getValue: (p) => p.pricePerVialDollars ?? Infinity,
        render: (p) => p.pricePerVialDollars != null ? <span style={{ color: primaryColor, fontWeight: 800 }}>${Number(p.pricePerVialDollars).toFixed(2)}</span> : NL
      },
      { kind: 'group', label: 'Overview' },
      {
        kind: 'data', label: 'Research Summary',
        getValue: (p: PinnedItem) => { const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; return c?.eli5_summary ?? c?.plain_summary ?? ''; },
        render: (p: PinnedItem) => { const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; const text = c?.eli5_summary ?? c?.plain_summary; return text ? <span style={{ fontSize: '0.8rem', lineHeight: 1.5, display: 'block', maxHeight: 100, overflowY: 'auto' }}>{text}</span> : NL; }
      },
      {
        kind: 'data', label: 'Studied For',
        getValue: (p: PinnedItem) => { const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; return c?.studied_for?.join(',') ?? ''; },
        render: (p: PinnedItem) => { const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; return (c?.studied_for ?? []).length ? c!.studied_for.join(', ') : NL; }
      },
      {
        kind: 'data', label: 'Best Stacked With',
        getValue: (p: PinnedItem) => { const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; return c?.best_stacked_with?.join(',') ?? ''; },
        render: (p: PinnedItem) => { const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; return c?.best_stacked_with?.length ? c.best_stacked_with.join(', ') : NL; }
      },
      { kind: 'group', label: 'Evidence & Risk' },
      {
        kind: 'data', label: 'Evidence Tier', glossaryTerm: 'Evidence Tier',
        bestLogic: 'max',
        getRawScore: (p) => {
          if (p.evidenceTierKey === 'approved_drug') return 5;
          if (p.evidenceTierKey === 'investigational') return 4;
          if (p.evidenceTierKey === 'preclinical') return 3;
          if (p.evidenceTierKey === 'research_chemical') return 2;
          return 1;
        },
        getValue: (p: PinnedItem) => p.evidenceTierKey || NL,
        render: (p: PinnedItem) => {
          const tier = p.evidenceTierKey ? evidenceTier(p.evidenceTierKey) : null;
          return tier ? (
            <span style={{ color: tier.color, fontWeight: 700, border: `1px solid ${tier.color}`, padding: '2px 8px', borderRadius: 999, fontSize: '0.7rem' }}>{tier.label}</span>
          ) : NL;
        }
      },
      {
        kind: 'data', label: 'Risk Level',
        bestLogic: 'min',
        getRawScore: (p) => {
          const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null;
          if (c?.risk_level === 'low') return 1; if (c?.risk_level === 'moderate') return 2; if (c?.risk_level === 'high') return 3; if (c?.risk_level === 'critical') return 4; return 5;
        },
        getValue: (p: PinnedItem) => { const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; return c?.risk_level || NL; },
        render: (p: PinnedItem) => { const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; const r = c?.risk_level ? RISK_META[c.risk_level] : null; return r ? <span style={{ color: r.color, fontWeight: 700 }}>{r.label}</span> : NL; }
      },
      {
        kind: 'data', label: 'WADA Status',
        getValue: (p: PinnedItem) => { const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; return c?.wada_status || NL; },
        render: (p: PinnedItem) => { const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; return c?.wada_status ? wadaLabel(c.wada_status) : NL; }
      },
      {
        kind: 'data', label: 'PubMed Citations',
        bestLogic: 'max',
        getRawScore: (p) => { const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; return c?.pubmed_citation_count ?? 0; },
        getValue: (p: PinnedItem) => { const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; return c?.pubmed_citation_count ?? 0; },
        render: (p: PinnedItem) => { const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; return c?.pubmed_citation_count ? c.pubmed_citation_count.toLocaleString() : NL; }
      },
      {
        kind: 'data', label: 'Clinical Trials',
        bestLogic: 'max',
        getRawScore: (p) => { const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; return (c?.active_trial_count ?? 0) + (c?.completed_trial_count ?? 0); },
        getValue: (p: PinnedItem) => { const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; return (c?.active_trial_count ?? 0) + (c?.completed_trial_count ?? 0); },
        render: (p: PinnedItem) => { const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; const t = (c?.active_trial_count ?? 0) + (c?.completed_trial_count ?? 0); return t > 0 ? String(t) : NL; }
      },
      { kind: 'group', label: 'Pharmacology' },
      {
        kind: 'data', label: 'Half-Life', glossaryTerm: 'Half-Life',
        bestLogic: 'max',
        getRawScore: (p) => { const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; return parseHalfLifeHours(c?.half_life); },
        getValue: (p: PinnedItem) => { const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; return c?.half_life || NL; },
        render: (p: PinnedItem, maxHalfLife?: number) => {
          const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null;
          if (!c?.half_life) return NL;
          const hlVal = parseHalfLifeHours(c.half_life);
          const pct = maxHalfLife && maxHalfLife > 0 ? (hlVal / maxHalfLife) * 100 : 0;
          return (<div><div style={{ color: primaryColor, fontWeight: 700, marginBottom: 4 }}>{c.half_life}</div>{pct > 0 && (<div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden', width: '100%', maxWidth: 150 }}><div style={{ height: '100%', width: `${pct}%`, background: primaryColor }} /></div>)}</div>);
        }
      },
      {
        kind: 'data', label: 'Typical Frequency',
        getValue: (p: PinnedItem) => { const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; return txt(c?.typical_frequency); },
        render: (p: PinnedItem) => { const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; return txt(c?.typical_frequency); }
      },
      {
        kind: 'data', label: 'Mechanism / PK', glossaryTerm: 'Mechanism',
        getValue: (p: PinnedItem) => { const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; return txt(c?.pk_summary); },
        render: (p: PinnedItem) => { const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; return txt(c?.pk_summary); }
      },
      {
        kind: 'data', label: 'Molecular Target',
        getValue: (p: PinnedItem) => { const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; return txt(c?.molecular_target); },
        render: (p: PinnedItem) => { const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; return txt(c?.molecular_target); }
      },
      {
        kind: 'data', label: 'Research Areas',
        getValue: (p: PinnedItem) => { const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; return c?.research_areas?.length ? c.research_areas.join(',') : NL; },
        render: (p: PinnedItem) => { const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; return c?.research_areas?.length ? c.research_areas.map(researchAreaLabel).join(', ') : NL; }
      },
      {
        kind: 'data', label: 'Reported Findings',
        getValue: (p: PinnedItem) => { const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; return txt(c?.benefits); },
        render: (p: PinnedItem) => { const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; return txt(c?.benefits); }
      },
      {
        kind: 'data', label: 'Side Effects',
        getValue: (p: PinnedItem) => { const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; return txt(c?.side_effects); },
        render: (p: PinnedItem) => { const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; return txt(c?.side_effects); }
      },
      {
        kind: 'data', label: 'Warnings',
        getValue: (p: PinnedItem) => { const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; return txt(c?.warnings); },
        render: (p: PinnedItem) => { const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; return txt(c?.warnings); }
      },
      { kind: 'group', label: 'Handling' },
      {
        kind: 'data', label: 'Storage Temp', glossaryTerm: 'Storage',
        getValue: (p: PinnedItem) => { const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; return txt(c?.handling?.storage_temp); },
        render: (p: PinnedItem) => { const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; return txt(c?.handling?.storage_temp); }
      },
      {
        kind: 'data', label: 'Diluent', glossaryTerm: 'Reconstitution',
        getValue: (p: PinnedItem) => { const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; return txt(c?.handling?.diluent); },
        render: (p: PinnedItem) => { const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; return txt(c?.handling?.diluent); }
      },
      {
        kind: 'data', label: 'Light Sensitive',
        getValue: (p: PinnedItem) => { const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; return c?.handling?.light_sensitive == null ? NL : c.handling.light_sensitive ? 'Yes' : 'No'; },
        render: (p: PinnedItem) => { const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; return c?.handling?.light_sensitive == null ? NL : c.handling.light_sensitive ? '⚠️ Yes' : '✓ No'; }
      },
      {
        kind: 'data', label: 'Reconstituted Shelf Life',
        bestLogic: 'max',
        getRawScore: (p) => { const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; return c?.reconstitution_shelf_days ?? c?.handling?.reconstituted_days ?? 0; },
        getValue: (p: PinnedItem) => { const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; const d = c?.reconstitution_shelf_days ?? c?.handling?.reconstituted_days; return d != null ? `${d} Days Refrigerated` : NL; },
        render: (p: PinnedItem) => { const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; const d = c?.reconstitution_shelf_days ?? c?.handling?.reconstituted_days; return d != null ? `${d} Days Refrigerated` : NL; }
      }
    ];
  }, [compoundsBySlug, primaryColor]);

  let clampedMobileIndex = mobileViewIndex;
  if (clampedMobileIndex >= pinned.length && pinned.length > 1) {
    clampedMobileIndex = pinned.length - 1;
  }

  const displayedPinned = isMobile && pinned.length > 1 
    ? [pinned[0], pinned[clampedMobileIndex]] 
    : pinned;

  const maxHalfLife = useMemo(() => {
    return Math.max(...displayedPinned.map(p => {
      const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null;
      return parseHalfLifeHours(c?.half_life);
    }), 0);
  }, [displayedPinned, compoundsBySlug]);

  const maxCitations = useMemo(() => {
    return Math.max(...displayedPinned.map(p => {
      const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null;
      return c?.pubmed_citation_count || 0;
    }), 0);
  }, [displayedPinned, compoundsBySlug]);

  const pinnedScores = useMemo(() => pinned.map(p => scoreCompoundFromPinned(p, compoundsBySlug)), [pinned, compoundsBySlug]);
  const pinnedProsCons = useMemo(() => pinned.map(p => generateProsConsPinned(p, compoundsBySlug)), [pinned, compoundsBySlug]);

  const topPickIdx = useMemo(() => {
    if (pinned.length < 2) return -1;
    let best = 0;
    pinnedScores.forEach((s, i) => { if (s.total > pinnedScores[best].total) best = i; });
    return best;
  }, [pinned, pinnedScores]);

  const [matrixTab, setMatrixTab] = useState<'matrix' | 'proscons' | 'brief'>('matrix');

  const analystBriefLines = useMemo(() => {
    if (pinned.length < 2) return [];
    const lines: string[] = [];
    const sorted = [...pinned].map((p, i) => ({ p, s: pinnedScores[i] })).sort((a, b) => b.s.total - a.s.total);
    const leader = sorted[0]; const runner = sorted[1];
    lines.push(`Overall, ${leader.p.productName} scores highest at ${leader.s.total}/100 on PepNation Lab's composite research index (${leader.s.verdict.toLowerCase()}). ${runner.p.productName} follows at ${runner.s.total}/100${sorted.length > 2 ? `, with ${sorted.slice(2).map(x => `${x.p.productName} at ${x.s.total}`).join(', ')}` : ''}.`);
    const highestEvidence = [...pinned].sort((a, b) => { const r = (e: string | null) => e === 'approved_drug' ? 4 : e === 'investigational' ? 3 : e === 'preclinical' ? 2 : 1; return r(b.evidenceTierKey) - r(a.evidenceTierKey); })[0];
    lines.push(`From an evidence standpoint, ${highestEvidence.productName} carries the strongest regulatory backing as an ${evidenceTier(highestEvidence.evidenceTierKey ?? '').label.toLowerCase()} compound.`);
    const allHl = pinned.map(p => { const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; return { p, hl: parseHalfLifeHours(c?.half_life), raw: c?.half_life }; }).filter(x => x.hl > 0).sort((a, b) => b.hl - a.hl);
    if (allHl.length >= 2) { const lg = allHl[0]; const sh = allHl[allHl.length - 1]; if (lg.p.productName !== sh.p.productName) lines.push(`Pharmacokinetically, ${lg.p.productName} provides a ${(lg.hl/sh.hl).toFixed(1)}x longer half-life than ${sh.p.productName} (${lg.raw} vs. ${sh.raw}), offering greater dosing interval flexibility.`); }
    return lines;
  }, [pinned, pinnedScores, compoundsBySlug]);

  const smartSummary = useMemo(() => {
    if (pinned.length !== 2) return null;
    const [a, b] = pinned;
    const cA = a.compoundSlug ? compoundsBySlug[a.compoundSlug] : null;
    const cB = b.compoundSlug ? compoundsBySlug[b.compoundSlug] : null;
    if (!cA || !cB) return null;
    const aHl = parseHalfLifeHours(cA.half_life);
    const bHl = parseHalfLifeHours(cB.half_life);
    let hlText = '';
    if (aHl && bHl) {
      if (aHl > bHl) hlText = `${a.productName} has a ${(aHl/bHl).toFixed(1)}x longer half-life than ${b.productName}.`;
      else if (bHl > aHl) hlText = `${b.productName} has a ${(bHl/aHl).toFixed(1)}x longer half-life than ${a.productName}.`;
    }
    return hlText;
  }, [pinned, compoundsBySlug]);

  const colors = [primaryColor, '#F6AD55', '#68D391', '#FC8181'];

  const activeSynergiesModal = KNOWN_SYNERGIES.filter(syn =>
    syn.pairs.every(slug => pinned.some(p => p.compoundSlug === slug))
  );

  const maxTrials = useMemo(() => Math.max(...displayedPinned.map(p => { const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; return (c?.active_trial_count ?? 0) + (c?.completed_trial_count ?? 0); }), 1), [displayedPinned, compoundsBySlug]);

  const radarData = useMemo(() => {
    if (pinned.length < 2) return [];
    return [
      { label: 'Evidence', scores: pinned.map(p => p.evidenceTierKey === 'approved_drug' ? 100 : p.evidenceTierKey === 'investigational' ? 78 : p.evidenceTierKey === 'preclinical' ? 55 : 30) },
      { label: 'Safety', scores: pinned.map(p => { const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; return c?.risk_level === 'low' ? 100 : c?.risk_level === 'moderate' ? 70 : c?.risk_level === 'high' ? 35 : 10; }) },
      { label: 'Citations', scores: pinned.map(p => { if (!maxCitations) return 10; const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; return Math.min(100, Math.max(5, ((c?.pubmed_citation_count ?? 0) / maxCitations) * 100)); }) },
      { label: 'Trials', scores: pinned.map(p => { if (!maxTrials) return 5; const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; const t = (c?.active_trial_count ?? 0) + (c?.completed_trial_count ?? 0); return Math.min(100, Math.max(5, (t / maxTrials) * 100)); }) },
      { label: 'Half-Life', scores: pinned.map(p => { if (!maxHalfLife) return 20; const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; return Math.min(100, Math.max(5, (parseHalfLifeHours(c?.half_life) / maxHalfLife) * 100)); }) },
      { label: 'Coverage', scores: pinned.map(p => { const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; return Math.min(100, Math.max(5, ((c?.research_areas ?? []).length / 8) * 100)); }) },
      { label: 'Handling', scores: pinned.map(p => { const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; const shelf = c?.reconstitution_shelf_days ?? c?.handling?.reconstituted_days ?? 0; return Math.min(100, Math.max(5, (shelf / 60) * 100)); }) },
    ];
  }, [pinned, compoundsBySlug, maxCitations, maxHalfLife, maxTrials]);

  if (!mounted) return null;
  if (pinned.length === 0) return null;
  if (typeof document === 'undefined') return null;

  const activeSynergies = activeSynergiesModal;

  return createPortal(
    <>
      <div
        role="region"
        aria-label="Compare Pinned Products"
        style={{
          position: 'fixed',
          left: 0, right: 0,
          bottom: 'env(safe-area-inset-bottom, 0px)',
          zIndex: 99000,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            margin: '0 auto',
            maxWidth: 980,
            pointerEvents: 'auto',
            background: 'linear-gradient(180deg, #131b24 0%, #0a0f14 100%)',
            border: `2px solid ${primaryColor}55`,
            borderBottom: 'none',
            borderRadius: '16px 16px 0 0',
            boxShadow: '0 -10px 32px rgba(0,0,0,0.55)',
            overflow: 'hidden',
          }}
        >
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px',
            background: `linear-gradient(90deg, ${primaryColor}25, transparent)`,
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            flexWrap: 'wrap',
          }}>
            <div style={{
              color: primaryColor, fontWeight: 800, fontSize: '0.86rem',
              textTransform: 'uppercase', letterSpacing: '0.05em',
              flex: 1, minWidth: 150,
            }}>
              Compare ({pinned.length} Of {MAX_PINNED})
            </div>
            {pinned.length >= 2 && (
              <button
                type="button"
                onClick={() => setShowMatrix(true)}
                style={{
                  background: primaryColor, border: `1px solid ${primaryColor}`,
                  color: '#04221F', borderRadius: 8, padding: '6px 16px',
                  fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer',
                  boxShadow: `0 2px 8px ${primaryColor}55`,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <Scale size={14} />
                Compare Attributes
              </button>
            )}
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              style={{
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                color: 'var(--white)', borderRadius: 8, padding: '6px 12px',
                fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer',
              }}
            >
              {collapsed ? 'Expand' : 'Collapse'}
            </button>
            <button
              type="button"
              onClick={() => dispatchAddAllToCart(pinned)}
              aria-label="Add All Pinned To Cart - Stack Builder"
              style={{
                background: 'rgba(255,255,255,0.05)', border: `1px solid rgba(255,255,255,0.12)`,
                color: 'var(--white)', borderRadius: 8, padding: '6px 12px',
                fontSize: '0.74rem', fontWeight: 800, cursor: 'pointer',
              }}
            >
              Add All To Cart
            </button>
            <button
              type="button"
              onClick={clearAll}
              aria-label="Clear All Pinned"
              style={{
                background: 'rgba(229,62,62,0.10)', border: '1px solid rgba(229,62,62,0.32)',
                color: '#F08A8A', borderRadius: 8, padding: '6px 12px',
                fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer',
              }}
            >
              Clear All
            </button>
          </div>

          {!collapsed && (
            <div style={{ padding: 14, display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(180px, 1fr))`, gap: 10 }}>
              {pinned.map((item, i) => {
                const tier = item.evidenceTierKey ? evidenceTier(item.evidenceTierKey) : null;
                const c = item.compoundSlug ? compoundsBySlug[item.compoundSlug] : null;
                return (
                  <div
                    key={item.productName}
                    style={{
                      position: 'relative',
                      padding: 10, borderRadius: 12,
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.10)',
                      display: 'flex', flexDirection: 'column', gap: 8,
                      minHeight: 130,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => removeAt(i)}
                      aria-label={`Remove ${item.productName} From Compare`}
                      style={{
                        position: 'absolute', top: 6, right: 6,
                        width: 24, height: 24, minWidth: 24, minHeight: 24,
                        borderRadius: '50%', padding: 0,
                        background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.18)',
                        color: 'var(--white)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <X size={12} aria-hidden="true" />
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.imageUrl}
                          alt={item.productName}
                          width={36}
                          height={36}
                          style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', background: '#0F1923' }}
                        />
                      ) : (
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: `${primaryColor}25` }} aria-hidden="true" />
                      )}
                      <div style={{
                        flex: 1, color: 'var(--white)', fontWeight: 800,
                        fontSize: '0.82rem', lineHeight: 1.2, paddingRight: 22,
                        overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {item.productName}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {tier && (
                        <span style={{
                          fontSize: '0.64rem', padding: '3px 8px', borderRadius: 9999,
                          background: `${tier.color}1A`, color: tier.color, fontWeight: 800,
                          textTransform: 'uppercase', letterSpacing: '0.04em',
                          border: `1px solid ${tier.color}55`,
                        }}>{tier.label}</span>
                      )}
                      {c?.wada_status !== 'Permitted' && (
                        <span style={{ background: 'rgba(229,62,62,0.15)', color: '#FC8181', padding: '2px 6px', borderRadius: 4, fontSize: '0.65rem', fontWeight: 800 }}>
                          WADA 🚫
                        </span>
                      )}
                      {item.pricePerVialDollars != null && (
                        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: primaryColor, fontFamily: 'var(--font-brand)' }}>
                          ${Number(item.pricePerVialDollars).toFixed(2)}/Vial
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Full-Screen Comparison Modal */}
      {showMatrix && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 'var(--space-4, 16px)'
        }}>
          <div style={{
            background: '#0F161E',
            border: `1px solid ${primaryColor}40`,
            borderRadius: 'var(--radius-xl, 16px)',
            width: '100%', maxWidth: 1200,
            maxHeight: '90vh',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)',
              background: `linear-gradient(90deg, ${primaryColor}15, transparent)`,
              flexWrap: 'wrap',
              gap: 12,
            }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: 'var(--white)' }}>
                Compare Products
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
                {pinned.length >= 2 && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'var(--silver)', fontSize: '0.85rem', fontWeight: 800, userSelect: 'none' }}>
                    <input 
                      type="checkbox" 
                      checked={diffMode} 
                      onChange={(e) => setDiffMode(e.target.checked)} 
                      style={{ accentColor: primaryColor, width: 16, height: 16 }}
                    />
                    Highlight Differences
                  </label>
                )}
                <button
                  type="button"
                  onClick={() => dispatchAddAllToCart(pinned)}
                  style={{
                    background: primaryColor, border: 'none', color: '#04221F',
                    padding: '8px 16px', borderRadius: 8, fontWeight: 800, fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  Add All To Cart
                </button>
                <button
                  onClick={() => setShowMatrix(false)}
                  style={{
                    background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--white)',
                    width: 32, height: 32, borderRadius: '50%', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            
            <div style={{ overflowY: 'auto', padding: '24px', flex: 1 }}>
              {activeSynergies.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  {activeSynergies.map((syn, idx) => (
                    <div key={idx} style={{ background: syn.type === 'conflict' ? 'rgba(229,62,62,0.1)' : 'rgba(104,211,145,0.1)', border: `1px solid ${syn.type === 'conflict' ? 'rgba(229,62,62,0.3)' : 'rgba(104,211,145,0.3)'}`, color: syn.type === 'conflict' ? '#FC8181' : '#68D391', padding: '12px 16px', borderRadius: 8, marginBottom: 8, fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      {syn.type === 'conflict' ? <AlertTriangle size={16} style={{ marginTop: 1, flexShrink: 0 }} /> : <span>🔥</span>}
                      <span><strong>{syn.type === 'conflict' ? 'Conflict' : 'Synergy'}:</strong> {syn.message}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Top Pick + Score Cards */}
              {pinned.length >= 2 && (
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
                  {topPickIdx >= 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, background: 'rgba(0,196,188,0.08)', border: '1px solid rgba(0,196,188,0.2)', borderRadius: 8, padding: '8px 12px' }}>
                      <Trophy size={16} color={primaryColor} />
                      <span style={{ fontWeight: 800, fontSize: '0.88rem', color: primaryColor }}>Top Pick: {pinned[topPickIdx]?.productName}</span>
                      <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', marginLeft: 4 }}>· Highest composite score</span>
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(200px, 1fr))`, gap: 12 }}>
                    {displayedPinned.map((p, dIdx) => {
                      const origIdx = pinned.findIndex(x => x.productName === p.productName);
                      const score = pinnedScores[origIdx];
                      const color = colors[origIdx % colors.length];
                      const pct = score?.total ?? 0;
                      return (
                        <div key={p.productName} style={{ padding: 12, borderRadius: 10, background: origIdx === topPickIdx ? 'rgba(0,196,188,0.06)' : 'rgba(255,255,255,0.02)', border: `1px solid ${origIdx === topPickIdx ? 'rgba(0,196,188,0.3)' : 'rgba(255,255,255,0.08)'}` }}>
                          <div style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--white)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
                            {p.productName}
                            {origIdx === topPickIdx && <Trophy size={11} color={primaryColor} />}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <div style={{ fontSize: '1.3rem', fontWeight: 900, color }}>{pct}</div>
                            <div style={{ flex: 1 }}>
                              <div style={{ height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 999 }} />
                              </div>
                              <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{score?.verdict}</div>
                            </div>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 6px' }}>
                            {score && [['Ev', score.breakdown.evidence, 30], ['Sa', score.breakdown.safety, 25], ['Sc', score.breakdown.science, 15], ['Ha', score.breakdown.handling, 15]].map(([lbl, val, max]) => (
                              <div key={String(lbl)} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)' }}>
                                <span style={{ minWidth: 14 }}>{lbl}</span>
                                <div style={{ flex: 1, height: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 999, overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${(Number(val)/Number(max))*100}%`, background: color, borderRadius: 999 }} />
                                </div>
                                <span>{val}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Radar Chart */}
              {radarData.length >= 2 && (
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
                  <div style={{ textAlign: 'center', fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', marginBottom: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Research Profile Radar</div>
                  <AttributeRadarChart data={radarData} colors={colors} size={260} />
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
                    {pinned.map((p, i) => <div key={p.productName} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.68rem', color: 'rgba(255,255,255,0.5)' }}><div style={{ width: 8, height: 8, borderRadius: 2, background: colors[i % colors.length] }} />{p.productName}</div>)}
                  </div>
                </div>
              )}

              {/* Tab navigation */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {([['matrix', '📊 Matrix'], ['proscons', '⚖️ Pros & Cons'], ['brief', '🧠 Brief']] as const).map(([id, label]) => (
                  <button key={id} type="button" onClick={() => setMatrixTab(id)}
                    style={{ padding: '7px 14px', borderRadius: 8, fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', border: matrixTab === id ? `1px solid ${primaryColor}77` : '1px solid rgba(255,255,255,0.1)', background: matrixTab === id ? `${primaryColor}15` : 'rgba(255,255,255,0.04)', color: matrixTab === id ? primaryColor : 'rgba(255,255,255,0.5)' }}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Pros & Cons Tab */}
              {matrixTab === 'proscons' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 20 }}>
                  {displayedPinned.map((p) => {
                    const origIdx = pinned.findIndex(x => x.productName === p.productName);
                    const pc = pinnedProsCons[origIdx];
                    const color = colors[origIdx % colors.length];
                    return (
                      <div key={p.productName} style={{ padding: 14, borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div style={{ fontWeight: 900, fontSize: '0.88rem', color: 'var(--white)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
                          {p.productName}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {pc?.pros.map((pro, i) => <div key={`pro-${i}`} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}><ThumbsUp size={11} color="#68D391" style={{ marginTop: 2, flexShrink: 0 }} /><span style={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.4 }}>{pro}</span></div>)}
                          {pc?.cons.map((con, i) => <div key={`con-${i}`} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}><ThumbsDown size={11} color="#FC8181" style={{ marginTop: 2, flexShrink: 0 }} /><span style={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.4 }}>{con}</span></div>)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Analyst Brief Tab */}
              {matrixTab === 'brief' && analystBriefLines.length > 0 && (
                <div style={{ padding: 16, borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <Info size={15} color={primaryColor} />
                    <span style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--white)' }}>Analyst Brief</span>
                    <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>Research reference only</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {analystBriefLines.map((para, i) => <p key={i} style={{ margin: 0, color: 'rgba(255,255,255,0.7)', fontSize: '0.84rem', lineHeight: 1.7, paddingLeft: 12, borderLeft: `2px solid ${primaryColor}40` }}>{para}</p>)}
                  </div>
                </div>
              )}

              {matrixTab === 'matrix' && <div style={{ borderRadius: 'var(--radius-lg, 12px)', overflowX: 'auto', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px', position: 'relative' }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 20 }}>
                    <tr>
                      <th style={{ ...labelCellStyle, textAlign: 'left', width: '20%', background: '#0F161E', zIndex: 30 }} scope="col">Product</th>
                      {displayedPinned.map((p) => {
                        const originalIndex = pinned.findIndex(x => x.productName === p.productName);

                        return (
                          <th 
                            key={p.productName} 
                            style={{ ...cellStyle, textAlign: 'left', width: `${80 / displayedPinned.length}%`, background: '#0F161E' }} 
                            scope="col"
                            draggable={!isMobile}
                            onDragStart={(e) => handleDragStart(e, originalIndex)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => handleDrop(e, originalIndex)}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {!isMobile && <GripHorizontal size={14} color="rgba(255,255,255,0.2)" style={{ cursor: 'grab' }} />}
                                
                                {isMobile && originalIndex !== 0 && pinned.length > 2 && (
                                  <button
                                    onClick={() => setMobileViewIndex(prev => prev > 1 ? prev - 1 : pinned.length - 1)}
                                    style={{ background: 'none', border: 'none', color: 'var(--silver)', cursor: 'pointer', padding: 0 }}
                                  >
                                    <ChevronLeft size={18} />
                                  </button>
                                )}

                                {p.imageUrl && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={p.imageUrl} alt={p.productName} width={48} height={48} style={{ borderRadius: 8, objectFit: 'cover' }} />
                                )}
                                <div style={{ fontSize: '1.1rem', fontWeight: 900, color: primaryColor }}>{p.productName}</div>
                                
                                {isMobile && originalIndex !== 0 && pinned.length > 2 && (
                                  <button
                                    onClick={() => setMobileViewIndex(prev => prev < pinned.length - 1 ? prev + 1 : 1)}
                                    style={{ background: 'none', border: 'none', color: 'var(--silver)', cursor: 'pointer', padding: 0 }}
                                  >
                                    <ChevronRight size={18} />
                                  </button>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => dispatchAddToCart(p.productName)}
                                style={{
                                  background: primaryColor, border: 'none', color: '#04221F',
                                  padding: '8px 12px', borderRadius: 8, fontWeight: 800, fontSize: '0.8rem',
                                  cursor: 'pointer', marginTop: 4, width: 'fit-content'
                                }}
                              >
                                Add To Cart
                              </button>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {ROWS.map((row, rIdx) => {
                      if (row.kind === 'group') {
                        const isCollapsed = collapsedGroups.has(row.label);
                        return (
                          <tr key={rIdx} onClick={() => toggleGroup(row.label)}>
                            <td style={{ ...groupCellStyle, position: 'sticky', left: 0, zIndex: 10 }} colSpan={displayedPinned.length + 1}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                                {row.label}
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      // Check collapsed state for parent group
                      let currentGroupLabel = '';
                      for (let i = rIdx; i >= 0; i--) {
                        if (ROWS[i].kind === 'group') {
                          currentGroupLabel = ROWS[i].label;
                          break;
                        }
                      }

                      if (collapsedGroups.has(currentGroupLabel)) {
                        return null;
                      }

                      // Check differences
                      const values = displayedPinned.map(p => row.getValue(p));
                      const allSame = values.every(v => v === values[0]);
                      const isDiff = !allSame && displayedPinned.length > 1;

                      const trStyle: React.CSSProperties = { transition: 'background 0.2s' };
                      const tdLabelStyle: React.CSSProperties = { ...labelCellStyle, background: '#0F161E', transition: 'color 0.2s' };
                      const valueCellStyle: React.CSSProperties = { ...cellStyle, transition: 'opacity 0.2s' };

                      if (diffMode) {
                        if (isDiff) {
                          trStyle.background = `${primaryColor}15`;
                          tdLabelStyle.background = `linear-gradient(${primaryColor}15, ${primaryColor}15), #0F161E`;
                        } else {
                          tdLabelStyle.color = 'rgba(168,180,192,0.3)';
                          valueCellStyle.opacity = 0.3;
                        }
                      }

                      // Winner Engine Calculation
                      const bestIndices: number[] = [];
                      if (row.bestLogic && displayedPinned.length > 1 && !allSame) {
                        const scores = displayedPinned.map(p => row.getRawScore ? row.getRawScore(p) : 0);
                        const validScores = scores.filter(s => typeof s === 'number' && !isNaN(s) && s !== Infinity);
                        if (validScores.length > 0) {
                          const bestValue = row.bestLogic === 'max' ? Math.max(...validScores) : Math.min(...validScores);
                          scores.forEach((s, idx) => {
                            if (s === bestValue) bestIndices.push(idx);
                          });
                        }
                      }

                      return (
                        <tr key={rIdx} style={trStyle}>
                          <td style={tdLabelStyle}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              {row.label}
                              {row.glossaryTerm && <InCellGlossaryTooltip term={row.glossaryTerm} />}
                            </div>
                          </td>
                          {displayedPinned.map((p, pIdx) => {
                            const isWinner = bestIndices.includes(pIdx);
                            return (
                              <td key={p.productName} style={{ ...valueCellStyle, position: 'relative' }}>
                                {isWinner && (
                                  <div style={{ position: 'absolute', top: 4, right: 4, fontSize: '0.65rem', background: primaryColor, color: '#04221F', padding: '2px 6px', borderRadius: 4, fontWeight: 800 }}>
                                    TOP PICK 👑
                                  </div>
                                )}
                                <div style={isWinner ? { borderLeft: `2px solid ${primaryColor}`, paddingLeft: 8, marginLeft: -10 } : {}}>
                                  {row.render(p, maxHalfLife)}
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>}
            </div>
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}
