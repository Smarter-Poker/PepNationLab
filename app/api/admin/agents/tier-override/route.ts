import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { isTierLadderV2 } from '@/lib/pricing';
import { writeAuditLog } from '@/lib/admin-audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/agents/tier-override?agentId=...
 * Current Fixed-Scale-Override state for an agent, plus whether the tier ladder
 * is live yet (so the admin UI can show a "takes effect when enabled" hint).
 */
export async function GET(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const agentId = req.nextUrl.searchParams.get('agentId') || '';
  if (!agentId) return NextResponse.json({ error: 'agentId Is Required.' }, { status: 400 });

  const svc = await createServiceClient();
  const { data } = await svc
    .from('profiles')
    .select('fixed_scale_override, locked_tier_level, house_tier_level, custom_markup_override, parent_agent_id')
    .eq('id', agentId)
    .maybeSingle();

  const { data: caller } = await svc.from('profiles').select('role').eq('id', gate.userId).maybeSingle();
  if (caller?.role !== 'admin' && data?.parent_agent_id !== gate.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Live tier config so the UI never shows stale hardcoded markup labels.
  const { data: houseTiers } = await svc
    .from('house_tiers')
    .select('level, name, markup')
    .order('level');

  // custom_markup_override is stored as a DECIMAL FRACTION (0.30 = 30%) because
  // the pricing engine computes cost = base * (1 + custom_markup_override).
  // The UI works in whole percent, so expose it multiplied by 100.
  return NextResponse.json({
    enabled: !!data?.fixed_scale_override,
    level: data?.locked_tier_level == null ? null : Number(data.locked_tier_level),
    currentLevel: data?.house_tier_level == null ? null : Number(data.house_tier_level),
    customMarkup: data?.custom_markup_override == null ? null : Math.round(Number(data.custom_markup_override) * 100 * 100) / 100,
    ladderActive: isTierLadderV2(),
    levels: (houseTiers ?? []).map((t) => ({
      level: Number(t.level),
      name: String(t.name),
      markup: Number(t.markup),
    })),
  });
}

/**
 * POST /api/admin/agents/tier-override
 * Body: { agentId: string, enabled: boolean, level?: 1..5 }
 *
 * Admin "Fixed Scale Override": hardcode an agent to a specific house tier
 * (e.g. Apex), decoupling their pricing from rolling volume. When enabled the
 * locked level is also written to house_tier_level so the UI/pricing reflect it
 * immediately. When disabled, pricing reverts to volume-driven resolution.
 */
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => ({}));
  const agentId = typeof body.agentId === 'string' ? body.agentId : '';
  const enabled = body.enabled === true;
  const level = body.level == null ? null : Number(body.level);
  // customMarkup arrives as a WHOLE PERCENT from the UI (e.g. 30 = 30%). It is
  // persisted as a decimal fraction (0.30) so the pricing engine's
  // cost = base * (1 + custom_markup_override) is correct. Range mirrors the
  // onboarding flat-markup step (0-500%).
  const customMarkupPct = body.customMarkup === '' ? null : (body.customMarkup == null ? null : Number(body.customMarkup));

  if (!agentId) {
    return NextResponse.json({ error: 'agentId Is Required.' }, { status: 400 });
  }
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(agentId)) {
    return NextResponse.json({ error: 'Invalid agentId Format.' }, { status: 400 });
  }
  if (enabled && (!Number.isInteger(level) || (level as number) < 1 || (level as number) > 5)) {
    return NextResponse.json({ error: 'A Locked Level Between 1 And 5 Is Required When Enabling The Override.' }, { status: 400 });
  }
  if (customMarkupPct !== null && (!Number.isFinite(customMarkupPct) || customMarkupPct < 0 || customMarkupPct > 500)) {
    return NextResponse.json({ error: 'Custom Markup Must Be Between 0 And 500 Percent.' }, { status: 400 });
  }
  const customMarkup = customMarkupPct === null ? null : Math.round((customMarkupPct / 100) * 10000) / 10000;

  const svc = await createServiceClient();

  const { data: target } = await svc.from('profiles').select('id, role, parent_agent_id').eq('id', agentId).maybeSingle();
  if (!target || !['agent', 'super_agent'].includes(String(target.role))) {
    return NextResponse.json({ error: 'Agent Not Found.' }, { status: 404 });
  }

  // If the user isn't an admin, they must be the super-agent who owns this sub-agent
  const { data: caller } = await svc.from('profiles').select('role').eq('id', gate.userId).maybeSingle();
  if (caller?.role !== 'admin') {
    if (target.parent_agent_id !== gate.userId) {
      return NextResponse.json({ error: 'Forbidden. You do not own this agent.' }, { status: 403 });
    }
  }

  const update: Record<string, unknown> = {
    fixed_scale_override: enabled,
    locked_tier_level: enabled ? level : null,
    custom_markup_override: customMarkup,
  };
  // Reflect the locked level immediately when enabling; otherwise leave the
  // persisted level for the recompute cron to refresh from volume.
  if (enabled) update.house_tier_level = level;
  // Locking to a standard tier (1-3) is a tier assignment: mirror profiles.tier
  // so the admin roster badge and tier semantics stay consistent with pricing.
  // A flat custom % markup intentionally leaves tier untouched - the override
  // takes precedence over tier pricing in the resolution chain.
  if (enabled && customMarkup === null && Number.isInteger(level) && (level as number) >= 1 && (level as number) <= 3) {
    update.tier = `tier_${level}`;
  }

  const { error } = await svc.from('profiles').update(update).eq('id', agentId);
  if (error) {
    console.error('[tier-override] update error:', error.message);
    return NextResponse.json({ error: 'Failed To Update Override.' }, { status: 500 });
  }

  // Tier/Markup Changes Preserve Store Retail Prices (Owner Decision
  // 2026-07-06): the DB trigger fn_recalc_agent_products_on_markup_change
  // keeps retail_price fixed and re-derives margin_percent from the new
  // wholesale cost. No retail recalculation here.

  await writeAuditLog(svc, {
    actorId: gate.userId,
    action: 'agent_tier_override_set',
    entityType: 'profile',
    entityId: agentId,
    changes: { enabled, level: enabled ? level : null, custom_markup_pct: customMarkupPct },
  });

  return NextResponse.json({ success: true, agentId, enabled, level: enabled ? level : null, customMarkup: customMarkupPct });
}
