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
  const results = scoreCompounds(input, compounds);
  return NextResponse.json({ results, note: RESEARCH_NOTE });
}
