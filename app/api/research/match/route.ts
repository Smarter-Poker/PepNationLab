/**
 * POST /api/research/match — Match Me To A Peptide.
 *
 * Public route. No authentication. The endpoint accepts a structured form
 * payload describing the researcher's stated goal and risk preferences, runs
 * the deterministic `scoreCompounds` engine over the compound catalog, and
 * returns the top 5 candidates with plain-English rationales.
 *
 * Research-Use-Only: results are factual catalog ranking; nothing here is
 * dosing or medical advice.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getAllCompounds } from '@/lib/compounds-server';
import {
  scoreCompounds,
  type MatchInput,
  type EvidenceComfort,
  type WadaConstraint,
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
const WADA_VALUES: WadaConstraint[] = ['wada_permitted_only', 'no_constraint'];
const RISK_VALUES: RiskTolerance[] = ['low_only', 'moderate_ok', 'any'];

function isEvidenceComfort(v: unknown): v is EvidenceComfort {
  return typeof v === 'string' && (EVIDENCE_VALUES as string[]).includes(v);
}

function isWadaConstraint(v: unknown): v is WadaConstraint {
  return typeof v === 'string' && (WADA_VALUES as string[]).includes(v);
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
  if (!isWadaConstraint(obj.wadaConstraint)) return null;
  if (!isRiskTolerance(obj.riskTolerance)) return null;
  return {
    goal: obj.goal,
    evidenceComfort: obj.evidenceComfort,
    wadaConstraint: obj.wadaConstraint,
    riskTolerance: obj.riskTolerance,
    preference: typeof obj.preference === 'string' && ['single', 'stack', 'either'].includes(obj.preference) ? obj.preference as 'single' | 'stack' | 'either' : undefined,
    excludeInjectables: typeof obj.excludeInjectables === 'boolean' ? obj.excludeInjectables : undefined,
    requireLongHalfLife: typeof obj.requireLongHalfLife === 'boolean' ? obj.requireLongHalfLife : undefined,
    excludeSlugs: Array.isArray(obj.excludeSlugs) ? obj.excludeSlugs.filter((s) => typeof s === 'string') : undefined,
    budget: typeof obj.budget === 'string' && ['conservative', 'standard', 'unlimited'].includes(obj.budget) ? obj.budget as 'conservative' | 'standard' | 'unlimited' : undefined,
  };
}

export async function POST(req: NextRequest) {
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON Body', note: RESEARCH_NOTE },
      { status: 400 },
    );
  }

  const candidate = (body as { input?: unknown } | null)?.input ?? body;
  const input = parseInput(candidate);
  if (!input) {
    return NextResponse.json(
      {
        error:
          'Invalid Match Input. Expected { goal, evidenceComfort, wadaConstraint, riskTolerance }.',
        note: RESEARCH_NOTE,
      },
      { status: 400 },
    );
  }

  const compounds = await getAllCompounds();
  const scoredData = scoreCompounds(input, compounds);

  // Analytics log to db (awaited to prevent serverless termination)
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from('research_match_analytics')
    .insert({
      goal: input.goal,
      evidence_comfort: input.evidenceComfort,
      wada_constraint: input.wadaConstraint,
      risk_tolerance: input.riskTolerance,
      exclude_injectables: input.excludeInjectables ?? false,
      require_long_half_life: input.requireLongHalfLife ?? false,
      preference: input.preference ?? 'either',
    });
  if (error) console.error('[Match Analytics] Failed to insert', error);

  return NextResponse.json({ 
    results: scoredData.matches, 
    excluded: scoredData.excluded, 
    note: RESEARCH_NOTE 
  });
}
