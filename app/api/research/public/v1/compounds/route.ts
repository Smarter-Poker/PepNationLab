/**
 * GET /api/research/public/v1/compounds
 * Paginated list of compounds. Bearer-token auth via api_keys.
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

export async function GET(req: NextRequest) {
  const t0 = Date.now();
  const auth = await validateApiKey(req.headers.get('authorization'));
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.reason ?? 'unauthorized' },
      { status: auth.reason === 'rate_limited' ? 429 : 401, headers: corsHeaders() },
    );
  }

  const limit = Math.max(1, Math.min(100, Number(req.nextUrl.searchParams.get('limit') ?? '25') || 25));
  const offset = Math.max(0, Number(req.nextUrl.searchParams.get('offset') ?? '0') || 0);

  const supabase = await createServiceClient();
  const { data, count } = await supabase
    .from('compounds')
    .select(
      'slug, display_name, aliases, category, research_areas, evidence_tier, plain_summary, mechanism, half_life, pk_summary, fda_approval_year, ema_approval_year, pipeline_status, is_discontinued, is_orphan_drug, is_repurposed',
      { count: 'exact' },
    )
    .order('display_name', { ascending: true })
    .range(offset, offset + limit - 1);

  const status = 200;
  const body = {
    note: RESEARCH_NOTE,
    total: count ?? 0,
    limit,
    offset,
    results: data ?? [],
  };
  await logApiRequest(
    auth.key_id!,
    '/api/research/public/v1/compounds',
    'GET',
    status,
    Date.now() - t0,
    firstClientIp(req),
  );
  return NextResponse.json(body, { status, headers: corsHeaders() });
}
