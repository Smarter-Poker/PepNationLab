'use client';

/**
 * R35 Phase 3 & 4 — Compare drawer for agent storefronts.
 *
 * Fixed, bottom-anchored drawer that lets a researcher pin up to 3 products
 * from the modal's "Pin To Compare" button and view them side by side.
 *
 * Includes a full-screen StorefrontCompareModal that renders the attributes matrix.
 */

import { useEffect, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Scale, ChevronDown, ChevronRight, GripHorizontal, ChevronLeft, ThumbsUp, ThumbsDown, Trophy, AlertTriangle, Info, Zap, BookOpen, Clock, Thermometer, Sparkles, Check, Shield } from 'lucide-react';
import { evidenceTier, type Compound, RISK_META, researchAreaLabel, wadaLabel } from '@/lib/compounds';
import InCellGlossaryTooltip from '../research/InCellGlossaryTooltip';
import { scoreCompound, type CompoundScore } from '../research/CompareTool';

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
    // Notify other components/buttons across the page
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
    window.dispatchEvent(new CustomEvent('pnl:compare-changed'));
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
  // Tissue Repair / Healing
  { pairs: ['bpc-157', 'tb-500'], type: 'synergy', category: 'Healing', message: 'BPC-157 + TB-500 act highly synergistically — BPC-157 drives localized GI/tendon cytoprotection while TB-500 provides systemic actin-regulatory repair.' },
  { pairs: ['bpc-157', 'ghk-cu'], type: 'synergy', category: 'Healing', message: 'BPC-157 + GHK-Cu: complementary wound healing — GHK-Cu drives collagen synthesis and copper-dependent enzymes while BPC-157 supports vascular repair.' },
  { pairs: ['tb-500', 'ghk-cu'], type: 'synergy', category: 'Healing', message: 'TB-500 + GHK-Cu: actin regulation + ECM remodeling provides dual-layered soft tissue recovery support.' },
  { pairs: ['bpc-157', 'tb-500', 'ghk-cu'], type: 'synergy', category: 'Healing', message: 'Triple Healing Stack: BPC-157 + TB-500 + GHK-Cu is the full tissue repair trifecta — local, systemic, and structural matrix rebuilding.' },
  // GH Secretagogue Stacks
  { pairs: ['cjc-1295-without-dac', 'ipamorelin'], type: 'synergy', category: 'Performance', message: 'CJC-1295 + Ipamorelin: gold-standard GH stack — GHRH analog + GHSR agonist dual-pathway stimulation amplifies GH pulse amplitude without spiking cortisol or prolactin.' },
  { pairs: ['sermorelin', 'ipamorelin'], type: 'synergy', category: 'Performance', message: 'Sermorelin + Ipamorelin: softer dual-pathway GH secretagogue combination with favorable safety profile.' },
  { pairs: ['cjc-1295-without-dac', 'mk-677'], type: 'synergy', category: 'Performance', message: 'CJC-1295 + MK-677: injectable GHRH + oral ghrelin mimetic produces robust, sustained GH/IGF-1 elevation.' },
  { pairs: ['ipamorelin', 'mk-677'], type: 'synergy', category: 'Performance', message: 'Ipamorelin + MK-677: complementary ghrelin-axis stimulation — injectable pulse + oral sustained background.' },
  // Longevity / Anti-Aging
  { pairs: ['epitalon', 'ghk-cu'], type: 'synergy', category: 'Longevity', message: 'Epitalon + GHK-Cu: telomerase activation + copper-tripeptide regeneration for multi-pathway longevity research.' },
  { pairs: ['epitalon', 'dsip'], type: 'synergy', category: 'Sleep', message: 'Epitalon + DSIP: circadian clock restoration + sleep-initiation signaling for sleep architecture research.' },
  { pairs: ['mots-c', 'ss-31'], type: 'synergy', category: 'Longevity', message: 'MOTS-c + SS-31: dual mitochondrial optimization — MOTS-c for metabolic signaling, SS-31 for inner membrane cardiolipin protection.' },
  // Sexual Health
  { pairs: ['pt-141', 'kisspeptin-10'], type: 'synergy', category: 'Sexual Health', message: 'PT-141 + Kisspeptin-10: complementary central (melanocortin MC4R) + hypothalamic (GPR54) sexual health pathways.' },
  // Weight / Metabolic
  { pairs: ['aod-9604', 'ipamorelin'], type: 'synergy', category: 'Metabolic', message: 'AOD-9604 + Ipamorelin: lipolytic C-terminal fragment + GH pulse amplifier for body composition research.' },
  // Conflict Pairs
  { pairs: ['tirzepatide', 'retatrutide'], type: 'conflict', category: 'Safety', message: 'Compounding GLP-1/GIP dual/triple agonists: highly overlapping mechanism with compounding GI adverse effects (nausea, vomiting, gastroparesis).' },
  { pairs: ['semaglutide', 'tirzepatide'], type: 'conflict', category: 'Safety', message: 'Two incretin agents: stacking GLP-1 agonists compounds GI distress and unclear additive efficacy benefit in research.' },
  { pairs: ['semaglutide', 'retatrutide'], type: 'conflict', category: 'Safety', message: 'GLP-1 agonist overlap: additive nausea/vomiting risk with no clear mechanistic benefit over mono-therapy.' },
  // Pro-Angiogenic caution
  { pairs: ['bpc-157', 'igf-1'], type: 'caution', category: 'Safety', message: 'Caution: Both BPC-157 and IGF-1 promote angiogenesis. Research literature notes theoretical considerations around stacking pro-angiogenic compounds.' },
  { pairs: ['tb-500', 'igf-1'], type: 'caution', category: 'Safety', message: 'Caution: TB-500 (thymosin beta-4) and IGF-1 both promote cell migration and angiogenesis — research protocol design should account for this.' },
];

// ── Animated Score Ring ───────────────────────────────────────────────────────
function AnimatedScoreRingDrawer({ score, color }: { score: CompoundScore; color: string }) {
  const [displayPct, setDisplayPct] = useState(0);
  const rafRef = useRef<number>(0);
  const [showAudit, setShowAudit] = useState(false);

  useEffect(() => {
    const target = score.total;
    const duration = 900;
    const start = performance.now();
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      setDisplayPct(Math.round(easeOut(t) * target));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [score.total]);

  const r = 32;
  const circ = 2 * Math.PI * r;
  const pct = (displayPct / 100) * circ;
  const gradeColor = score.letter.startsWith('A') ? '#68D391' : score.letter.startsWith('B') ? '#00C4BC' : score.letter.startsWith('C') ? '#F6AD55' : '#FC8181';

  return (
    <div style={{ position: 'relative' }}>
      <div 
        onClick={() => setShowAudit(prev => !prev)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, cursor: 'pointer', padding: '4px', borderRadius: '6px', transition: 'background 0.2s', userSelect: 'none' }}
        onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
        onMouseOut={e => e.currentTarget.style.background = 'transparent'}
        title="Click to view score audit breakdown"
      >
        <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
          <svg width="72" height="72" viewBox="0 0 72 72">
            <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
            <circle cx="36" cy="36" r={r} fill="none" stroke={gradeColor} strokeWidth="6" strokeLinecap="round"
              strokeDasharray={`${pct} ${circ}`} strokeDashoffset={circ / 4} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 900, color: gradeColor, lineHeight: 1 }}>{displayPct}</span>
            <span style={{ fontSize: '0.5rem', color: gradeColor, opacity: 0.6 }}>/100</span>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.88rem', fontWeight: 900, color: gradeColor }}>Grade {score.letter}</div>
          <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)', marginBottom: 5 }}>{score.verdict}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {[['Ev', score.breakdown.evidence, 28], ['Sa', score.breakdown.safety, 24], ['Sc', score.breakdown.science, 14], ['Co', score.breakdown.coverage, 16], ['Ha', score.breakdown.handling, 10], ['Dp', score.breakdown.completeness, 8]].map(([lbl, val, max]) => (
              <div key={String(lbl)} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.58rem', color: 'rgba(255,255,255,0.35)' }}>
                <span style={{ minWidth: 12 }}>{lbl}</span>
                <div style={{ flex: 1, height: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(Number(val)/Number(max))*100}%`, background: color, borderRadius: 999 }} />
                </div>
                <span style={{ minWidth: 14, textAlign: 'right', fontWeight: 700, color }}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showAudit && (
        <div style={{
          position: 'absolute',
          top: '78px',
          left: 0,
          right: 0,
          background: 'linear-gradient(135deg, #162230, #0f1720)',
          border: '1px solid rgba(0, 196, 188, 0.3)',
          boxShadow: '0 8px 20px rgba(0,0,0,0.6)',
          borderRadius: 8,
          padding: 10,
          zIndex: 500,
          color: '#fff',
          fontSize: '0.72rem',
          lineHeight: 1.4
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 3 }}>
            <span style={{ fontWeight: 800, color: '#00C4BC' }}>Score Audit</span>
            <button onClick={(e) => { e.stopPropagation(); setShowAudit(false); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '0.65rem', padding: 0 }}>Close</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div>Evidence: {score.breakdown.evidence} / 28</div>
            <div>Safety: {score.breakdown.safety} / 24</div>
            <div>Science: {score.breakdown.science} / 14</div>
            <div>Coverage: {score.breakdown.coverage} / 16</div>
            <div>Handling: {score.breakdown.handling} / 10</div>
            <div>Data Depth: {score.breakdown.completeness} / 8</div>
          </div>
        </div>
      )}
    </div>
  );
}

function scoreCompoundFromPinned(p: PinnedItem, compoundsBySlug: Record<string, Compound>, allPinned: PinnedItem[] = []): CompoundScore {
  const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null;
  if (!c) {
    return {
      total: 80,
      letter: 'B-',
      breakdown: { evidence: 0, safety: 0, coverage: 0, science: 0, handling: 0, completeness: 0 },
      verdict: 'Compound data pending',
      weaknesses: [],
      strengths: [],
      bestFor: [],
      recommendedContexts: []
    };
  }
  const allSelected = allPinned
    .map(x => x.compoundSlug ? compoundsBySlug[x.compoundSlug] : null)
    .filter(Boolean) as Compound[];
  return scoreCompound(c, allSelected);
}

function getChoiceBadge(idx: number): React.ReactNode {
  const labels = ['1st Choice', '2nd Choice', '3rd Choice', '4th Choice'];
  const badgeColors = [
    { bg: 'rgba(0,196,188,0.15)', text: '#00C4BC', border: 'rgba(0,196,188,0.35)' },
    { bg: 'rgba(246,173,85,0.15)', text: '#F6AD55', border: 'rgba(246,173,85,0.35)' },
    { bg: 'rgba(104,211,145,0.15)', text: '#68D391', border: 'rgba(104,211,145,0.35)' },
    { bg: 'rgba(252,129,129,0.15)', text: '#FC8181', border: 'rgba(252,129,129,0.35)' },
  ];
  const color = badgeColors[idx] || badgeColors[badgeColors.length - 1];
  return (
    <span style={{
      fontSize: '0.65rem',
      fontWeight: 900,
      padding: '2px 8px',
      borderRadius: 999,
      background: color.bg,
      color: color.text,
      border: `1px solid ${color.border}`,
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 3,
      width: 'fit-content'
    }}>
      {idx === 0 && <Trophy size={10} />}
      {labels[idx] || `${idx + 1}th Choice`}
    </span>
  );
}

function getAttributeRawValue(
  label: string,
  p: PinnedItem,
  compoundsBySlug: Record<string, Compound>
): string {
  const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null;
  if (!c) return 'N/A';
  switch (label) {
    case 'Evidence':
      return p.evidenceTierKey ? evidenceTier(p.evidenceTierKey).label : 'Pending';
    case 'Safety':
      return c.risk_level ? RISK_META[c.risk_level]?.label || c.risk_level : 'Pending';
    case 'Citations':
      return c.pubmed_citation_count ? `${c.pubmed_citation_count.toLocaleString()} cites` : '0 cites';
    case 'Trials': {
      const trials = (c.active_trial_count ?? 0) + (c.completed_trial_count ?? 0);
      return `${trials} trials`;
    }
    case 'Half-Life':
      return c.half_life || 'N/A';
    case 'Coverage':
      return `${(c.research_areas ?? []).length} areas`;
    case 'Handling': {
      const shelf = c.reconstitution_shelf_days ?? c.handling?.reconstituted_days;
      return shelf ? `${shelf} days stable` : 'N/A';
    }
    default:
      return 'N/A';
  }
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
  primaryColor = '#00C4BC',
  compoundsBySlug: initialCompoundsBySlug = {}
}: { 
  primaryColor?: string;
  compoundsBySlug?: Record<string, Compound>;
}) {
  const [compoundsBySlug, setCompoundsBySlug] = useState<Record<string, Compound>>(initialCompoundsBySlug);
  const [pinned, setPinned] = useState<PinnedItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [showMatrix, setShowMatrix] = useState(false);
  const [diffMode, setDiffMode] = useState(false);
  const [hideIdentical, setHideIdentical] = useState(false);
  
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
    if (initialCompoundsBySlug && Object.keys(initialCompoundsBySlug).length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCompoundsBySlug(initialCompoundsBySlug);
    }
  }, [initialCompoundsBySlug]);

  useEffect(() => {
    if (Object.keys(compoundsBySlug).length === 0) {
      fetch('/api/research/compounds-list')
        .then((res) => res.json())
        .then((data) => {
          if (data && Array.isArray(data.compounds)) {
            const map: Record<string, Compound> = {};
            for (const c of data.compounds) {
              map[c.slug] = c;
            }
            setCompoundsBySlug(map);
          }
        })
        .catch((err) => console.error('Error fetching compounds for compare drawer:', err));
    }
  }, [compoundsBySlug]);



  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    setPinned(readPinned());

    const onAdd = (e: Event) => {
      const detail = (e as CustomEvent<PinnedItem>).detail;
      if (!detail || !detail.productName) return;
      const current = readPinned();
      const filtered = current.filter((p) => p.productName !== detail.productName);
      const next = [...filtered, detail].slice(-MAX_PINNED);
      writePinned(next);
      setPinned(next);
      setCollapsed(false);
    };

    const onRemove = (e: Event) => {
      const detail = (e as CustomEvent<{ productName: string }>).detail;
      if (!detail || !detail.productName) return;
      const current = readPinned();
      const next = current.filter((p) => p.productName !== detail.productName);
      writePinned(next);
      setPinned(next);
    };

    const onClear = () => {
      writePinned([]);
      setPinned([]);
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        const latest = readPinned();
        setPinned((prev) => {
          const isSame = prev.length === latest.length && prev.every((p, idx) => p.productName === latest[idx].productName);
          if (isSame) return prev;
          return latest;
        });
      }
    };

    const syncPinned = () => {
      const latest = readPinned();
      setPinned((prev) => {
        const isSame = prev.length === latest.length && prev.every((p, idx) => p.productName === latest[idx].productName);
        if (isSame) return prev;
        return latest;
      });
    };

    window.addEventListener('pnl:compare-add', onAdd as EventListener);
    window.addEventListener('pnl:compare-remove', onRemove as EventListener);
    window.addEventListener('pnl:compare-clear', onClear as EventListener);
    window.addEventListener('pnl:compare-changed', syncPinned);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('pnl:compare-add', onAdd as EventListener);
      window.removeEventListener('pnl:compare-remove', onRemove as EventListener);
      window.removeEventListener('pnl:compare-clear', onClear as EventListener);
      window.removeEventListener('pnl:compare-changed', syncPinned);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  function removeAt(i: number) {
    const next = pinned.filter((_, idx) => idx !== i);
    writePinned(next);
    setPinned(next);
  }

  function clearAll() {
    writePinned([]);
    setPinned([]);
  }

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
      { kind: 'group', label: 'Overview' },
      {
        kind: 'data', label: 'Research Summary',
        getValue: (p: PinnedItem) => { const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; return c?.eli5_summary ?? c?.plain_summary ?? ''; },
        render: (p: PinnedItem) => { const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; const text = c?.eli5_summary ?? c?.plain_summary; return text ? <span style={{ fontSize: '0.8rem', lineHeight: 1.5, display: 'block' }}>{text}</span> : NL; }
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
        render: (p: PinnedItem) => { const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; return c?.handling?.light_sensitive == null ? NL : c.handling.light_sensitive ? <span style={{ color: '#F6AD55', display: 'inline-flex', alignItems: 'center', gap: '3px' }}><AlertTriangle size={11} /> Yes</span> : <span style={{ color: '#68D391', display: 'inline-flex', alignItems: 'center', gap: '3px' }}><Check size={11} /> No</span>; }
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

  // Sort pinned items dynamically by their composite score descending
  const sortedPinned = useMemo(() => {
    return [...pinned]
      .map((item) => {
        const score = scoreCompoundFromPinned(item, compoundsBySlug, pinned);
        return { item, score };
      })
      .sort((a, b) => b.score.total - a.score.total);
  }, [pinned, compoundsBySlug]);

  const sortedPinnedItems = useMemo(() => sortedPinned.map(x => x.item), [sortedPinned]);
  const pinnedScores = useMemo(() => sortedPinned.map(x => x.score), [sortedPinned]);
  const pinnedProsCons = useMemo(() => sortedPinnedItems.map(p => generateProsConsPinned(p, compoundsBySlug)), [sortedPinnedItems, compoundsBySlug]);

  let clampedMobileIndex = mobileViewIndex;
  if (clampedMobileIndex >= sortedPinnedItems.length && sortedPinnedItems.length > 1) {
    clampedMobileIndex = sortedPinnedItems.length - 1;
  }

  const displayedPinned = useMemo(() => {
    return isMobile && sortedPinnedItems.length > 1 
      ? [sortedPinnedItems[0], sortedPinnedItems[clampedMobileIndex]] 
      : sortedPinnedItems;
  }, [isMobile, sortedPinnedItems, clampedMobileIndex]);

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

  const topPickIdx = sortedPinnedItems.length >= 2 ? 0 : -1;

  const [matrixTab, setMatrixTab] = useState<'matrix' | 'proscons' | 'brief' | 'mechanism' | 'protocol' | 'verdict'>('matrix');

  const analystBriefLines = useMemo(() => {
    if (sortedPinnedItems.length < 2) return [];
    const lines: string[] = [];
    const sorted = sortedPinnedItems.map((p, i) => ({ p, s: pinnedScores[i] }));
    const leader = sorted[0]; const runner = sorted[1];
    lines.push(`Overall, ${leader.p.productName} scores highest at ${leader.s.total}/100 on PepNation Lab's composite research index (${leader.s.verdict.toLowerCase()}). ${runner.p.productName} follows at ${runner.s.total}/100${sorted.length > 2 ? `, with ${sorted.slice(2).map(x => `${x.p.productName} at ${x.s.total}`).join(', ')}` : ''}.`);
    const highestEvidence = [...sortedPinnedItems].sort((a, b) => { const r = (e: string | null) => e === 'approved_drug' ? 4 : e === 'investigational' ? 3 : e === 'preclinical' ? 2 : 1; return r(b.evidenceTierKey) - r(a.evidenceTierKey); })[0];
    lines.push(`From an evidence standpoint, ${highestEvidence.productName} carries the strongest regulatory backing as an ${evidenceTier(highestEvidence.evidenceTierKey ?? '').label.toLowerCase()} compound.`);
    const allHl = sortedPinnedItems.map(p => { const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; return { p, hl: parseHalfLifeHours(c?.half_life), raw: c?.half_life }; }).filter(x => x.hl > 0).sort((a, b) => b.hl - a.hl);
    if (allHl.length >= 2) { const lg = allHl[0]; const sh = allHl[allHl.length - 1]; if (lg.p.productName !== sh.p.productName) lines.push(`Pharmacokinetically, ${lg.p.productName} provides a ${(lg.hl/sh.hl).toFixed(1)}x longer half-life than ${sh.p.productName} (${lg.raw} vs. ${sh.raw}), offering greater dosing interval flexibility.`); }
    // Safety divergence
    const safeRanked = [...sortedPinnedItems].map(p => ({ p, c: p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null })).filter(x => x.c).sort((a, b) => { const r = (x: string) => x === 'low' ? 1 : x === 'moderate' ? 2 : x === 'high' ? 3 : 4; return r(a.c!.risk_level) - r(b.c!.risk_level); });
    if (safeRanked.length >= 2 && safeRanked[0].c?.risk_level !== safeRanked[safeRanked.length-1].c?.risk_level) {
      lines.push(`Safety profiles diverge: ${safeRanked[0].p.productName} has the most favorable risk profile (${safeRanked[0].c?.risk_level}), while ${safeRanked[safeRanked.length-1].p.productName} carries a ${safeRanked[safeRanked.length-1].c?.risk_level} designation.`);
    }
    return lines;
  }, [sortedPinnedItems, pinnedScores, compoundsBySlug]);

  const smartSummary = useMemo(() => {
    if (sortedPinnedItems.length !== 2) return null;
    const [a, b] = sortedPinnedItems;
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
  }, [sortedPinnedItems, compoundsBySlug]);

  const colors = [primaryColor, '#F6AD55', '#68D391', '#FC8181'];

  const activeSynergiesModal = useMemo(() => {
    const matched = KNOWN_SYNERGIES.filter(syn =>
      syn.pairs.every(slug => sortedPinnedItems.some(p => p.compoundSlug === slug))
    );

    const pinnedCompounds = sortedPinnedItems.map(p => p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null).filter(Boolean) as Compound[];
    const glp1s = pinnedCompounds.filter(c => c.is_glp1);
    const hasGlp1Conflict = glp1s.length >= 2;
    const proAngio = pinnedCompounds.filter(c => c.is_pro_angiogenic);
    const hasProAngioCaution = proAngio.length >= 2;

    return matched.filter(syn => {
      if (hasGlp1Conflict) {
        const isGlp1Pair = syn.pairs.every(slug => {
          const comp = compoundsBySlug[slug];
          return comp?.is_glp1;
        });
        if (isGlp1Pair) return false;
      }
      if (hasProAngioCaution) {
        const isProAngioPair = syn.pairs.every(slug => {
          const comp = compoundsBySlug[slug];
          return comp?.is_pro_angiogenic;
        });
        if (isProAngioPair) return false;
      }
      return true;
    });
  }, [sortedPinnedItems, compoundsBySlug]);

  // Dynamic GLP-1 / pro-angiogenic warnings
  const dynamicWarnings = useMemo(() => {
    const warnings: { type: 'conflict' | 'caution'; category: string; message: string }[] = [];
    const pinnedCompounds = sortedPinnedItems.map(p => p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null).filter(Boolean) as Compound[];
    const proAngio = pinnedCompounds.filter(c => c.is_pro_angiogenic);
    if (proAngio.length >= 2) warnings.push({ type: 'caution', category: 'Safety', message: `Multiple pro-angiogenic compounds pinned (${proAngio.map(c => c.display_name).join(', ')}). Stacking compounds that promote new vessel growth warrants additional research scrutiny.` });
    const glp1s = pinnedCompounds.filter(c => c.is_glp1);
    if (glp1s.length >= 2) warnings.push({ type: 'conflict', category: 'Safety', message: `Multiple GLP-1/incretin agents pinned (${glp1s.map(c => c.display_name).join(', ')}). Combining incretin-class agents compounds gastrointestinal adverse effects.` });
    return warnings;
  }, [sortedPinnedItems, compoundsBySlug]);

  const maxTrials = useMemo(() => Math.max(...displayedPinned.map(p => { const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; return (c?.active_trial_count ?? 0) + (c?.completed_trial_count ?? 0); }), 1), [displayedPinned, compoundsBySlug]);

  const radarData = useMemo(() => {
    if (sortedPinnedItems.length < 2) return [];
    return [
      { label: 'Evidence', scores: sortedPinnedItems.map(p => p.evidenceTierKey === 'approved_drug' ? 100 : p.evidenceTierKey === 'investigational' ? 78 : p.evidenceTierKey === 'preclinical' ? 55 : 30) },
      { label: 'Safety', scores: sortedPinnedItems.map(p => { const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; return c?.risk_level === 'low' ? 100 : c?.risk_level === 'moderate' ? 70 : c?.risk_level === 'high' ? 35 : 10; }) },
      { label: 'Citations', scores: sortedPinnedItems.map(p => { if (!maxCitations) return 10; const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; return Math.min(100, Math.max(5, ((c?.pubmed_citation_count ?? 0) / maxCitations) * 100)); }) },
      { label: 'Trials', scores: sortedPinnedItems.map(p => { if (!maxTrials) return 5; const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; const t = (c?.active_trial_count ?? 0) + (c?.completed_trial_count ?? 0); return Math.min(100, Math.max(5, (t / maxTrials) * 100)); }) },
      { label: 'Half-Life', scores: sortedPinnedItems.map(p => { if (!maxHalfLife) return 20; const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; return Math.min(100, Math.max(5, (parseHalfLifeHours(c?.half_life) / maxHalfLife) * 100)); }) },
      { label: 'Coverage', scores: sortedPinnedItems.map(p => { const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; return Math.min(100, Math.max(5, ((c?.research_areas ?? []).length / 8) * 100)); }) },
      { label: 'Handling', scores: sortedPinnedItems.map(p => { const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null; const shelf = c?.reconstitution_shelf_days ?? c?.handling?.reconstituted_days ?? 0; return Math.min(100, Math.max(5, (shelf / 60) * 100)); }) },
    ];
  }, [sortedPinnedItems, compoundsBySlug, maxCitations, maxHalfLife, maxTrials]);

  const activeSynergies = useMemo(() => {
    return [...activeSynergiesModal, ...dynamicWarnings];
  }, [activeSynergiesModal, dynamicWarnings]);

  if (!mounted) return null;
  if (pinned.length === 0) return null;
  if (typeof document === 'undefined') return null;

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
                      minHeight: 165,
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
                      {c?.wada_status && (c.wada_status === 'prohibited' || c.wada_status === 'prohibited_males') && (
                        <span style={{ background: 'rgba(229,62,62,0.15)', color: '#FC8181', padding: '2px 6px', borderRadius: 4, fontSize: '0.65rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <X size={10} /> WADA Banned
                        </span>
                      )}
                      {item.pricePerVialDollars != null && (
                        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: primaryColor, fontFamily: 'var(--font-brand)' }}>
                          ${Number(item.pricePerVialDollars).toFixed(2)}/Vial
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => dispatchAddToCart(item.productName)}
                      style={{
                        background: primaryColor, border: 'none', color: '#04221F',
                        padding: '6px 12px', borderRadius: 8, fontWeight: 800, fontSize: '0.74rem',
                        cursor: 'pointer', marginTop: 'auto', width: '100%',
                        textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                        transition: 'opacity 0.2s',
                      }}
                      onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
                      onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
                    >
                      <Zap size={11} /> Add To Cart
                    </button>
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
                  <>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'var(--silver)', fontSize: '0.85rem', fontWeight: 800, userSelect: 'none' }}>
                      <input 
                        type="checkbox" 
                        checked={diffMode} 
                        onChange={(e) => setDiffMode(e.target.checked)} 
                        style={{ accentColor: primaryColor, width: 16, height: 16 }}
                      />
                      Highlight Differences
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'var(--silver)', fontSize: '0.85rem', fontWeight: 800, userSelect: 'none', marginLeft: 16 }}>
                      <input 
                        type="checkbox" 
                        checked={hideIdentical} 
                        onChange={(e) => setHideIdentical(e.target.checked)} 
                        style={{ accentColor: primaryColor, width: 16, height: 16 }}
                      />
                      Hide Identical Attributes
                    </label>
                  </>
                )}
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
                <div style={{
                  background: 'rgba(20, 25, 30, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 16,
                  backdropFilter: 'blur(8px)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <AlertTriangle size={16} color="#FC8181" />
                    <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#FC8181', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Research Safety & Compatibility Advisories
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {activeSynergies.map((syn, idx) => (
                      <div key={idx} style={{
                        background: syn.type === 'conflict' ? 'rgba(229,62,62,0.06)' : 'rgba(104,211,145,0.06)',
                        borderLeft: `3px solid ${syn.type === 'conflict' ? '#FC8181' : '#68D391'}`,
                        color: syn.type === 'conflict' ? '#FC8181' : '#68D391',
                        padding: '8px 12px',
                        borderRadius: '0 8px 8px 0',
                        fontSize: '0.82rem',
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 8,
                        lineHeight: 1.4
                      }}>
                        {syn.type === 'conflict' ? <AlertTriangle size={14} style={{ marginTop: 2, flexShrink: 0 }} /> : <Sparkles size={14} style={{ marginTop: 2, flexShrink: 0 }} />}
                        <span><strong>{syn.type === 'conflict' ? 'Conflict' : 'Synergy'}:</strong> {syn.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Top Pick Banner */}
              {sortedPinnedItems.length >= 2 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, background: 'rgba(0,196,188,0.08)', border: '1px solid rgba(0,196,188,0.2)', borderRadius: 8, padding: '10px 14px' }}>
                  <Trophy size={16} color={primaryColor} />
                  <span style={{ fontWeight: 800, fontSize: '0.92rem', color: primaryColor }}>Top Pick: {sortedPinnedItems[0].productName}</span>
                  <span style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.4)', marginLeft: 4 }}>· Leading with a composite score of {pinnedScores[0].total}/100</span>
                </div>
              )}

              {/* Score Ring Summary Panel */}
              {sortedPinnedItems.length >= 2 && (
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(190px, 1fr))`, gap: 12, marginBottom: 16, padding: 14, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10 }}>
                  {displayedPinned.map((p, idx) => {
                    const score = pinnedScores[idx];
                    const color = colors[idx % colors.length];
                    return (
                      <div key={p.productName} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10, background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          {getChoiceBadge(idx)}
                        </div>
                        <AnimatedScoreRingDrawer score={score} color={color} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                          {p.imageUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.imageUrl} alt={p.productName} width={36} height={36} style={{ borderRadius: 6, objectFit: 'cover' }} />
                          )}
                          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                            <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.productName}</div>
                            {p.pricePerVialDollars != null && (
                              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#68D391' }}>
                                ${Number(p.pricePerVialDollars).toFixed(2)} <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>/ vial</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Tab navigation */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                {([
                  ['matrix', 'Matrix'],
                  ['proscons', 'Pros & Cons'],
                  ['brief', 'Analyst Brief'],
                  ['mechanism', 'Mechanism'],
                  ['protocol', 'Protocol'],
                  ['verdict', 'Verdict'],
                ] as const).map(([id, label]) => (
                  <button key={id} type="button" onClick={() => setMatrixTab(id)}
                    style={{ padding: '7px 12px', borderRadius: 8, fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', border: matrixTab === id ? `1px solid ${primaryColor}77` : '1px solid rgba(255,255,255,0.1)', background: matrixTab === id ? `${primaryColor}15` : 'rgba(255,255,255,0.04)', color: matrixTab === id ? primaryColor : 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Pros & Cons Tab */}
              <div style={{ display: matrixTab === 'proscons' ? 'grid' : 'none', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 20 }}>
                {displayedPinned.map((p, idx) => {
                  const pc = pinnedProsCons[idx];
                  const color = colors[idx % colors.length];
                  const score = pinnedScores[idx];
                  return (
                    <div key={p.productName} style={{ padding: 14, borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ fontWeight: 900, fontSize: '0.88rem', color: 'var(--white)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        {getChoiceBadge(idx)}
                        <span style={{ color: 'var(--white)', fontWeight: 850 }}>{p.productName}</span>
                        <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color, fontWeight: 800 }}>Score: {score?.total}/100</span>
                      </div>
                      <AnimatedScoreRingDrawer score={score} color={color} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 10 }}>
                        {pc?.pros.map((pro, i) => <div key={`pro-${i}`} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}><ThumbsUp size={11} color="#68D391" style={{ marginTop: 2, flexShrink: 0 }} /><span style={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.4 }}>{pro}</span></div>)}
                        {pc?.cons.map((con, i) => <div key={`con-${i}`} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}><ThumbsDown size={11} color="#FC8181" style={{ marginTop: 2, flexShrink: 0 }} /><span style={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.4 }}>{con}</span></div>)}
                      </div>
                      <button
                        type="button"
                        onClick={() => dispatchAddToCart(p.productName)}
                        style={{
                          background: primaryColor, border: 'none', color: '#04221F',
                          padding: '8px 14px', borderRadius: 8, fontWeight: 800, fontSize: '0.78rem',
                          cursor: 'pointer', marginTop: 'auto', width: '100%', textAlign: 'center',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                          transition: 'opacity 0.2s',
                        }}
                        onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
                        onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
                      >
                        <Zap size={12} /> Add To Cart
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Analyst Brief Tab */}
              <div style={{ display: (matrixTab === 'brief' && analystBriefLines.length > 0) ? 'block' : 'none', padding: 16, borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <Info size={15} color={primaryColor} />
                  <span style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--white)' }}>Analyst Brief</span>
                  <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>Research reference only</span>
                </div>
                {smartSummary && (
                  <div style={{ background: `${primaryColor}10`, border: `1px solid ${primaryColor}30`, borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: '0.78rem', color: primaryColor, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Info size={14} /> {smartSummary}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {analystBriefLines.map((para, i) => <p key={i} style={{ margin: 0, color: 'rgba(255,255,255,0.7)', fontSize: '0.84rem', lineHeight: 1.7, paddingLeft: 12, borderLeft: `2px solid ${primaryColor}40` }}>{para}</p>)}
                </div>
              </div>

              {/* Mechanism Tab */}
              <div style={{ display: matrixTab === 'mechanism' ? 'grid' : 'none', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 20 }}>
                {displayedPinned.map((p, idx) => {
                  const color = colors[idx % colors.length];
                  const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null;
                  return (
                    <div key={p.productName} style={{ padding: 14, borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ fontWeight: 900, fontSize: '0.88rem', color: 'var(--white)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        {getChoiceBadge(idx)}
                        <span style={{ color: 'var(--white)', fontWeight: 800 }}>{p.productName}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {c?.compound_class && <div><div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Compound Class</div><div style={{ fontSize: '0.78rem', color }}>{c.compound_class}</div></div>}
                        {c?.molecular_target && <div><div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Molecular Target</div><div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.4 }}>{c.molecular_target}</div></div>}
                        {c?.mechanism && <div><div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Mechanism of Action</div><div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>{c.mechanism}</div></div>}
                        {c?.pk_summary && <div><div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Pharmacokinetics</div><div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>{c.pk_summary}</div></div>}
                        {c?.risk_reasons?.length ? <div><div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Risk Considerations</div><div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>{c.risk_reasons.map((r, ri) => <div key={ri} style={{ display: 'flex', gap: 5, alignItems: 'flex-start' }}><AlertTriangle size={10} color={RISK_META[c.risk_level]?.color ?? '#F6AD55'} style={{ marginTop: 2, flexShrink: 0 }} /><span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.4 }}>{r}</span></div>)}</div></div> : null}
                        {c?.is_pro_angiogenic && <div style={{ fontSize: '0.72rem', color: '#F6AD55', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={12} /> Pro-Angiogenic — Promotes New Vessel Growth</div>}
                        {c?.is_glp1 && <div style={{ fontSize: '0.72rem', color: '#9F7AEA', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Check size={12} /> GLP-1 / Incretin Class</div>}
                        {c?.sources?.length ? <div><div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Key Sources</div><div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>{c.sources.slice(0, 3).map((src, si) => <a key={si} href={src.startsWith('http') ? src : undefined} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.68rem', color, opacity: 0.8, wordBreak: 'break-all', lineHeight: 1.3, textDecoration: src.startsWith('http') ? 'underline' : 'none' }}>{src.startsWith('http') ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><BookOpen size={11} /> Source {si+1}</span> : src}</a>)}</div></div> : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => dispatchAddToCart(p.productName)}
                        style={{
                          background: primaryColor, border: 'none', color: '#04221F',
                          padding: '8px 14px', borderRadius: 8, fontWeight: 800, fontSize: '0.78rem',
                          cursor: 'pointer', marginTop: 'auto', width: '100%', textAlign: 'center',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                          transition: 'opacity 0.2s',
                        }}
                        onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
                        onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
                      >
                        <Zap size={12} /> Add To Cart
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Protocol Tab */}
              <div style={{ display: matrixTab === 'protocol' ? 'grid' : 'none', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 20 }}>
                {displayedPinned.map((p, idx) => {
                  const color = colors[idx % colors.length];
                  const c = p.compoundSlug ? compoundsBySlug[p.compoundSlug] : null;
                  const shelf = c?.reconstitution_shelf_days ?? c?.handling?.reconstituted_days;
                  const hlH = parseHalfLifeHours(c?.half_life);
                  const dosesPerWeek = hlH > 0 ? Math.max(1, Math.round(168 / (hlH * 2))) : null;
                  return (
                    <div key={p.productName} style={{ padding: 14, borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ fontWeight: 900, fontSize: '0.88rem', color: 'var(--white)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        {getChoiceBadge(idx)}
                        <span style={{ color: 'var(--white)', fontWeight: 800 }}>{p.productName}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ background: `${color}08`, borderRadius: 8, padding: '8px 10px' }}>
                          <div style={{ fontSize: '0.65rem', fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Reconstitution</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 10px', fontSize: '0.74rem' }}>
                            <div style={{ color: 'rgba(255,255,255,0.4)' }}>Form</div><div style={{ color: 'rgba(255,255,255,0.8)' }}>{c?.handling?.form ?? NL}</div>
                            <div style={{ color: 'rgba(255,255,255,0.4)' }}>Diluent</div><div style={{ color: 'rgba(255,255,255,0.8)' }}>{c?.handling?.diluent ?? NL}</div>
                            <div style={{ color: 'rgba(255,255,255,0.4)' }}>Storage</div><div style={{ color: 'rgba(255,255,255,0.8)' }}>{c?.handling?.storage_temp ?? NL}</div>
                            <div style={{ color: 'rgba(255,255,255,0.4)' }}>Light</div><div style={{ color: 'rgba(255,255,255,0.8)' }}>{c?.handling?.light_sensitive == null ? NL : c.handling.light_sensitive ? 'Sensitive' : 'Safe'}</div>
                            {shelf && <><div style={{ color: 'rgba(255,255,255,0.4)' }}>Shelf Life</div><div style={{ color: shelf >= 28 ? '#68D391' : shelf < 14 ? '#FC8181' : '#F6AD55', fontWeight: 700 }}>{shelf} days</div></>}
                          </div>
                        </div>
                        {(c?.half_life || c?.typical_frequency) && (
                          <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '8px 10px', border: '1px solid rgba(255,255,255,0.04)' }}>
                            <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Administration</div>
                            {c?.half_life && <div style={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.7)', marginBottom: 3 }}><Clock size={9} style={{ marginRight: 4, display: 'inline-block', verticalAlign: 'middle' }} />Half-life: <strong style={{ color }}>{c.half_life}</strong></div>}
                            {c?.typical_frequency && <div style={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.7)', marginBottom: 3 }}><Zap size={9} style={{ marginRight: 4, display: 'inline-block', verticalAlign: 'middle' }} />Frequency: <strong style={{ color: 'rgba(255,255,255,0.9)' }}>{c.typical_frequency}</strong></div>}
                            {dosesPerWeek && <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)', marginTop: 3, fontStyle: 'italic' }}>~{dosesPerWeek}× per week based on half-life</div>}
                          </div>
                        )}
                        {c?.handling?.freeze_thaw && <div style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.6)', display: 'flex', gap: 5, alignItems: 'flex-start' }}><Thermometer size={11} color="#F6AD55" style={{ marginTop: 1, flexShrink: 0 }} /><span>{c.handling.freeze_thaw}</span></div>}
                        {c?.handling?.notes && <div style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.4, borderLeft: '2px solid rgba(255,255,255,0.08)', paddingLeft: 6 }}>{c.handling.notes}</div>}
                        {c?.coa_url && <a href={c.coa_url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color, textDecoration: 'none', fontWeight: 700 }}><BookOpen size={11} /> View COA</a>}
                      </div>
                      <button
                        type="button"
                        onClick={() => dispatchAddToCart(p.productName)}
                        style={{
                          background: primaryColor, border: 'none', color: '#04221F',
                          padding: '8px 14px', borderRadius: 8, fontWeight: 800, fontSize: '0.78rem',
                          cursor: 'pointer', marginTop: 'auto', width: '100%', textAlign: 'center',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                          transition: 'opacity 0.2s',
                        }}
                        onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
                        onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
                      >
                        <Zap size={12} /> Add To Cart
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Verdict Tab */}
              <div style={{ display: matrixTab === 'verdict' ? 'block' : 'none' }}>
                {sortedPinnedItems.length >= 2 && (() => {
                  const ranked = sortedPinnedItems.map((p, i) => ({ p, s: pinnedScores[i] }));
                  const leader = ranked[0];
                  const safest = [...ranked].sort((a, b) => b.s.breakdown.safety - a.s.breakdown.safety)[0];
                  const mostStudied = [...ranked].sort((a, b) => b.s.breakdown.science - a.s.breakdown.science)[0];
                  const mostPractical = [...ranked].sort((a, b) => b.s.breakdown.handling - a.s.breakdown.handling)[0];
                  const verdicts = [
                    { label: 'Overall Best', icon: <Trophy size={14} />, item: leader, color: primaryColor, reason: `Highest composite research score (${leader.s.total}/100)` },
                    { label: 'Safest Profile', icon: <Shield size={14} />, item: safest, color: '#68D391', reason: `Best safety-to-evidence ratio in this comparison` },
                    { label: 'Most Studied', icon: <BookOpen size={14} />, item: mostStudied, color: '#F6AD55', reason: `Deepest scientific literature footprint` },
                    { label: 'Most Practical', icon: <Zap size={14} />, item: mostPractical, color: '#9F7AEA', reason: `Best handling & protocol practicality score` },
                  ];
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                      <p style={{ margin: '0 0 4px 0', fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>Research verdict cards — scored on evidence strength, safety profile, scientific backing, research coverage, and handling practicality.</p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                        {verdicts.map(v => (
                          <div key={v.label} style={{ padding: '12px 14px', borderRadius: 10, background: `${v.color}08`, border: `1px solid ${v.color}25`, display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div>
                              <div style={{ fontSize: '0.65rem', fontWeight: 800, color: v.color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4, display: 'flex', alignItems: 'center', gap: '4px' }}>{v.icon} {v.label}</div>
                              <div style={{ fontWeight: 900, fontSize: '0.92rem', color: 'var(--white)', marginBottom: 4 }}>{v.item.p.productName}</div>
                              <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.4 }}>{v.reason}</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => dispatchAddToCart(v.item.p.productName)}
                              style={{
                                background: v.color, border: 'none', color: '#04221F',
                                padding: '6px 12px', borderRadius: 8, fontWeight: 800, fontSize: '0.74rem',
                                cursor: 'pointer', marginTop: 'auto', width: '100%', textAlign: 'center',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                                transition: 'opacity 0.2s',
                              }}
                              onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
                              onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
                            >
                              <Zap size={11} /> Add To Cart
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Matrix Tab */}
              <div style={{ display: matrixTab === 'matrix' ? 'block' : 'none', borderRadius: 'var(--radius-lg, 12px)', overflowX: 'auto', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px', position: 'relative' }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 20 }}>
                    <tr>
                      <th style={{ ...labelCellStyle, textAlign: 'left', width: '20%', background: '#0F161E', zIndex: 30 }} scope="col">Product</th>
                      {displayedPinned.map((p, idx) => {
                        return (
                          <th 
                            key={p.productName} 
                            style={{ ...cellStyle, textAlign: 'left', width: `${80 / displayedPinned.length}%`, background: '#0F161E', borderLeft: '1px solid rgba(168,180,192,0.18)' }} 
                            scope="col"
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 8 }}>
                                {getChoiceBadge(idx)}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  {p.pricePerVialDollars != null && (
                                    <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#68D391' }}>
                                      ${Number(p.pricePerVialDollars).toFixed(2)} <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>/ vial</span>
                                    </div>
                                  )}
                                  {isMobile && idx !== 0 && sortedPinnedItems.length > 2 && (
                                    <div style={{ display: 'flex', gap: 4 }}>
                                      <button
                                        onClick={() => setMobileViewIndex(prev => prev > 1 ? prev - 1 : sortedPinnedItems.length - 1)}
                                        style={{ background: 'none', border: 'none', color: 'var(--silver)', cursor: 'pointer', padding: 0 }}
                                      >
                                        <ChevronLeft size={18} />
                                      </button>
                                      <button
                                        onClick={() => setMobileViewIndex(prev => prev < sortedPinnedItems.length - 1 ? prev + 1 : 1)}
                                        style={{ background: 'none', border: 'none', color: 'var(--silver)', cursor: 'pointer', padding: 0 }}
                                      >
                                        <ChevronRight size={18} />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                                {p.imageUrl && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={p.imageUrl} alt={p.productName} width={40} height={40} style={{ borderRadius: 8, objectFit: 'cover' }} />
                                )}
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <div style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--white)' }}>{p.productName}</div>
                                </div>
                              </div>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const visibleRows: typeof ROWS = [];
                      let currentGroupRow: typeof ROWS[number] | null = null;
                      let currentGroupHasChildren = false;

                      for (const row of ROWS) {
                        if (row.kind === 'group') {
                          if (currentGroupRow && currentGroupHasChildren) {
                            visibleRows.push(currentGroupRow);
                          }
                          currentGroupRow = row;
                          currentGroupHasChildren = false;
                        } else {
                          const values = displayedPinned.map(p => row.getValue(p));
                          const allSame = values.every(v => v === values[0]);
                          const isVisible = !(hideIdentical && allSame && displayedPinned.length > 1);
                          if (isVisible) {
                            currentGroupHasChildren = true;
                            visibleRows.push(row);
                          }
                        }
                      }
                      if (currentGroupRow && currentGroupHasChildren) {
                        visibleRows.push(currentGroupRow);
                      }

                      return visibleRows.map((row) => {
                        const rIdx = ROWS.indexOf(row);
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

                        if (hideIdentical && allSame && displayedPinned.length > 1) {
                          return null;
                        }

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
                                <td key={p.productName} style={{ ...valueCellStyle, position: 'relative', borderLeft: '1px solid rgba(168,180,192,0.18)' }}>
                                  {isWinner && (
                                    <div style={{ position: 'absolute', top: 4, right: 4, fontSize: '0.65rem', background: primaryColor, color: '#04221F', padding: '2px 6px', borderRadius: 4, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                                      <Trophy size={9} /> Top Pick
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
                      });
                    })()}
                  </tbody>
                  <tfoot style={{ position: 'sticky', bottom: 0, zIndex: 20 }}>
                    <tr style={{ background: '#0F161E', borderTop: '2px solid rgba(168,180,192,0.18)' }}>
                      <td style={{ ...labelCellStyle, background: '#0F161E', borderBottom: 'none' }}>Action</td>
                      {displayedPinned.map((p) => (
                        <td key={p.productName} style={{ ...cellStyle, borderBottom: 'none', borderLeft: '1px solid rgba(168,180,192,0.18)' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              {p.imageUrl && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={p.imageUrl} alt={p.productName} width={32} height={32} style={{ borderRadius: 6, objectFit: 'cover' }} />
                              )}
                              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.productName}</div>
                                {p.pricePerVialDollars != null && (
                                  <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#68D391' }}>
                                    ${Number(p.pricePerVialDollars).toFixed(2)}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => dispatchAddToCart(p.productName)}
                            style={{
                              background: primaryColor, border: 'none', color: '#04221F',
                              padding: '10px 16px', borderRadius: 8, fontWeight: 800, fontSize: '0.85rem',
                              cursor: 'pointer', width: '100%', textAlign: 'center',
                              boxShadow: `0 2px 8px ${primaryColor}33`,
                              transition: 'opacity 0.2s',
                            }}
                            onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
                            onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
                          >
                            Add To Cart
                          </button>
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}
