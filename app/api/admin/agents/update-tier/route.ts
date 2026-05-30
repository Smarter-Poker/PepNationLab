import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';

const VALID_TIERS = ['tier_1', 'tier_2', 'tier_3'] as const;
type AgentTier = (typeof VALID_TIERS)[number];

export async function PATCH(req: NextRequest) {
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

  const { error } = await supabase
    .from('profiles')
    .update({ tier: tier as AgentTier })
    .eq('id', agentId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Cascade new tier pricing to all of this agent's products immediately.
  // DB trigger on profiles.tier handles this, but we also call the RPC directly
  // so the catalog reflects the new cost on the very next page load.
  await supabase.rpc('recalculate_agent_product_prices', { p_agent_id: agentId }).catch(() => null);

  return NextResponse.json({ success: true, tier });
}
