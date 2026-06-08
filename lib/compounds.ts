/**
 * Peptide Expert shared library (pure - no server imports, safe in client or
 * server components). Types, label maps, glossary, reconstitution + shelf-life
 * math, and the cart-warning analyzer that power the Research section.
 *
 * Research-use-only: every helper presents factual / lab-prep information.
 * Nothing here produces human dosing or medical advice.
 */

export interface CompoundHandling {
  form?: string;
  diluent?: string;
  storage_temp?: string;
  light_sensitive?: boolean;
  freeze_thaw?: string;
  reconstituted_days?: number | null;
  notes?: string;
}

export interface CompoundIdentity {
  sequence?: string;
  molecular_weight?: string;
  cas?: string;
  parent?: string;
}

export interface Compound {
  slug: string;
  display_name: string;
  aliases: string[];
  category: string | null;
  evidence_tier: string;
  compound_class: string | null;
  molecular_target: string | null;
  identity: CompoundIdentity;
  mechanism: string | null;
  studied_for: string[];
  research_areas: string[];
  plain_summary: string | null;
  eli5_summary: string | null;
  benefits: string | null;
  side_effects: string | null;
  warnings: string | null;
  handling: CompoundHandling;
  regulatory: string | null;
  wada_status: string;
  sources: string[];
  is_temp_sensitive: boolean;
  is_pro_angiogenic: boolean;
  is_glp1: boolean;
  is_stack: boolean;
  stack_components: string[];
  stack_rationale: string | null;
  risk_level: 'critical' | 'high' | 'moderate' | 'low';
  risk_reasons: string[];
  recommended_action: 'keep' | 'review' | 'restrict' | 'remove';
  reconstitution_shelf_days: number | null;
  half_life: string | null;
  measured_half_life_hours?: number | null;
  predicted_half_life_hours?: number | null;
  pk_summary: string | null;
  molecular_weight_da?: number | null;
  pubmed_citation_count?: number | null;
  active_trial_count?: number | null;
  completed_trial_count?: number | null;
  year_discovered?: number | null;
  efficacy_scores?: Record<string, number> | null;
  best_stacked_with?: string[] | null;
  typical_frequency?: string | null;
  purity_percentage?: number | null;
  coa_url?: string | null;
}

export const EVIDENCE_TIER: Record<string, { label: string; color: string; blurb: string; badgeUrl: string }> = {
  approved_drug: { label: 'Approved Drug', color: '#68D391', blurb: 'FDA and/or EMA approved with robust human trial data.', badgeUrl: '/images/badges/badge_approved_drug.png' },
  investigational: { label: 'Investigational', color: '#00E5FF', blurb: 'In active human clinical trials; not yet approved.', badgeUrl: '/images/badges/badge_investigational_drug.png' },
  preclinical: { label: 'Preclinical', color: '#F6AD55', blurb: 'Evidence is animal or in-vitro; no human efficacy data.', badgeUrl: '/images/badges/badge_preclinical.png' },
  research_chemical: { label: 'Research Compound', color: '#A8B4C0', blurb: 'No approved human use; sold for laboratory research only.', badgeUrl: '/images/badges/badge_research_compound.png' },
  cosmetic: { label: 'Cosmetic', color: '#D6BCFA', blurb: 'Recognized topical cosmetic active, not a drug.', badgeUrl: '/images/badges/badge_cosmetic.png' },
  supply: { label: 'Supply', color: '#A8B4C0', blurb: 'Reconstitution or lab-prep supply.', badgeUrl: '' },
};

export const RISK_META: Record<Compound['risk_level'], { label: string; color: string; bg: string; badgeUrl: string }> = {
  critical: { label: 'Critical Risk', color: '#FF6B6B', bg: 'rgba(229,62,62,0.16)', badgeUrl: '/images/badges/badge_risk_critical.png' },
  high: { label: 'High Risk', color: '#F6AD55', bg: 'rgba(246,173,85,0.14)', badgeUrl: '/images/badges/badge_risk_high.png' },
  moderate: { label: 'Moderate Risk', color: '#00E5FF', bg: 'rgba(0,229,255,0.12)', badgeUrl: '/images/badges/badge_risk_moderate.png' },
  low: { label: 'Low Risk', color: '#68D391', bg: 'rgba(104,211,145,0.12)', badgeUrl: '/images/badges/badge_risk_low.png' },
};

export const WADA_LABEL: Record<string, string> = {};

export const RESEARCH_AREAS: Record<string, { label: string; blurb: string }> = {
  weight_management: { label: 'Weight Management & Fat Loss', blurb: 'GLP-1 / GIP / triple-agonist incretins, AOD9604, Tesamorelin, and related fat-axis compounds.' },
  tissue_repair: { label: 'Tissue Repair', blurb: 'Compounds studied for tendon, ligament, muscle, and wound repair.' },
  healing: { label: 'Healing & Recovery', blurb: 'Compounds studied for healing, cytoprotection, and recovery.' },
  performance: { label: 'Performance & Muscle', blurb: 'Growth hormone secretagogues and anabolic pathways (Ipamorelin, Tesamorelin, CJC-1295).' },
  cosmetic: { label: 'Skin & Hair', blurb: 'Compounds studied for skin, hair, and cosmetic applications.' },
  cognitive: { label: 'Cognitive', blurb: 'Compounds studied for cognition, mood, and neuroprotection.' },
  pain_inflammation: { label: 'Pain & Inflammation', blurb: 'Cross-class anti-inflammatory and analgesic mechanisms (BPC-157, TB-500, LL-37, ARA-290).' },
  gut_health: { label: 'Gut Health & GI Repair', blurb: 'Mucosal repair, tight-junction integrity, and GI cytoprotection literature (BPC-157, KPV, VIP).' },
  sexual_health: { label: 'Sexual Health & Libido', blurb: 'Compounds studied for arousal, erectile function, and libido (PT-141, Kisspeptin).' },
  sleep: { label: 'Sleep & Circadian', blurb: 'Compounds studied for sleep architecture and circadian rhythms (Epitalon, DSIP).' },
  longevity: { label: 'Longevity', blurb: 'Compounds studied for aging, senescence, and healthspan.' },
  bone_joint: { label: 'Joint & Bone Support', blurb: 'Bone density, cartilage maintenance, and joint repair pathways (BPC-157, TB-500, GHK-Cu, IGF-1).' },
  immune: { label: 'Immune', blurb: 'Compounds studied for immune modulation and host defense.' },
  metabolic: { label: 'Metabolic', blurb: 'Compounds studied for metabolism, glucose, and fat regulation.' },
  mitochondrial: { label: 'Mitochondrial Function', blurb: 'Energy, mitophagy, and cellular optimization (MOTS-c, SS-31, 5-Amino-1MQ).' },
};

export function evidenceTier(tier: string) {
  return EVIDENCE_TIER[tier] ?? { label: tier, color: '#A8B4C0', blurb: '' };
}

export function wadaLabel(_status: string): string {
  return '';
}

export function researchAreaLabel(area: string): string {
  return RESEARCH_AREAS[area]?.label ?? area;
}

/** Reconstitution volume required to hit a target mg/mL concentration. */
export function reconstitutionVolumeMl(vialMassMg: number, targetConcentrationMgPerMl: number): number | null {
  if (!isFinite(vialMassMg) || !isFinite(targetConcentrationMgPerMl)) return null;
  if (vialMassMg <= 0 || targetConcentrationMgPerMl <= 0) return null;
  return vialMassMg / targetConcentrationMgPerMl;
}

/** Volume (mL) to draw for a given mass, after reconstitution. */
export function drawVolumeMl(vialMassMg: number, diluentMl: number, desiredMassMg: number): number | null {
  if (!isFinite(vialMassMg) || !isFinite(diluentMl) || !isFinite(desiredMassMg)) return null;
  if (vialMassMg <= 0 || diluentMl <= 0 || desiredMassMg <= 0) return null;
  const concentration = vialMassMg / diluentMl; // mg/mL
  return desiredMassMg / concentration;
}

export interface ShelfLife {
  totalDays: number;
  elapsedDays: number;
  remainingDays: number;
  expired: boolean;
  pct: number; // 0..1 remaining
}

/** Remaining shelf life of a reconstituted vial. */
export function shelfLife(reconstitutedISO: string, totalDays: number, now: Date = new Date()): ShelfLife | null {
  const start = new Date(reconstitutedISO).getTime();
  if (isNaN(start) || !totalDays || totalDays <= 0) return null;
  const dayMs = 24 * 60 * 60 * 1000;
  const elapsed = Math.max(0, Math.floor((now.getTime() - start) / dayMs));
  const remaining = Math.max(0, totalDays - elapsed);
  return {
    totalDays,
    elapsedDays: elapsed,
    remainingDays: remaining,
    expired: remaining <= 0,
    pct: Math.max(0, Math.min(1, remaining / totalDays)),
  };
}

export interface CartWarning {
  level: 'info' | 'warning' | 'danger';
  title: string;
  detail: string;
}

/**
 * Analyze a set of compounds in a cart and return contextual, research-framed
 * warnings: stacked pro-angiogenic compounds, multiple
 * GLP-1 agents, and a cold-chain shipping note for temperature-sensitive items.
 */
export function analyzeCartWarnings(compounds: Compound[]): CartWarning[] {
  const warnings: CartWarning[] = [];
  if (compounds.length === 0) return warnings;

  const proAngio = compounds.filter((c) => c.is_pro_angiogenic);
  if (proAngio.length >= 2) {
    warnings.push({
      level: 'info',
      title: 'Multiple Pro-Angiogenic Compounds',
      detail: `${proAngio.map((c) => c.display_name).join(', ')} each promote new blood-vessel growth. Research literature notes a theoretical caution about stacking pro-angiogenic agents.`,
    });
  }

  const glp1 = compounds.filter((c) => c.is_glp1);
  if (glp1.length >= 2) {
    warnings.push({
      level: 'warning',
      title: 'More Than One GLP-1 Agent',
      detail: `${glp1.map((c) => c.display_name).join(', ')} are GLP-1-class agents. Combining incretin agents compounds gastrointestinal and class-warning considerations.`,
    });
  }

  const coldChain = compounds.filter((c) => c.is_temp_sensitive);
  if (coldChain.length > 0) {
    warnings.push({
      level: 'info',
      title: 'Cold-Chain Handling',
      detail: `${coldChain.map((c) => c.display_name).join(', ')} ${coldChain.length === 1 ? 'is' : 'are'} temperature-sensitive. Refrigerate on arrival and avoid freeze-thaw cycles.`,
    });
  }

  return warnings;
}

/**
 * Glossary of terms surfaced as inline tooltips across the Research section so
 * non-specialist readers are not lost.
 */
export const GLOSSARY: Record<string, string> = {
  lyophilized: 'Freeze-dried into a stable powder that is reconstituted with a sterile liquid before use.',
  reconstitution: 'Dissolving a freeze-dried powder in a sterile diluent such as bacteriostatic water.',
  bacteriostatic: 'Containing a preservative (benzyl alcohol) that inhibits bacterial growth, allowing multi-dose use.',
  ghrh: 'Growth-Hormone-Releasing Hormone - the hypothalamic signal that tells the pituitary to release growth hormone.',
  'ghs-r1a': 'The ghrelin receptor; growth-hormone-releasing peptides act here to stimulate growth-hormone release.',
  glp1: 'Glucagon-Like Peptide-1 - an incretin hormone that increases insulin, slows gastric emptying, and reduces appetite.',
  gip: 'Glucose-dependent Insulinotropic Polypeptide - an incretin hormone that complements GLP-1.',
  incretin: 'A gut hormone (GLP-1, GIP) that boosts insulin release in response to food.',
  angiogenesis: 'The growth of new blood vessels.',
  'pro-angiogenic': 'Promoting the growth of new blood vessels.',
  senolytic: 'An agent that selectively clears senescent (aged, non-dividing) cells.',
  telomerase: 'The enzyme that maintains the protective caps (telomeres) on the ends of chromosomes.',
  cardiolipin: 'A lipid in the inner mitochondrial membrane essential to energy production.',
  mitophagy: 'The cellular cleanup process that removes damaged mitochondria.',
  melanocortin: 'A receptor family (MC1R-MC5R) involved in pigmentation, appetite, and sexual function.',
  amylin: 'A pancreatic hormone that promotes satiety and slows gastric emptying.',
  vial: 'The sealed glass container holding a freeze-dried peptide.',
  subcutaneous: 'Beneath the skin.',
  'half-life': 'The time for half of a substance to be cleared from circulation.',
};

export function findGlossaryTerms(text: string): string[] {
  const lower = text.toLowerCase();
  return Object.keys(GLOSSARY).filter((term) => lower.includes(term));
}

/** A lightweight reference to a related compound for See-Also linking. */
export interface RelatedCompoundRef {
  slug: string;
  display_name: string;
  category: string | null;
  evidence_tier: string;
  /** Primary research areas - included so callers can render area pills without a second lookup. */
  research_areas: string[];
  /** True when this compound explicitly lists the target in its best_stacked_with field (or vice-versa). */
  is_best_stack_match: boolean;
}

/**
 * Rank other compounds by relatedness to `target`: shared compound_class and
 * research areas weigh most, then stack relationships, then shared category.
 * Returns the top `limit` matches (default 6), excluding the target itself.
 */
export function relatedCompounds(
  target: Compound,
  all: Compound[],
  limit = 6,
): RelatedCompoundRef[] {
  const targetAreas = new Set((target.research_areas || []).map((a) => a.toLowerCase()));
  const targetStack = new Set((target.stack_components || []).map((s) => s.toLowerCase()));
  // Normalised slugs/names from best_stacked_with on the target
  const targetBestWith = new Set(
    (target.best_stacked_with || []).map((s) => s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))
  );

  const score = (c: Compound): number => {
    if (c.slug === target.slug) return -1;
    let s = 0;

    // Shared research areas (+3 each)
    for (const a of c.research_areas || []) if (targetAreas.has(a.toLowerCase())) s += 3;

    // Same compound class (+4)
    if (c.compound_class && target.compound_class && c.compound_class === target.compound_class) s += 4;

    // Same product category (+1)
    if (c.category && target.category && c.category === target.category) s += 1;

    // Overlapping stack components (+2)
    if ((c.stack_components || []).some((x) => targetStack.has(x.toLowerCase()))) s += 2;

    // Stack component cross-reference (+3)
    const cName = c.display_name.toLowerCase();
    if (
      (target.stack_components || []).some((x) => x.toLowerCase() === c.slug || x.toLowerCase() === cName) ||
      (c.stack_components || []).some((x) => x.toLowerCase() === target.slug)
    ) {
      s += 3;
    }

    // best_stacked_with is the strongest signal - explicitly curated pairs (+7 each direction)
    const cNorm = c.slug.toLowerCase();
    const cNameNorm = cName.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (targetBestWith.has(cNorm) || targetBestWith.has(cNameNorm)) s += 7;
    const cBestWith = new Set(
      (c.best_stacked_with || []).map((s2) => s2.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))
    );
    const targetNorm = target.slug.toLowerCase();
    const targetNameNorm = target.display_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (cBestWith.has(targetNorm) || cBestWith.has(targetNameNorm)) s += 7;

    return s;
  };

  return all
    .map((c) => ({ c, s: score(c) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.c.display_name.localeCompare(b.c.display_name))
    .slice(0, limit)
    .map((x) => {
      const cNorm = x.c.slug.toLowerCase();
      const cNameNorm = x.c.display_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const isBestStack = targetBestWith.has(cNorm) || targetBestWith.has(cNameNorm) ||
        (x.c.best_stacked_with || []).some((s2) => {
          const n = s2.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
          return n === target.slug || n === target.display_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        });
      return {
        slug: x.c.slug,
        display_name: x.c.display_name,
        category: x.c.category,
        evidence_tier: x.c.evidence_tier,
        research_areas: x.c.research_areas || [],
        is_best_stack_match: isBestStack,
      };
    });
}

export interface StackAnalysis {
  synergyIndex: number;
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  synergyExplanation: string;
}

export function calculateStackSynergy(compounds: Compound[], isOfficialStack = false): StackAnalysis {
  if (compounds.length <= 1) {
    return {
      synergyIndex: 0,
      riskLevel: compounds.length === 1 ? compounds[0].risk_level : 'low',
      synergyExplanation: 'Select at least two compounds to calculate synergy and cumulative stack risk.'
    };
  }

  let score = 50;
  let sharedAreasCount = 0;
  const areas = new Set<string>();
  
  for (const c of compounds) {
    for (const a of c.research_areas || []) {
      if (areas.has(a.toLowerCase())) {
        sharedAreasCount++;
      } else {
        areas.add(a.toLowerCase());
      }
    }
  }
  score += sharedAreasCount * 15;

  let hasRelationship = false;
  for (let i = 0; i < compounds.length; i++) {
    for (let j = i + 1; j < compounds.length; j++) {
      const c1 = compounds[i];
      const c2 = compounds[j];
      if (c1.best_stacked_with?.some(s => s.toLowerCase() === c2.slug || s.toLowerCase() === c2.display_name.toLowerCase())) {
        hasRelationship = true;
      }
      if (c1.stack_components?.some(s => s.toLowerCase() === c2.slug || s.toLowerCase() === c2.display_name.toLowerCase())) {
        hasRelationship = true;
      }
    }
  }
  if (hasRelationship) {
    score += 20;
  }

  if (isOfficialStack) {
    score = Math.max(88, Math.min(99, 88 + (sharedAreasCount * 2) + (compounds.length * 2)));
  }

  const isMultipleGlp1 = compounds.filter(c => c.is_glp1).length >= 2;
  const isMultipleProAngio = compounds.filter(c => c.is_pro_angiogenic).length >= 2;
  
  if (isMultipleGlp1) score -= 25;
  if (isMultipleProAngio) score -= 15;

  const maxRisk = compounds.reduce((acc, c) => {
    const levels: Record<string, number> = { low: 1, moderate: 2, high: 3, critical: 4 };
    if (levels[c.risk_level] > levels[acc]) return c.risk_level;
    return acc;
  }, 'low' as Compound['risk_level']);

  if (maxRisk === 'critical') score -= 20;
  else if (maxRisk === 'high') score -= 10;

  let finalScore = Math.max(0, Math.min(100, score));
  if (isOfficialStack) {
    finalScore = Math.max(88, Math.min(99, finalScore));
  }

  let riskLevel = maxRisk;
  if (isMultipleGlp1) {
    riskLevel = 'critical';
  } else if (isMultipleProAngio && (riskLevel === 'low' || riskLevel === 'moderate')) {
    riskLevel = 'moderate';
  }

  let explanation = '';
  if (finalScore >= 80) {
    explanation = 'Excellent synergy. These compounds share documented complementary pathways and are highly recommended for combined research protocols.';
  } else if (finalScore >= 50) {
    explanation = 'Moderate synergy. The compounds address similar research areas but lack direct stacking documentation in standard literature.';
  } else {
    explanation = 'Low synergy. These compounds have unrelated mechanism profiles or carry overlapping pathway contraindications (e.g. incretin redundancy).';
  }

  return {
    synergyIndex: finalScore,
    riskLevel,
    synergyExplanation: explanation
  };
}
