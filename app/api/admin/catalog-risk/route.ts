import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';

export const dynamic = 'force-dynamic';

/**
 * Admin Catalog-Risk Audit.
 *
 * GET  -> ranked list of compounds scored against the Peptide Expert knowledge
 *         base (risk_level, risk_reasons, recommended_action) joined with how
 *         many product SKUs are live for each. This is the "consider restrict /
 *         remove" board so a high-risk SKU is never quietly live in a storefront.
 *
 * POST -> apply an action across every product row for a compound:
 *           restrict   -> is_active=false (hidden from storefronts, record kept)
 *           remove     -> is_banned=true + is_active=false (blocked from sale)
 *           reactivate -> is_active=true + is_banned=false
 *         Every action is recorded in admin_audit_log.
 *
 * Research-use-only platform: this protects the business from selling a
 * high-risk SKU; it never alters the factual compound profile.
 */

const RISK_RANK: Record<string, number> = { critical: 0, high: 1, moderate: 2, low: 3 };

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const service = await createServiceClient();

  const { data: compounds, error: cErr } = await service
    .from('compounds')
    .select('slug, display_name, category, evidence_tier, risk_level, risk_reasons, recommended_action');
  if (cErr) {
    return NextResponse.json({ error: 'Failed To Load Compounds.' }, { status: 500 });
  }

  const { data: products, error: pErr } = await service
    .from('products')
    .select('compound_slug, is_active, is_banned');
  if (pErr) {
    return NextResponse.json({ error: 'Failed To Load Products.' }, { status: 500 });
  }

  const counts = new Map<string, { active: number; banned: number; total: number }>();
  for (const p of products ?? []) {
    const slug = (p as { compound_slug: string | null }).compound_slug;
    if (!slug) continue;
    const c = counts.get(slug) ?? { active: 0, banned: 0, total: 0 };
    c.total += 1;
    if ((p as { is_active: boolean }).is_active) c.active += 1;
    if ((p as { is_banned: boolean }).is_banned) c.banned += 1;
    counts.set(slug, c);
  }

  const rows = (compounds ?? []).map((c) => {
    const cc = counts.get((c as { slug: string }).slug) ?? { active: 0, banned: 0, total: 0 };
    return { ...c, active_skus: cc.active, banned_skus: cc.banned, total_skus: cc.total };
  });

  rows.sort((a, b) => {
    const ra = RISK_RANK[(a as { risk_level: string }).risk_level] ?? 9;
    const rb = RISK_RANK[(b as { risk_level: string }).risk_level] ?? 9;
    if (ra !== rb) return ra - rb;
    return (a as { display_name: string }).display_name.localeCompare((b as { display_name: string }).display_name);
  });

  const summary = {
    critical: rows.filter((r) => (r as { risk_level: string }).risk_level === 'critical').length,
    high: rows.filter((r) => (r as { risk_level: string }).risk_level === 'high').length,
    moderate: rows.filter((r) => (r as { risk_level: string }).risk_level === 'moderate').length,
    low: rows.filter((r) => (r as { risk_level: string }).risk_level === 'low').length,
  };

  return NextResponse.json({ rows, summary });
}

const ACTIONS = new Set(['restrict', 'remove', 'reactivate']);

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  let body: { slug?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid Request Body.' }, { status: 400 });
  }

  const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
  const action = typeof body.action === 'string' ? body.action.trim() : '';
  if (!slug || !ACTIONS.has(action)) {
    return NextResponse.json({ error: 'A Compound And A Valid Action Are Required.' }, { status: 400 });
  }

  const service = await createServiceClient();

  const { data: compound } = await service
    .from('compounds')
    .select('slug, display_name')
    .eq('slug', slug)
    .maybeSingle();
  if (!compound) {
    return NextResponse.json({ error: 'Compound Not Found.' }, { status: 404 });
  }

  const patch =
    action === 'restrict'
      ? { is_active: false }
      : action === 'remove'
      ? { is_active: false, is_banned: true }
      : { is_active: true, is_banned: false };

  const { data: updated, error: uErr } = await service
    .from('products')
    .update(patch)
    .eq('compound_slug', slug)
    .select('id');
  if (uErr) {
    return NextResponse.json({ error: 'Failed To Apply Action. Please Try Again.' }, { status: 500 });
  }

  try {
    await service.from('admin_audit_log').insert({
      actor_id: gate.userId,
      action: `catalog_risk_${action}`,
      entity_type: 'compound',
      entity_id: slug,
      changes: {
        compound: (compound as { display_name: string }).display_name,
        action,
        affected_skus: updated?.length ?? 0,
        patch,
      },
    });
  } catch {
    /* audit failure never blocks the protective action */
  }

  return NextResponse.json({ success: true, action, affected_skus: updated?.length ?? 0 });
}
