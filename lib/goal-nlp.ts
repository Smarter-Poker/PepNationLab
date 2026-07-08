/**
 * Natural-language goal parsing for the "Ask Us Anything" typed-goal search.
 *
 * Turns a free-text research goal (e.g. "safe oral compound for fat loss") into the
 * structured match input the deterministic engine consumes. Extracted so it can be
 * shared by:
 *   - POST /api/research/ai-match  (legacy two-step flow: parse, then /match)
 *   - POST /api/research/match     (single-call prompt path -- one round trip)
 *
 * Research-Use-Only: this only maps prose to catalog-filter parameters. It performs
 * no external inference and stores nothing.
 */

// NLP keyword map -- mirrors GOAL_KEYWORDS in lib/match-engine.ts
const NLP_GOAL_KEYWORDS: Record<string, string[]> = {
  tissue_repair: ['repair', 'tendon', 'ligament', 'wound', 'injury', 'healing', 'cartilage', 'muscle repair', 'bpc', 'tb4', 'thymosin', 'torn', 'sprain', 'strain'],
  healing: ['healing', 'recovery', 'cytoprotection', 'regeneration', 'wound', 'gut', 'colitis', 'ulcer', 'gastrointestinal', 'stomach', 'intestine', 'leaky'],
  metabolic: ['metabolic', 'glucose', 'insulin', 'fat loss', 'lipolysis', 'obesity', 'diabetes', 'appetite', 'metabolism'],
  weight_management: ['weight', 'fat', 'appetite', 'obesity', 'lipolysis', 'satiety', 'glp', 'incretin', 'slim', 'lean', 'cutting', 'diet'],
  longevity: ['aging', 'longevity', 'senescent', 'senolytic', 'telomere', 'healthspan', 'lifespan', 'anti-aging', 'anti aging', 'age', 'epigenetic'],
  cosmetic: ['skin', 'hair', 'follicle', 'collagen', 'cosmetic', 'wrinkle', 'pigment', 'tan', 'tanning', 'melanotan', 'melanin', 'complexion', 'glow'],
  cognitive: ['cognition', 'cognitive', 'memory', 'mood', 'neuroprotection', 'brain', 'focus', 'nootropic', 'anxiety', 'depression', 'mental', 'concentration', 'clarity', 'alzheimer'],
  immune: ['immune', 'immunity', 'thymus', 'host defense', 'infection', 'antiviral', 'thymulin', 'thymosin alpha', 'ta1', 'autoimmune', 'inflammation'],
  sexual_health: ['libido', 'sexual', 'erectile', 'arousal', 'desire', 'reproductive', 'fertility', 'hormone', 'testosterone', 'estrogen', 'dysfunction'],
  performance: ['growth hormone', 'gh', 'igf', 'anabolic', 'muscle', 'lean mass', 'performance', 'strength', 'athletic', 'ghrh', 'ghrp', 'sermorelin', 'ipamorelin', 'cjc', 'ibutamoren'],
  sleep: ['sleep', 'insomnia', 'circadian', 'melatonin', 'rest', 'wake', 'tired', 'fatigue', 'night'],
  mitochondrial: ['mitochondrial', 'mitochondria', 'energy', 'cardiolipin', 'mitophagy', 'nad', 'fatigue', 'cellular energy', 'atp', 'mots-c'],
  pain_inflammation: ['pain', 'inflammation', 'anti-inflammatory', 'analgesic', 'inflammatory', 'arthritis', 'chronic pain', 'joint pain', 'swelling', 'ache'],
  gut_health: ['gut', 'gi', 'mucosal', 'ulcer', 'colitis', 'crohn', 'leaky', 'gastric', 'digestive', 'ibs', 'intestinal', 'bowel', 'microbiome'],
  bone_joint: ['bone', 'joint', 'cartilage', 'osteo', 'density', 'fracture', 'synovial', 'skeletal', 'osteoporosis', 'osteoarthritis'],
};

const INJECTABLE_EXCLUDE = ['no needle', 'no needles', 'oral', 'topical', 'sublingual', 'nasal', 'cream', 'pill', 'tablet', 'capsule', 'hate inject', 'scared of needle', 'afraid of needle', 'no inject', 'non-injectable', 'non injectable'];
const LONG_HALF_LIFE = ['once a week', 'weekly', 'long acting', 'long-acting', 'slow release', 'low frequency', 'infrequent', 'extended release', 'biweekly'];
const STACK_KW = ['stack', 'combination', 'combine', 'synergy', 'synergistic', 'multiple', 'together', 'protocol', 'blend'];
const SINGLE_KW = ['single', 'one compound', 'just one', 'only one', 'solo'];
const CONSERVATIVE_BUDGET = ['cheap', 'budget', 'affordable', 'inexpensive', 'low cost', 'cost effective', 'cost-effective', 'save money', 'economical'];
const STRICT_EVIDENCE = ['safe', 'proven', 'clinical', 'human study', 'human trial', 'fda', 'approved', 'well studied', 'established'];
const PERMISSIVE_EVIDENCE = ['cutting edge', 'research chemical', 'experimental', 'novel', 'latest', 'frontier', 'investigational', 'preclinical'];
const LOW_RISK = ['safe', 'gentle', 'low risk', 'minimal side', 'no side effect', 'well tolerated', 'conservative'];

// Very short tokens (<=3 chars, e.g. 'gh','gi','age','fat','nad') are matched on
// word boundaries so they don't false-match inside longer words ('gh' in 'weight',
// 'gi' in 'region', 'age' in 'manage'). Longer keywords and multi-word phrases keep
// substring matching (intentional prefix behavior, e.g. 'hate inject' -> 'injections').
function kwMatch(lower: string, kw: string): boolean {
  if (kw.length <= 3) {
    const esc = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${esc}\\b`, 'i').test(lower);
  }
  return lower.includes(kw);
}

function scoreGoals(text: string): Array<{ key: string; score: number }> {
  const lower = text.toLowerCase();
  const scores: Array<{ key: string; score: number }> = [];
  for (const [area, keywords] of Object.entries(NLP_GOAL_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      if (kwMatch(lower, kw)) {
        score += kw.split(' ').length;
      }
    }
    scores.push({ key: area, score });
  }
  return scores.sort((a, b) => b.score - a.score);
}

function hasAny(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some(kw => kwMatch(lower, kw));
}

export interface ParsedGoal {
  goal: string;
  goals: string[];
  evidenceComfort: 'strict_human_only' | 'investigational_ok' | 'preclinical_ok' | 'any';
  riskTolerance: 'low_only' | 'moderate_ok' | 'any';
  excludeInjectables: boolean;
  requireLongHalfLife: boolean;
  preference: 'single' | 'stack' | 'either';
  budget: 'conservative' | 'standard' | 'unlimited';
}

/**
 * Parse a free-text research goal into the structured match input. Deterministic
 * and side-effect free. The prompt is clamped to 1000 chars before scanning.
 */
export function parsePromptToMatchInput(rawPrompt: string): ParsedGoal {
  const prompt = rawPrompt.slice(0, 1000);

  const scored = scoreGoals(prompt);
  const topScore = scored[0]?.score ?? 0;

  const goal = topScore > 0 ? scored[0].key : 'any';
  const goals = topScore > 0 ? scored.filter(s => s.score > 0).map(s => s.key) : ['any'];

  let evidenceComfort: ParsedGoal['evidenceComfort'] = 'preclinical_ok';
  if (hasAny(prompt, PERMISSIVE_EVIDENCE)) evidenceComfort = 'any';
  else if (hasAny(prompt, STRICT_EVIDENCE)) evidenceComfort = 'investigational_ok';

  const riskTolerance: ParsedGoal['riskTolerance'] = hasAny(prompt, LOW_RISK) ? 'low_only' : 'any';
  const excludeInjectables = hasAny(prompt, INJECTABLE_EXCLUDE);
  const requireLongHalfLife = hasAny(prompt, LONG_HALF_LIFE);

  let preference: ParsedGoal['preference'] = 'either';
  if (hasAny(prompt, STACK_KW)) preference = 'stack';
  else if (hasAny(prompt, SINGLE_KW)) preference = 'single';

  const budget: ParsedGoal['budget'] = hasAny(prompt, CONSERVATIVE_BUDGET) ? 'conservative' : 'standard';

  return { goal, goals, evidenceComfort, riskTolerance, excludeInjectables, requireLongHalfLife, preference, budget };
}
