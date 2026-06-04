'use client';

/**
 * Compare Tool — comprehensive side-by-side comparison of up to four compounds,
 * with pros/cons, a weighted scoring verdict, analyst brief, synergy detection,
 * and a radar chart. Pure presentation over an in-memory Compound[] from the
 * parent server component. Research-use-only.
 */

import { useMemo, useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
  Search, X, PlusCircle, Check, Printer, Share2, Download,
  ChevronDown, ChevronRight, GripHorizontal, ChevronLeft,
  ThumbsUp, ThumbsDown, Trophy, AlertTriangle, Info
} from 'lucide-react';
import { type Compound, evidenceTier, wadaLabel, researchAreaLabel, RISK_META } from '@/lib/compounds';
import AttributeRadarChart, { type RadarDataPoint } from './AttributeRadarChart';
import InCellGlossaryTooltip from './InCellGlossaryTooltip';

const MAX_COLUMNS = 4;

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
  return num;
}

// ─── Weighted Composite Scoring Engine ───────────────────────────────────────
interface CompoundScore {
  total: number; // 0–100
  breakdown: {
    evidence: number;    // 0–30
    safety: number;      // 0–25
    coverage: number;    // 0–15
    science: number;     // 0–15
    handling: number;    // 0–15
  };
  verdict: string;       // human-readable summary of strongest dimension
  bestFor: string[];     // research areas where this compound leads
}

function scoreCompound(c: Compound, allSelected: Compound[]): CompoundScore {
  // Evidence Tier (0–30)
  const evidenceScore =
    c.evidence_tier === 'approved_drug' ? 30 :
    c.evidence_tier === 'investigational' ? 22 :
    c.evidence_tier === 'preclinical' ? 14 :
    c.evidence_tier === 'research_chemical' ? 6 : 3;

  // Safety/Risk (0–25) — lower risk = higher score
  const safetyScore =
    c.risk_level === 'low' ? 25 :
    c.risk_level === 'moderate' ? 18 :
    c.risk_level === 'high' ? 9 :
    c.risk_level === 'critical' ? 2 : 10;

  // Research Coverage (0–15) — number of research areas, capped
  const areaCount = (c.research_areas ?? []).length;
  const coverageScore = Math.min(15, areaCount * 2.5);

  // Scientific Backing (0–15) — citations + trials
  const citeScore = Math.min(8, ((c.pubmed_citation_count ?? 0) / 500) * 8);
  const trialScore = Math.min(7, (((c.active_trial_count ?? 0) + (c.completed_trial_count ?? 0)) / 20) * 7);
  const scienceScore = citeScore + trialScore;

  // Handling Practicality (0–15) — half-life + shelf life
  const hlHours = parseHalfLifeHours(c.half_life);
  const hlScore = hlHours > 0 ? Math.min(8, (hlHours / 168) * 8) : 2; // 168h = 1 week
  const shelfDays = c.reconstitution_shelf_days ?? c.handling?.reconstituted_days ?? 0;
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
  const topDim = dims.sort((a, b) => b.val - a.val)[0];
  const verdict = `Leads in ${topDim.name}`;

  // bestFor: research areas where this compound has the most coverage vs peers
  const bestFor = (c.research_areas ?? []).filter(area =>
    allSelected.every(other =>
      other.slug === c.slug || !(other.research_areas ?? []).includes(area)
    )
  );

  return {
    total,
    breakdown: {
      evidence: Math.round(evidenceScore),
      safety: Math.round(safetyScore),
      coverage: Math.round(coverageScore),
      science: Math.round(scienceScore),
      handling: Math.round(handlingScore),
    },
    verdict,
    bestFor,
  };
}

// ─── Pros / Cons Generator ───────────────────────────────────────────────────
interface ProsCons {
  pros: string[];
  cons: string[];
}

function generateProsCons(c: Compound): ProsCons {
  const pros: string[] = [];
  const cons: string[] = [];

  // Evidence
  if (c.evidence_tier === 'approved_drug') pros.push('FDA/EMA Approved — highest evidence tier');
  else if (c.evidence_tier === 'investigational') pros.push('Active human clinical trials underway');
  else if (c.evidence_tier === 'preclinical') cons.push('Only preclinical (animal/in-vitro) evidence so far');
  else cons.push('Research compound only — no approved human use');

  // Safety
  if (c.risk_level === 'low') pros.push('Low risk profile in available literature');
  else if (c.risk_level === 'moderate') cons.push('Moderate risk — careful handling protocols recommended');
  else if (c.risk_level === 'high') cons.push('High risk level — significant adverse event reports');
  else if (c.risk_level === 'critical') cons.push('Critical risk designation — exercise extreme caution');

  // WADA
  if (c.wada_status === 'prohibited' || c.wada_status === 'prohibited_males') {
    cons.push('WADA Prohibited — not permitted in tested competitive sport');
  } else if (c.wada_status === 'permitted') {
    pros.push('WADA Permitted — compliant for tested athletes');
  }

  // Citations
  const cites = c.pubmed_citation_count ?? 0;
  if (cites >= 1000) pros.push(`Extensive scientific literature (${cites.toLocaleString()} PubMed citations)`);
  else if (cites >= 200) pros.push(`Good scientific literature base (${cites.toLocaleString()} PubMed citations)`);
  else if (cites < 50 && cites >= 0) cons.push('Limited peer-reviewed literature available');

  // Clinical Trials
  const trials = (c.active_trial_count ?? 0) + (c.completed_trial_count ?? 0);
  if (trials >= 10) pros.push(`Substantial clinical trial history (${trials} trials)`);
  else if (trials > 0) pros.push(`${trials} clinical trial${trials > 1 ? 's' : ''} on record`);
  else cons.push('No registered clinical trials found');

  // Half-life
  const hlHours = parseHalfLifeHours(c.half_life);
  if (hlHours >= 48) pros.push(`Long half-life (${c.half_life}) — infrequent dosing intervals possible`);
  else if (hlHours > 0 && hlHours < 2) cons.push(`Very short half-life (${c.half_life}) — frequent administration required`);

  // Shelf life
  const shelf = c.reconstitution_shelf_days ?? c.handling?.reconstituted_days;
  if (shelf && shelf >= 28) pros.push(`Good reconstituted shelf life (${shelf} days refrigerated)`);
  else if (shelf && shelf < 14) cons.push(`Short shelf life after reconstitution (${shelf} days)`);

  // Research areas breadth
  const areaCount = (c.research_areas ?? []).length;
  if (areaCount >= 4) pros.push(`Broad research interest — studied across ${areaCount} application areas`);
  else if (areaCount === 1) cons.push('Narrow research scope — limited to one primary application area');

  // Stack benefits
  if ((c.best_stacked_with ?? []).length > 0) {
    pros.push(`Known synergistic stack partners: ${c.best_stacked_with!.join(', ')}`);
  }

  // Temperature sensitivity
  if (c.is_temp_sensitive) {
    cons.push('Temperature-sensitive — requires cold-chain shipping and refrigerated storage');
  }

  return { pros, cons };
}

// ─── Analyst Brief Generator ──────────────────────────────────────────────────
function generateAnalystBrief(selected: Compound[], scores: CompoundScore[]): string[] {
  if (selected.length < 2) return [];
  const paragraphs: string[] = [];

  // Score leader
  const sorted = [...selected].map((c, i) => ({ c, s: scores[i] })).sort((a, b) => b.s.total - a.s.total);
  const leader = sorted[0];
  const runner = sorted[1];
  paragraphs.push(
    `Overall, ${leader.c.display_name} scores highest at ${leader.s.total}/100 on PepNation Lab's composite research index, driven by its ${leader.s.verdict.toLowerCase()}. ${runner.c.display_name} follows at ${runner.s.total}/100${sorted.length > 2 ? `, with ${sorted.slice(2).map(x => `${x.c.display_name} at ${x.s.total}`).join(', ')}` : ''}.`
  );

  // Evidence narrative
  const highestEvidence = [...selected].sort((a, b) => {
    const rank = (e: string) =>
      e === 'approved_drug' ? 4 : e === 'investigational' ? 3 : e === 'preclinical' ? 2 : 1;
    return rank(b.evidence_tier) - rank(a.evidence_tier);
  })[0];
  paragraphs.push(
    `From an evidence standpoint, ${highestEvidence.display_name} carries the strongest regulatory backing as an ${evidenceTier(highestEvidence.evidence_tier).label.toLowerCase()} compound. Researchers prioritizing well-validated compounds should weight this heavily in their selection.`
  );

  // Safety narrative
  const safest = [...selected].sort((a, b) => {
    const rank = (r: string) => r === 'low' ? 1 : r === 'moderate' ? 2 : r === 'high' ? 3 : 4;
    return rank(a.risk_level) - rank(b.risk_level);
  })[0];
  const mostRisky = [...selected].sort((a, b) => {
    const rank = (r: string) => r === 'low' ? 1 : r === 'moderate' ? 2 : r === 'high' ? 3 : 4;
    return rank(b.risk_level) - rank(a.risk_level);
  })[0];
  if (safest.slug !== mostRisky.slug) {
    paragraphs.push(
      `Safety profiles diverge meaningfully across this selection. ${safest.display_name} presents the lowest documented risk level, while ${mostRisky.display_name} carries a ${RISK_META[mostRisky.risk_level]?.label ?? mostRisky.risk_level} risk designation — a factor that should inform lab protocol design and storage handling.`
    );
  }

  // Half-life narrative
  const byHl = [...selected].map(c => ({ c, hl: parseHalfLifeHours(c.half_life) })).filter(x => x.hl > 0).sort((a, b) => b.hl - a.hl);
  if (byHl.length >= 2) {
    const longest = byHl[0];
    const shortest = byHl[byHl.length - 1];
    if (longest.c.slug !== shortest.c.slug) {
      const ratio = (longest.hl / shortest.hl).toFixed(1);
      paragraphs.push(
        `Pharmacokinetically, ${longest.c.display_name} provides a ${ratio}x longer half-life than ${shortest.c.display_name} (${longest.c.half_life} vs. ${shortest.c.half_life}). For research protocols requiring sustained exposure, ${longest.c.display_name} offers greater dosing interval flexibility.`
      );
    }
  }

  // Unique use-case note
  const uniqueAreas = selected.flatMap(c =>
    (c.research_areas ?? []).filter(a =>
      selected.filter(o => o.slug !== c.slug).every(o => !(o.research_areas ?? []).includes(a))
    ).map(a => ({ compound: c.display_name, area: researchAreaLabel(a) }))
  );
  if (uniqueAreas.length > 0) {
    const grouped = uniqueAreas.reduce<Record<string, string[]>>((acc, { compound, area }) => {
      if (!acc[compound]) acc[compound] = [];
      acc[compound].push(area);
      return acc;
    }, {});
    const parts = Object.entries(grouped).map(([name, areas]) => `${name} uniquely covers ${areas.join(' and ')}`);
    paragraphs.push(`In terms of research scope differentiation: ${parts.join('; ')}.`);
  }

  return paragraphs;
}

// ─── Row Definitions ─────────────────────────────────────────────────────────
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
  { kind: 'group', label: 'Overview' },
  {
    kind: 'data', label: 'Research Summary',
    getValue: c => c.eli5_summary ?? c.plain_summary,
    render: c => {
      const text = c.eli5_summary ?? c.plain_summary;
      if (!text) return NL;
      return <span style={{ fontSize: '0.82rem', lineHeight: 1.5, display: 'block', maxHeight: 120, overflowY: 'auto' }}>{text}</span>;
    }
  },
  { kind: 'data', label: 'Studied For', getValue: c => c.studied_for?.join(','), render: (c) => ((c.studied_for ?? []).length ? c.studied_for.join(', ') : NL) },
  { kind: 'data', label: 'Research Areas', getValue: c => c.research_areas?.join(','), render: (c) => ((c.research_areas ?? []).length ? c.research_areas.map(researchAreaLabel).join(', ') : NL) },
  { kind: 'data', label: 'Best Stacked With', getValue: c => c.best_stacked_with?.join(','), render: (c) => (c.best_stacked_with?.length ? c.best_stacked_with.join(', ') : NL) },

  { kind: 'group', label: 'Identity' },
  { kind: 'data', label: 'Category', getValue: c => c.category, render: (c) => txt(c.category) },
  { kind: 'data', label: 'Class', getValue: c => c.compound_class, render: (c) => txt(c.compound_class) },
  { kind: 'data', label: 'Molecular Target', getValue: c => c.molecular_target, render: (c) => txt(c.molecular_target) },
  { kind: 'data', label: 'Sequence', getValue: c => c.identity?.sequence, render: (c) => txt(c.identity?.sequence) },
  {
    kind: 'data',
    label: 'Molecular Weight',
    glossaryTerm: 'Molecular Weight',
    bestLogic: 'min',
    getRawScore: c => c.molecular_weight_da ? Number(c.molecular_weight_da) : Number(c.identity?.molecular_weight) || Infinity,
    getValue: c => c.molecular_weight_da ?? c.identity?.molecular_weight,
    render: (c) => c.molecular_weight_da ? `${c.molecular_weight_da} Da` : txt(c.identity?.molecular_weight)
  },
  { kind: 'data', label: 'CAS Number', getValue: c => c.identity?.cas, render: (c) => txt(c.identity?.cas) },
  { kind: 'data', label: 'Discovered', getValue: c => c.year_discovered, render: (c) => txt(c.year_discovered) },

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
        <span style={{ display: 'inline-block', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: t.color, border: `1px solid ${t.color}`, borderRadius: '999px', padding: '2px 10px' }}>
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
      const total = (c.active_trial_count ?? 0) + (c.completed_trial_count ?? 0);
      if (!total) return NL;
      return (
        <span>
          {total.toLocaleString()}
          {c.active_trial_count ? <span style={{ marginLeft: 6, fontSize: '0.7rem', background: 'rgba(104,211,145,0.15)', color: '#68D391', padding: '1px 6px', borderRadius: 4, fontWeight: 800 }}>{c.active_trial_count} Active</span> : null}
        </span>
      );
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
  { kind: 'data', label: 'Typical Frequency', getValue: c => c.typical_frequency, render: (c) => txt(c.typical_frequency) },
  { kind: 'data', label: 'Mechanism / PK', glossaryTerm: 'Mechanism', getValue: c => c.pk_summary, render: (c) => txt(c.pk_summary) },
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
    render: (c) => (c.handling?.light_sensitive == null ? NL : c.handling.light_sensitive ? '⚠️ Yes' : '✓ No'),
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
  { pairs: ['bpc-157', 'tb-500'], type: 'synergy', message: 'BPC-157 + TB-500 act highly synergistically for combined systemic and localized tissue/tendon repair.' },
  { pairs: ['cjc-1295-without-dac', 'ipamorelin'], type: 'synergy', message: 'CJC-1295 + Ipamorelin amplifies GH pulse amplitude without spiking cortisol or prolactin.' },
  { pairs: ['bpc-157', 'ghk-cu'], type: 'synergy', message: 'BPC-157 + GHK-Cu offers complementary wound healing — GHK-Cu drives collagen synthesis while BPC-157 supports vascular repair.' },
  { pairs: ['sermorelin', 'ipamorelin'], type: 'synergy', message: 'Sermorelin + Ipamorelin provides dual-pathway GH stimulation (GHRH + GHSR) for amplified secretagogue effect.' },
  { pairs: ['epitalon', 'dsip'], type: 'synergy', message: 'Epitalon + DSIP may complement each other for circadian rhythm regulation and sleep architecture optimization.' },
  { pairs: ['pt-141', 'kisspeptin-10'], type: 'synergy', message: 'PT-141 + Kisspeptin-10 provides complementary central and peripheral sexual health pathways.' },
  { pairs: ['tirzepatide', 'retatrutide'], type: 'conflict', message: 'Warning: Compounding GLP-1/GIP agonists may lead to severe gastrointestinal distress and overlapping adverse effects.' },
  { pairs: ['semaglutide', 'tirzepatide'], type: 'conflict', message: 'Warning: Stacking two incretin agents is not recommended — compounding GI effects and unclear additive benefit.' },
];

const colors = ['#00C4BC', '#FF6B6B', '#FCA311', '#9F7AEA'];

// ─── Score Badge Component ─────────────────────────────────────────────────────
function ScoreBadge({ score, color }: { score: CompoundScore; color: string }) {
  const pct = score.total;
  const grade =
    pct >= 80 ? { label: 'A', bg: 'rgba(104,211,145,0.2)', border: '#68D391', text: '#68D391' } :
    pct >= 65 ? { label: 'B', bg: 'rgba(0,196,188,0.2)', border: '#00C4BC', text: '#00C4BC' } :
    pct >= 50 ? { label: 'C', bg: 'rgba(246,173,85,0.2)', border: '#F6AD55', text: '#F6AD55' } :
    { label: 'D', bg: 'rgba(229,62,62,0.2)', border: '#FC8181', text: '#FC8181' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
      {/* Score Ring */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: grade.bg, border: `2px solid ${grade.border}`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 800, color: grade.text, lineHeight: 1 }}>{pct}</span>
          <span style={{ fontSize: '0.52rem', color: grade.text, opacity: 0.7 }}>/100</span>
        </div>
        <div style={{ flex: 1 }}>
          {/* Score bar */}
          <div style={{ height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden', width: '100%' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}cc)`, borderRadius: 999, transition: 'width 0.6s ease' }} />
          </div>
          <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.5)', marginTop: 3 }}>{score.verdict}</div>
        </div>
      </div>
      {/* Dimension breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 8px', fontSize: '0.62rem', color: 'rgba(255,255,255,0.45)' }}>
        {[
          { label: 'Evidence', val: score.breakdown.evidence, max: 30 },
          { label: 'Safety', val: score.breakdown.safety, max: 25 },
          { label: 'Coverage', val: score.breakdown.coverage, max: 15 },
          { label: 'Science', val: score.breakdown.science, max: 15 },
          { label: 'Handling', val: score.breakdown.handling, max: 15 },
        ].map(d => (
          <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ minWidth: 48 }}>{d.label}</span>
            <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(d.val / d.max) * 100}%`, background: color, borderRadius: 999 }} />
            </div>
            <span style={{ minWidth: 18, textAlign: 'right' }}>{d.val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Pros/Cons Card Component ──────────────────────────────────────────────────
function ProsConsCard({ pc, color }: { pc: ProsCons; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {pc.pros.map((p, i) => (
        <div key={`pro-${i}`} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          <ThumbsUp size={12} color="#68D391" style={{ marginTop: 2, flexShrink: 0 }} />
          <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.4 }}>{p}</span>
        </div>
      ))}
      {pc.cons.map((c, i) => (
        <div key={`con-${i}`} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          <ThumbsDown size={12} color="#FC8181" style={{ marginTop: 2, flexShrink: 0 }} />
          <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.4 }}>{c}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
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
  const [activeTab, setActiveTab] = useState<'matrix' | 'proscons' | 'brief'>('matrix');
  const searchRef = useRef<HTMLDivElement>(null);

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [mobileViewIndex, setMobileViewIndex] = useState<number>(1);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    if (selectedSlugs.length > 0) {
      params.set('compare', selectedSlugs.join(','));
      params.delete('add');
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

  const scores = useMemo(() => selected.map(c => scoreCompound(c, selected)), [selected]);
  const prosCons = useMemo(() => selected.map(c => generateProsCons(c)), [selected]);
  const analystBrief = useMemo(() => generateAnalystBrief(selected, scores), [selected, scores]);

  const topPickSlug = useMemo(() => {
    if (selected.length < 2) return null;
    const best = [...selected].map((c, i) => ({ c, s: scores[i] })).sort((a, b) => b.s.total - a.s.total)[0];
    return best?.c.slug ?? null;
  }, [selected, scores]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const lower = searchQuery.toLowerCase();
    return compounds.filter((c) =>
      !selectedSlugs.includes(c.slug) &&
      (c.display_name.toLowerCase().includes(lower) ||
        (c.category && c.category.toLowerCase().includes(lower)) ||
        c.slug.toLowerCase().includes(lower) ||
        (c.aliases ?? []).some(a => a.toLowerCase().includes(lower)))
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
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleExportCSV() {
    if (selected.length === 0) return;
    let csv = 'Attribute,' + selected.map(c => `"${c.display_name}"`).join(',') + '\n';
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

  // Radar Data — 7 axes
  const radarData: RadarDataPoint[] = useMemo(() => {
    if (selected.length < 2) return [];
    const maxCites = Math.max(...selected.map(c => c.pubmed_citation_count ?? 0), 1);
    const maxHl = Math.max(...selected.map(c => parseHalfLifeHours(c.half_life)), 1);
    const maxTrials = Math.max(...selected.map(c => (c.active_trial_count ?? 0) + (c.completed_trial_count ?? 0)), 1);
    return [
      { label: 'Evidence', scores: selected.map(c => { const t = evidenceTier(c.evidence_tier); return t.label === 'Approved Drug' ? 100 : t.label === 'Investigational' ? 78 : t.label === 'Preclinical' ? 55 : 30; }) },
      { label: 'Safety', scores: selected.map(c => c.risk_level === 'low' ? 100 : c.risk_level === 'moderate' ? 70 : c.risk_level === 'high' ? 35 : 10) },
      { label: 'Citations', scores: selected.map(c => Math.min(100, Math.max(5, ((c.pubmed_citation_count ?? 0) / maxCites) * 100))) },
      { label: 'Trials', scores: selected.map(c => Math.min(100, Math.max(5, (((c.active_trial_count ?? 0) + (c.completed_trial_count ?? 0)) / maxTrials) * 100))) },
      { label: 'Half-Life', scores: selected.map(c => Math.min(100, Math.max(5, (parseHalfLifeHours(c.half_life) / maxHl) * 100))) },
      { label: 'Coverage', scores: selected.map(c => Math.min(100, Math.max(5, ((c.research_areas ?? []).length / 8) * 100))) },
      { label: 'Handling', scores: selected.map(c => { const shelf = c.reconstitution_shelf_days ?? c.handling?.reconstituted_days ?? 0; return Math.min(100, Math.max(5, (shelf / 60) * 100)); }) },
    ];
  }, [selected]);

  // Synergy Detection
  const activeSynergies = KNOWN_SYNERGIES.filter(syn =>
    syn.pairs.every(slug => selectedSlugs.includes(slug))
  );

  return (
    <div>
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body { background: #fff !important; color: #000 !important; }
          .no-print { display: none !important; }
          .glass-panel { background: #fff !important; border: 1px solid #ccc !important; padding: 0 !important; }
          td, th { color: #000 !important; background: #fff !important; border-bottom: 1px solid #ddd !important; }
          .print-group { background: #f5f5f5 !important; color: #000 !important; }
        }
        .ct-tab-btn { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.5); border-radius: 8px; padding: 8px 16px; font-size: 0.82rem; font-weight: 700; cursor: pointer; transition: all 0.2s; }
        .ct-tab-btn:hover { background: rgba(255,255,255,0.08); color: var(--white); }
        .ct-tab-btn.active { background: rgba(0,196,188,0.15); border-color: rgba(0,196,188,0.5); color: var(--teal); }
      `}} />

      {/* ── Search / Add Bar ── */}
      <div className="no-print" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4, 16px)', alignItems: 'center', marginBottom: 'var(--space-5, 24px)', position: 'relative', zIndex: 50 }} ref={searchRef}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 500 }}>
          <div style={{ position: 'relative' }}>
            <Search style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--silver, #A8B4C0)' }} size={18} />
            <input
              type="text"
              placeholder={canAdd ? 'Search for a compound to compare...' : `Maximum of ${MAX_COLUMNS} compounds selected`}
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setIsSearchOpen(true); }}
              onFocus={() => setIsSearchOpen(true)}
              disabled={!canAdd}
              style={{ width: '100%', background: 'var(--grey-400, #162230)', color: 'var(--white, #FFFFFF)', border: '1px solid rgba(168,180,192,0.25)', borderRadius: 'var(--radius-md, 8px)', padding: '12px 16px 12px 42px', fontSize: '1rem', outline: 'none', opacity: canAdd ? 1 : 0.5 }}
            />
          </div>
          {isSearchOpen && searchQuery.trim() && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 8, background: '#162230', border: '1px solid rgba(168,180,192,0.25)', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
              {searchResults.length > 0 ? (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: 300, overflowY: 'auto' }}>
                  {searchResults.map((c) => {
                    const tier = evidenceTier(c.evidence_tier);
                    return (
                      <li key={c.slug}>
                        <button type="button" onClick={() => addCompound(c.slug)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(168,180,192,0.1)', color: 'var(--white, #FFFFFF)', textAlign: 'left', cursor: 'pointer' }}
                          onMouseOver={(e) => e.currentTarget.style.background = 'rgba(0,196,188,0.1)'}
                          onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{c.display_name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--silver, #A8B4C0)', marginTop: 2 }}>{c.category}</div>
                          </div>
                          <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: 999, background: `${tier.color}20`, color: tier.color, fontWeight: 700 }}>{tier.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--silver, #A8B4C0)', fontSize: '0.9rem' }}>No compounds found matching &quot;{searchQuery}&quot;</div>
              )}
            </div>
          )}
        </div>

        <span style={{ color: 'var(--silver, #A8B4C0)', fontSize: '0.85rem', fontWeight: 700 }}>{selected.length} Of {MAX_COLUMNS} Selected</span>

        {selected.length >= 2 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: 'var(--silver)', fontSize: '0.85rem', fontWeight: 800, userSelect: 'none' }}>
              <input type="checkbox" checked={diffMode} onChange={(e) => setDiffMode(e.target.checked)} style={{ accentColor: '#00C4BC', width: 16, height: 16 }} />
              Highlight Differences
            </label>
            <button type="button" onClick={handleExportCSV} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--white)', borderRadius: 8, padding: '8px 12px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
              <Download size={14} /> Export
            </button>
            <button type="button" onClick={handleShare} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--white)', borderRadius: 8, padding: '8px 12px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
              {copied ? <Check size={14} color="#00C4BC" /> : <Share2 size={14} />}
              {copied ? 'Copied!' : 'Share'}
            </button>
            <button type="button" onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--white)', borderRadius: 8, padding: '8px 12px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
              <Printer size={14} /> Print
            </button>
          </div>
        )}

        {selected.length > 0 && (
          <button type="button" onClick={() => setSelectedSlugs([])} style={{ background: 'rgba(229,62,62,0.1)', border: '1px solid rgba(229,62,62,0.3)', color: '#F08A8A', borderRadius: 8, padding: '8px 16px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
            Clear All
          </button>
        )}
      </div>

      {/* ── Synergy / Conflict Alerts ── */}
      {activeSynergies.map((syn, idx) => (
        <div key={idx} style={{
          background: syn.type === 'conflict' ? 'rgba(229,62,62,0.1)' : 'rgba(104,211,145,0.1)',
          border: `1px solid ${syn.type === 'conflict' ? 'rgba(229,62,62,0.3)' : 'rgba(104,211,145,0.3)'}`,
          color: syn.type === 'conflict' ? '#FC8181' : '#68D391',
          padding: '12px 16px', borderRadius: 8, marginBottom: 12, fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'flex-start', gap: 10
        }}>
          {syn.type === 'conflict' ? <AlertTriangle size={16} style={{ marginTop: 1, flexShrink: 0 }} /> : <span style={{ fontSize: '1rem' }}>🔥</span>}
          <span><strong>{syn.type === 'conflict' ? 'Conflict Detected' : 'Synergy Detected'}:</strong> {syn.message}</span>
        </div>
      ))}

      {/* ── Empty State ── */}
      {selected.length === 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4, 16px)' }}>
          {[1, 2, 3].map((num) => (
            <div key={num} className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, height: 300, border: '2px dashed rgba(168,180,192,0.2)', borderRadius: 'var(--radius-lg, 12px)', background: 'rgba(22, 34, 48, 0.4)' }}>
              <PlusCircle size={48} color="rgba(168,180,192,0.2)" />
              <div style={{ color: 'var(--silver, #A8B4C0)', fontWeight: 700, fontSize: '1.1rem' }}>Compound {num}</div>
              <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '0.85rem', textAlign: 'center', padding: '0 24px', opacity: 0.7 }}>Use the search bar above to select a compound and begin building your comparison.</p>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6, 32px)' }}>

          {/* ── Tab Navigation ── */}
          {selected.length >= 2 && (
            <div className="no-print" style={{ display: 'flex', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 0 }}>
              {[
                { id: 'matrix' as const, label: '📊 Attribute Matrix' },
                { id: 'proscons' as const, label: '⚖️ Pros & Cons' },
                { id: 'brief' as const, label: '🧠 Analyst Brief' },
              ].map(tab => (
                <button key={tab.id} type="button" className={`ct-tab-btn${activeTab === tab.id ? ' active' : ''}`} onClick={() => setActiveTab(tab.id)}>
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {/* ── RADAR + SCORE SUMMARY (always visible) ── */}
          {selected.length >= 2 && (
            <div className="glass-panel" style={{ borderRadius: 'var(--radius-lg, 12px)', padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Top Pick Banner */}
              {topPickSlug && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(0,196,188,0.08)', border: '1px solid rgba(0,196,188,0.25)', borderRadius: 10, padding: '10px 16px' }}>
                  <Trophy size={18} color="#00C4BC" />
                  <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--teal)' }}>Top Overall Pick: {bySlug.get(topPickSlug)?.display_name}</span>
                  <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', marginLeft: 4 }}>· Highest composite research score among selected compounds</span>
                </div>
              )}

              {/* Score cards per compound */}
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${displayedSelected.length}, 1fr)`, gap: 16 }}>
                {displayedSelected.map((c, idx) => {
                  const originalIdx = selected.findIndex(x => x.slug === c.slug);
                  const score = scores[originalIdx];
                  const color = colors[originalIdx % colors.length];
                  const isTop = c.slug === topPickSlug;
                  return (
                    <div key={c.slug} style={{ padding: 14, borderRadius: 10, background: isTop ? 'rgba(0,196,188,0.06)' : 'rgba(255,255,255,0.02)', border: `1px solid ${isTop ? 'rgba(0,196,188,0.3)' : 'rgba(255,255,255,0.08)'}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                        <span style={{ fontWeight: 900, fontSize: '0.9rem', color: 'var(--white)' }}>{c.display_name}</span>
                        {isTop && <Trophy size={12} color="#00C4BC" />}
                      </div>
                      <ScoreBadge score={score} color={color} />
                      {score.bestFor.length > 0 && (
                        <div style={{ marginTop: 8, padding: '6px 10px', background: `${color}12`, borderRadius: 6, fontSize: '0.7rem', color: color, fontWeight: 700 }}>
                          Unique: {score.bestFor.map(researchAreaLabel).slice(0, 2).join(', ')}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Radar */}
              {radarData.length >= 2 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginBottom: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Research Profile Radar</div>
                  <AttributeRadarChart data={radarData} colors={colors} size={isMobile ? 220 : 300} />
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
                    {selected.map((c, i) => (
                      <div key={c.slug} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)' }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: colors[i % colors.length] }} />
                        {c.display_name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TAB: PROS & CONS ── */}
          {(activeTab === 'proscons' || selected.length === 1) && (
            <div className="glass-panel" style={{ borderRadius: 'var(--radius-lg, 12px)', padding: '24px' }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '1.1rem', fontWeight: 800, color: 'var(--white)' }}>
                ⚖️ Pros &amp; Cons Analysis
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(260px, 1fr))`, gap: 16 }}>
                {displayedSelected.map((c, idx) => {
                  const originalIdx = selected.findIndex(x => x.slug === c.slug);
                  const pc = prosCons[originalIdx];
                  const color = colors[originalIdx % colors.length];
                  return (
                    <div key={c.slug} style={{ padding: 16, borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: `1px solid rgba(255,255,255,0.08)` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                        <span style={{ fontWeight: 900, fontSize: '0.92rem', color: 'var(--white)' }}>{c.display_name}</span>
                      </div>
                      <ProsConsCard pc={pc} color={color} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── TAB: ANALYST BRIEF ── */}
          {activeTab === 'brief' && selected.length >= 2 && (
            <div className="glass-panel" style={{ borderRadius: 'var(--radius-lg, 12px)', padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <Info size={18} color="rgba(0,196,188,0.8)" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--white)' }}>
                  Analyst Brief
                </h3>
                <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>For laboratory research reference only</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {analystBrief.map((para, i) => (
                  <p key={i} style={{ margin: 0, color: 'rgba(255,255,255,0.75)', fontSize: '0.9rem', lineHeight: 1.7, paddingLeft: 14, borderLeft: '2px solid rgba(0,196,188,0.3)' }}>
                    {para}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* ── TAB: ATTRIBUTE MATRIX ── */}
          {(activeTab === 'matrix' || selected.length === 1) && (
            <div className="glass-panel" style={{ borderRadius: 'var(--radius-lg, 12px)', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '480px', position: 'relative' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 20 }}>
                  <tr>
                    <th className="print-th" style={{ ...labelCellStyle, textAlign: 'left', width: '22%', background: '#162230', zIndex: 30 }} scope="col">Attribute</th>
                    {displayedSelected.map((c) => {
                      const originalIndex = selected.findIndex(x => x.slug === c.slug);
                      const color = colors[originalIndex % colors.length];
                      const isTop = c.slug === topPickSlug;
                      return (
                        <th key={c.slug} className="print-th" style={{ ...cellStyle, textAlign: 'left', width: `${78 / displayedSelected.length}%`, background: '#162230' }} scope="col"
                          draggable={!isMobile}
                          onDragStart={(e) => handleDragStart(e, originalIndex)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => handleDrop(e, originalIndex)}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                {!isMobile && <GripHorizontal size={14} color="rgba(255,255,255,0.2)" style={{ cursor: 'grab' }} />}
                                {isMobile && originalIndex !== 0 && selected.length > 2 && (
                                  <button onClick={() => setMobileViewIndex(prev => prev > 1 ? prev - 1 : selected.length - 1)} style={{ background: 'none', border: 'none', color: 'var(--silver)', cursor: 'pointer', padding: 0 }}>
                                    <ChevronLeft size={18} />
                                  </button>
                                )}
                                <Link href={`/research/${c.slug}`} style={{ color, fontWeight: 900, textDecoration: 'none', fontSize: '1.1rem' }}>
                                  {c.display_name}
                                </Link>
                                {isTop && <Trophy size={14} color="#00C4BC" />}
                                {isMobile && originalIndex !== 0 && selected.length > 2 && (
                                  <button onClick={() => setMobileViewIndex(prev => prev < selected.length - 1 ? prev + 1 : 1)} style={{ background: 'none', border: 'none', color: 'var(--silver)', cursor: 'pointer', padding: 0 }}>
                                    <ChevronRight size={18} />
                                  </button>
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                                {c.evidence_tier === 'approved_drug' && <span style={{ background: 'rgba(104,211,145,0.15)', color: '#68D391', padding: '2px 6px', borderRadius: 4, fontSize: '0.65rem', fontWeight: 800 }}>FDA</span>}
                                {(c.wada_status === 'prohibited' || c.wada_status === 'prohibited_males') && <span style={{ background: 'rgba(229,62,62,0.15)', color: '#FC8181', padding: '2px 6px', borderRadius: 4, fontSize: '0.65rem', fontWeight: 800 }}>WADA 🚫</span>}
                                {c.regulatory?.toLowerCase().includes('orphan') && <span style={{ background: 'rgba(246,173,85,0.15)', color: '#F6AD55', padding: '2px 6px', borderRadius: 4, fontSize: '0.65rem', fontWeight: 800 }}>ORPHAN</span>}
                                {c.is_stack && <span style={{ background: 'rgba(159,122,234,0.15)', color: '#9F7AEA', padding: '2px 6px', borderRadius: 4, fontSize: '0.65rem', fontWeight: 800 }}>STACK</span>}
                              </div>
                            </div>
                            <button type="button" className="no-print" onClick={() => removeCompound(c.slug)} aria-label={`Remove ${c.display_name}`}
                              style={{ background: 'transparent', border: 'none', color: 'var(--silver, #A8B4C0)', cursor: 'pointer', display: 'inline-flex', padding: 4, borderRadius: 4 }}
                              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                              onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
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

                    let currentGroupLabel = '';
                    const rowIdx = ROWS.indexOf(row);
                    for (let i = rowIdx; i >= 0; i--) {
                      if (ROWS[i].kind === 'group') { currentGroupLabel = ROWS[i].label; break; }
                    }
                    if (collapsedGroups.has(currentGroupLabel)) return null;

                    const values = displayedSelected.map(c => row.getValue(c));
                    const allSame = values.every(v => v === values[0]);
                    const isDiff = !allSame && displayedSelected.length > 1;

                    const trStyle: React.CSSProperties = { transition: 'background 0.2s' };
                    const tdLabelStyle: React.CSSProperties = { ...labelCellStyle, background: '#162230', transition: 'color 0.2s' };
                    const valueCellStyle: React.CSSProperties = { ...cellStyle, transition: 'opacity 0.2s' };

                    if (diffMode) {
                      if (isDiff) {
                        trStyle.background = 'rgba(0,196,188,0.08)';
                        tdLabelStyle.background = 'linear-gradient(rgba(0,196,188,0.08), rgba(0,196,188,0.08)), #162230';
                      } else {
                        tdLabelStyle.color = 'rgba(168,180,192,0.3)';
                        valueCellStyle.opacity = 0.3;
                      }
                    }

                    const bestIndices: number[] = [];
                    if (row.bestLogic && displayedSelected.length > 1 && !allSame) {
                      const scoresRaw = displayedSelected.map(c => row.getRawScore ? row.getRawScore(c) : 0);
                      const validScores = scoresRaw.filter(s => typeof s === 'number' && !isNaN(s) && s !== Infinity);
                      if (validScores.length > 0) {
                        const bestValue = row.bestLogic === 'max' ? Math.max(...validScores) : Math.min(...validScores);
                        scoresRaw.forEach((s, idx) => { if (s === bestValue) bestIndices.push(idx); });
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
                                  TOP 👑
                                </div>
                              )}
                              <div style={isWinner ? { borderLeft: '2px solid var(--teal)', paddingLeft: 8, marginLeft: -10 } : {}}>
                                {row.render(c, maxHalfLife)}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
