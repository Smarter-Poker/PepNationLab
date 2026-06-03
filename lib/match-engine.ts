/**
 * Match Me To A Peptide — deterministic scoring engine.
 *
 * Pure TypeScript, no React, no I/O. Given a researcher's stated primary goal,
 * evidence-tier comfort, WADA constraint, and risk tolerance, the engine ranks
 * the catalog and returns the top 5 candidate compounds with a plain-English
 * rationale.
 *
 * Research-Use-Only: this is an educational suggestion engine for laboratory
 * research framing. It does not produce dosing or medical advice. Compounds
 * that are unsafe under the user's stated constraints are hard-rejected, not
 * down-weighted.
 */

import type { Compound } from '@/lib/compounds';

export type EvidenceComfort =
  | 'strict_human_only'
  | 'investigational_ok'
  | 'preclinical_ok'
  | 'any';

export type WadaConstraint = 'wada_permitted_only' | 'no_constraint';

export type RiskTolerance = 'low_only' | 'moderate_ok' | 'any';

export interface MatchInput {
  goal: string;
  evidenceComfort: EvidenceComfort;
  wadaConstraint: WadaConstraint;
  riskTolerance: RiskTolerance;
}

export interface MatchResult {
  slug: string;
  displayName: string;
  score: number; // 0..100 (clamped)
  rationale: string; // 1-2 plain English sentences
  evidenceTier: string;
  wadaStatus: string;
  riskLevel: string;
}

// --------------------------------------------------------------------------
// Evidence tier ordering. Higher index = stronger human evidence.
// Used for both the comfort gate and as a deterministic tie-breaker.
// --------------------------------------------------------------------------
const EVIDENCE_TIER_ORDER: Record<string, number> = {
  approved_drug: 5,
  investigational: 4,
  preclinical: 3,
  research_chemical: 2,
  cosmetic: 1,
};

function tierRank(tier: string): number {
  return EVIDENCE_TIER_ORDER[tier] ?? 0;
}

/**
 * Minimum tier rank a user is willing to accept given their comfort level.
 * Stricter comfort = higher minimum rank.
 */
function comfortMinRank(comfort: EvidenceComfort): number {
  switch (comfort) {
    case 'strict_human_only':
      return EVIDENCE_TIER_ORDER.approved_drug; // approved_drug only
    case 'investigational_ok':
      return EVIDENCE_TIER_ORDER.investigational; // approved or investigational
    case 'preclinical_ok':
      return EVIDENCE_TIER_ORDER.preclinical; // approved, investigational, preclinical
    case 'any':
    default:
      return 0;
  }
}

/**
 * "+15 if the compound's tier matches the user's comfort." We interpret this
 * generously: any compound that survives the comfort gate gets the +15 boost,
 * because the user said they were comfortable with that tier or better.
 */
function evidenceComfortBonus(tier: string, comfort: EvidenceComfort): number {
  if (comfort === 'any') return tierRank(tier) > 0 ? 15 : 0;
  return tierRank(tier) >= comfortMinRank(comfort) ? 15 : 0;
}

// --------------------------------------------------------------------------
// Keyword groups for category / studied_for fuzzy goal matching.
// These mirror the research_areas keys in lib/compounds.ts so a compound
// that has not been explicitly tagged with a research area can still score
// based on prose hints in its category or studied-for entries.
// --------------------------------------------------------------------------
const GOAL_KEYWORDS: Record<string, string[]> = {
  tissue_repair: ['repair', 'tendon', 'ligament', 'wound', 'injury', 'healing', 'cartilage', 'muscle repair'],
  healing: ['healing', 'recovery', 'cytoprotection', 'regeneration', 'wound', 'gut', 'colitis', 'ulcer'],
  metabolic: ['metabolic', 'glucose', 'insulin', 'fat', 'weight', 'lipolysis', 'obesity', 'diabetes', 'appetite'],
  weight_management: ['weight', 'fat', 'appetite', 'obesity', 'lipolysis', 'satiety', 'glp', 'incretin'],
  longevity: ['aging', 'longevity', 'senescent', 'senolytic', 'telomere', 'healthspan', 'lifespan'],
  cosmetic: ['skin', 'hair', 'follicle', 'collagen', 'cosmetic', 'wrinkle', 'pigment', 'tan'],
  cognitive: ['cognition', 'cognitive', 'memory', 'mood', 'neuroprotection', 'brain', 'focus', 'nootropic'],
  immune: ['immune', 'immunity', 'thymus', 'host defense', 'infection', 'antiviral'],
  sexual_health: ['libido', 'sexual', 'erectile', 'arousal', 'desire', 'reproductive', 'fertility', 'hormone'],
  performance: ['growth hormone', 'gh', 'igf', 'anabolic', 'muscle', 'lean mass', 'performance', 'strength'],
  sleep: ['sleep', 'insomnia', 'circadian', 'melatonin'],
  mitochondrial: ['mitochondrial', 'mitochondria', 'energy', 'cardiolipin', 'mitophagy', 'nad', 'fatigue'],
  pain_inflammation: ['pain', 'inflammation', 'anti-inflammatory', 'analgesic', 'inflammatory', 'arthritis'],
};

function goalMentionsBonus(goal: string, c: Compound): number {
  const keywords = GOAL_KEYWORDS[goal] ?? [goal.replace(/_/g, ' ')];
  const haystack = [
    c.category ?? '',
    c.compound_class ?? '',
    c.mechanism ?? '',
    ...(c.studied_for ?? []),
  ]
    .join(' ')
    .toLowerCase();
  for (const kw of keywords) {
    if (kw && haystack.includes(kw.toLowerCase())) {
      return 20;
    }
  }
  return 0;
}

// --------------------------------------------------------------------------
// Hard-reject gates.
// --------------------------------------------------------------------------
function failsWadaGate(c: Compound, constraint: WadaConstraint): boolean {
  if (constraint === 'no_constraint') return false;
  // Hard reject anything whose wada_status begins with "prohibited"
  return typeof c.wada_status === 'string' && c.wada_status.toLowerCase().startsWith('prohibited');
}

function failsRiskGate(c: Compound, tolerance: RiskTolerance): boolean {
  if (tolerance === 'any') return false;
  const risk = c.risk_level;
  if (tolerance === 'low_only') {
    return risk === 'moderate' || risk === 'high' || risk === 'critical';
  }
  if (tolerance === 'moderate_ok') {
    return risk === 'high' || risk === 'critical';
  }
  return false;
}

function failsEvidenceGate(c: Compound, comfort: EvidenceComfort): boolean {
  if (comfort === 'any') return false;
  return tierRank(c.evidence_tier) < comfortMinRank(comfort);
}

// --------------------------------------------------------------------------
// Rationale composition.
// --------------------------------------------------------------------------
function evidenceLabel(tier: string): string {
  switch (tier) {
    case 'approved_drug':
      return 'Approved Drug';
    case 'investigational':
      return 'Investigational';
    case 'preclinical':
      return 'Preclinical';
    case 'research_chemical':
      return 'Research Compound';
    case 'cosmetic':
      return 'Cosmetic';
    default:
      return tier;
  }
}

function goalLabel(goal: string): string {
  return goal
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function buildRationale(
  c: Compound,
  goal: string,
  taggedHit: boolean,
  keywordHit: boolean,
): string {
  const tier = evidenceLabel(c.evidence_tier);
  const reason = taggedHit
    ? `Tagged In Research Area ${goalLabel(goal)}`
    : keywordHit
      ? `Studied For Topics Related To ${goalLabel(goal)}`
      : `Related To ${goalLabel(goal)}`;
  const tail =
    c.plain_summary && c.plain_summary.length > 0
      ? c.plain_summary.split('.')[0].trim()
      : c.mechanism
        ? c.mechanism.split('.')[0].trim()
        : `${tier} Evidence Tier`;
  return `${reason}. ${tail}.`;
}

// --------------------------------------------------------------------------
// Top-level scoring.
// --------------------------------------------------------------------------
function scoreOne(input: MatchInput, c: Compound): { score: number; rationale: string } | null {
  // Hard gates first — if any of these fail, the compound is excluded from
  // results entirely. We model that as returning null rather than a negative
  // score so callers cannot accidentally surface restricted compounds.
  if (failsEvidenceGate(c, input.evidenceComfort)) return null;
  if (failsWadaGate(c, input.wadaConstraint)) return null;
  if (failsRiskGate(c, input.riskTolerance)) return null;

  let score = 0;

  // +50 for an exact research-area tag match.
  const taggedHit = Array.isArray(c.research_areas) && c.research_areas.includes(input.goal);
  if (taggedHit) score += 50;

  // +20 if the goal's keywords appear in category / class / mechanism / studied_for.
  const keywordBonus = goalMentionsBonus(input.goal, c);
  if (keywordBonus > 0) score += keywordBonus;
  const keywordHit = keywordBonus > 0;

  // +15 if the compound's evidence tier matches the user's comfort level.
  score += evidenceComfortBonus(c.evidence_tier, input.evidenceComfort);

  // +5 nudge for class-aligned bonuses.
  if (c.is_glp1 && (input.goal === 'metabolic' || input.goal === 'weight_management')) {
    score += 5;
  }
  if (
    c.is_pro_angiogenic &&
    (input.goal === 'tissue_repair' ||
      input.goal === 'healing' ||
      input.goal === 'pain_inflammation')
  ) {
    score += 5;
  }

  // If the compound has zero goal-signal at all, do not surface it. This keeps
  // the top-5 list relevant rather than padded by tier-only matches.
  if (!taggedHit && !keywordHit) return null;

  // Clamp to 0..100 for the public score field.
  const clamped = Math.max(0, Math.min(100, score));

  return {
    score: clamped,
    rationale: buildRationale(c, input.goal, taggedHit, keywordHit),
  };
}

/**
 * Score the full catalog against a `MatchInput` and return the top 5 surviving
 * candidates, sorted by score desc, then by evidence-tier rank desc, then by
 * display_name ascending (deterministic).
 */
export function scoreCompounds(input: MatchInput, compounds: Compound[]): MatchResult[] {
  const scored: MatchResult[] = [];
  for (const c of compounds) {
    const result = scoreOne(input, c);
    if (!result) continue;
    scored.push({
      slug: c.slug,
      displayName: c.display_name,
      score: result.score,
      rationale: result.rationale,
      evidenceTier: c.evidence_tier,
      wadaStatus: c.wada_status,
      riskLevel: c.risk_level,
    });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const tierDelta = tierRank(b.evidenceTier) - tierRank(a.evidenceTier);
    if (tierDelta !== 0) return tierDelta;
    return a.displayName.localeCompare(b.displayName);
  });

  return scored.slice(0, 5);
}
