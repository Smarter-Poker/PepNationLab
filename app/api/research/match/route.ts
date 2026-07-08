/**
 * POST /api/research/match - Match Me To A Peptide.
 *
 * Public route. No authentication. The endpoint accepts a structured form
 * payload describing the researcher's stated goal and risk preferences, runs
 * the deterministic `scoreCompounds` engine over the compound catalog, and
 * returns the top candidates (up to 12) with plain-English rationales.
 *
 * Research-Use-Only: results are factual catalog ranking; nothing here is
 * dosing or medical advice.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getAllCompounds } from '@/lib/compounds-server';
import { assertSameOrigin } from '@/lib/csrf';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { parsePromptToMatchInput } from '@/lib/goal-nlp';
import {
  scoreCompounds,
  type MatchInput,
  type MatchResult,
  type ExcludedCompound,
  type EvidenceComfort,
  type RiskTolerance,
} from '@/lib/match-engine';

export const dynamic = 'force-dynamic';

const RESEARCH_NOTE =
  'For Research Use Only. This Restates Stored Laboratory Facts And Is Not Dosing Or Medical Advice.';

const EVIDENCE_VALUES: EvidenceComfort[] = [
  'strict_human_only',
  'investigational_ok',
  'preclinical_ok',
  'any',
];
const RISK_VALUES: RiskTolerance[] = ['low_only', 'moderate_ok', 'any'];

function isEvidenceComfort(v: unknown): v is EvidenceComfort {
  return typeof v === 'string' && (EVIDENCE_VALUES as string[]).includes(v);
}

function isRiskTolerance(v: unknown): v is RiskTolerance {
  return typeof v === 'string' && (RISK_VALUES as string[]).includes(v);
}

function parseInput(raw: unknown): MatchInput | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.goal !== 'string' || obj.goal.length === 0 || obj.goal.length > 255) {
    return null;
  }
  if (!isEvidenceComfort(obj.evidenceComfort)) return null;
  if (!isRiskTolerance(obj.riskTolerance)) return null;
  return {
    goal: obj.goal,
    goals: Array.isArray(obj.goals) ? obj.goals.filter((g): g is string => typeof g === 'string') : undefined,
    evidenceComfort: obj.evidenceComfort,
    riskTolerance: obj.riskTolerance,
    preference: typeof obj.preference === 'string' && ['single', 'stack', 'either'].includes(obj.preference) ? obj.preference as 'single' | 'stack' | 'either' : undefined,
    excludeInjectables: typeof obj.excludeInjectables === 'boolean' ? obj.excludeInjectables : undefined,
    requireLongHalfLife: typeof obj.requireLongHalfLife === 'boolean' ? obj.requireLongHalfLife : undefined,
    excludeSlugs: Array.isArray(obj.excludeSlugs) ? obj.excludeSlugs.filter((s) => typeof s === 'string') : undefined,
    budget: typeof obj.budget === 'string' && ['conservative', 'standard', 'unlimited'].includes(obj.budget) ? obj.budget as 'conservative' | 'standard' | 'unlimited' : undefined,
  };
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const ip = getClientIp(req);
  const rl = await rateLimit({ key: 'research_match', limit: 20, windowSeconds: 60, identifier: ip });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON Body', note: RESEARCH_NOTE },
      { status: 400 },
    );
  }

  // Accept either a structured { input } (or bare structured body) or a raw
  // { prompt } which we parse server-side -- letting the typed-goal search hit
  // this endpoint in a single round trip instead of pre-calling /ai-match.
  const rawBody = body as { input?: unknown; prompt?: unknown } | null;
  const input =
    rawBody && typeof rawBody.prompt === 'string' && rawBody.prompt.trim()
      ? parseInput(parsePromptToMatchInput(rawBody.prompt))
      : parseInput(rawBody?.input ?? body);
  if (!input) {
    return NextResponse.json(
      {
        error:
          'Invalid Match Input. Expected { goal, evidenceComfort, riskTolerance }.',
        note: RESEARCH_NOTE,
      },
      { status: 400 },
    );
  }

  const compounds = await getAllCompounds();

  const goals = input.goals && input.goals.length > 0 ? input.goals : [input.goal];
  const allMatchesMap = new Map<string, MatchResult>();
  const allExcludedMap = new Map<string, ExcludedCompound>();

  for (const g of goals) {
    const singleInput = { ...input, goal: g };
    const scoredData = scoreCompounds(singleInput, compounds);

    for (const match of scoredData.matches) {
      const existing = allMatchesMap.get(match.slug);
      if (!existing || match.score > existing.score) {
        allMatchesMap.set(match.slug, match);
      }
    }

    for (const excl of scoredData.excluded) {
      if (!allExcludedMap.has(excl.slug)) {
        allExcludedMap.set(excl.slug, excl);
      }
    }
  }

  const matches = Array.from(allMatchesMap.values())
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.displayName.localeCompare(b.displayName);
    })
    .slice(0, 12);

  // Detect synergistic stack relationships among the top results
  for (let i = 0; i < matches.length; i++) {
    for (let j = i + 1; j < matches.length; j++) {
      const cA = compounds.find(c => c.slug === matches[i].slug);
      const cB = compounds.find(c => c.slug === matches[j].slug);
      if (cA && cB) {
        // Match the engine's own stack logic: case-insensitive, by slug OR display
        // name. The previous case-sensitive slug-only check under-detected stacks.
        const aComp = (cA.stack_components || []).map(s => s.toLowerCase());
        const bComp = (cB.stack_components || []).map(s => s.toLowerCase());
        const aHasB = aComp.includes(cB.slug.toLowerCase()) || (!!cB.display_name && aComp.includes(cB.display_name.toLowerCase()));
        const bHasA = bComp.includes(cA.slug.toLowerCase()) || (!!cA.display_name && bComp.includes(cA.display_name.toLowerCase()));
        if (aHasB || bHasA) {
          matches[i].isStackPartner = true;
          matches[j].isStackPartner = true;
        }
      }
    }
  }

  const excluded = Array.from(allExcludedMap.values()).slice(0, 5);

  // Fire-and-forget analytics: never block the response on a best-effort BI
  // insert. Failures are logged, not surfaced. `wada_constraint` is a legacy
  // NOT NULL column kept satisfied with 'none'; budget + result_count were
  // added in migration 20260708170000 for richer aggregate reporting.
  const supabase = await createServiceClient();
  void supabase
    .from('research_match_analytics')
    .insert({
      goal: input.goal,
      evidence_comfort: input.evidenceComfort,
      risk_tolerance: input.riskTolerance,
      exclude_injectables: input.excludeInjectables ?? false,
      require_long_half_life: input.requireLongHalfLife ?? false,
      preference: input.preference ?? 'either',
      budget: input.budget ?? 'standard',
      result_count: matches.length,
      wada_constraint: 'none',
    })
    .then(({ error }) => {
      if (error) console.error('[Match Analytics] Failed to insert', error);
    });

  return NextResponse.json({
    results: matches,
    excluded: excluded,
    note: RESEARCH_NOTE,
  });
}
