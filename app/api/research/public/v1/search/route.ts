/**
 * GET /api/research/public/v1/search
 * Bearer-token wrapper around the existing search_compounds_rank RPC.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { parseQuery, buildAutoWildcardTsquery } from '@/lib/research/search-parser';
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

export async function GET(req: NextRequest) {
  const t0 = Date.now();
  const auth = await validateApiKey(req.headers.get('authorization'));
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.reason ?? 'unauthorized' },
      { status: auth.reason === 'rate_limited' ? 429 : 401, headers: corsHeaders() },
    );
  }
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
  const limit = Math.max(1, Math.min(50, Number(req.nextUrl.searchParams.get('limit') ?? '20') || 20));
  const offset = Math.max(0, Number(req.nextUrl.searchParams.get('offset') ?? '0') || 0);
  if (!q) {
    return NextResponse.json({ note: RESEARCH_NOTE, results: [], total: 0 }, { headers: corsHeaders() });
  }
  const supabase = await createServiceClient();
  const parsed = parseQuery(q);
  const tsquery = buildAutoWildcardTsquery(parsed);
  const { data } = await supabase.rpc('search_compounds_rank', {
    p_tsquery: tsquery,
    p_limit: limit,
    p_offset: offset,
  });
  const rows = Array.isArray(data) ? data : [];
  const total =
    rows.length > 0 && (rows[0] as Record<string, unknown>).total_count !== undefined
      ? Number((rows[0] as Record<string, unknown>).total_count)
      : rows.length;
  const status = 200;
  await logApiRequest(auth.key_id!, '/api/research/public/v1/search', 'GET', status, Date.now() - t0, firstClientIp(req));
  return NextResponse.json({ note: RESEARCH_NOTE, results: rows, total }, { status, headers: corsHeaders() });
}
