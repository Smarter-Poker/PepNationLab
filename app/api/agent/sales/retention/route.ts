
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAgentOrAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export interface ResearcherRow {
  user_id: string;
  name: string;
  last_order_date: string;
  days_since_order: number;
  total_spent: number;
}

export interface ChampionRow {
  user_id: string;
  name: string;
  total_orders: number;
  total_spent: number;
  avg_order_value: number;
  member_since: string;
}

/**
 * GET /api/agent/sales/retention
 *
 * Returns researcher retention stats for the authenticated agent.
 *
 * Response shape:
 *   {
 *     retention_rate: number,   // % of researchers who reordered within 90 days of first order
 *     at_risk: ResearcherRow[], // last order > 45 days ago, ordered by days_since_order DESC
 *     champions: ChampionRow[]  // top 5 by total_spent DESC
 *   }
 */
export async function GET() {
  try {
    const gate = await requireAgentOrAdmin();
    if (!gate.ok) return gate.response;

    const supabase = createAdminClient();
    const agentId = gate.user.id;

    // Pull all collected orders for this agent (exclude wholesale restocks and self-buys).
    // Self-buy orders have agent_id = buyer_id (the agent buying from their own store).
    // Including them inflates retention metrics and makes the agent appear as their own
    // dormant/champion researcher. Exclude them here; they show in the Sales tab instead.
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('buyer_id, total, created_at, profiles!orders_buyer_id_fkey(id, full_name, email, created_at)')
      .eq('agent_id', agentId)
      .neq('buyer_id', agentId)
      .eq('is_wholesale_restock', false)
      .in('status', ['approved_ship', 'approved_pickup', 'in_fulfillment', 'shipped', 'delivered'])
      .order('created_at', { ascending: true });

    if (ordersError) {
      console.error('Retention route orders error:', ordersError);
      return NextResponse.json({ error: 'An Unexpected Error Occurred.' }, { status: 500 });
    }

    const rows = orders ?? [];

    // Aggregate per buyer
    type BuyerAgg = {
      user_id: string;
      name: string;
      member_since: string;
      orders: { date: string; amount: number }[];
      total_spent: number;
    };

    const buyers = new Map<string, BuyerAgg>();

    for (const o of rows) {
      const buyerId = o.buyer_id as string;
      if (!buyerId) continue;

      const profile = Array.isArray(o.profiles) ? o.profiles[0] : o.profiles;
      const name: string = (profile as any)?.full_name || (profile as any)?.email || 'Unknown Researcher';
      const memberSince: string = (profile as any)?.created_at || o.created_at;

      const existing = buyers.get(buyerId);
      if (!existing) {
        buyers.set(buyerId, { // @ts-ignore
          user_id: buyerId,
          name,
          member_since: memberSince,
          orders: [{ date: o.created_at, amount: Number(o.total) || 0 }], // @ts-ignore
          total_spent: Number(o.total) || 0,
        });
      } else {
        // @ts-expect-error Database schema mismatch from generated types
        existing.orders.push({ date: o.created_at, amount: Number(o.total) || 0 });
        existing.total_spent += Number(o.total) || 0;
      }
    }

    const nowMs = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;

    // Retention rate: % of researchers with >= 2 orders where second order
    // was placed within 90 days of the first order
    let eligibleCount = 0;
    let retainedCount = 0;
    const atRiskList: ResearcherRow[] = [];
    const championsRaw: { user_id: string; name: string; total_orders: number; total_spent: number; avg_order_value: number; member_since: string }[] = [];

    for (const b of buyers.values()) {
      const sortedOrders = [...b.orders].sort((x, y) => new Date(x.date).getTime() - new Date(y.date).getTime());
      const lastOrder = sortedOrders[sortedOrders.length - 1];
      const lastOrderMs = new Date(lastOrder.date).getTime();
      const daysSinceOrder = Math.floor((nowMs - lastOrderMs) / DAY_MS);

      // Retention calculation
      if (sortedOrders.length >= 2) {
        eligibleCount += 1;
        const firstMs = new Date(sortedOrders[0].date).getTime();
        const secondMs = new Date(sortedOrders[1].date).getTime();
        const daysToReorder = (secondMs - firstMs) / DAY_MS;
        if (daysToReorder <= 90) retainedCount += 1;
      }

      // At-risk: last order > 45 days ago
      if (daysSinceOrder > 45) {
        atRiskList.push({
          user_id: b.user_id,
          name: b.name,
          last_order_date: lastOrder.date,
          days_since_order: daysSinceOrder,
          total_spent: Number(b.total_spent.toFixed(2)),
        });
      }

      // Champions candidates
      championsRaw.push({
        user_id: b.user_id,
        name: b.name,
        total_orders: sortedOrders.length,
        total_spent: Number(b.total_spent.toFixed(2)),
        avg_order_value: sortedOrders.length > 0 ? Number((b.total_spent / sortedOrders.length).toFixed(2)) : 0,
        member_since: b.member_since,
      });
    }

    const retentionRate = eligibleCount > 0 ? Math.round((retainedCount / eligibleCount) * 100) : 0;

    atRiskList.sort((a, b) => b.days_since_order - a.days_since_order);
    championsRaw.sort((a, b) => b.total_spent - a.total_spent);
    const champions: ChampionRow[] = championsRaw.slice(0, 5);

    return NextResponse.json({ retention_rate: retentionRate, at_risk: atRiskList, champions });
  } catch (err) {
    console.error('Retention API error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
