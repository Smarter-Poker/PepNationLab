/**
 * Intent classifier for the Research Library v3 search engine.
 *
 * Pure heuristic — no LLM call, no IO. Reads a ParsedQuery (from
 * lib/research/search-parser.ts) plus an optional compound catalog and
 * returns a structured IntentMatch that /api/research/instant-answer
 * uses to build the position-0 knowledge card.
 *
 * The classifier is intentionally conservative: when in doubt, return
 * { kind: 'none', confidence: 'low' } so the caller falls back to the
 * ranked FTS results.
 */

import type { ParsedQuery } from '@/lib/research/search-parser';

export type IntentKind =
  | 'definition'
  | 'comparison'
  | 'mechanism'
  | 'reconstitution'
  | 'side_effects'
  | 'half_life'
  | 'stack'
  | 'category'
  | 'safety'
  | 'storage'
  | 'dose_conversion'
  | 'none';

export type IntentConfidence = 'high' | 'medium' | 'low';

export interface IntentMatch {
  kind: IntentKind;
  confidence: IntentConfidence;
  slugs: string[];
  area?: string;
  extra?: Record<string, string | number | boolean>;
}

export interface CatalogEntry {
  slug: string;
  display_name: string;
  aliases?: string[] | null;
  research_areas?: string[] | null;
  category?: string | null;
}

const DEFINITION_PATTERNS = [
  /^what\s+is\s+/,
  /^what\s+are\s+/,
  /^tell\s+me\s+about\s+/,
  /^define\s+/,
  /^explain\s+/,
  /^about\s+/,
];

const MECHANISM_PATTERNS = [
  /\bmechanism\b/,
  /\bhow\s+does\s+\w+\s+work\b/,
  /\bmoa\b/,
  /\bmode\s+of\s+action\b/,
  /\bpathway\b/,
  /\bagonist\b/,
  /\bantagonist\b/,
];

const RECONSTITUTION_PATTERNS = [
  /\breconstitut/,
  /\bmix(ing)?\s+ratio\b/,
  /\bbacteriostatic\b/,
  /\bdiluent\b/,
  /\bhow\s+much\s+water\b/,
];

const SIDE_EFFECT_PATTERNS = [
  /\bside\s+effect/,
  /\badverse\b/,
  /\btolerabilit/,
  /\bsafety\s+profile\b/,
  /\brisks?\s+of\b/,
];



const HALF_LIFE_PATTERNS = [
  /\bhalf[-\s]?life\b/,
  /\bt1\/2\b/,
  /\bduration\s+of\s+action\b/,
  /\bhow\s+long\s+does\s+\w+\s+last\b/,
  /\belimination\b/,
];

const STACK_PATTERNS = [
  /\bstack\b/,
  /\bcombo\b/,
  /\bcombination\b/,
  /\btogether\s+with\b/,
  /\bsynergy\b/,
];

const STORAGE_PATTERNS = [
  /\bstorage\b/,
  /\bstore\s+(at|in)\b/,
  /\brefrigerat/,
  /\bshelf\s+life\b/,
  /\bcold\s+chain\b/,
];

const SAFETY_PATTERNS = [
  /\bsafe\b/,
  /\bsafety\b/,
  /\bcontraindicat/,
  /\bblack\s+box\b/,
];

const DOSE_CONVERSION_PATTERNS = [
  /\bdose\s+conversion\b/,
  /\bconvert\s+\d+\s*(mg|mcg|iu)\b/,
  /\bunits?\s+per\s+(ml|vial)\b/,
];

const COMPARISON_TOKENS = [' vs ', ' vs. ', ' versus ', ' compared to ', ' or ', ' against '];

function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/**
 * Walk the parsed query against the catalog. A compound is matched when its
 * slug, display_name (collapsed), OR any alias (collapsed) is a substring of
 * the normalized raw query. Returns slugs in catalog order (deterministic).
 */
export function extractSlugs(
  parsed: ParsedQuery,
  catalog: CatalogEntry[],
): string[] {
  if (!catalog || catalog.length === 0) return [];
  const hay = (parsed.raw || '').toLowerCase();
  if (!hay) return [];
  const hayDense = normalizeName(hay);

  const matched: string[] = [];
  for (const c of catalog) {
    const candidates: string[] = [c.slug, c.display_name, ...(c.aliases ?? [])];
    let hit = false;
    for (const cand of candidates) {
      if (!cand) continue;
      const candLower = cand.toLowerCase();
      const candDense = normalizeName(cand);
      if (candLower.length < 2) continue;
      // Match either the literal token (handles "BPC-157") or the dense form
      // (handles "bpc157" / "GLP-1" written as "glp1").
      if (hay.includes(candLower) || (candDense.length >= 3 && hayDense.includes(candDense))) {
        hit = true;
        break;
      }
    }
    if (hit) matched.push(c.slug);
  }
  // De-dupe in case a slug + alias matched the same compound twice.
  return Array.from(new Set(matched));
}

function matchesAny(raw: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(raw));
}

function detectComparison(raw: string): boolean {
  const lower = ` ${raw.toLowerCase()} `;
  return COMPARISON_TOKENS.some((t) => lower.includes(t));
}

function detectCategoryArea(
  parsed: ParsedQuery,
): { kind: 'category'; area: string; confidence: IntentConfidence } | null {
  const areaFilter = parsed.filters.find((f) => f.field === 'research_area' || f.field === 'class');
  if (areaFilter && typeof areaFilter.value === 'string') {
    return { kind: 'category', area: areaFilter.value, confidence: 'high' };
  }
  const lower = (parsed.raw || '').toLowerCase();
  const AREA_HINTS: Array<{ phrase: string; area: string }> = [
    { phrase: 'tissue repair', area: 'tissue_repair' },
    { phrase: 'weight loss', area: 'weight_management' },
    { phrase: 'fat loss', area: 'weight_management' },
    { phrase: 'glp-1', area: 'weight_management' },
    { phrase: 'glp1', area: 'weight_management' },
    { phrase: 'longevity', area: 'longevity' },
    { phrase: 'anti-aging', area: 'longevity' },
    { phrase: 'sleep', area: 'sleep' },
    { phrase: 'cognition', area: 'cognitive' },
    { phrase: 'cognitive', area: 'cognitive' },
    { phrase: 'memory', area: 'cognitive' },
    { phrase: 'libido', area: 'sexual_health' },
    { phrase: 'gut health', area: 'gut_health' },
    { phrase: 'immune', area: 'immune' },
    { phrase: 'joint', area: 'bone_joint' },
    { phrase: 'bone density', area: 'bone_joint' },
    { phrase: 'skin', area: 'cosmetic' },
    { phrase: 'hair', area: 'cosmetic' },
    { phrase: 'mitochondrial', area: 'mitochondrial' },
    { phrase: 'inflammation', area: 'pain_inflammation' },
  ];
  for (const hint of AREA_HINTS) {
    if (lower.includes(hint.phrase)) {
      return { kind: 'category', area: hint.area, confidence: 'medium' };
    }
  }
  return null;
}

export interface ClassifyOptions {
  catalog?: CatalogEntry[];
}

export function classifyIntent(
  parsed: ParsedQuery,
  opts: ClassifyOptions = {},
): IntentMatch {
  const raw = (parsed.raw || '').toLowerCase().trim();
  if (!raw) return { kind: 'none', confidence: 'low', slugs: [] };

  const slugs = opts.catalog ? extractSlugs(parsed, opts.catalog) : [];

  // 1. Comparison — needs two or more slugs, and a comparison connective.
  if (slugs.length >= 2 && detectComparison(raw)) {
    return { kind: 'comparison', confidence: 'high', slugs: slugs.slice(0, 4) };
  }

  // 2. Reconstitution — strong verbal cue, attach the first matched slug if any.
  if (matchesAny(raw, RECONSTITUTION_PATTERNS)) {
    return {
      kind: 'reconstitution',
      confidence: slugs.length > 0 ? 'high' : 'medium',
      slugs: slugs.slice(0, 1),
    };
  }

  // 3. Side effects.
  if (matchesAny(raw, SIDE_EFFECT_PATTERNS)) {
    return {
      kind: 'side_effects',
      confidence: slugs.length > 0 ? 'high' : 'medium',
      slugs: slugs.slice(0, 1),
    };
  }



  // 5. Half life.
  if (matchesAny(raw, HALF_LIFE_PATTERNS)) {
    return {
      kind: 'half_life',
      confidence: slugs.length > 0 ? 'high' : 'medium',
      slugs: slugs.slice(0, 1),
    };
  }

  // 6. Stack / combination.
  if (matchesAny(raw, STACK_PATTERNS)) {
    return {
      kind: 'stack',
      confidence: slugs.length > 0 ? 'high' : 'medium',
      slugs: slugs.slice(0, 4),
    };
  }

  // 7. Mechanism.
  if (matchesAny(raw, MECHANISM_PATTERNS)) {
    return {
      kind: 'mechanism',
      confidence: slugs.length > 0 ? 'high' : 'medium',
      slugs: slugs.slice(0, 1),
    };
  }

  // 8. Storage / shelf life.
  if (matchesAny(raw, STORAGE_PATTERNS)) {
    return {
      kind: 'storage',
      confidence: slugs.length > 0 ? 'high' : 'medium',
      slugs: slugs.slice(0, 1),
    };
  }

  // 9. Dose conversion (calculator).
  if (matchesAny(raw, DOSE_CONVERSION_PATTERNS)) {
    return { kind: 'dose_conversion', confidence: 'medium', slugs: slugs.slice(0, 1) };
  }

  // 10. Safety (generic, weaker than side_effects).
  if (matchesAny(raw, SAFETY_PATTERNS)) {
    return {
      kind: 'safety',
      confidence: slugs.length > 0 ? 'medium' : 'low',
      slugs: slugs.slice(0, 1),
    };
  }

  // 11. Category / research area — only fires if no slug-anchored intent matched.
  const cat = detectCategoryArea(parsed);
  if (cat) {
    return { kind: 'category', area: cat.area, confidence: cat.confidence, slugs };
  }

  // 12. Definition — "what is X" plus exactly one slug.
  if (matchesAny(raw, DEFINITION_PATTERNS) && slugs.length === 1) {
    return { kind: 'definition', confidence: 'high', slugs };
  }

  // 13. Bare compound name (single slug, single term) — treat as definition
  //     with medium confidence so the knowledge panel renders.
  if (
    slugs.length === 1 &&
    parsed.phrases.length === 0 &&
    parsed.terms.length + parsed.required.length <= 3
  ) {
    return { kind: 'definition', confidence: 'medium', slugs };
  }

  return { kind: 'none', confidence: 'low', slugs };
}

export function intentLabel(kind: IntentKind): string {
  switch (kind) {
    case 'definition': return 'Definition';
    case 'comparison': return 'Comparison';
    case 'mechanism': return 'Mechanism Of Action';
    case 'reconstitution': return 'Reconstitution';
    case 'side_effects': return 'Side Effects';

    case 'half_life': return 'Half-Life';
    case 'stack': return 'Stack';
    case 'category': return 'Research Area';
    case 'safety': return 'Safety';
    case 'storage': return 'Storage';
    case 'dose_conversion': return 'Conversion';
    case 'none':
    default:
      return 'Results';
  }
}
