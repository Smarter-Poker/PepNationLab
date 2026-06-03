/**
 * GET|POST /api/research/public/v1/match
 * Bearer-token wrapper around the existing match engine.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  validateApiKey,
  logApiRequest,
  corsHeaders,
  firstClientIp,
} from '@/lib/research/api-keys';

export const dynamic = 'force-dynamic';

const RESEARCH_NOTE =
  'For Research Use Only. This Restates Stored Laboratory Facts And Is Not Dosing Or Medical Advice.';

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

async function handle(req: NextRequest, payload: { goal?: string; comfort?: string; wada?: string; risk?: string; limit?: number }) {
  const t0 = Date.now();
  const auth = await validateApiKey(req.headers.get('authorization'));
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.reason ?? 'unauthorized' },
      { status: auth.reason === 'rate_limited' ? 429 : 401, headers: corsHeaders() },
    );
  }
  const supabase = await createServiceClient();
  const limit = Math.max(1, Math.min(25, Number(payload.limit ?? 10)));
  const { data } = await supabase.rpc('match_compounds', {
    p_goal: (payload.goal ?? '').slice(0, 256),
    p_comfort: (payload.comfort ?? '').slice(0, 32),
    p_wada: (payload.wada ?? '').slice(0, 32),
    p_risk: (payload.risk ?? '').slice(0, 32),
    p_limit: limit,
  });
  const status = 200;
  await logApiRequest(auth.key_id!, '/api/research/public/v1/match', req.method, status, Date.now() - t0, firstClientIp(req));
  return NextResponse.json({ note: RESEARCH_NOTE, results: data ?? [] }, { status, headers: corsHeaders() });
}

export async function GET(req: NextRequest) {
  return handle(req, {
    goal: req.nextUrl.searchParams.get('goal') ?? '',
    comfort: req.nextUrl.searchParams.get('comfort') ?? '',
    wada: req.nextUrl.searchParams.get('wada') ?? '',
    risk: req.nextUrl.searchParams.get('risk') ?? '',
    limit: Number(req.nextUrl.searchParams.get('limit') ?? '10') || 10,
  });
}

export async function POST(req: NextRequest) {
  let body: { goal?: string; comfort?: string; wada?: string; risk?: string; limit?: number } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    // fall through with empty body
  }
  return handle(req, body);
}
