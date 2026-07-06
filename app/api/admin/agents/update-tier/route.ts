import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { withIdempotency, readIdempotencyKey } from '@/lib/idempotency';

const VALID_TIERS = ['tier_1', 'tier_2', 'tier_3'] as const;
type AgentTier = (typeof VALID_TIERS)[number];

export async function PATCH(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => ({}));
  const { agentId, tier } = body as { agentId?: string; tier?: string };

  if (!agentId || !tier) {
    return NextResponse.json({ error: 'agentId and tier are required' }, { status: 400 });
  }

  if (!VALID_TIERS.includes(tier as AgentTier)) {
    return NextResponse.json(
      { error: `Invalid tier. Must be one of: ${VALID_TIERS.join(', ')}` },
      { status: 400 },
    );
  }

  return withIdempotency({
    userId: gate.userId,
    route: '/api/admin/agents/update-tier',
    key: readIdempotencyKey(req),
    request: { agentId, tier },
    handler: async () => {
  const supabase = await createServiceClient();

  // Confirm target is actually an agent (not another admin)
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', agentId)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  if (profile.role === 'admin') {
    return NextResponse.json({ error: 'Cannot change tier of an admin account' }, { status: 403 });
  }

  const locked_tier_level = tier ? parseInt(tier.replace('tier_', ''), 10) : null;

  // Assigning a tier means tier pricing governs: lock the house level to the
  // tier (fixed_scale_override), mirror it into house_tier_level for the UI,
  // and clear any stale flat custom_markup_override so the agent's wholesale
  // cost is exactly base_cost x the admin-configured tier multiplier.
  const { error } = await supabase
    .from('profiles')
    .update({
      tier: tier as AgentTier,
      locked_tier_level,
      fixed_scale_override: true,
      house_tier_level: locked_tier_level,
      custom_markup_override: null,
    })
    .eq('id', agentId);

  if (error) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }

  // Tier Changes Preserve Store Retail Prices (Owner Decision 2026-07-06):
  // The DB trigger fn_recalc_agent_products_on_markup_change keeps every
  // retail_price fixed and re-derives margin_percent from the new wholesale
  // cost, so an upgraded agent simply earns more profit per sale. Do NOT call
  // recalculate_agent_product_prices here -- that would recompute retail from
  // the rounded margin and could drift prices by cents.

  return NextResponse.json({ success: true, tier });
    },
  });
}
