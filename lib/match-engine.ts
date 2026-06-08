/**
 * Match Me To A Peptide - deterministic scoring engine.
 *
 * Pure TypeScript, no React, no I/O. Given a researcher's stated primary goal,
 * evidence-tier comfort, and risk tolerance, the engine ranks
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

export type RiskTolerance = 'low_only' | 'moderate_ok' | 'any';

export interface MatchInput {
  goal: string;
  goals?: string[];
  evidenceComfort: EvidenceComfort;
  riskTolerance: RiskTolerance;
  excludeInjectables?: boolean;
  requireLongHalfLife?: boolean;
  excludeSlugs?: string[];
  preference?: 'single' | 'stack' | 'either';
  budget?: 'conservative' | 'standard' | 'unlimited';
  prep?: 'reconstitution' | 'no_reconstitution' | 'all';
}

export interface ScoreBreakdown {
  base: number;
  keyword: number;
  evidenceBonus: number;
  classBonus: number;
}

export interface ExcludedCompound {
  slug: string;
  displayName: string;
  reason: string;
}

export interface MatchResult {
  slug: string;
  displayName: string;
  score: number; // 0..100 (clamped)
  rationale: string; // 1-2 plain English sentences
  evidenceTier: string;
  riskLevel: string;
  halfLife: string | null;
  molecularWeight: number | null;
  isTempSensitive: boolean;
  scoreBreakdown: ScoreBreakdown;
  isStackPartner?: boolean;
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
  gut_health: ['gut', 'gi', 'mucosal', 'ulcer', 'colitis', 'crohn', 'leaky', 'gastric'],
  bone_joint: ['bone', 'joint', 'cartilage', 'osteo', 'density', 'fracture', 'synovial'],
};

function goalMentionsBonus(goal: string, c: Compound): number {
  const keywords = GOAL_KEYWORDS[goal] ?? [goal.replace(/_/g, ' ')];
  const haystack = [
    c.category ?? '',
    c.compound_class ?? '',
    c.mechanism ?? '',
    c.plain_summary ?? '',
    c.benefits ?? '',
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

function failsHandlingGate(c: Compound, excludeInjectables: boolean | undefined): boolean {
  if (!excludeInjectables) return false;
  const form = c.handling?.form?.toLowerCase() || '';
  if (form.includes('injectable') || form.includes('lyophilized') || form.includes('vial') || form.includes('injection')) {
    return true;
  }
  return false;
}

function failsPrepGate(c: Compound, prep: 'reconstitution' | 'no_reconstitution' | 'all' | undefined): boolean {
  if (!prep || prep === 'all') return false;
  const form = (c.handling?.form || '').toLowerCase();
  const isReconstitution = form.includes('lyophilized') || form.includes('powder') || form.includes('vial') || form.includes('injection') || form.includes('injectable');
  if (prep === 'reconstitution' && !isReconstitution) return true;
  if (prep === 'no_reconstitution' && isReconstitution) return true;
  return false;
}

function failsHalfLifeGate(c: Compound, requireLongHalfLife: boolean | undefined): boolean {
  if (!requireLongHalfLife) return false;
  const hl = c.half_life?.toLowerCase() || '';
  if (!hl) return false;
  if (hl.includes('min') || hl.includes('short')) return true;
  if (hl.match(/\b([1-9]|1[0-9]|2[0-3])\s*h(ou)?r/)) return true; // e.g. "2 hours"
  return false;
}

function failsPreferenceGate(c: Compound, preference: 'single' | 'stack' | 'either' | undefined): boolean {
  if (!preference || preference === 'either') return false;
  if (preference === 'single' && c.is_stack) return true;
  if (preference === 'stack' && !c.is_stack) return true;
  return false;
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
  const reason = goal === 'any'
    ? 'Matches Explore Criteria'
    : taggedHit
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
function scoreOne(input: MatchInput, c: Compound): { score: number; rationale: string; breakdown: ScoreBreakdown } | { failReason: string } {
  // Hard gates first - if any of these fail, the compound is excluded from
  // results entirely. We model that as returning { failReason } so callers can surface it.
  if (failsEvidenceGate(c, input.evidenceComfort)) return { failReason: 'Does not meet requested evidence comfort level.' };
  if (failsRiskGate(c, input.riskTolerance)) return { failReason: 'Exceeds requested risk tolerance.' };
  if (failsHandlingGate(c, input.excludeInjectables)) return { failReason: 'Requires injection (user requested non-injectable).' };
  if (failsPrepGate(c, input.prep)) return { failReason: 'Requires reconstitution equipment configuration mismatch.' };
  if (failsHalfLifeGate(c, input.requireLongHalfLife)) return { failReason: 'Does not meet long half-life requirement.' };
  if (failsPreferenceGate(c, input.preference)) return { failReason: 'Does not match preference (single/stack).' };
  if (input.excludeSlugs && input.excludeSlugs.includes(c.slug)) return { failReason: 'Manually excluded.' };

  let score = 0;
  const breakdown: ScoreBreakdown = { base: 0, keyword: 0, evidenceBonus: 0, classBonus: 0 };

  // +50 for an exact research-area tag match (or 'any' goal grants base +50 to all).
  const taggedHit = input.goal === 'any' || (Array.isArray(c.research_areas) && c.research_areas.includes(input.goal));
  if (taggedHit) {
    score += 50;
    breakdown.base = 50;
  }

  // +20 if the goal's keywords appear in category / class / mechanism / studied_for.
  let keywordBonus = 0;
  if (input.goal === 'any') {
    // If 'any' is selected, everyone gets a free keyword bump to level the playing field.
    keywordBonus = 20;
  } else {
    keywordBonus = goalMentionsBonus(input.goal, c);
  }
  
  if (keywordBonus > 0) {
    score += keywordBonus;
    breakdown.keyword = keywordBonus;
  }
  const keywordHit = keywordBonus > 0;

  // +15 if the compound's evidence tier matches the user's comfort level.
  const eBonus = evidenceComfortBonus(c.evidence_tier, input.evidenceComfort);
  score += eBonus;
  breakdown.evidenceBonus = eBonus;

  // +5 nudge for class-aligned bonuses.
  if (c.is_glp1 && (input.goal === 'metabolic' || input.goal === 'weight_management')) {
    score += 5;
    breakdown.classBonus += 5;
  }
  if (
    c.is_pro_angiogenic &&
    (input.goal === 'tissue_repair' ||
      input.goal === 'healing' ||
      input.goal === 'pain_inflammation')
  ) {
    score += 5;
    breakdown.classBonus += 5;
  }

  // If the compound has zero goal-signal at all, do not surface it. This keeps
  // the top-5 list relevant rather than padded by tier-only matches.
  if (!taggedHit && !keywordHit) return { failReason: 'Not relevant to your goal.' };

  // Budget penalty for stacks if conservative
  if (input.budget === 'conservative') {
    if (c.is_stack) {
      score -= 20; // Penalize expensive stacks
    }
    const premiumSlugs = ['semaglutide', 'tirzepatide', 'retatrutide', 'igf-1-lr3', 'igf-1-des', 'dihexa', 'mots-c'];
    if (premiumSlugs.includes(c.slug)) {
      score -= 15;
    } else {
      score += 10;
    }
  } else if (input.budget === 'standard') {
    if (c.is_stack) {
      score -= 5;
    }
    const premiumSlugs = ['tirzepatide', 'retatrutide', 'igf-1-lr3'];
    if (premiumSlugs.includes(c.slug)) {
      score -= 5;
    }
  }

  // Clamp to 0..100 for the public score field.
  const clamped = Math.max(0, Math.min(100, score));

  return {
    score: clamped,
    rationale: buildRationale(c, input.goal, taggedHit, keywordHit),
    breakdown,
  };
}

/**
 * Score the full catalog against a `MatchInput` and return the top surviving
 * candidates along with an array of excluded popular compounds and their reason.
 */
export function scoreCompounds(
  input: MatchInput,
  compounds: Compound[],
  limit: number = 12
): { matches: MatchResult[]; excluded: ExcludedCompound[] } {
  const scored: MatchResult[] = [];
  const excluded: ExcludedCompound[] = [];
  for (const c of compounds) {
    const result = scoreOne(input, c);
    if ('failReason' in result) {
      if (result.failReason !== 'Not relevant to your goal.') {
        excluded.push({ slug: c.slug, displayName: c.display_name, reason: result.failReason });
      }
      continue;
    }
    scored.push({
      slug: c.slug,
      displayName: c.display_name,
      score: result.score,
      rationale: result.rationale,
      evidenceTier: c.evidence_tier,
      riskLevel: c.risk_level,
      halfLife: c.half_life,
      molecularWeight: c.molecular_weight_da ?? null,
      isTempSensitive: c.is_temp_sensitive ?? false,
      scoreBreakdown: result.breakdown,
      isStackPartner: false, // Updated below
    });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const tierDelta = tierRank(b.evidenceTier) - tierRank(a.evidenceTier);
    if (tierDelta !== 0) return tierDelta;
    return a.displayName.localeCompare(b.displayName);
  });

  const results = scored.slice(0, limit);

  // Detect synergistic stack relationships among the top results
  for (let i = 0; i < results.length; i++) {
    for (let j = i + 1; j < results.length; j++) {
      const cA = compounds.find(c => c.slug === results[i].slug);
      const cB = compounds.find(c => c.slug === results[j].slug);
      if (cA && cB) {
        const aHasB = cA.stack_components?.includes(cB.slug);
        const bHasA = cB.stack_components?.includes(cA.slug);
        if (aHasB || bHasA) {
          results[i].isStackPartner = true;
          results[j].isStackPartner = true;
        }
      }
    }
  }

  // Sort excluded to prioritize famous compounds that users might be wondering about
  excluded.sort((a, b) => a.displayName.localeCompare(b.displayName));
  const topExcluded = excluded.slice(0, 5);

  return { matches: results, excluded: topExcluded };
}
