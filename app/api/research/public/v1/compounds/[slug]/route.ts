/**
 * GET /api/research/public/v1/compounds/:slug
 * Full compound JSON including references, trials, and orthologs.
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const t0 = Date.now();
  const auth = await validateApiKey(req.headers.get('authorization'));
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.reason ?? 'unauthorized' },
      { status: auth.reason === 'rate_limited' ? 429 : 401, headers: corsHeaders() },
    );
  }
  const { slug } = await params;
  const cleaned = (slug || '').toLowerCase().trim();
  if (!cleaned) {
    return NextResponse.json({ error: 'missing_slug' }, { status: 400, headers: corsHeaders() });
  }
  const supabase = await createServiceClient();
  const [compoundResp, refsResp, trialsResp, orthologsResp] = await Promise.all([
    supabase.from('compounds').select('id, slug, display_name, aliases, category, evidence_tier, compound_class, molecular_target, identity, mechanism, studied_for, research_areas, benefits, side_effects, warnings, handling, regulatory, wada_status, sources, plain_summary, is_temp_sensitive, is_pro_angiogenic, is_glp1, is_stack, stack_components, stack_rationale, reconstitution_shelf_days, best_stacked_with, efficacy_scores, eli5_summary, quality_score, updated_at, created_at').eq('slug', cleaned).maybeSingle(),
    supabase.from('compound_references').select('*').eq('compound_slug', cleaned).order('created_at', { ascending: false }).limit(100),
    supabase.from('compound_clinical_trials').select('*').eq('compound_slug', cleaned).limit(50),
    supabase.from('compound_orthologs').select('*').eq('compound_slug', cleaned).limit(50),
  ]);
  if (!compoundResp.data) {
    const status = 404;
    await logApiRequest(auth.key_id!, `/api/research/public/v1/compounds/${cleaned}`, 'GET', status, Date.now() - t0, firstClientIp(req));
    return NextResponse.json({ error: 'not_found' }, { status, headers: corsHeaders() });
  }
  const body = {
    note: RESEARCH_NOTE,
    compound: compoundResp.data,
    references: refsResp.data ?? [],
    clinical_trials: trialsResp.data ?? [],
    orthologs: orthologsResp.data ?? [],
  };
  const status = 200;
  await logApiRequest(auth.key_id!, `/api/research/public/v1/compounds/${cleaned}`, 'GET', status, Date.now() - t0, firstClientIp(req));
  return NextResponse.json(body, { status, headers: corsHeaders() });
}
