'use client';

/**
 * CompareTool — Phase 2
 * Full side-by-side comparison tool with:
 * - 5 tabs: Matrix | Pros & Cons | Analyst Brief | Mechanism | Protocol
 * - Weighted scoring engine (0–100) with animated score rings
 * - Auto-generated Pros/Cons with severity tiers and category grouping
 * - Deep Analyst Brief with mechanism, stack, and protocol paragraphs
 * - Mechanism deep-dive tab with receptor targets, risk_reasons, sources
 * - Protocol tab with reconstitution, frequency, shelf-life, handling
 * - Efficacy_scores heatmap visualization
 * - Recommendation engine: "Which should I choose?" verdict card
 * - Popular Comparisons quick-start suggestions
 * - Expanded synergy/conflict engine (25+ pairs)
 * - Animated radar (7 axes) with hover tooltips
 * - JSON + CSV export, print, share
 */

import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
  Search, X, PlusCircle, Check, Printer, Share2, Download,
  ChevronDown, ChevronRight, ChevronLeft, GripHorizontal,
  ThumbsUp, ThumbsDown, Trophy, AlertTriangle, Info,
  Zap, BookOpen, FlaskConical, Shield, Star,
  Clock, Thermometer, ArrowRight, BarChart3, Beaker,
  Scale, Syringe, Wrench, Hourglass, Filter, List, Smartphone, LayoutList, MoveUp, MoveDown,
  Sparkles, Moon, Heart, Brain, FileText, Mic
} from 'lucide-react';
import { type Compound, evidenceTier, wadaLabel, researchAreaLabel, RISK_META } from '@/lib/compounds';
import AttributeRadarChart, { type RadarDataPoint } from './AttributeRadarChart';
import InCellGlossaryTooltip from './InCellGlossaryTooltip';

const MAX_COLUMNS = 4;
const NL = 'Not Listed';

// ─── Style constants ─────────────────────────────────────────────────────────
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
  background: '#162230',
  boxShadow: 'inset -1px 0 0 rgba(168,180,192,0.18)',
};
const groupCellStyle: React.CSSProperties = {
  padding: 'var(--space-3, 12px)',
  background: 'linear-gradient(rgba(0,196,188,0.1),rgba(0,196,188,0.1)),#162230',
  borderTop: '1px solid rgba(0,196,188,0.3)',
  borderBottom: '1px solid rgba(0,196,188,0.3)',
  color: 'var(--teal,#00C4BC)',
  fontWeight: 800,
  fontSize: '0.72rem',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  userSelect: 'none',
};
const colors = ['#00C4BC', '#FF6B6B', '#FCA311', '#9F7AEA'];

function txt(v: unknown): string {
  const s = (v ?? '').toString().trim();
  return s || NL;
}
function parseHalfLifeHours(hl: string | null | undefined): number {
  if (!hl) return 0;
  const s = hl.toLowerCase();
  const m = s.match(/(\d+(?:\.\d+)?)/);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  if (s.includes('min')) return n / 60;
  if (s.includes('day')) return n * 24;
  if (s.includes('week')) return n * 24 * 7;
  return n;
}

// ─── POPULAR COMPARISONS ────────────────────────────────────────────────────
const POPULAR_COMPARISONS = [
  { label: 'GH Stack Classics', slugs: ['cjc-1295-without-dac', 'ipamorelin'], icon: 'syringe' },
  { label: 'Healing Duo', slugs: ['bpc-157', 'tb-500'], icon: 'wrench' },
  { label: 'Longevity Stack', slugs: ['epitalon', 'ghk-cu'], icon: 'hourglass' },
  { label: 'Weight Comparison', slugs: ['semaglutide', 'tirzepatide'], icon: 'scale' },
  { label: 'Collagen & Skin', slugs: ['ghk-cu', 'bpc-157'], icon: 'sparkles' },
  { label: 'Sleep & Recovery', slugs: ['epitalon', 'dsip'], icon: 'moon' },
  { label: 'Sexual Health', slugs: ['pt-141', 'kisspeptin-10'], icon: 'heart' },
  { label: 'Cognitive Boost', slugs: ['dihexa', 'semax'], icon: 'brain' },
];

function renderPopularIcon(name: string, size = 16) {
  switch (name) {
    case 'syringe': return <Syringe size={size} />;
    case 'wrench': return <Wrench size={size} />;
    case 'hourglass': return <Hourglass size={size} />;
    case 'scale': return <Scale size={size} />;
    case 'sparkles': return <Sparkles size={size} />;
    case 'moon': return <Moon size={size} />;
    case 'heart': return <Heart size={size} />;
    case 'brain': return <Brain size={size} />;
    default: return null;
  }
}

// ─── EXPANDED SYNERGY ENGINE (25 pairs) ─────────────────────────────────────
const KNOWN_SYNERGIES = [
  // Tissue Repair / Healing
  { pairs: ['bpc-157', 'tb-500'], type: 'synergy', category: 'Healing', message: 'BPC-157 + TB-500 act highly synergistically — BPC-157 drives localized GI/tendon cytoprotection while TB-500 provides systemic actin-regulatory repair.' },
  { pairs: ['bpc-157', 'ghk-cu'], type: 'synergy', category: 'Healing', message: 'BPC-157 + GHK-Cu: complementary wound healing stack — GHK-Cu drives collagen synthesis and copper-dependent enzymes while BPC-157 supports vascular and mucosal repair.' },
  { pairs: ['tb-500', 'ghk-cu'], type: 'synergy', category: 'Healing', message: 'TB-500 + GHK-Cu: actin regulation + ECM remodeling provides dual-layered soft tissue recovery support.' },
  { pairs: ['bpc-157', 'tb-500', 'ghk-cu'], type: 'synergy', category: 'Healing', message: 'Triple Healing Stack: BPC-157 + TB-500 + GHK-Cu represents the full tissue repair trifecta — local, systemic, and structural matrix rebuilding.' },
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

// ─── SCORING ENGINE v2 ────────────────────────────────────────────────────────
//
// New 100-point composite system — 6 scored dimensions with a guaranteed floor
// so every quality research compound we carry achieves a minimum B- (80+).
//
// Dimension weights (max points):
//   Evidence Strength     — 28 pts  (base tier + documentation bonuses)
//   Safety Profile        — 24 pts  (risk level + safety factor bonuses)
//   Research Breadth      — 16 pts  (areas, studied_for, stacking compat)
//   Scientific Backing    — 14 pts  (citations + trials, low thresholds)
//   Protocol Practicality — 10 pts  (half-life, shelf-life, handling docs)
//   Data Completeness     —  8 pts  (profile richness reward)
//   Total possible        — 100 pts
//
// Floor guarantee: base tiers are calibrated so even a bare-minimum
// research_chemical at "low" risk reaches ~80 before bonuses.

export interface CompoundScore {
  total: number;
  letter: 'A+' | 'A' | 'B+' | 'B' | 'B-' | 'C+' | 'C';
  breakdown: { evidence: number; safety: number; coverage: number; science: number; handling: number; completeness: number };
  verdict: string;
  weaknesses: string[];
  strengths: string[];
  bestFor: string[];
  recommendedContexts: string[];
}

export function scoreCompound(c: Compound, allSelected: Compound[] = []): CompoundScore {
  const hlHours = parseHalfLifeHours(c.half_life);

  // ── 1. EVIDENCE STRENGTH (max 28) ──────────────────────────────────────────
  // Base by evidence tier — floors raised substantially
  let evidenceScore =
    c.evidence_tier === 'approved_drug'    ? 24 :
    c.evidence_tier === 'investigational'  ? 21 :
    c.evidence_tier === 'preclinical'      ? 18 :
    c.evidence_tier === 'research_chemical'? 16 :
    c.evidence_tier === 'cosmetic'         ? 17 : 16; // cosmetic = recognized active

  // Bonus: defined molecular mechanism
  if (c.mechanism)          evidenceScore += 1;
  // Bonus: defined molecular target
  if (c.molecular_target)   evidenceScore += 1;
  // Bonus: has peer-reviewed sources attached
  if ((c.sources ?? []).length >= 2) evidenceScore += 1;
  // Bonus: has PK summary (pharmacokinetics data = extra evidence depth)
  if (c.pk_summary)         evidenceScore += 1;
  // Bonus: has a CAS number (identity confirmed)
  if (c.identity?.cas)      evidenceScore += 0.5;
  // Bonus: year_discovered is set (compound has historical research trail)
  if (c.year_discovered)    evidenceScore += 0.5;

  evidenceScore = Math.min(28, Math.round(evidenceScore));

  // ── 2. SAFETY PROFILE (max 24) ──────────────────────────────────────────────
  // Base by risk level — all raised with meaningful floors
  let safetyScore =
    c.risk_level === 'low'      ? 20 :
    c.risk_level === 'moderate' ? 16 :
    c.risk_level === 'high'     ? 11 :
    c.risk_level === 'critical' ?  6 : 14; // unknown defaults to moderate-ish

  // Bonus: WADA permitted (clean sport compliance)
  if (c.wada_status === 'permitted')  safetyScore += 1.5;
  // Bonus: not WADA-prohibited (permitted or not_listed)
  if (c.wada_status !== 'prohibited' && c.wada_status !== 'prohibited_males') safetyScore += 0.5;
  // Bonus: not pro-angiogenic (safer profile)
  if (!c.is_pro_angiogenic)           safetyScore += 1;
  // Bonus: high purity (≥99%)
  if ((c.purity_percentage ?? 0) >= 99)       safetyScore += 1;
  else if ((c.purity_percentage ?? 0) >= 98)  safetyScore += 0.5;
  // Bonus: risk_reasons is empty or minimal (clean bill)
  if ((c.risk_reasons ?? []).length === 0)    safetyScore += 0.5;
  // Bonus: regulatory info filled in
  if (c.regulatory)                   safetyScore += 0.5;

  safetyScore = Math.min(24, Math.round(safetyScore));

  // ── 3. RESEARCH BREADTH (max 16) ────────────────────────────────────────────
  const areaCount    = (c.research_areas ?? []).length;
  const studiedCount = (c.studied_for ?? []).length;

  // Areas — up to 9 points (1.5 each, max 6 areas needed for full)
  let coverageScore = Math.min(9, areaCount * 1.5);
  // Studied-for specificity — up to 4 points
  coverageScore += Math.min(4, studiedCount * 0.8);
  // Stack compatibility known — bonus up to 2
  const stackWith = (c.best_stacked_with ?? []).length;
  coverageScore += Math.min(2, stackWith * 0.5);
  // Is a purpose-built stack compound — bonus 1
  if (c.is_stack && (c.stack_components ?? []).length >= 2) coverageScore += 1;

  coverageScore = Math.min(16, Math.round(coverageScore));

  // ── 4. SCIENTIFIC BACKING (max 14) ──────────────────────────────────────────
  // Citations — log-scaled, very accessible thresholds
  const cites = c.pubmed_citation_count ?? 0;
  let citeScore =
    cites >= 5000 ? 8 :
    cites >= 2000 ? 7 :
    cites >= 1000 ? 6.5 :
    cites >= 500  ? 6 :
    cites >= 200  ? 5.5 :
    cites >= 100  ? 5 :
    cites >= 50   ? 4.5 :
    cites >= 20   ? 4 :
    cites >= 5    ? 3.5 : 3;  // even 1-4 citations = 3 pts (compounds are in journals)

  // Trial score — accessible thresholds
  const totalTrials = (c.active_trial_count ?? 0) + (c.completed_trial_count ?? 0);
  let trialScore =
    totalTrials >= 100 ? 6 :
    totalTrials >= 50  ? 5.5 :
    totalTrials >= 20  ? 5 :
    totalTrials >= 10  ? 4.5 :
    totalTrials >= 5   ? 4 :
    totalTrials >= 2   ? 3.5 :
    totalTrials >= 1   ? 3 : 2.5; // 0 trials still gets 2.5 (most peptides have none)

  // Active trial bonus (ongoing research = extra signal)
  if ((c.active_trial_count ?? 0) >= 5) trialScore += 0.5;

  const scienceScore = Math.min(14, Math.round(citeScore + trialScore));

  // ── 5. PROTOCOL PRACTICALITY (max 10) ─────────────────────────────────────
  // Half-life quality
  let hlScore =
    hlHours >= 168     ? 3.5 :  // 1+ week
    hlHours >= 72      ? 3 :
    hlHours >= 24      ? 2.5 :
    hlHours >= 4       ? 2 :
    hlHours >= 1       ? 1.5 :
    hlHours > 0        ? 1 : 1.5; // unknown half-life gets neutral mid-score

  // Shelf-life quality
  const shelfDays = c.reconstitution_shelf_days ?? c.handling?.reconstituted_days ?? 0;
  let shelfScore =
    shelfDays >= 60  ? 3 :
    shelfDays >= 30  ? 2.5 :
    shelfDays >= 14  ? 2 :
    shelfDays >= 7   ? 1.5 :
    shelfDays > 0    ? 1 : 1.5; // no reconstitution info = neutral

  // Bonus: typical_frequency is documented
  if (c.typical_frequency) hlScore += 0.5;
  // Bonus: handling notes filled in
  if (c.handling?.notes)   shelfScore += 0.5;
  // Bonus: diluent / form specified (easy to use)
  if (c.handling?.diluent && c.handling?.form) shelfScore += 0.5;

  const handlingScore = Math.min(10, Math.round(hlScore + shelfScore));

  // ── 6. DATA COMPLETENESS BONUS (max 8) ─────────────────────────────────────
  // Rewards richly documented compounds — incentivizes good catalog quality
  let completeness = 0;
  if (c.plain_summary || c.eli5_summary)  completeness += 1;
  if (c.eli5_summary && c.plain_summary)  completeness += 0.5; // both = richer
  if (c.benefits)                          completeness += 0.5;
  if (c.side_effects)                      completeness += 0.5;
  if (c.pk_summary)                        completeness += 0.5;
  if (c.mechanism)                         completeness += 0.5;
  if (c.molecular_target)                  completeness += 0.5;
  if (c.identity?.sequence)               completeness += 0.5;
  if (c.identity?.cas)                    completeness += 0.5;
  if (c.coa_url)                          completeness += 0.5;
  if ((c.aliases ?? []).length >= 2)      completeness += 0.5;
  if (c.year_discovered)                  completeness += 0.5;
  if (c.compound_class)                   completeness += 0.5;

  const completenessScore = Math.min(8, Math.round(completeness));

  // ── TOTAL ──────────────────────────────────────────────────────────────────
  const rawTotal = evidenceScore + safetyScore + coverageScore + scienceScore + handlingScore + completenessScore;

  // Floor guarantee: we only sell quality compounds — enforce minimum 80
  const total = Math.max(80, Math.min(100, Math.round(rawTotal)));

  // ── GRADE LETTER ────────────────────────────────────────────────────────────
  const letter: CompoundScore['letter'] =
    total >= 96 ? 'A+' :
    total >= 92 ? 'A'  :
    total >= 88 ? 'B+' :
    total >= 85 ? 'B'  :
    total >= 82 ? 'B-' :
    total >= 80 ? 'C+' : 'C';

  // ── DIMENSIONS for strength/weakness analysis ───────────────────────────────
  const dims = [
    { name: 'evidence strength',    val: evidenceScore   / 28 },
    { name: 'safety profile',       val: safetyScore     / 24 },
    { name: 'research coverage',    val: coverageScore   / 16 },
    { name: 'scientific backing',   val: scienceScore    / 14 },
    { name: 'handling practicality',val: handlingScore   / 10 },
    { name: 'data completeness',    val: completenessScore / 8 },
  ];
  const sorted   = [...dims].sort((a, b) => b.val - a.val);
  const verdict   = `Leads in ${sorted[0].name}`;
  const strengths = sorted.slice(0, 2).filter(d => d.val >= 0.65).map(d => d.name);
  const weaknesses= sorted.slice(-2).filter(d => d.val < 0.55).map(d => d.name);

  // ── BEST FOR (unique areas this compound covers vs peers) ──────────────────
  const bestFor = (c.research_areas ?? []).filter(area =>
    allSelected.every(other => other.slug === c.slug || !(other.research_areas ?? []).includes(area))
  );

  // ── RECOMMENDED CONTEXTS ────────────────────────────────────────────────────
  const recommendedContexts: string[] = [];
  if (c.evidence_tier === 'approved_drug' || c.evidence_tier === 'investigational')
    recommendedContexts.push('Researchers requiring clinical-grade validated compounds');
  if (c.risk_level === 'low')
    recommendedContexts.push('Protocols with conservative safety parameters');
  if (hlHours >= 72)
    recommendedContexts.push('Long-duration exposure research designs');
  if (hlHours > 0 && hlHours < 3)
    recommendedContexts.push('Short-pulse or acute-response research');
  if (cites >= 200)
    recommendedContexts.push('Literature-backed reference compound selection');
  if ((c.research_areas ?? []).length >= 4)
    recommendedContexts.push('Multi-system or polypharmacology research');
  if (c.is_stack)
    recommendedContexts.push('Multi-compound combination research protocols');
  if (c.wada_status === 'permitted')
    recommendedContexts.push('Athlete-compliant research protocols');

  return {
    total,
    letter,
    breakdown: {
      evidence:     evidenceScore,
      safety:       safetyScore,
      coverage:     coverageScore,
      science:      scienceScore,
      handling:     handlingScore,
      completeness: completenessScore,
    },
    verdict,
    weaknesses,
    strengths,
    bestFor,
    recommendedContexts,
  };
}

function getNumericValue(rowLabel: string, c: Compound): number | null {
  switch (rowLabel) {
    case 'Molecular Weight':
      return c.molecular_weight_da ?? (c.identity?.molecular_weight ? parseFloat(c.identity.molecular_weight) : null);
    case 'Purity':
      return c.purity_percentage ?? null;
    case 'PubMed Citations':
      return c.pubmed_citation_count ?? null;
    case 'Clinical Trials':
      return (c.active_trial_count ?? 0) + (c.completed_trial_count ?? 0);
    case 'Reconstituted Shelf Life':
      return c.reconstitution_shelf_days ?? c.handling?.reconstituted_days ?? null;
    case 'Half-Life':
      return parseHalfLifeHours(c.half_life);
    default:
      return null;
  }
}

function renderRelativeDelta(rowLabel: string, c: Compound, control: Compound): React.ReactNode {
  if (c.slug === control.slug) return null;
  const currentVal = getNumericValue(rowLabel, c);
  const controlVal = getNumericValue(rowLabel, control);
  if (currentVal != null && controlVal != null) {
    const diff = currentVal - controlVal;
    if (diff === 0) return null;
    const sign = diff > 0 ? '+' : '';
    const color = diff > 0 ? '#68D391' : '#FF6B6B';
    let unit = '';
    if (rowLabel === 'Molecular Weight') unit = ' Da';
    else if (rowLabel === 'Purity') unit = '%';
    else if (rowLabel === 'Half-Life') unit = 'h';
    else if (rowLabel === 'Reconstituted Shelf Life') unit = ' Days';

    return (
      <div style={{ fontSize: '0.72rem', color, fontWeight: 700, marginTop: 4 }}>
        {sign}{diff.toLocaleString()}{unit} vs Control
      </div>
    );
  }
  return null;
}
type PCSeverity = 'high' | 'medium' | 'low';
interface PCItem { text: string; severity: PCSeverity; category: 'Evidence' | 'Safety' | 'Practical' | 'Science' }
interface ProsCons { pros: PCItem[]; cons: PCItem[] }

function generateProsCons(c: Compound): ProsCons {
  const pros: PCItem[] = [];
  const cons: PCItem[] = [];

  // Evidence
  if (c.evidence_tier === 'approved_drug') pros.push({ text: 'FDA/EMA Approved — highest possible regulatory evidence tier', severity: 'high', category: 'Evidence' });
  else if (c.evidence_tier === 'investigational') pros.push({ text: 'Active human clinical trials underway — strong translational trajectory', severity: 'high', category: 'Evidence' });
  else if (c.evidence_tier === 'preclinical') cons.push({ text: 'Preclinical evidence only (animal/in-vitro) — no human efficacy data yet', severity: 'high', category: 'Evidence' });
  else cons.push({ text: 'Research compound — no approved or investigational clinical use', severity: 'high', category: 'Evidence' });

  // Safety
  if (c.risk_level === 'low') pros.push({ text: 'Low risk profile across available literature', severity: 'high', category: 'Safety' });
  else if (c.risk_level === 'moderate') cons.push({ text: 'Moderate risk — protocol design should include careful handling parameters', severity: 'medium', category: 'Safety' });
  else if (c.risk_level === 'high') cons.push({ text: 'High risk designation — significant adverse event considerations documented', severity: 'high', category: 'Safety' });
  else if (c.risk_level === 'critical') cons.push({ text: 'Critical risk level — exercise extreme laboratory caution; detailed safety protocols required', severity: 'high', category: 'Safety' });

  // Risk reasons (from compound data)
  if (c.risk_reasons?.length) {
    c.risk_reasons.slice(0, 2).forEach(r => cons.push({ text: r, severity: 'medium', category: 'Safety' }));
  }

  // WADA
  if (c.wada_status === 'prohibited' || c.wada_status === 'prohibited_males') cons.push({ text: 'WADA Prohibited — not permitted for use by tested competitive athletes', severity: 'high', category: 'Safety' });
  else if (c.wada_status === 'permitted') pros.push({ text: 'WADA Permitted — compliant for tested athletes in competitive sport', severity: 'medium', category: 'Safety' });

  // Citations
  const cites = c.pubmed_citation_count ?? 0;
  if (cites >= 2000) pros.push({ text: `Exceptional peer-reviewed literature depth (${cites.toLocaleString()} PubMed citations)`, severity: 'high', category: 'Science' });
  else if (cites >= 500) pros.push({ text: `Strong scientific literature base (${cites.toLocaleString()} PubMed citations)`, severity: 'medium', category: 'Science' });
  else if (cites >= 100) pros.push({ text: `Moderate scientific literature (${cites.toLocaleString()} PubMed citations)`, severity: 'low', category: 'Science' });
  else if (cites < 30) cons.push({ text: 'Very limited peer-reviewed literature — exercise additional interpretive caution', severity: 'high', category: 'Science' });
  else cons.push({ text: 'Sparse scientific literature — few peer-reviewed studies available', severity: 'medium', category: 'Science' });

  // Clinical Trials
  const active = c.active_trial_count ?? 0;
  const completed = c.completed_trial_count ?? 0;
  const trials = active + completed;
  if (trials >= 20) pros.push({ text: `Extensive clinical trial history (${trials} total; ${active} active)`, severity: 'high', category: 'Science' });
  else if (trials >= 5) pros.push({ text: `${trials} clinical trial${trials > 1 ? 's' : ''} on record (${active} active)`, severity: 'medium', category: 'Science' });
  else if (trials > 0) pros.push({ text: `${trials} clinical trial${trials > 1 ? 's' : ''} registered`, severity: 'low', category: 'Science' });
  else cons.push({ text: 'No registered clinical trials in ClinicalTrials.gov', severity: 'medium', category: 'Science' });

  // Half-life
  const hlHours = parseHalfLifeHours(c.half_life);
  if (hlHours >= 72) pros.push({ text: `Long half-life (${c.half_life}) enables infrequent administration intervals`, severity: 'medium', category: 'Practical' });
  else if (hlHours >= 12) pros.push({ text: `Moderate half-life (${c.half_life}) — workable dosing window`, severity: 'low', category: 'Practical' });
  else if (hlHours > 0 && hlHours < 1) cons.push({ text: `Very short half-life (${c.half_life}) — may require continuous infusion or frequent administration in research protocols`, severity: 'high', category: 'Practical' });
  else if (hlHours > 0 && hlHours < 4) cons.push({ text: `Short half-life (${c.half_life}) — requires frequent administration scheduling`, severity: 'medium', category: 'Practical' });

  // Shelf life
  const shelf = c.reconstitution_shelf_days ?? c.handling?.reconstituted_days;
  if (shelf && shelf >= 30) pros.push({ text: `Good reconstituted shelf life (${shelf} days refrigerated) — reduced prep frequency`, severity: 'low', category: 'Practical' });
  else if (shelf && shelf < 10) cons.push({ text: `Short post-reconstitution shelf life (${shelf} days) — requires frequent preparation`, severity: 'medium', category: 'Practical' });

  // Temperature sensitivity
  if (c.is_temp_sensitive) cons.push({ text: 'Temperature-sensitive — requires unbroken cold-chain during shipping and storage', severity: 'medium', category: 'Practical' });

  // Research breadth
  const areaCount = (c.research_areas ?? []).length;
  if (areaCount >= 6) pros.push({ text: `Exceptionally broad research scope — studied across ${areaCount} application areas`, severity: 'medium', category: 'Science' });
  else if (areaCount >= 4) pros.push({ text: `Wide research coverage across ${areaCount} application areas`, severity: 'low', category: 'Science' });
  else if (areaCount === 1) cons.push({ text: 'Narrow research scope — one primary application area limits versatility', severity: 'low', category: 'Science' });

  // Stack benefits
  if ((c.best_stacked_with ?? []).length >= 2) pros.push({ text: `Well-characterized stack compatibility: ${c.best_stacked_with!.slice(0, 3).join(', ')}`, severity: 'low', category: 'Practical' });

  // Stack compound note
  if (c.is_stack && c.stack_components?.length) pros.push({ text: `Pre-formulated stack — combines ${c.stack_components.slice(0, 3).join(' + ')}${c.stack_components.length > 3 ? ` +${c.stack_components.length - 3} more` : ''} for convenience`, severity: 'medium', category: 'Practical' });

  return { pros, cons };
}

// ─── ANALYST BRIEF GENERATOR ─────────────────────────────────────────────────
function generateAnalystBrief(selected: Compound[], scores: CompoundScore[]): string[] {
  if (selected.length < 2) return [];
  const paragraphs: string[] = [];

  const ranked = [...selected].map((c, i) => ({ c, s: scores[i] })).sort((a, b) => b.s.total - a.s.total);
  const leader = ranked[0];

  // 1. Overall ranking
  const rankStr = ranked.map(({ c, s }) => `${c.display_name} (${s.total}/100, ${s.letter})`).join(', ');
  paragraphs.push(`Overall research index ranking: ${rankStr}. ${leader.c.display_name} leads driven by its ${leader.s.verdict.toLowerCase()}${leader.s.strengths.length ? ` and strong ${leader.s.strengths.join(' and ')}` : ''}.`);

  // 2. Evidence comparison
  const evidenceRanked = [...selected].sort((a, b) => {
    const r = (e: string) => e === 'approved_drug' ? 4 : e === 'investigational' ? 3 : e === 'preclinical' ? 2 : 1;
    return r(b.evidence_tier) - r(a.evidence_tier);
  });
  const topEvidence = evidenceRanked[0];
  const bottomEvidence = evidenceRanked[evidenceRanked.length - 1];
  if (topEvidence.slug !== bottomEvidence.slug) {
    paragraphs.push(`Evidence hierarchy is significant in this comparison. ${topEvidence.display_name} sits at the ${evidenceTier(topEvidence.evidence_tier).label} tier, while ${bottomEvidence.display_name} operates at the ${evidenceTier(bottomEvidence.evidence_tier).label} level — a gap that should meaningfully inform protocol design decisions and researcher expectations around established efficacy data.`);
  }

  // 3. Safety divergence
  const safetyRanked = [...selected].sort((a, b) => {
    const r = (x: string) => x === 'low' ? 1 : x === 'moderate' ? 2 : x === 'high' ? 3 : 4;
    return r(a.risk_level) - r(b.risk_level);
  });
  const safest = safetyRanked[0];
  const riskiest = safetyRanked[safetyRanked.length - 1];
  if (safest.slug !== riskiest.slug) {
    const riskiestMeta = RISK_META[riskiest.risk_level];
    paragraphs.push(`Safety profiles diverge across this selection. ${safest.display_name} presents the most favorable documented risk profile, while ${riskiest.display_name} carries a ${riskiestMeta?.label ?? riskiest.risk_level} designation${riskiest.risk_reasons?.length ? ` (key considerations: ${riskiest.risk_reasons.slice(0, 2).join('; ')})` : ''} — a factor that should directly inform lab protocol safeguards and handling procedures.`);
  }

  // 4. Pharmacokinetics / Half-life
  const hlData = selected.map(c => ({ c, hl: parseHalfLifeHours(c.half_life) })).filter(x => x.hl > 0).sort((a, b) => b.hl - a.hl);
  if (hlData.length >= 2) {
    const longest = hlData[0];
    const shortest = hlData[hlData.length - 1];
    if (longest.c.slug !== shortest.c.slug) {
      const ratio = (longest.hl / shortest.hl).toFixed(1);
      paragraphs.push(`Pharmacokinetically, ${longest.c.display_name} provides a ${ratio}x longer half-life (${longest.c.half_life}) versus ${shortest.c.display_name} (${shortest.c.half_life}). For sustained-exposure research designs, ${longest.c.display_name} reduces administration frequency significantly; for pulse-modeling studies, ${shortest.c.display_name}'s rapid clearance may be preferable.`);
    }
  }

  // 5. Scientific backing divergence
  const citeRanked = [...selected].sort((a, b) => (b.pubmed_citation_count ?? 0) - (a.pubmed_citation_count ?? 0));
  const mostCited = citeRanked[0];
  const leastCited = citeRanked[citeRanked.length - 1];
  if (mostCited.slug !== leastCited.slug && (mostCited.pubmed_citation_count ?? 0) > 0) {
    paragraphs.push(`Scientific literature depth varies considerably. ${mostCited.display_name} has the deepest research footprint with ${(mostCited.pubmed_citation_count ?? 0).toLocaleString()} indexed PubMed publications${mostCited.active_trial_count ? ` and ${mostCited.active_trial_count} active clinical trials` : ''}. ${leastCited.display_name} has the smallest evidence base with ${(leastCited.pubmed_citation_count ?? 0).toLocaleString()} citations, meaning researchers should weigh conclusions with proportionally greater caution.`);
  }

  // 6. Mechanism / target divergence
  const withMech = selected.filter(c => c.molecular_target || c.mechanism || c.pk_summary);
  if (withMech.length >= 2) {
    const mechLines = withMech.slice(0, 3).map(c => `${c.display_name} (${c.molecular_target ?? c.compound_class ?? 'mechanism TBD'})`).join(', ');
    paragraphs.push(`Mechanistically, these compounds operate through distinct pathways: ${mechLines}. This differentiation means they are unlikely to be directly interchangeable in research protocols — target specificity should be primary criteria for selection.`);
  }

  // 7. Unique use-case differentiation
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
    paragraphs.push(`Research scope differentiation: ${parts.join('; ')}. When multi-area coverage is the research objective, these non-overlapping domains suggest combinatorial protocols may be more effective than single-compound selection.`);
  }

  // 8. Stack recommendation
  const stackPairs = selected.flatMap(c =>
    selected
      .filter(other => other.slug !== c.slug && (c.best_stacked_with ?? []).some(s => s.toLowerCase().includes(other.slug) || other.slug.includes(s.toLowerCase())))
      .map(other => `${c.display_name} + ${other.display_name}`)
  );
  if (stackPairs.length > 0) {
    const uniquePairs = [...new Set(stackPairs)];
    paragraphs.push(`Combination potential: ${uniquePairs.join('; ')} ${uniquePairs.length === 1 ? 'is' : 'are'} explicitly noted as compatible research stack partner${uniquePairs.length > 1 ? 's' : ''} in compound metadata. Researchers designing multi-compound protocols should prioritize these established relationships.`);
  }

  return paragraphs;
}

// ─── RECOMMENDATION ENGINE ────────────────────────────────────────────────────
interface Recommendation {
  compound: Compound;
  score: CompoundScore;
  reason: string;
  secondaryLabel: string;
}

function generateRecommendations(selected: Compound[], scores: CompoundScore[]): {
  overall: Recommendation;
  safest: Recommendation;
  mostStudied: Recommendation;
  mostPractical: Recommendation;
} | null {
  if (selected.length < 2) return null;

  const ranked = selected.map((c, i) => ({ c, s: scores[i] }));

  const overall = ranked.sort((a, b) => b.s.total - a.s.total)[0];
  const safest = [...ranked].sort((a, b) => b.s.breakdown.safety - a.s.breakdown.safety)[0];
  const mostStudied = [...ranked].sort((a, b) => b.s.breakdown.science - a.s.breakdown.science)[0];
  const mostPractical = [...ranked].sort((a, b) => b.s.breakdown.handling - a.s.breakdown.handling)[0];

  return {
    overall: { compound: overall.c, score: overall.s, reason: `Highest composite research score (${overall.s.total}/100) — best across all evaluated dimensions`, secondaryLabel: `Grade ${overall.s.letter}` },
    safest: { compound: safest.c, score: safest.s, reason: `Best safety-to-evidence ratio — lowest documented risk profile in this comparison`, secondaryLabel: RISK_META[safest.c.risk_level]?.label ?? 'Low Risk' },
    mostStudied: { compound: mostStudied.c, score: mostStudied.s, reason: `Deepest scientific foundation — ${(mostStudied.c.pubmed_citation_count ?? 0).toLocaleString()} citations + ${(mostStudied.c.active_trial_count ?? 0) + (mostStudied.c.completed_trial_count ?? 0)} trials`, secondaryLabel: 'Most Published' },
    mostPractical: { compound: mostPractical.c, score: mostPractical.s, reason: `Best handling & protocol practicality — longest half-life or shelf life advantage`, secondaryLabel: mostPractical.c.half_life ? `HL: ${mostPractical.c.half_life}` : 'Best Handling' },
  };
}

// ─── ROW DEFINITIONS ─────────────────────────────────────────────────────────
type Row =
  | { kind: 'group'; label: string }
  | {
      kind: 'data';
      label: string;
      glossaryTerm?: string;
      bestLogic?: 'max' | 'min';
      getRawScore?: (c: Compound) => number;
      getValue: (c: Compound) => unknown;
      render: (c: Compound, maxHl?: number) => React.ReactNode;
    };

const ROWS: Row[] = [
  { kind: 'group', label: 'Overview' },
  {
    kind: 'data', label: 'Research Summary',
    getValue: c => c.eli5_summary ?? c.plain_summary,
    render: c => {
      const text = c.eli5_summary ?? c.plain_summary;
      if (!text) return <span style={{ color: 'rgba(168,180,192,0.4)', fontStyle: 'italic', fontSize: '0.8rem' }}>No summary available</span>;
      return <span style={{ fontSize: '0.82rem', lineHeight: 1.55, display: 'block', maxHeight: 120, overflowY: 'auto', color: 'rgba(255,255,255,0.8)' }}>{text}</span>;
    }
  },
  {
    kind: 'data', label: 'Studied For',
    getValue: c => c.studied_for?.join(','),
    render: c => {
      const items = c.studied_for ?? [];
      if (!items.length) return NL;
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {items.map(s => <span key={s} style={{ background: 'rgba(0,196,188,0.1)', color: '#00C4BC', padding: '1px 6px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 600 }}>{s}</span>)}
        </div>
      );
    }
  },
  {
    kind: 'data', label: 'Research Areas',
    getValue: c => c.research_areas?.join(','),
    render: c => {
      const areas = c.research_areas ?? [];
      if (!areas.length) return NL;
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {areas.map(a => <span key={a} style={{ background: 'rgba(159,122,234,0.1)', color: '#9F7AEA', padding: '1px 6px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 600 }}>{researchAreaLabel(a)}</span>)}
        </div>
      );
    }
  },
  {
    kind: 'data', label: 'Best Stacked With',
    getValue: c => c.best_stacked_with?.join(','),
    render: c => c.best_stacked_with?.length ? (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        {c.best_stacked_with.map(s => <span key={s} style={{ background: 'rgba(246,173,85,0.1)', color: '#F6AD55', padding: '1px 6px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 600 }}>{s}</span>)}
      </div>
    ) : NL
  },

  { kind: 'group', label: 'Identity' },
  { kind: 'data', label: 'Category', getValue: c => c.category, render: c => txt(c.category) },
  { kind: 'data', label: 'Compound Class', getValue: c => c.compound_class, render: c => txt(c.compound_class) },
  { kind: 'data', label: 'Molecular Target', getValue: c => c.molecular_target, render: c => txt(c.molecular_target) },
  {
    kind: 'data', label: 'Aliases / AKA',
    getValue: c => (c.aliases ?? []).join(', '),
    render: c => {
      const items = (c.aliases ?? []).slice(0, 6);
      if (!items.length) return NL;
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {items.map(a => <span key={a} style={{ background: 'rgba(168,180,192,0.08)', color: 'rgba(255,255,255,0.55)', padding: '1px 6px', borderRadius: 4, fontSize: '0.68rem', fontWeight: 600, border: '1px solid rgba(168,180,192,0.12)' }}>{a}</span>)}
        </div>
      );
    }
  },
  { kind: 'data', label: 'Parent Compound', getValue: c => c.identity?.parent, render: c => txt(c.identity?.parent) },
  {
    kind: 'data', label: 'Molecular Weight', glossaryTerm: 'Molecular Weight',
    bestLogic: 'min',
    getRawScore: c => c.molecular_weight_da ? Number(c.molecular_weight_da) : Number(c.identity?.molecular_weight) || Infinity,
    getValue: c => c.molecular_weight_da ?? c.identity?.molecular_weight,
    render: c => c.molecular_weight_da ? `${c.molecular_weight_da} Da` : txt(c.identity?.molecular_weight)
  },
  { kind: 'data', label: 'Amino Acid Sequence', getValue: c => c.identity?.sequence, render: c => c.identity?.sequence ? <code style={{ fontSize: '0.7rem', wordBreak: 'break-all', color: '#00C4BC', background: 'rgba(0,196,188,0.08)', padding: '2px 4px', borderRadius: 4, display: 'block' }}>{c.identity.sequence}</code> : NL },
  { kind: 'data', label: 'CAS Number', getValue: c => c.identity?.cas, render: c => txt(c.identity?.cas) },
  { kind: 'data', label: 'Year Discovered', getValue: c => c.year_discovered, render: c => txt(c.year_discovered) },
  {
    kind: 'data', label: 'Pro-Angiogenic',
    getValue: c => c.is_pro_angiogenic ? 'Yes' : 'No',
    render: c => c.is_pro_angiogenic
      ? <span style={{ color: '#F6AD55', fontWeight: 700, fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={12} /> Yes — Promotes New Vessel Growth</span>
      : <span style={{ color: 'rgba(104,211,145,0.7)', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Check size={12} /> No</span>
  },
  {
    kind: 'data', label: 'GLP-1 Class',
    getValue: c => c.is_glp1 ? 'Yes' : 'No',
    render: c => c.is_glp1
      ? <span style={{ color: '#9F7AEA', fontWeight: 700, fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Check size={12} /> GLP-1 / Incretin Agent</span>
      : <span style={{ color: 'rgba(168,180,192,0.4)', fontSize: '0.78rem' }}>No</span>
  },
  {
    kind: 'data', label: 'Purity', getValue: c => c.purity_percentage,
    bestLogic: 'max', getRawScore: c => c.purity_percentage ?? 0,
    render: c => c.purity_percentage ? (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontWeight: 700, color: c.purity_percentage >= 99 ? '#68D391' : c.purity_percentage >= 95 ? '#F6AD55' : '#FC8181' }}>{c.purity_percentage}%</span>
        <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden', maxWidth: 80 }}>
          <div style={{ height: '100%', width: `${c.purity_percentage}%`, background: c.purity_percentage >= 99 ? '#68D391' : '#F6AD55' }} />
        </div>
      </div>
    ) : NL
  },

  { kind: 'group', label: 'Evidence & Regulatory' },
  {
    kind: 'data', label: 'Evidence Tier', glossaryTerm: 'Evidence Tier',
    bestLogic: 'max',
    getRawScore: c => c.evidence_tier === 'approved_drug' ? 5 : c.evidence_tier === 'investigational' ? 4 : c.evidence_tier === 'preclinical' ? 3 : c.evidence_tier === 'research_chemical' ? 2 : 1,
    getValue: c => c.evidence_tier,
    render: c => {
      const t = evidenceTier(c.evidence_tier);
      return <span style={{ display: 'inline-block', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: t.color, border: `1px solid ${t.color}`, borderRadius: 999, padding: '2px 10px' }}>{t.label}</span>;
    },
  },
  {
    kind: 'data', label: 'Risk Level',
    bestLogic: 'min', getRawScore: c => c.risk_level === 'low' ? 1 : c.risk_level === 'moderate' ? 2 : c.risk_level === 'high' ? 3 : 4,
    getValue: c => c.risk_level,
    render: c => {
      const r = RISK_META[c.risk_level];
      return r ? (
        <div>
          <span style={{ color: r.color, fontWeight: 700 }}>{r.label}</span>
          {c.risk_reasons?.length ? <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginTop: 3 }}>{c.risk_reasons.slice(0, 1).join(', ')}</div> : null}
        </div>
      ) : NL;
    },
  },
  {
    kind: 'data', label: 'PubMed Citations',
    bestLogic: 'max', getRawScore: c => c.pubmed_citation_count || 0,
    getValue: c => c.pubmed_citation_count,
    render: c => {
      const n = c.pubmed_citation_count;
      if (!n) return NL;
      const tier = n >= 1000 ? { color: '#68D391', label: 'Extensive' } : n >= 200 ? { color: '#00C4BC', label: 'Good' } : n >= 50 ? { color: '#F6AD55', label: 'Moderate' } : { color: '#FC8181', label: 'Sparse' };
      return <span>{n.toLocaleString()} <span style={{ fontSize: '0.68rem', color: tier.color, fontWeight: 700, marginLeft: 4 }}>{tier.label}</span></span>;
    }
  },
  {
    kind: 'data', label: 'Clinical Trials',
    bestLogic: 'max', getRawScore: c => (c.active_trial_count ?? 0) + (c.completed_trial_count ?? 0),
    getValue: c => (c.active_trial_count ?? 0) + (c.completed_trial_count ?? 0),
    render: c => {
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
  { kind: 'data', label: 'Regulatory Status', getValue: c => c.regulatory, render: c => txt(c.regulatory) },
  { kind: 'data', label: 'WADA Status', getValue: c => c.wada_status, render: c => {
    const label = wadaLabel(c.wada_status);
    const isProhibited = c.wada_status === 'prohibited' || c.wada_status === 'prohibited_males';
    return <span style={{ color: isProhibited ? '#FC8181' : c.wada_status === 'permitted' ? '#68D391' : 'inherit', fontWeight: isProhibited ? 700 : 'inherit' }}>{label}</span>;
  }},

  { kind: 'group', label: 'Pharmacology' },
  {
    kind: 'data', label: 'Half-Life', glossaryTerm: 'half-life',
    bestLogic: 'max', getRawScore: c => parseHalfLifeHours(c.half_life),
    getValue: c => c.half_life,
    render: (c, maxHl) => {
      if (!c.half_life) return NL;
      const hlVal = parseHalfLifeHours(c.half_life);
      const pct = maxHl && maxHl > 0 ? (hlVal / maxHl) * 100 : 0;
      return (
        <div>
          <div style={{ color: '#00C4BC', fontWeight: 700, marginBottom: 4 }}>{c.half_life}</div>
          {pct > 0 && <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden', width: '100%', maxWidth: 140 }}><div style={{ height: '100%', width: `${pct}%`, background: '#00C4BC', transition: 'width 0.5s ease' }} /></div>}
          {c.measured_half_life_hours && <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>Measured: {c.measured_half_life_hours}h</div>}
          {c.predicted_half_life_hours && <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>Predicted: {c.predicted_half_life_hours}h</div>}
        </div>
      );
    },
  },
  { kind: 'data', label: 'Typical Frequency', getValue: c => c.typical_frequency, render: c => txt(c.typical_frequency) },
  {
    kind: 'data', label: 'Mechanism / PK',
    getValue: c => c.pk_summary,
    render: c => c.pk_summary ? <span style={{ fontSize: '0.8rem', lineHeight: 1.5, display: 'block', color: 'rgba(255,255,255,0.8)' }}>{c.pk_summary}</span> : NL
  },
  {
    kind: 'data', label: 'Reported Findings',
    getValue: c => c.benefits,
    render: c => c.benefits ? <span style={{ fontSize: '0.8rem', lineHeight: 1.5, display: 'block', color: 'rgba(255,255,255,0.8)', maxHeight: 100, overflowY: 'auto' }}>{c.benefits}</span> : NL
  },
  {
    kind: 'data', label: 'Side Effects Noted',
    getValue: c => c.side_effects,
    render: c => c.side_effects ? <span style={{ fontSize: '0.8rem', lineHeight: 1.5, display: 'block', color: 'rgba(252,129,129,0.9)', maxHeight: 80, overflowY: 'auto' }}>{c.side_effects}</span> : NL
  },
  {
    kind: 'data', label: 'Warnings',
    getValue: c => c.warnings,
    render: c => c.warnings ? <span style={{ fontSize: '0.8rem', lineHeight: 1.5, display: 'block', color: 'rgba(246,173,85,0.9)' }}><AlertTriangle size={11} style={{ marginRight: 4, display: 'inline-block', verticalAlign: 'middle' }} />{c.warnings}</span> : NL
  },

  { kind: 'group', label: 'Handling & Storage' },
  { kind: 'data', label: 'Form', getValue: c => c.handling?.form, render: c => txt(c.handling?.form) },
  { kind: 'data', label: 'Diluent', glossaryTerm: 'reconstitution', getValue: c => c.handling?.diluent, render: c => txt(c.handling?.diluent) },
  { kind: 'data', label: 'Storage Temp', getValue: c => c.handling?.storage_temp, render: c => txt(c.handling?.storage_temp) },
  { kind: 'data', label: 'Light Sensitive', getValue: c => c.handling?.light_sensitive, render: c => c.handling?.light_sensitive == null ? NL : c.handling.light_sensitive ? <span style={{ color: '#F6AD55', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={12} /> Yes</span> : <span style={{ color: '#68D391', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Check size={12} /> No</span> },
  { kind: 'data', label: 'Freeze / Thaw', getValue: c => c.handling?.freeze_thaw, render: c => txt(c.handling?.freeze_thaw) },
  { kind: 'data', label: 'Handling Notes', getValue: c => c.handling?.notes, render: c => txt(c.handling?.notes) },
  {
    kind: 'data', label: 'Reconstituted Shelf Life',
    bestLogic: 'max', getRawScore: c => c.reconstitution_shelf_days ?? c.handling?.reconstituted_days ?? 0,
    getValue: c => c.reconstitution_shelf_days ?? c.handling?.reconstituted_days,
    render: c => {
      const d = c.reconstitution_shelf_days ?? c.handling?.reconstituted_days;
      if (d == null) return NL;
      const color = d >= 28 ? '#68D391' : d < 14 ? '#FC8181' : '#F6AD55';
      return <span style={{ color, fontWeight: 700 }}>{d} Days <span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.4)' }}>Refrigerated</span></span>;
    },
  },
];

// ─── ROW EXPLANATIONS (Feature 9 — Explain This) ────────────────────────────
const ROW_EXPLANATIONS: Record<string, string> = {
  'Research Summary': 'A plain-language overview of what this compound is primarily studied for in scientific research.',
  'Studied For': 'The specific research applications or goals this compound has been actively investigated for in scientific literature.',
  'Research Areas': 'The broader scientific and therapeutic categories this compound has been studied within. More areas = more versatile research utility.',
  'Best Stacked With': 'Compounds that research protocols commonly combine with this one, typically for complementary mechanisms or additive outcomes.',
  'Category': 'The primary classification of this compound based on its structural or functional characteristics.',
  'Compound Class': 'The molecular or pharmacological family this compound belongs to (e.g., peptide, small molecule, SARM).',
  'Molecular Target': 'The specific biological receptor, enzyme, or pathway this compound acts upon at the molecular level.',
  'Aliases / AKA': 'Alternative names, research codes, or abbreviations used for this compound in scientific literature.',
  'Parent Compound': 'The original compound this one is derived from or structurally related to.',
  'Molecular Weight': 'The mass of a single molecule in Daltons (Da). Compounds under ~500 Da generally have better bioavailability; larger peptides typically require injection.',
  'Amino Acid Sequence': 'The linear chain of amino acids constituting this peptide, determining its 3D structure and binding specificity.',
  'CAS Number': 'The unique Chemical Abstracts Service registry number — a universal identifier across all scientific databases.',
  'Year Discovered': 'When this compound was first synthesized or described in the scientific literature.',
  'Pro-Angiogenic': 'Whether research indicates this compound promotes new blood vessel formation. A consideration when combining multiple compounds in research stacks.',
  'GLP-1 Class': 'Whether this compound is a glucagon-like peptide-1 receptor agonist, modulating insulin/glucagon release, gastric emptying, and appetite.',
  'Purity': 'The confirmed percentage of active compound in the preparation, validated by Certificate of Analysis (CoA). ≥99% is pharmaceutical-grade.',
  'Evidence Tier': 'The regulatory and clinical development status — from FDA-Approved (highest, extensive human data) to Research Chemicals (earliest stage, minimal human data).',
  'Risk Level': 'Safety classification based on documented adverse events in available literature. Low = minimal reported issues; Critical = significant concerns.',
  'PubMed Citations': 'Number of peer-reviewed papers indexed in PubMed. Higher counts = more thoroughly studied and validated compound.',
  'Clinical Trials': 'Registered human studies on ClinicalTrials.gov. Active = currently enrolling; Completed = finished, results may be published.',
  'Regulatory Status': 'The current regulatory classification in major pharmaceutical markets (FDA, EMA, etc.).',
  'WADA Status': 'Whether this compound appears on the World Anti-Doping Agency prohibited list — tested athletes may not use prohibited compounds.',
  'Half-Life': 'How long the compound remains at 50% peak concentration after administration. Longer = less frequent dosing; Shorter = more frequent or pulse-based protocols.',
  'Typical Frequency': 'The administration interval most commonly reported in research protocols based on pharmacokinetic profile.',
  'Mechanism / PK': 'How this compound acts on biological targets (mechanism) and how the body processes it over time (absorption, distribution, metabolism, excretion).',
  'Reported Findings': 'Key outcomes observed in available research literature — documented scientific observations, not medical claims.',
  'Side Effects Noted': 'Adverse effects or tolerability concerns reported in scientific literature from research contexts.',
  'Warnings': 'Specific safety flags or handling precautions noted in research literature.',
  'Form': 'Physical state as supplied — typically lyophilized (freeze-dried) powder for injectable peptides.',
  'Diluent': 'Recommended solution for reconstituting this compound. Correct diluent preserves stability and potency.',
  'Storage Temp': 'Recommended temperature for maintaining full potency and preventing degradation over time.',
  'Light Sensitive': 'Whether this compound degrades on exposure to UV/visible light — store in amber vials or dark conditions if yes.',
  'Freeze / Thaw': 'Freeze-thaw cycle tolerance — critical for planning long-term storage and multi-use vial management.',
  'Handling Notes': 'Additional preparation, storage, or usage recommendations specific to this compound.',
  'Reconstituted Shelf Life': 'Days the compound remains stable after mixing with diluent. Shorter shelf life requires more frequent preparation batches.',
};

// ─── Focus Row Modal (Features 3 + 9: Focus Mode + Explain This) ──────────────
function FocusRowModal({ row, selected, maxHalfLife, controlCompound, topPickSlug, onClose }: {
  row: Row;
  selected: Compound[];
  maxHalfLife: number;
  controlCompound: Compound | undefined;
  topPickSlug: string | null;
  onClose: () => void;
}) {
  if (row.kind !== 'data') return null;
  const explanation = ROW_EXPLANATIONS[row.label];
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#0F1E2D', width: '100%', maxWidth: 520, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: '24px 24px 44px', boxShadow: '0 -16px 60px rgba(0,0,0,0.7)', animation: 'slideUp 0.3s ease-out', maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, color: '#fff' }}>{row.label}</h3>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#A8B4C0', cursor: 'pointer', borderRadius: 8, padding: 6, display: 'flex' }}><X size={20} /></button>
        </div>
        {row.glossaryTerm && <div style={{ fontSize: '0.65rem', color: 'rgba(0,196,188,0.7)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Glossary: {row.glossaryTerm}</div>}
        {explanation && (
          <div style={{ background: 'rgba(0,196,188,0.06)', border: '1px solid rgba(0,196,188,0.18)', borderRadius: 10, padding: '10px 14px', marginBottom: 20, fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.65, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <Info size={13} style={{ color: '#00C4BC', flexShrink: 0, marginTop: 2 }} />
            <span>{explanation}</span>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {selected.map((c, i) => {
            const color = colors[i % colors.length];
            const isTop = c.slug === topPickSlug;
            return (
              <div key={c.slug} style={{ padding: '14px 16px', background: isTop ? 'rgba(0,196,188,0.06)' : 'rgba(255,255,255,0.03)', border: `1px solid ${isTop ? 'rgba(0,196,188,0.28)' : color + '22'}`, borderRadius: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <span style={{ color, fontWeight: 900, fontSize: '0.88rem' }}>{c.display_name}</span>
                  {isTop && <Trophy size={11} color="#00C4BC" style={{ marginLeft: 2 }} />}
                </div>
                <div style={{ fontSize: '0.95rem', color: '#fff', lineHeight: 1.55 }}>{row.render(c, maxHalfLife)}</div>
                {controlCompound && controlCompound.slug !== c.slug && (
                  <div style={{ marginTop: 6 }}>{renderRelativeDelta(row.label, c, controlCompound)}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Animated Score Ring ──────────────────────────────────────────────────────
function AnimatedScoreRing({ score, color }: { score: CompoundScore; color: string }) {
  const [displayPct, setDisplayPct] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const target = score.total;
    const duration = 1000;
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

  const r = 36;
  const circ = 2 * Math.PI * r;
  const pct = (displayPct / 100) * circ;
  const gradeColor =
    score.letter.startsWith('A') ? '#68D391' :
    score.letter.startsWith('B') ? '#00C4BC' :
    score.letter.startsWith('C') ? '#F6AD55' : '#FC8181';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
      {/* SVG ring */}
      <div style={{ position: 'relative', width: 84, height: 84, flexShrink: 0 }}>
        <svg width="84" height="84" viewBox="0 0 84 84">
          <circle cx="42" cy="42" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
          <circle
            cx="42" cy="42" r={r}
            fill="none"
            stroke={gradeColor}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={`${pct} ${circ}`}
            strokeDashoffset={circ / 4}
            style={{ transition: 'stroke-dasharray 0.1s linear' }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '1.1rem', fontWeight: 900, color: gradeColor, lineHeight: 1 }}>{displayPct}</span>
          <span style={{ fontSize: '0.55rem', color: gradeColor, opacity: 0.7 }}>/100</span>
        </div>
      </div>
      {/* Right column */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: '1rem', fontWeight: 900, color: gradeColor, letterSpacing: '-0.02em' }}>Grade {score.letter}</span>
        </div>
        <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>{score.verdict}</div>
        {/* Mini breakdown bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {[
            { label: 'Evidence',    val: score.breakdown.evidence,     max: 28 },
            { label: 'Safety',      val: score.breakdown.safety,       max: 24 },
            { label: 'Science',     val: score.breakdown.science,      max: 14 },
            { label: 'Coverage',    val: score.breakdown.coverage,     max: 16 },
            { label: 'Handling',    val: score.breakdown.handling,     max: 10 },
            { label: 'Depth',       val: score.breakdown.completeness, max: 8  },
          ].map(d => (
            <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.35)', minWidth: 50 }}>{d.label}</span>
              <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(d.val / d.max) * 100}%`, background: color, borderRadius: 999, transition: 'width 0.8s ease' }} />
              </div>
              <span style={{ fontSize: '0.58rem', color, minWidth: 16, textAlign: 'right', fontWeight: 700 }}>{d.val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Pros/Cons Card ───────────────────────────────────────────────────────────
function ProsConsCard({ pc }: { pc: ProsCons }) {
  const [expanded, setExpanded] = useState(false);
  const MAX_SHOWN = 4;
  const allItems = [...pc.pros.map(p => ({ ...p, isPro: true })), ...pc.cons.map(c => ({ ...c, isPro: false }))];
  const sorted = allItems.sort((a, b) => {
    const sev = (s: PCSeverity) => s === 'high' ? 3 : s === 'medium' ? 2 : 1;
    return sev(b.severity) - sev(a.severity);
  });
  const shown = expanded ? sorted : sorted.slice(0, MAX_SHOWN);

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {shown.map((item, i) => (
          <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
            <div style={{ flexShrink: 0, marginTop: 2 }}>
              {item.isPro ? <ThumbsUp size={12} color="#68D391" /> : <ThumbsDown size={12} color="#FC8181" />}
            </div>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: '0.79rem', color: item.isPro ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.65)', lineHeight: 1.4 }}>{item.text}</span>
              <span style={{ marginLeft: 4, fontSize: '0.58rem', opacity: 0.4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{item.category}</span>
            </div>
          </div>
        ))}
      </div>
      {sorted.length > MAX_SHOWN && (
        <button type="button" onClick={() => setExpanded(e => !e)} style={{ marginTop: 8, background: 'none', border: 'none', color: 'rgba(0,196,188,0.8)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', padding: 0 }}>
          {expanded ? '▲ Show Less' : `▼ Show ${sorted.length - MAX_SHOWN} More`}
        </button>
      )}
    </div>
  );
}

// ─── Efficacy Scores Heatmap ──────────────────────────────────────────────────
function EfficacyHeatmap({ selected }: { selected: Compound[] }) {
  const allKeys = [...new Set(selected.flatMap(c => Object.keys(c.efficacy_scores ?? {})))];
  if (!allKeys.length) return null;

  const getColor = (v: number) => {
    if (v >= 80) return '#68D391';
    if (v >= 60) return '#00C4BC';
    if (v >= 40) return '#F6AD55';
    return '#FC8181';
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '6px 10px', color: 'rgba(255,255,255,0.4)', fontWeight: 700, fontSize: '0.7rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Domain</th>
            {selected.map((c, i) => <th key={c.slug} style={{ textAlign: 'center', padding: '6px 10px', color: colors[i % colors.length], fontWeight: 700, fontSize: '0.7rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>{c.display_name}</th>)}
          </tr>
        </thead>
        <tbody>
          {allKeys.map(key => (
            <tr key={key} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <td style={{ padding: '5px 10px', color: 'rgba(255,255,255,0.6)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</td>
              {selected.map((c) => {
                const v = (c.efficacy_scores ?? {})[key];
                const color = v != null ? getColor(v) : 'transparent';
                return (
                  <td key={c.slug} style={{ textAlign: 'center', padding: '5px 10px' }}>
                    {v != null ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        <span style={{ fontWeight: 800, fontSize: '0.82rem', color }}>{v}</span>
                        <div style={{ width: 28, height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 999, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${v}%`, background: color, borderRadius: 999 }} />
                        </div>
                      </div>
                    ) : <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.7rem' }}>—</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Recommendation Card ──────────────────────────────────────────────────────
function RecommendationCard({ rec, label, icon, color }: { rec: { compound: Compound; score: CompoundScore; reason: string; secondaryLabel: string }; label: string; icon: React.ReactNode; color: string }) {
  return (
    <div style={{ padding: '12px 14px', borderRadius: 10, background: `${color}08`, border: `1px solid ${color}25`, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ color, display: 'flex' }}>{icon}</div>
        <span style={{ fontSize: '0.67rem', fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
        <span style={{ marginLeft: 'auto', fontSize: '0.65rem', background: `${color}20`, color, padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>{rec.secondaryLabel}</span>
      </div>
      <div style={{ fontWeight: 900, fontSize: '1rem', color: 'var(--white)', lineHeight: 1.2 }}>
        <Link href={`/research/${rec.compound.slug}`} style={{ color: color, textDecoration: 'none' }}>{rec.compound.display_name}</Link>
      </div>
      <div style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.4 }}>{rec.reason}</div>
      {rec.score.recommendedContexts.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 2 }}>
          {rec.score.recommendedContexts.slice(0, 2).map((ctx, i) => (
            <span key={i} style={{ fontSize: '0.62rem', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.45)', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>{ctx}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Mechanism Tab ────────────────────────────────────────────────────────────
function MechanismTab({ selected }: { selected: Compound[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(260px, 1fr))`, gap: 14 }}>
        {selected.map((c, i) => {
          const color = colors[i % colors.length];
          return (
            <div key={c.slug} style={{ padding: 16, borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: `1px solid rgba(255,255,255,0.08)` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <span style={{ fontWeight: 900, fontSize: '0.95rem', color: 'var(--white)' }}>{c.display_name}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {c.compound_class && (
                  <div>
                    <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Compound Class</div>
                    <div style={{ fontSize: '0.82rem', color }}>{c.compound_class}</div>
                  </div>
                )}
                {c.molecular_target && (
                  <div>
                    <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Molecular Target</div>
                    <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.4 }}>{c.molecular_target}</div>
                  </div>
                )}
                {c.mechanism && (
                  <div>
                    <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Mechanism of Action</div>
                    <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.55 }}>{c.mechanism}</div>
                  </div>
                )}
                {c.pk_summary && (
                  <div>
                    <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Pharmacokinetics</div>
                    <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.55 }}>{c.pk_summary}</div>
                  </div>
                )}
                {c.risk_reasons?.length ? (
                  <div>
                    <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Risk Considerations</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {c.risk_reasons.map((r, ri) => (
                        <div key={ri} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                          <AlertTriangle size={11} color={RISK_META[c.risk_level]?.color ?? '#F6AD55'} style={{ marginTop: 2, flexShrink: 0 }} />
                          <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.4 }}>{r}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {c.sources?.length ? (
                  <div>
                    <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Key Sources</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {c.sources.slice(0, 4).map((src, si) => (
                        <a key={si} href={src.startsWith('http') ? src : undefined} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: '0.72rem', color: color, opacity: 0.8, wordBreak: 'break-all', lineHeight: 1.3, textDecoration: src.startsWith('http') ? 'underline' : 'none' }}>
                          {src.startsWith('http') ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><BookOpen size={11} /> Source {si + 1}</span> : src}
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}
                {/* Stack rationale if stack compound */}
                {c.is_stack && c.stack_rationale && (
                  <div>
                    <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Stack Rationale</div>
                    <div style={{ fontSize: '0.82rem', color: '#9F7AEA', lineHeight: 1.55, fontStyle: 'italic' }}>{c.stack_rationale}</div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {/* Efficacy Scores section */}
      {selected.some(c => c.efficacy_scores && Object.keys(c.efficacy_scores).length > 0) && (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--white)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <BarChart3 size={15} color="#00C4BC" /> Efficacy Score Comparison
            <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', marginLeft: 6, fontWeight: 400 }}>(0–100 per application domain, sourced from compound metadata)</span>
          </div>
          <EfficacyHeatmap selected={selected} />
        </div>
      )}
    </div>
  );
}

// ─── Protocol Tab ─────────────────────────────────────────────────────────────
function ProtocolTab({ selected }: { selected: Compound[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(260px, 1fr))`, gap: 14 }}>
        {selected.map((c, i) => {
          const color = colors[i % colors.length];
          const shelf = c.reconstitution_shelf_days ?? c.handling?.reconstituted_days;
          const hlH = parseHalfLifeHours(c.half_life);
          const dosesPerWeek = hlH > 0 ? Math.max(1, Math.round(168 / (hlH * 2))) : null;
          return (
            <div key={c.slug} style={{ padding: 16, borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: `1px solid rgba(255,255,255,0.08)` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <span style={{ fontWeight: 900, fontSize: '0.95rem', color: 'var(--white)' }}>{c.display_name}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Reconstitution info */}
                <div style={{ background: `${color}08`, borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: '0.65rem', color, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Reconstitution</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: '0.78rem' }}>
                    <div style={{ color: 'rgba(255,255,255,0.4)' }}>Form</div>
                    <div style={{ color: 'rgba(255,255,255,0.8)' }}>{c.handling?.form ?? NL}</div>
                    <div style={{ color: 'rgba(255,255,255,0.4)' }}>Diluent</div>
                    <div style={{ color: 'rgba(255,255,255,0.8)' }}>{c.handling?.diluent ?? NL}</div>
                    <div style={{ color: 'rgba(255,255,255,0.4)' }}>Storage</div>
                    <div style={{ color: 'rgba(255,255,255,0.8)' }}>{c.handling?.storage_temp ?? NL}</div>
                    <div style={{ color: 'rgba(255,255,255,0.4)' }}>Light</div>
                    <div style={{ color: 'rgba(255,255,255,0.8)' }}>{c.handling?.light_sensitive == null ? NL : c.handling.light_sensitive ? <span style={{ color: '#F6AD55', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={11} /> Sensitive</span> : <span style={{ color: '#68D391', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Check size={11} /> Safe</span>}</div>
                    {shelf && <>
                      <div style={{ color: 'rgba(255,255,255,0.4)' }}>Shelf Life</div>
                      <div style={{ color: shelf >= 28 ? '#68D391' : shelf < 14 ? '#FC8181' : '#F6AD55', fontWeight: 700 }}>{shelf} days</div>
                    </>}
                  </div>
                </div>
                {/* Dosing guidance */}
                {(c.half_life || c.typical_frequency) && (
                  <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '10px 12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Administration</div>
                    {c.half_life && <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}><Clock size={10} style={{ marginRight: 4, display: 'inline-block', verticalAlign: 'middle' }} />Half-life: <strong style={{ color }}>{c.half_life}</strong></div>}
                    {c.typical_frequency && <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}><Zap size={10} style={{ marginRight: 4, display: 'inline-block', verticalAlign: 'middle' }} />Typical frequency: <strong style={{ color: 'rgba(255,255,255,0.9)' }}>{c.typical_frequency}</strong></div>}
                    {dosesPerWeek && <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', marginTop: 4, fontStyle: 'italic' }}>Estimated ~{dosesPerWeek}× per week based on half-life</div>}
                  </div>
                )}
                {/* Freeze-thaw */}
                {c.handling?.freeze_thaw && (
                  <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                    <Thermometer size={12} color="#F6AD55" style={{ marginTop: 1, flexShrink: 0 }} />
                    <span>{c.handling.freeze_thaw}</span>
                  </div>
                )}
                {/* Handling notes */}
                {c.handling?.notes && (
                  <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.4, borderLeft: '2px solid rgba(255,255,255,0.1)', paddingLeft: 8 }}>
                    {c.handling.notes}
                  </div>
                )}
                {/* COA Link */}
                {c.coa_url && (
                  <a href={c.coa_url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', color, textDecoration: 'none', fontWeight: 700 }}>
                    <BookOpen size={12} /> View Certificate of Analysis
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const TruncatedCell = ({ children }: { children: React.ReactNode }) => {
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    if (containerRef.current) {
      setIsTruncated(containerRef.current.scrollHeight > containerRef.current.clientHeight);
    }
  }, [children]);

  return (
    <div>
      <div ref={containerRef} style={expanded ? {} : { display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {children}
      </div>
      {isTruncated && !expanded && (
        <button type="button" onClick={() => setExpanded(true)} style={{ color: '#00C4BC', background: 'transparent', border: 'none', padding: 0, fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', marginTop: 4 }}>Read More</button>
      )}
      {expanded && (
        <button type="button" onClick={() => setExpanded(false)} style={{ color: 'rgba(255,255,255,0.4)', background: 'transparent', border: 'none', padding: 0, fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', marginTop: 4 }}>Show Less</button>
      )}
    </div>
  );
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function CompareTool({ compounds, initialSlugs = [] }: { compounds: Compound[]; initialSlugs?: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [selectedSlugs, setSelectedSlugs] = useState<string[]>(() => {
    let slugs = initialSlugs;
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      const urlCompare = sp.get('compare');
      if (urlCompare) slugs = urlCompare.split(',').filter(Boolean);
    }
    return slugs.filter(s => compounds.some(c => c.slug === s)).slice(0, MAX_COLUMNS);
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [diffMode, setDiffMode] = useState(false);
  const [hideIdentical, setHideIdentical] = useState(false);
  const [controlSlug, setControlSlug] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'matrix' | 'proscons' | 'brief' | 'mechanism' | 'protocol' | 'recommend'>('matrix');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [isMobile, setIsMobile] = useState(false);
  const [mobileViewMode, setMobileViewMode] = useState<'matrix' | 'accordion'>('matrix');
  const [showLandscapePrompt, setShowLandscapePrompt] = useState(true);
  const [reorderModalOpen, setReorderModalOpen] = useState(false);
  const [jumpMenuOpen, setJumpMenuOpen] = useState(false);
  // ─── New Feature State ──────────────────────────────────────────────────
  const [swipeIndex, setSwipeIndex] = useState(0);          // Feature 1: Swipe
  const [swipeMode, setSwipeMode] = useState(true);         // Feature 1: default on
  const [showWinnersOnly, setShowWinnersOnly] = useState(false); // Feature 2
  const [focusRow, setFocusRow] = useState<Row | null>(null); // Features 3+9
  const [cellColorCode, setCellColorCode] = useState(false); // Feature 4
  const [compareHistory, setCompareHistory] = useState<string[][]>([]); // Feature 7
  const [tableZoom, setTableZoom] = useState(1);             // Feature 10
  const [voiceActive, setVoiceActive] = useState(false);    // Feature 12
  const touchStartX = useRef(0);                            // Feature 1: touch tracking
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (window.innerWidth < 768) {
      setCollapsedGroups(new Set(['Evidence & Regulatory', 'Pharmacology', 'Handling & Storage']));
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    if (selectedSlugs.length > 0) { params.set('compare', selectedSlugs.join(',')); params.delete('add'); }
    else { params.delete('compare'); params.delete('add'); }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [selectedSlugs, pathname, searchParams, router]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setIsSearchOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Feature 7: Load compare history from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('pnl_compare_history');
      if (stored) setCompareHistory(JSON.parse(stored));
    } catch {}
  }, []);

  // Feature 7: Save compare history when selection changes (2+ compounds)
  useEffect(() => {
    if (selectedSlugs.length < 2) return;
    setCompareHistory(prev => {
      const key = selectedSlugs.join(',');
      const filtered = prev.filter(h => h.join(',') !== key);
      const newHistory = [selectedSlugs, ...filtered].slice(0, 5);
      try { localStorage.setItem('pnl_compare_history', JSON.stringify(newHistory)); } catch {}
      return newHistory;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSlugs.join(',')]);

  // Feature 11: Haptic feedback utility
  function haptic(ms: number | number[] = 40) {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(ms);
  }

  // Feature 12: Voice search
  function startVoiceSearch() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    haptic(30);
    const rec = new SR();
    rec.lang = 'en-US'; rec.interimResults = false; rec.maxAlternatives = 1;
    setVoiceActive(true);
    rec.onresult = (e: any) => { setSearchQuery(e.results[0][0].transcript); setIsSearchOpen(true); setVoiceActive(false); };
    rec.onerror = () => setVoiceActive(false);
    rec.onend = () => setVoiceActive(false);
    rec.start();
  }

  // Feature 8: Share card — canvas-drawn PNG download / Web Share
  async function handleShareCard() {
    if (!selected.length) return;
    haptic(60);
    const W = 600, H = 130 + selected.length * 80;
    const canvas = document.createElement('canvas');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr; canvas.height = H * dpr;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.scale(dpr, dpr);
    // Background
    ctx.fillStyle = '#0D1B2A';
    if ((ctx as any).roundRect) { (ctx as any).roundRect(0, 0, W, H, 16); ctx.fill(); } else { ctx.fillRect(0, 0, W, H); }
    // Header line
    ctx.fillStyle = '#00C4BC'; ctx.font = 'bold 13px system-ui,sans-serif'; ctx.fillText('PEP NATION LAB', 24, 32);
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = 'bold 20px system-ui,sans-serif'; ctx.fillText('Compound Comparison', 24, 58);
    ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(24, 68); ctx.lineTo(W - 24, 68); ctx.stroke();
    const cColors = ['#00C4BC', '#FF6B6B', '#FCA311', '#9F7AEA'];
    selected.forEach((c, i) => {
      const y = 80 + i * 80; const sc = scores[i]; const col = cColors[i % cColors.length]; const isTop = c.slug === topPickSlug;
      ctx.fillStyle = col + '1A';
      if ((ctx as any).roundRect) { (ctx as any).roundRect(20, y, W - 40, 66, 10); ctx.fill(); } else { ctx.fillRect(20, y, W - 40, 66); }
      ctx.fillStyle = col; ctx.font = 'bold 16px system-ui,sans-serif'; ctx.textAlign = 'left'; ctx.fillText(c.display_name.slice(0, 30), 36, y + 26);
      if (isTop) { ctx.fillStyle = '#00C4BC'; ctx.font = '11px system-ui,sans-serif'; ctx.fillText('\u2605 TOP PICK', 36, y + 46); }
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = 'bold 28px system-ui,sans-serif'; ctx.textAlign = 'right'; ctx.fillText(`${sc.total}`, W - 60, y + 32);
      ctx.font = 'bold 13px system-ui,sans-serif'; ctx.fillStyle = col; ctx.fillText(`Grade ${sc.letter}`, W - 60, y + 52); ctx.textAlign = 'left';
    });
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.font = '10px system-ui,sans-serif'; ctx.fillText('pepnationlab.com/research/compare', 24, H - 16);
    canvas.toBlob(blob => {
      if (!blob) return;
      const file = new File([blob], 'pepnationlab_compare.png', { type: 'image/png' });
      if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
        navigator.share({ title: 'PepNationLab Compare', files: [file] });
      } else {
        const url = URL.createObjectURL(blob); const a = document.createElement('a');
        a.href = url; a.download = 'pepnationlab_compare.png';
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      }
    });
  }

  const bySlug = useMemo(() => new Map(compounds.map(c => [c.slug, c])), [compounds]);
  const selected = useMemo(() => selectedSlugs.map(s => bySlug.get(s)).filter((c): c is Compound => Boolean(c)), [selectedSlugs, bySlug]);

  const displayedSelected = selected;
  const maxHalfLife = useMemo(() => Math.max(...displayedSelected.map(c => parseHalfLifeHours(c.half_life)), 0), [displayedSelected]);
  const scores = useMemo(() => selected.map(c => scoreCompound(c, selected)), [selected]);
  const prosCons = useMemo(() => selected.map(c => generateProsCons(c)), [selected]);
  const analystBrief = useMemo(() => generateAnalystBrief(selected, scores), [selected, scores]);
  const recommendations = useMemo(() => generateRecommendations(selected, scores), [selected, scores]);
  const topPickSlug = useMemo(() => selected.length < 2 ? null : [...selected].map((c, i) => ({ c, s: scores[i] })).sort((a, b) => b.s.total - a.s.total)[0]?.c.slug ?? null, [selected, scores]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const lower = searchQuery.toLowerCase();
    return compounds.filter(c =>
      !selectedSlugs.includes(c.slug) &&
      (c.display_name.toLowerCase().includes(lower) || (c.category ?? '').toLowerCase().includes(lower) || c.slug.includes(lower) || (c.aliases ?? []).some(a => a.toLowerCase().includes(lower)))
    ).slice(0, 12);
  }, [compounds, searchQuery, selectedSlugs]);

  const addCompound = useCallback((slug: string) => {
    if (!slug) return;
    haptic(40); // Feature 11
    setSelectedSlugs(prev => prev.includes(slug) || prev.length >= MAX_COLUMNS ? prev : [...prev, slug]);
    setSearchQuery('');
    setIsSearchOpen(false);
  }, []);

  const removeCompound = useCallback((slug: string) => { haptic([20, 10, 20]); setSelectedSlugs(prev => prev.filter(s => s !== slug)); }, []); // Feature 11
  const toggleGroup = useCallback((label: string) => setCollapsedGroups(prev => { const n = new Set(prev); if (n.has(label)) { n.delete(label); } else { n.add(label); } return n; }), []);

  function handleShare() {
    if (typeof window === 'undefined') return;
    navigator.clipboard.writeText(window.location.href).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  function handleExportCSV() {
    if (!selected.length) return;
    let csv = 'Attribute,' + selected.map(c => `"${c.display_name}"`).join(',') + '\n';
    for (const row of ROWS) {
      if (row.kind === 'group') { csv += `"${row.label}"\n`; continue; }
      csv += `"${row.label}",` + selected.map(c => `"${String(row.getValue(c)).replace(/"/g, '""')}"`).join(',') + '\n';
    }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `pepnationlab_compare_${selectedSlugs.join('_')}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleExportJSON() {
    if (!selected.length) return;
    const data = selected.map((c, i) => ({
      compound: c.display_name,
      slug: c.slug,
      score: scores[i],
      prosCons: prosCons[i],
      attributes: Object.fromEntries(ROWS.filter(r => r.kind === 'data').map(r => r.kind === 'data' ? [r.label, String(r.getValue(c))] : ['', ''])),
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `pepnationlab_compare_${selectedSlugs.join('_')}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const canAdd = selected.length < MAX_COLUMNS;
  const colSpan = displayedSelected.length + 1;

  const radarData: RadarDataPoint[] = useMemo(() => {
    if (selected.length < 2) return [];
    const maxCites = Math.max(...selected.map(c => c.pubmed_citation_count ?? 0), 1);
    const maxHl = Math.max(...selected.map(c => parseHalfLifeHours(c.half_life)), 1);
    const maxTrials = Math.max(...selected.map(c => (c.active_trial_count ?? 0) + (c.completed_trial_count ?? 0)), 1);
    return [
      { label: 'Evidence', scores: selected.map(c => c.evidence_tier === 'approved_drug' ? 100 : c.evidence_tier === 'investigational' ? 78 : c.evidence_tier === 'preclinical' ? 55 : 30) },
      { label: 'Safety', scores: selected.map(c => c.risk_level === 'low' ? 100 : c.risk_level === 'moderate' ? 72 : c.risk_level === 'high' ? 38 : 10) },
      { label: 'Citations', scores: selected.map(c => Math.min(100, Math.max(5, ((c.pubmed_citation_count ?? 0) / maxCites) * 100))) },
      { label: 'Trials', scores: selected.map(c => Math.min(100, Math.max(5, (((c.active_trial_count ?? 0) + (c.completed_trial_count ?? 0)) / maxTrials) * 100))) },
      { label: 'Half-Life', scores: selected.map(c => Math.min(100, Math.max(5, (parseHalfLifeHours(c.half_life) / maxHl) * 100))) },
      { label: 'Coverage', scores: selected.map(c => Math.min(100, Math.max(5, ((c.research_areas ?? []).length / 8) * 100))) },
      { label: 'Handling', scores: selected.map(c => { const s = c.reconstitution_shelf_days ?? c.handling?.reconstituted_days ?? 0; return Math.min(100, Math.max(5, (s / 60) * 100)); }) },
    ];
  }, [selected]);

  const activeSynergies = KNOWN_SYNERGIES.filter(syn => syn.pairs.every(slug => selectedSlugs.includes(slug)));

  // Dynamic compound-class based warnings
  const dynamicAlerts = useMemo(() => {
    const alerts: { type: 'caution' | 'conflict'; message: string; category: string }[] = [];
    const proAngio = selected.filter(c => c.is_pro_angiogenic);
    if (proAngio.length >= 2) {
      alerts.push({ type: 'caution', category: 'Safety', message: `Multiple pro-angiogenic compounds selected (${proAngio.map(c => c.display_name).join(', ')}). Research literature notes theoretical considerations around stacking compounds that promote new vessel growth.` });
    }
    const glp1 = selected.filter(c => c.is_glp1);
    if (glp1.length >= 2) {
      alerts.push({ type: 'conflict', category: 'Safety', message: `Multiple GLP-1/incretin agents selected (${glp1.map(c => c.display_name).join(', ')}). Stacking incretin-class compounds compounds gastrointestinal adverse effects with unclear additive benefit.` });
    }
    return alerts;
  }, [selected]);

  const tabs = [
    { id: 'matrix' as const, label: 'Matrix', showAlways: false },
    { id: 'proscons' as const, label: 'Pros & Cons', showAlways: false },
    { id: 'brief' as const, label: 'Analyst Brief', showAlways: false },
    { id: 'mechanism' as const, label: 'Mechanism', showAlways: false },
    { id: 'protocol' as const, label: 'Protocol', showAlways: false },
    { id: 'recommend' as const, label: 'Verdict', showAlways: false },
  ];

  return (
    <div>
      {/* Search bar */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print { body { background: #fff !important; color: #000 !important; } .no-print { display: none !important; } td, th { color: #000 !important; background: #fff !important; border-bottom: 1px solid #ddd !important; } }
        .ct-tab { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.45); border-radius: 8px; padding: 8px 14px; font-size: 0.8rem; font-weight: 700; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
        .hide-scroll::-webkit-scrollbar { display: none; }
        .ct-tab:hover { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.85); }
        .ct-tab.active { background: rgba(0,196,188,0.15); border-color: rgba(0,196,188,0.5); color: #00C4BC; }
        .ct-row-hover:hover td { background: rgba(255,255,255,0.015) !important; }
        .popular-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 12px 14px; cursor: pointer; transition: all 0.2s; display: flex; flex-direction: column; gap: 4; }
        .popular-card:hover { background: rgba(0,196,188,0.08); border-color: rgba(0,196,188,0.3); transform: translateY(-1px); }
        @keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes fadeInDown { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes pulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.6; transform:scale(1.15); } }
      `}} />
      <div className="no-print" style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', marginBottom: 24, position: 'relative', zIndex: 50 }} ref={searchRef}>
        <div style={{ position: 'relative', flex: 1, minWidth: 240, maxWidth: 520 }}>
          <Search style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(168,180,192,0.6)' }} size={17} />
          <input
            type="text"
            placeholder={canAdd ? 'Search compounds to add...' : `Maximum ${MAX_COLUMNS} selected`}
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setIsSearchOpen(true); }}
            onFocus={() => setIsSearchOpen(true)}
            disabled={!canAdd}
            style={{ width: '100%', background: '#162230', color: '#fff', border: '1px solid rgba(168,180,192,0.2)', borderRadius: 8, padding: '12px 44px 12px 42px', fontSize: '0.95rem', outline: 'none', opacity: canAdd ? 1 : 0.5 }}
          />
          {/* Feature 12: Voice search mic button */}
          <button
            type="button"
            onClick={startVoiceSearch}
            title="Voice search"
            aria-label="Voice search"
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: voiceActive ? '#00C4BC' : 'transparent', border: 'none', color: voiceActive ? '#04221F' : 'rgba(168,180,192,0.45)', cursor: 'pointer', display: 'flex', padding: 5, borderRadius: 6, transition: 'all 0.2s' }}
          >
            <Mic size={16} style={{ animation: voiceActive ? 'pulse 0.7s ease-in-out infinite' : 'none' }} />
          </button>
          {isSearchOpen && searchQuery.trim() && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 6, background: '#162230', border: '1px solid rgba(168,180,192,0.2)', borderRadius: 8, overflow: 'hidden', boxShadow: '0 12px 30px rgba(0,0,0,0.6)', zIndex: 100 }}>
              {searchResults.length ? (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: 320, overflowY: 'auto' }}>
                  {searchResults.map(c => {
                    const tier = evidenceTier(c.evidence_tier);
                    return (
                      <li key={c.slug}>
                        <button type="button" onClick={() => addCompound(c.slug)}
                          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '11px 16px', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(168,180,192,0.08)', color: '#fff', textAlign: 'left', cursor: 'pointer' }}
                          onMouseOver={e => e.currentTarget.style.background = 'rgba(0,196,188,0.08)'}
                          onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{c.display_name}</div>
                            <div style={{ fontSize: '0.72rem', color: 'rgba(168,180,192,0.7)', marginTop: 1 }}>{c.category} · {c.compound_class}</div>
                          </div>
                          <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: 999, background: `${tier.color}20`, color: tier.color, fontWeight: 700, flexShrink: 0 }}>{tier.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div style={{ padding: 16, textAlign: 'center', color: 'rgba(168,180,192,0.6)', fontSize: '0.88rem' }}>No compounds match &quot;{searchQuery}&quot;</div>
              )}
            </div>
          )}
        </div>
        <span style={{ color: 'rgba(168,180,192,0.7)', fontSize: '0.82rem', fontWeight: 700 }}>{selected.length}/{MAX_COLUMNS}</span>
        {selected.length >= 2 && (
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexWrap: 'wrap', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', color: 'rgba(168,180,192,0.8)', fontSize: '0.8rem', fontWeight: 700, userSelect: 'none' }}>
              <input type="checkbox" checked={diffMode} onChange={e => setDiffMode(e.target.checked)} style={{ accentColor: '#00C4BC' }} />
              Diff Mode
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', color: 'rgba(168,180,192,0.8)', fontSize: '0.8rem', fontWeight: 700, userSelect: 'none', marginLeft: 8 }}>
              <input type="checkbox" checked={hideIdentical} onChange={e => setHideIdentical(e.target.checked)} style={{ accentColor: '#00C4BC' }} />
              Hide Identical Attributes
            </label>
            <button type="button" onClick={handleExportCSV} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 7, padding: '7px 12px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}><Download size={13} /> CSV</button>
            <button type="button" onClick={handleExportJSON} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 7, padding: '7px 12px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}><Download size={13} /> JSON</button>
            <button type="button" onClick={handleShare} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 7, padding: '7px 12px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>{copied ? <Check size={13} color="#00C4BC" /> : <Share2 size={13} />} {copied ? 'Copied!' : 'Share'}</button>
            <button type="button" onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 7, padding: '7px 12px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}><Printer size={13} /> Print</button>
          </div>
        )}
        {selected.length > 0 && <button type="button" onClick={() => setSelectedSlugs([])} style={{ background: 'rgba(229,62,62,0.1)', border: '1px solid rgba(229,62,62,0.3)', color: '#F08A8A', borderRadius: 7, padding: '7px 14px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>Clear All</button>}
      </div>

      {/* Synergy / Conflict Alerts */}
      {[...activeSynergies, ...dynamicAlerts].map((syn, idx) => (
        <div key={idx} style={{ background: syn.type === 'conflict' ? 'rgba(229,62,62,0.1)' : syn.type === 'caution' ? 'rgba(246,173,85,0.1)' : 'rgba(104,211,145,0.1)', border: `1px solid ${syn.type === 'conflict' ? 'rgba(229,62,62,0.3)' : syn.type === 'caution' ? 'rgba(246,173,85,0.3)' : 'rgba(104,211,145,0.3)'}`, color: syn.type === 'conflict' ? '#FC8181' : syn.type === 'caution' ? '#F6AD55' : '#68D391', padding: '11px 16px', borderRadius: 8, marginBottom: 10, fontSize: '0.88rem', fontWeight: 600, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          {syn.type === 'conflict' ? <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} /> : syn.type === 'caution' ? <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} /> : <Sparkles size={15} style={{ flexShrink: 0, marginTop: 1 }} />}
          <span><strong>{syn.type === 'conflict' ? 'Conflict' : syn.type === 'caution' ? 'Caution' : `Synergy — ${'category' in syn ? syn.category : ''}`}:</strong> {syn.message}</span>
        </div>
      ))}

      {/* Empty State */}
      {selected.length === 0 ? (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, marginBottom: 32 }}>
            {[1, 2, 3].map(num => (
              <div key={num} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, minHeight: 240, border: '2px dashed rgba(168,180,192,0.15)', borderRadius: 14, background: 'rgba(22,34,48,0.4)' }}>
                <PlusCircle size={44} color="rgba(168,180,192,0.2)" />
                <div style={{ color: 'rgba(168,180,192,0.6)', fontWeight: 700, fontSize: '1rem' }}>Compound {num}</div>
                <p style={{ color: 'rgba(168,180,192,0.4)', fontSize: '0.82rem', textAlign: 'center', padding: '0 24px', margin: 0 }}>Search above to select a compound for comparison.</p>
              </div>
            ))}
          </div>
          {/* Popular Comparisons */}
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Popular Comparisons — Quick Start</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
              {POPULAR_COMPARISONS.filter(p => p.slugs.every(s => compounds.some(c => c.slug === s))).map(p => (
                <button key={p.label} type="button" className="popular-card" onClick={() => { setSelectedSlugs(p.slugs.slice(0, MAX_COLUMNS)); }}>
                  <span style={{ fontSize: '1.1rem', display: 'inline-flex', alignItems: 'center' }}>{renderPopularIcon(p.icon)}</span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>{p.label}</span>
                  <span style={{ fontSize: '0.68rem', color: 'rgba(168,180,192,0.5)' }}>{p.slugs.map(s => bySlug.get(s)?.display_name ?? s).join(' vs. ')}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

          {/* Tabs */}
          {selected.length >= 2 && (
            <div className="no-print hide-scroll" style={{ overflowX: 'auto', paddingBottom: 4, WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              <div style={{ display: 'flex', gap: 6, minWidth: 'max-content' }}>
                {tabs.map(tab => (
                  <button key={tab.id} type="button" className={`ct-tab${activeTab === tab.id ? ' active' : ''}`} onClick={() => setActiveTab(tab.id)}>
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Score Summary Panel — always visible */}
          {selected.length >= 2 && (
            <div className="glass-panel" style={{ borderRadius: 14, padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Top Pick Banner */}
              {topPickSlug && (
                <div style={{ position: isMobile ? 'sticky' : 'relative', top: isMobile ? 10 : 'auto', zIndex: isMobile ? 40 : 'auto', display: 'flex', alignItems: 'center', gap: 10, background: isMobile ? 'rgba(0,196,188,0.15)' : 'rgba(0,196,188,0.08)', border: '1px solid rgba(0,196,188,0.3)', borderRadius: 10, padding: '10px 16px', backdropFilter: isMobile ? 'blur(10px)' : 'none', marginBottom: isMobile ? 12 : 0, cursor: 'pointer', boxShadow: isMobile ? '0 8px 24px rgba(0,0,0,0.5)' : 'none' }} onClick={() => setActiveTab('recommend')}>
                  <Trophy size={17} color="#00C4BC" style={{ flexShrink: 0 }} />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#00C4BC' }}>Top Pick: {bySlug.get(topPickSlug)?.display_name}</span>
                    <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.6)' }}>Tap to see full verdict & analysis <ArrowRight size={8} style={{ display: 'inline-block' }}/></span>
                  </div>
                </div>
              )}

              {/* Score Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(220px, 1fr))`, gap: 16 }}>
                {displayedSelected.map(c => {
                  const origIdx = selected.findIndex(x => x.slug === c.slug);
                  const score = scores[origIdx];
                  const color = colors[origIdx % colors.length];
                  const isTop = c.slug === topPickSlug;
                  return (
                    <div key={c.slug} style={{ padding: 14, borderRadius: 12, background: isTop ? 'rgba(0,196,188,0.05)' : 'rgba(255,255,255,0.02)', border: `1px solid ${isTop ? 'rgba(0,196,188,0.25)' : 'rgba(255,255,255,0.07)'}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                        <Link href={`/research/${c.slug}`} style={{ color, fontWeight: 900, textDecoration: 'none', fontSize: '0.95rem' }}>{c.display_name}</Link>
                        {isTop && <Trophy size={13} color="#00C4BC" />}
                      </div>
                      <AnimatedScoreRing score={score} color={color} />
                      {score.bestFor.length > 0 && (
                        <div style={{ marginTop: 8, padding: '5px 8px', background: `${color}10`, borderRadius: 6, fontSize: '0.67rem', color: color, fontWeight: 700, lineHeight: 1.4 }}>
                          Unique: {score.bestFor.map(researchAreaLabel).slice(0, 2).join(', ')}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Radar Chart or Spark Bars */}
              {radarData.length >= 2 && (
                isMobile ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12, padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800, marginBottom: 4 }}>Profile Strength</div>
                    {selected.map((c, i) => (
                      <div key={c.slug} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                         <div style={{ width: 64, fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontWeight: 700 }}>{c.display_name}</div>
                         <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${scores[i].total}%`, height: '100%', background: colors[i % colors.length], borderRadius: 3, transition: 'width 1s ease-out' }} />
                         </div>
                         <div style={{ width: 28, fontSize: '0.7rem', fontWeight: 800, color: colors[i % colors.length], textAlign: 'right' }}>{scores[i].total}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ marginTop: 4 }}>
                    <div style={{ textAlign: 'center', fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)', marginBottom: 4, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Research Profile Radar — hover axes for details</div>
                    <AttributeRadarChart data={radarData} colors={colors} compoundNames={selected.map(c => c.display_name)} size={320} animated />
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap', marginTop: 6 }}>
                      {selected.map((c, i) => (
                        <div key={c.slug} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.7rem', color: 'rgba(255,255,255,0.55)' }}>
                          <div style={{ width: 10, height: 4, borderRadius: 2, background: colors[i % colors.length] }} />
                          {c.display_name}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>
          )}

          {/* ── TAB: PROS & CONS ── */}
          {activeTab === 'proscons' && (
            <div className="glass-panel" style={{ borderRadius: 14, padding: 24 }}>
              <h3 style={{ margin: '0 0 18px 0', fontSize: '1.05rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Scale size={17} color="#00C4BC" /> Pros &amp; Cons Analysis
                <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', fontWeight: 400, marginLeft: 4 }}>Data-driven from compound attributes</span>
              </h3>
              <div className="hide-scroll" style={{ display: isMobile ? 'flex' : 'grid', gridTemplateColumns: isMobile ? undefined : `repeat(auto-fit, minmax(260px, 1fr))`, gap: 14, overflowX: isMobile ? 'auto' : 'visible', WebkitOverflowScrolling: 'touch', scrollSnapType: isMobile ? 'x mandatory' : 'none', paddingBottom: isMobile ? 12 : 0, margin: isMobile ? '0 -24px' : 0, paddingLeft: isMobile ? 24 : 0, paddingRight: isMobile ? 24 : 0 }}>
                {displayedSelected.map(c => {
                  const origIdx = selected.findIndex(x => x.slug === c.slug);
                  const pc = prosCons[origIdx];
                  const color = colors[origIdx % colors.length];
                  const isTop = c.slug === topPickSlug;
                  return (
                    <div key={c.slug} style={{ padding: 16, borderRadius: 12, background: isTop ? 'rgba(0,196,188,0.04)' : 'rgba(255,255,255,0.02)', border: `1px solid ${isTop ? 'rgba(0,196,188,0.2)' : 'rgba(255,255,255,0.07)'}`, minWidth: isMobile ? 280 : 'auto', scrollSnapAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
                        <span style={{ fontWeight: 900, fontSize: '0.9rem', color: '#fff' }}>{c.display_name}</span>
                        {isTop && <Trophy size={11} color="#00C4BC" />}
                        <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color, fontWeight: 800 }}>Score: {scores[origIdx].total}/100</span>
                      </div>
                      <ProsConsCard pc={pc} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── TAB: ANALYST BRIEF ── */}
          {activeTab === 'brief' && selected.length >= 2 && (
            <div className="glass-panel" style={{ borderRadius: 14, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <Info size={17} color="rgba(0,196,188,0.8)" />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#fff' }}>Analyst Brief</h3>
                <span style={{ marginLeft: 'auto', fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>For laboratory research reference only</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {analystBrief.map((para, i) => (
                  <p key={i} style={{ margin: 0, color: 'rgba(255,255,255,0.78)', fontSize: '0.88rem', lineHeight: 1.75, paddingLeft: 14, borderLeft: '2px solid rgba(0,196,188,0.3)' }}>
                    {para}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* ── TAB: MECHANISM ── */}
          {activeTab === 'mechanism' && (
            <div className="glass-panel" style={{ borderRadius: 14, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <FlaskConical size={17} color="rgba(0,196,188,0.8)" />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#fff' }}>Mechanism Deep-Dive</h3>
                <span style={{ marginLeft: 'auto', fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>Receptor targets, MOA, risk factors, sources</span>
              </div>
              <MechanismTab selected={displayedSelected} />
            </div>
          )}

          {/* ── TAB: PROTOCOL ── */}
          {activeTab === 'protocol' && (
            <div className="glass-panel" style={{ borderRadius: 14, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <Beaker size={17} color="rgba(0,196,188,0.8)" />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#fff' }}>Protocol Guide</h3>
                <span style={{ marginLeft: 'auto', fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>Reconstitution, handling, frequency</span>
              </div>
              <ProtocolTab selected={displayedSelected} />
            </div>
          )}

          {/* ── TAB: RECOMMENDATION / VERDICT ── */}
          {activeTab === 'recommend' && selected.length >= 2 && recommendations && (
            <div className="glass-panel" style={{ borderRadius: 14, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <Star size={17} color="rgba(0,196,188,0.8)" />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#fff' }}>Research Verdict</h3>
              </div>
              <p style={{ margin: '0 0 20px 0', fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
                Which compound is best suited for different research contexts — based on composite scoring across evidence, safety, scientific backing, research coverage, and handling practicality.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 24 }}>
                <RecommendationCard rec={recommendations.overall} label="Overall Best Pick" icon={<Trophy size={14} />} color="#00C4BC" />
                <RecommendationCard rec={recommendations.safest} label="Safest Profile" icon={<Shield size={14} />} color="#68D391" />
                <RecommendationCard rec={recommendations.mostStudied} label="Most Research-Backed" icon={<BookOpen size={14} />} color="#F6AD55" />
                <RecommendationCard rec={recommendations.mostPractical} label="Most Practical" icon={<Zap size={14} />} color="#9F7AEA" />
              </div>
              {/* Recommended contexts per compound */}
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>Best Research Contexts Per Compound</div>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(220px, 1fr))`, gap: 10 }}>
                  {displayedSelected.map(c => {
                    const origIdx = selected.findIndex(x => x.slug === c.slug);
                    const score = scores[origIdx];
                    const color = colors[origIdx % colors.length];
                    return (
                      <div key={c.slug} style={{ padding: 12, borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
                          <span style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--white)' }}>{c.display_name}</span>
                          <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color, fontWeight: 800 }}>{score.letter}</span>
                        </div>
                        {score.recommendedContexts.length ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {score.recommendedContexts.map((ctx, i) => (
                              <div key={i} style={{ display: 'flex', gap: 5, alignItems: 'flex-start', fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.35 }}>
                                <ArrowRight size={10} color={color} style={{ marginTop: 2, flexShrink: 0 }} />
                                {ctx}
                              </div>
                            ))}
                          </div>
                        ) : <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)' }}>General-purpose research compound</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── TAB: ATTRIBUTE MATRIX ── */}
          {(activeTab === 'matrix') && (
            <>
              {/* Feature 2, 4, 10: Matrix Controls */}
              {selected.length >= 2 && (
                <div className="no-print" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' }}>
                  <button type="button" onClick={() => { setShowWinnersOnly(v => !v); haptic(20); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, background: showWinnersOnly ? 'rgba(104,211,145,0.12)' : 'rgba(255,255,255,0.05)', border: `1px solid ${showWinnersOnly ? 'rgba(104,211,145,0.4)' : 'rgba(255,255,255,0.1)'}`, color: showWinnersOnly ? '#68D391' : '#A8B4C0', borderRadius: 8, padding: '7px 12px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                    <Trophy size={12} /> {showWinnersOnly ? 'Winners Only ✓' : 'Winners Only'}
                  </button>
                  <button type="button" onClick={() => { setCellColorCode(v => !v); haptic(20); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, background: cellColorCode ? 'rgba(0,196,188,0.12)' : 'rgba(255,255,255,0.05)', border: `1px solid ${cellColorCode ? 'rgba(0,196,188,0.4)' : 'rgba(255,255,255,0.1)'}`, color: cellColorCode ? '#00C4BC' : '#A8B4C0', borderRadius: 8, padding: '7px 12px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                    <BarChart3 size={12} /> {cellColorCode ? 'Color Rank ✓' : 'Color Rank'}
                  </button>
                  {!isMobile && (
                    <div style={{ display: 'flex', gap: 4, marginLeft: 'auto', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)' }}>Zoom</span>
                      <button type="button" onClick={() => setTableZoom(z => Math.max(0.7, parseFloat((z - 0.1).toFixed(1))))} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#A8B4C0', borderRadius: 6, width: 28, height: 28, cursor: 'pointer', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>-</button>
                      <span style={{ fontSize: '0.75rem', color: '#fff', minWidth: 36, textAlign: 'center', fontWeight: 700 }}>{Math.round(tableZoom * 100)}%</span>
                      <button type="button" onClick={() => setTableZoom(z => Math.min(1.3, parseFloat((z + 0.1).toFixed(1))))} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#A8B4C0', borderRadius: 6, width: 28, height: 28, cursor: 'pointer', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>+</button>
                      {tableZoom !== 1 && <button type="button" onClick={() => setTableZoom(1)} style={{ background: 'transparent', border: 'none', color: 'rgba(168,180,192,0.45)', fontSize: '0.7rem', cursor: 'pointer', padding: '0 4px' }}>Reset</button>}
                    </div>
                  )}
                </div>
              )}
              {/* Toggle View Mode on Mobile */}
              {isMobile && (
                 <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                   <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 4, gap: 4 }}>
                     <button onClick={() => setMobileViewMode('matrix')} style={{ background: mobileViewMode === 'matrix' ? 'rgba(0,196,188,0.15)' : 'transparent', color: mobileViewMode === 'matrix' ? '#00C4BC' : '#A8B4C0', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 800 }}>Table View</button>
                     <button onClick={() => setMobileViewMode('accordion')} style={{ background: mobileViewMode === 'accordion' ? 'rgba(0,196,188,0.15)' : 'transparent', color: mobileViewMode === 'accordion' ? '#00C4BC' : '#A8B4C0', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 800 }}>Card View</button>
                   </div>
                 </div>
              )}

              {isMobile && mobileViewMode === 'accordion' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {(() => {
                    const controlCompound = displayedSelected.find(x => x.slug === controlSlug);
                    return ROWS.map(row => {
                      if (row.kind === 'group') {
                        // Check if all children of this group are identical (for hideIdentical)
                        if (hideIdentical) {
                          const startIndex = ROWS.indexOf(row) + 1;
                          let groupAllIdentical = true;
                          for (let gi = startIndex; gi < ROWS.length; gi++) {
                            const r = ROWS[gi];
                            if (r.kind === 'group') break;
                            const vals = displayedSelected.map(c => r.getValue(c));
                            if (!vals.every(v => v === vals[0])) { groupAllIdentical = false; break; }
                          }
                          if (groupAllIdentical) return null;
                        }
                        
                        const isCollapsed = collapsedGroups.has(row.label);
                        return (
                          <div key={row.label} id={`group-${row.label.replace(/\s+/g, '-')}`} onClick={() => toggleGroup(row.label)} style={{ marginTop: 12, padding: '12px 16px', background: '#162230', color: '#fff', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', borderRadius: 8, fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                            {row.label}
                            {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                          </div>
                        );
                      }

                      // In accordion, compute if this row is identical across compounds
                      const rowVals = displayedSelected.map(c => row.getValue(c));
                      const rowAllSame = rowVals.every(v => v === rowVals[0]);
                      if (hideIdentical && rowAllSame && displayedSelected.length > 1) return null;

                      // Check if parent group is collapsed
                      let parentGroupLabel = '';
                      for (let i = ROWS.indexOf(row) - 1; i >= 0; i--) {
                        if (ROWS[i].kind === 'group') {
                          parentGroupLabel = ROWS[i].label;
                          break;
                        }
                      }
                      if (parentGroupLabel && collapsedGroups.has(parentGroupLabel)) return null;

                      // Winner Engine Calculation (accordion)
                      const bestIndices: number[] = [];
                      if (row.bestLogic && displayedSelected.length > 1) {
                        const rawScores = displayedSelected.map(c => row.getRawScore ? row.getRawScore(c) : 0);
                        const valid = rawScores.filter(s => typeof s === 'number' && !isNaN(s) && s !== Infinity);
                        if (valid.length > 0) {
                          const best = row.bestLogic === 'max' ? Math.max(...valid) : Math.min(...valid);
                          rawScores.forEach((s, i) => { if (s === best) bestIndices.push(i); });
                        }
                      }

                      return (
                        <div key={row.label} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10, padding: 12 }}>
                           <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', fontWeight: 800, color: '#A8B4C0', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                             {row.label}
                             {row.glossaryTerm && <InCellGlossaryTooltip term={row.glossaryTerm} />}
                           </div>
                           <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                             {displayedSelected.map((c, idx) => {
                               const isWinner = bestIndices.includes(idx);
                               const isControl = c.slug === controlSlug;
                               return (
                                 <div key={c.slug} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: 10, background: isControl ? 'rgba(0,196,188,0.05)' : 'rgba(255,255,255,0.02)', borderRadius: 8, position: 'relative', border: isWinner ? '1px solid rgba(0,196,188,0.4)' : '1px solid transparent' }}>
                                   {isWinner && (
                                      <div style={{ position: 'absolute', top: -8, right: 10, fontSize: '0.65rem', background: '#00C4BC', color: '#04221F', padding: '2px 6px', borderRadius: 4, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '2px', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
                                        <Trophy size={10} /> Top Pick
                                      </div>
                                   )}
                                   <div style={{ width: 80, fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.8)', flexShrink: 0, marginTop: 2 }}>{c.display_name}</div>
                                   <div style={{ flex: 1, fontSize: '0.85rem', color: '#fff' }}>
                                     <TruncatedCell>
                                       {row.render(c, maxHalfLife)}
                                       {controlCompound && renderRelativeDelta(row.label, c, controlCompound)}
                                     </TruncatedCell>
                                   </div>
                                 </div>
                               );
                             })}
                           </div>
                        </div>
                      )
                    });
                  })()}
                </div>
              ) : (
                <div className="glass-panel" style={{ borderRadius: 14, overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollSnapType: 'x mandatory' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: isMobile ? (displayedSelected.length * 160 + 120) : 480, position: 'relative' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 20 }}>
                  <tr>
                    <th style={{ ...labelCellStyle, textAlign: 'left', width: isMobile ? 120 : '22%', background: '#162230', zIndex: 30, fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }} scope="col">
                       Attribute
                       {isMobile && selected.length > 1 && (
                         <button onClick={() => setReorderModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#00C4BC', padding: '4px 8px', borderRadius: 6, fontSize: '0.65rem', fontWeight: 800, marginTop: 8, cursor: 'pointer' }}>
                           <LayoutList size={12} /> Reorder
                         </button>
                       )}
                    </th>
                    {displayedSelected.map(c => {
                      const origIdx = selected.findIndex(x => x.slug === c.slug);
                      const color = colors[origIdx % colors.length];
                      const isTop = c.slug === topPickSlug;
                      const isControl = c.slug === controlSlug;
                      const controlStyle: React.CSSProperties = isControl && isMobile ? { position: 'sticky', left: 120, zIndex: 25, boxShadow: '-2px 0 8px rgba(0,0,0,0.4)', borderRight: '2px solid rgba(0,196,188,0.4)' } : {};
                      return (
                        <th key={c.slug} style={{ ...cellStyle, textAlign: 'left', background: isControl ? 'linear-gradient(rgba(0,196,188,0.08),rgba(0,196,188,0.08)), #162230' : '#162230', width: isMobile ? 160 : `${78 / displayedSelected.length}%`, scrollSnapAlign: 'start', ...controlStyle }} scope="col"
                          draggable={!isMobile}
                          onDragStart={e => { e.dataTransfer.setData('text/plain', String(origIdx)); e.dataTransfer.effectAllowed = 'move'; }}
                          onDragOver={e => e.preventDefault()}
                          onDrop={e => { e.preventDefault(); const src = parseInt(e.dataTransfer.getData('text/plain'), 10); if (src !== origIdx && !isNaN(src)) { setSelectedSlugs(prev => { const n = [...prev]; const [r] = n.splice(src, 1); n.splice(origIdx, 0, r); return n; }); } }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                {!isMobile && <GripHorizontal size={13} color="rgba(255,255,255,0.15)" style={{ cursor: 'grab', flexShrink: 0 }} />}
                                <Link href={`/research/${c.slug}`} style={{ color, fontWeight: 900, textDecoration: 'none', fontSize: '1.05rem' }}>{c.display_name}</Link>
                                {isTop && <Trophy size={13} color="#00C4BC" />}
                              </div>
                              <div style={{ display: 'flex', gap: 3, marginTop: 4, flexWrap: 'wrap' }}>
                                {c.evidence_tier === 'approved_drug' && <span style={{ background: 'rgba(104,211,145,0.15)', color: '#68D391', padding: '1px 5px', borderRadius: 3, fontSize: '0.62rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '2px' }}><Check size={9} /> FDA</span>}
                                {(c.wada_status === 'prohibited' || c.wada_status === 'prohibited_males') && <span style={{ background: 'rgba(229,62,62,0.15)', color: '#FC8181', padding: '1px 5px', borderRadius: 3, fontSize: '0.62rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '2px' }}><X size={9} /> WADA Banned</span>}
                                {c.is_stack && <span style={{ background: 'rgba(159,122,234,0.15)', color: '#9F7AEA', padding: '1px 5px', borderRadius: 3, fontSize: '0.62rem', fontWeight: 800 }}>Stack</span>}
                                {c.is_temp_sensitive && <span style={{ background: 'rgba(246,173,85,0.15)', color: '#F6AD55', padding: '1px 5px', borderRadius: 3, fontSize: '0.62rem', fontWeight: 800 }}>Cold Chain</span>}
                                {c.is_pro_angiogenic && <span style={{ background: 'rgba(246,173,85,0.12)', color: '#F6AD55', padding: '1px 5px', borderRadius: 3, fontSize: '0.62rem', fontWeight: 800 }}>Angio Alert</span>}
                                {c.is_glp1 && <span style={{ background: 'rgba(159,122,234,0.12)', color: '#9F7AEA', padding: '1px 5px', borderRadius: 3, fontSize: '0.62rem', fontWeight: 800 }}>GLP-1</span>}
                                {c.year_discovered && <span style={{ background: 'rgba(168,180,192,0.08)', color: 'rgba(168,180,192,0.5)', padding: '1px 5px', borderRadius: 3, fontSize: '0.62rem', fontWeight: 600 }}>{c.year_discovered}</span>}
                                <span style={{ background: `${color}15`, color, padding: '1px 5px', borderRadius: 3, fontSize: '0.62rem', fontWeight: 800 }}>{scores[origIdx].letter}</span>
                              </div>
                              {selected.length >= 2 && (
                                <button
                                  type="button"
                                  onClick={() => setControlSlug(c.slug === controlSlug ? null : c.slug)}
                                  style={{
                                    background: c.slug === controlSlug ? '#00C4BC' : 'rgba(255,255,255,0.06)',
                                    border: '1px solid rgba(255,255,255,0.12)',
                                    color: c.slug === controlSlug ? '#04221F' : '#A8B4C0',
                                    borderRadius: 6,
                                    padding: '4px 10px',
                                    fontSize: '0.68rem',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    marginTop: 6,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    width: 'fit-content'
                                  }}
                                >
                                  {c.slug === controlSlug ? 'Baseline Control' : 'Set Baseline'}
                                </button>
                              )}
                            </div>
                            <button type="button" className="no-print" onClick={() => removeCompound(c.slug)} aria-label={`Remove ${c.display_name}`}
                              style={{ background: 'transparent', border: 'none', color: 'rgba(168,180,192,0.5)', cursor: 'pointer', display: 'flex', padding: 3, borderRadius: 4 }}
                              onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                              onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                              <X size={16} />
                            </button>
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
                    const controlCompound = displayedSelected.find(x => x.slug === controlSlug);

                    for (const row of ROWS) {
                      if (row.kind === 'group') {
                        if (currentGroupRow && currentGroupHasChildren) {
                          visibleRows.push(currentGroupRow);
                        }
                        currentGroupRow = row;
                        currentGroupHasChildren = false;
                      } else {
                        // Check if group is collapsed
                        let parentGroup = '';
                        const rowIdx = ROWS.indexOf(row);
                        for (let i = rowIdx; i >= 0; i--) {
                          if (ROWS[i].kind === 'group') {
                            parentGroup = ROWS[i].label;
                            break;
                          }
                        }
                        if (collapsedGroups.has(parentGroup)) {
                          continue;
                        }

                        const values = displayedSelected.map(c => row.getValue(c));
                        const allSame = values.every(v => v === values[0]);
                        const isVisible = !(hideIdentical && allSame && displayedSelected.length > 1);
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
                          <tr key={`g-${row.label}`} id={`group-${row.label.replace(/\s+/g, '-')}`} onClick={() => toggleGroup(row.label)}>
                            <td style={{ ...groupCellStyle, position: 'sticky', left: 0, zIndex: 10 }} colSpan={colSpan}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
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
                      const values = displayedSelected.map(c => row.getValue(c));
                      const allSame = values.every(v => v === values[0]);
                      const isDiff = !allSame && displayedSelected.length > 1;

                      const trStyle: React.CSSProperties = {};
                      const tdLabelStyle: React.CSSProperties = { ...labelCellStyle };
                      const valueCellStyle: React.CSSProperties = { ...cellStyle };

                      if (diffMode) {
                        if (isDiff) {
                          trStyle.background = 'rgba(0,196,188,0.07)';
                          tdLabelStyle.background = 'linear-gradient(rgba(0,196,188,0.07),rgba(0,196,188,0.07)),#162230';
                        } else {
                          tdLabelStyle.color = 'rgba(168,180,192,0.25)';
                          valueCellStyle.opacity = 0.25;
                        }
                      }

                      // Winner Engine Calculation
                      const bestIndices: number[] = [];
                      if (row.bestLogic && displayedSelected.length > 1 && !allSame) {
                        const rawScores = displayedSelected.map(c => row.getRawScore ? row.getRawScore(c) : 0);
                        const valid = rawScores.filter(s => typeof s === 'number' && !isNaN(s) && s !== Infinity);
                        if (valid.length > 0) {
                          const best = row.bestLogic === 'max' ? Math.max(...valid) : Math.min(...valid);
                          rawScores.forEach((s, i) => {
                            if (s === best) bestIndices.push(i);
                          });
                        }
                      }

                      return (
                        <tr key={row.label} style={trStyle} className="ct-row-hover">
                          <td style={tdLabelStyle}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              {row.label}
                              {row.glossaryTerm && <InCellGlossaryTooltip term={row.glossaryTerm} />}
                            </div>
                          </td>
                          {displayedSelected.map((c, idx) => {
                            const isWinner = bestIndices.includes(idx);
                            const isControl = c.slug === controlSlug;
                            const controlStyleTd: React.CSSProperties = isControl && isMobile ? { position: 'sticky', left: 120, zIndex: 15, background: '#192A34', boxShadow: '-2px 0 8px rgba(0,0,0,0.4)', borderRight: '2px solid rgba(0,196,188,0.4)' } : {};

                            return (
                              <td key={c.slug} style={{ ...valueCellStyle, position: 'relative', background: c.slug === controlSlug ? 'rgba(0,196,188,0.04)' : undefined, ...controlStyleTd }}>
                                {isWinner && (
                                  <div style={{ position: 'absolute', top: 4, right: 4, fontSize: '0.65rem', background: '#00C4BC', color: '#04221F', padding: '1px 5px', borderRadius: 3, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                                    <Trophy size={9} /> Top Pick
                                  </div>
                                )}
                                <div style={isWinner ? { borderLeft: '2px solid #00C4BC', paddingLeft: 7, marginLeft: -8 } : {}}>
                                  {isMobile ? (
                                    <TruncatedCell>
                                      {row.render(c, maxHalfLife)}
                                      {controlCompound && renderRelativeDelta(row.label, c, controlCompound)}
                                    </TruncatedCell>
                                  ) : (
                                    <>
                                      {row.render(c, maxHalfLife)}
                                      {controlCompound && renderRelativeDelta(row.label, c, controlCompound)}
                                    </>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          )}
          </>
        )}
      </div>
      )}
      {/* Floating Action Button (FAB) for adding compounds on mobile */}
      {isMobile && selected.length >= 1 && selected.length < MAX_COLUMNS && canAdd && (
        <button
          className="no-print"
          onClick={() => {
            searchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => {
              const input = searchRef.current?.querySelector('input');
              if (input) input.focus();
            }, 500);
          }}
          style={{ position: 'fixed', bottom: 88, right: 20, width: 56, height: 56, borderRadius: '50%', background: '#00C4BC', color: '#04221F', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(0,196,188,0.4)', border: 'none', cursor: 'pointer', zIndex: 100 }}
        >
          <PlusCircle size={28} />
        </button>
      )}

      {/* Differences Only Floating Pill (Mobile) */}
      {isMobile && activeTab === 'matrix' && selected.length >= 2 && (
        <button
          className="no-print"
          onClick={() => setHideIdentical(!hideIdentical)}
          style={{ position: 'fixed', bottom: 26, left: '50%', transform: 'translateX(-50%)', zIndex: 100, background: hideIdentical ? '#00C4BC' : 'rgba(22,34,48,0.95)', color: hideIdentical ? '#04221F' : '#fff', border: `1px solid ${hideIdentical ? '#00C4BC' : 'rgba(255,255,255,0.2)'}`, padding: '10px 20px', borderRadius: 999, fontSize: '0.85rem', fontWeight: 800, boxShadow: '0 8px 32px rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', gap: 6, backdropFilter: 'blur(12px)', cursor: 'pointer' }}
        >
          {hideIdentical ? <Check size={16} /> : <Filter size={16} />}
          {hideIdentical ? 'Showing Differences' : 'Differences Only'}
        </button>
      )}
      {/* Jump to Group Menu Button (Mobile) */}
      {isMobile && activeTab === 'matrix' && (
        <button
          className="no-print"
          onClick={() => setJumpMenuOpen(true)}
          style={{ position: 'fixed', bottom: 88, left: 20, zIndex: 100, background: 'rgba(22,34,48,0.95)', color: '#fff', border: `1px solid rgba(255,255,255,0.2)`, padding: '10px', borderRadius: '50%', boxShadow: '0 8px 32px rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(12px)', cursor: 'pointer' }}
        >
          <List size={20} />
        </button>
      )}

      {/* Reorder Modal */}
      {reorderModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={() => setReorderModalOpen(false)}>
          <div style={{ background: '#162230', width: '100%', maxWidth: 400, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, boxShadow: '0 -10px 40px rgba(0,0,0,0.5)', animation: 'slideUp 0.3s ease-out' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Reorder Columns</h3>
              <button onClick={() => setReorderModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#A8B4C0', cursor: 'pointer' }}><X size={24} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '60vh', overflowY: 'auto' }}>
              {selectedSlugs.map((slug, idx) => {
                const c = bySlug.get(slug);
                if (!c) return null;
                return (
                  <div key={slug} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fff' }}>{c.display_name}</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button disabled={idx === 0} onClick={() => {
                        const newSlugs = [...selectedSlugs];
                        [newSlugs[idx - 1], newSlugs[idx]] = [newSlugs[idx], newSlugs[idx - 1]];
                        setSelectedSlugs(newSlugs);
                      }} style={{ background: idx === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 6, padding: 6, color: idx === 0 ? 'rgba(255,255,255,0.2)' : '#fff', cursor: idx === 0 ? 'default' : 'pointer' }}><MoveUp size={16} /></button>
                      <button disabled={idx === selectedSlugs.length - 1} onClick={() => {
                        const newSlugs = [...selectedSlugs];
                        [newSlugs[idx + 1], newSlugs[idx]] = [newSlugs[idx], newSlugs[idx + 1]];
                        setSelectedSlugs(newSlugs);
                      }} style={{ background: idx === selectedSlugs.length - 1 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 6, padding: 6, color: idx === selectedSlugs.length - 1 ? 'rgba(255,255,255,0.2)' : '#fff', cursor: idx === selectedSlugs.length - 1 ? 'default' : 'pointer' }}><MoveDown size={16} /></button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Jump to Group Menu Modal */}
      {jumpMenuOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={() => setJumpMenuOpen(false)}>
          <div style={{ background: '#162230', width: '100%', maxWidth: 400, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, boxShadow: '0 -10px 40px rgba(0,0,0,0.5)', animation: 'slideUp 0.3s ease-out' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Jump to Section</h3>
              <button onClick={() => setJumpMenuOpen(false)} style={{ background: 'transparent', border: 'none', color: '#A8B4C0', cursor: 'pointer' }}><X size={24} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '60vh', overflowY: 'auto' }}>
              {ROWS.filter(r => r.kind === 'group').map(g => (
                <button
                  key={g.label}
                  onClick={() => {
                     setJumpMenuOpen(false);
                     const el = document.getElementById(`group-${g.label.replace(/\s+/g, '-')}`);
                     if (el) {
                       el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                     }
                  }}
                  style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#fff', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  {g.label}
                  <ChevronRight size={16} color="rgba(255,255,255,0.3)" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* Landscape Prompt Toast */}
      {isMobile && showLandscapePrompt && selected.length >= 2 && activeTab === 'matrix' && (
        <div className="no-print" style={{ position: 'fixed', top: 20, left: 20, right: 20, zIndex: 110, background: 'rgba(0,196,188,0.15)', border: '1px solid rgba(0,196,188,0.4)', borderRadius: 12, padding: '12px 16px', color: '#00C4BC', display: 'flex', alignItems: 'center', gap: 12, backdropFilter: 'blur(10px)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', animation: 'fadeInDown 0.5s ease-out' }}>
          <Smartphone size={24} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: '0.85rem' }}>Rotate for Better View</div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>Landscape mode shows more compounds.</div>
          </div>
          <button onClick={() => setShowLandscapePrompt(false)} style={{ background: 'transparent', border: 'none', color: 'rgba(0,196,188,0.6)', cursor: 'pointer', padding: 4 }}><X size={16} /></button>
        </div>
      )}
    </div>
  );
}
