export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { parseRange } from '@/lib/sales-range';

const TIER_LABELS: Record<string, string> = {
  tier_1: 'Tier 1',
  tier_2: 'Tier 2',
  tier_3: 'Tier 3',
  direct: 'Direct',
};

/**
 * GET /api/admin/sales/tier-breakdown
 * Returns revenue and order counts grouped by agent tier.
 */
export async function GET(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  try {
    const supabase = createAdminClient();
    const { start, end } = parseRange(req.nextUrl.searchParams);

    const { data: orders, error: ordErr } = await supabase
      .from('orders')
      .select('total, status, agent_id, created_at')
      .gte('created_at', start.toISOString())
      .lt('created_at', end.toISOString())
      .neq('status', 'cancelled')
      .limit(100000);

    if (ordErr) throw ordErr;

    // Fetch agent tiers for all agent_ids found
    const agentIds = [...new Set((orders ?? []).map((o) => o.agent_id).filter(Boolean))] as string[];

    const tierMap: Record<string, string> = {};
    if (agentIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, tier')
        .in('id', agentIds);
      for (const p of profiles ?? []) {
        tierMap[p.id] = p.tier ?? 'none';
      }
    }

    const buckets: Record<string, { revenue: number; orders: number }> = {
      tier_1: { revenue: 0, orders: 0 },
      tier_2: { revenue: 0, orders: 0 },
      tier_3: { revenue: 0, orders: 0 },
      direct: { revenue: 0, orders: 0 },
    };

    for (const o of orders ?? []) {
      const total = Number(o.total || 0);
      const tier = o.agent_id ? (tierMap[o.agent_id] ?? 'tier_1') : 'direct';
      const key = tier === 'none' || !buckets[tier] ? 'direct' : tier;
      buckets[key].revenue += total;
      buckets[key].orders += 1;
    }

    const breakdown = Object.entries(buckets).map(([tier, v]) => ({
      tier,
      label: TIER_LABELS[tier] ?? tier,
      revenue_cents: Math.round(v.revenue * 100),
      orders: v.orders,
    }));

    return NextResponse.json({ breakdown });
  } catch (err) {
    console.error('[admin/sales/tier-breakdown] error:', err);
    return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
  }
}
