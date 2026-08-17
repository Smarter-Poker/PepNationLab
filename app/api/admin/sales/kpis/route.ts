export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { parseRange, priorPeriod } from '@/lib/sales-range';

/**
 * GET /api/admin/sales/kpis
 * Returns platform-wide KPIs with period-over-period deltas.
 * Uses the same profit formula as agent_sales_kpis RPC:
 *   profit = total - discount_amount - shipping_cost
 */
export async function GET(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  try {
    const supabase = createAdminClient();
    const { start, end } = parseRange(req.nextUrl.searchParams);
    const prior = priorPeriod(start, end);

    async function fetchPeriod(from: Date, to: Date) {
      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          id, total, status, agent_id, created_at, shipping_cost, discount_amount,
          order_items ( quantity, unit_cost_price, unit_retail_price, unit_super_agent_cost, unit_house_cost, products ( base_cost, house_cost ) )
        `)
        .gte('created_at', from.toISOString())
        .lt('created_at', to.toISOString())
        .limit(100000);

      if (error) throw error;

      const rows = orders ?? [];
      const live = rows.filter((o) => o.status !== 'cancelled');
      const cancelled = rows.filter((o) => o.status === 'cancelled');

      let revenue = 0;
      let profit = 0;
      let directRevenue = 0;
      let agentRevenue = 0;
      const agentSet = new Set<string>();

      for (const o of live) {
        let orderHouseRevenue = 0;
        let orderHouseProfit = 0;

        for (const item of ((o as any).order_items || [])) {
           const qty = Number(item.quantity || 1);
           const ucp = Number(item.unit_cost_price || 0);
           const urp = Number(item.unit_retail_price || 0);
           // Chained orders (a super agent in the billing chain): the house
           // collects unit_super_agent_cost from the super; unit_cost_price -
           // unit_super_agent_cost is the SUPER's markup profit, not ours.
           const usc = Number(item.unit_super_agent_cost || 0);
           // unit_house_cost (top-of-chain cost, captured at checkout) is the
           // correct house collect under 3+ level chains, where usc only
           // reflects the immediate parent, not the true top ancestor.
           // Historical rows predate the column (NULL) and are 2-level sales,
           // where usc IS the correct house collect -- the usc fallback keeps
           // them unchanged.
           const uhc = Number(item.unit_house_cost || 0);
           const houseCollect = uhc > 0 ? uhc : (usc > 0 ? usc : ucp);
           const baseCostPer10 = Number(item.products?.house_cost || item.products?.base_cost || 0);
           const baseCostPerVial = baseCostPer10 / 10;
           
           if (o.agent_id) {
             orderHouseRevenue += houseCollect * qty;
             orderHouseProfit += (houseCollect - baseCostPerVial) * qty;
           } else {
             orderHouseRevenue += urp * qty;
             orderHouseProfit += (urp - baseCostPerVial) * qty;
           }
        }
        
        const shipping = Number(o.shipping_cost || 0);
        orderHouseRevenue += shipping;
        
        if (!o.agent_id) {
           const discount = Number(o.discount_amount || 0);
           orderHouseRevenue -= discount;
           orderHouseProfit -= discount;
           if (orderHouseRevenue < 0) orderHouseRevenue = 0;
        }

        revenue += orderHouseRevenue;
        profit += orderHouseProfit;

        if (o.agent_id) {
          agentRevenue += orderHouseRevenue;
          agentSet.add(o.agent_id);
        } else {
          directRevenue += orderHouseRevenue;
        }
      }

      const orders_count = live.length;
      const aov = orders_count > 0 ? revenue / orders_count : 0;
      const margin_pct = revenue > 0 ? (profit / revenue) * 100 : 0;

      return {
        revenue_cents: Math.round(revenue * 100),
        profit_cents: Math.round(profit * 100),
        orders_count,
        aov_cents: Math.round(aov * 100),
        cancelled_count: cancelled.length,
        direct_revenue_cents: Math.round(directRevenue * 100),
        agent_revenue_cents: Math.round(agentRevenue * 100),
        active_agents: agentSet.size,
        margin_pct: Math.round(margin_pct * 10) / 10,
      };
    }

    const [current, previous] = await Promise.all([
      fetchPeriod(start, end),
      fetchPeriod(prior.start, prior.end),
    ]);

    const delta = (a: number, b: number) =>
      b === 0 ? null : Math.round(((a - b) / b) * 1000) / 10;

    return NextResponse.json({
      range: { start: start.toISOString(), end: end.toISOString() },
      current,
      previous,
      deltas: {
        revenue: delta(current.revenue_cents, previous.revenue_cents),
        profit: delta(current.profit_cents, previous.profit_cents),
        orders: delta(current.orders_count, previous.orders_count),
        aov: delta(current.aov_cents, previous.aov_cents),
        margin: delta(current.margin_pct, previous.margin_pct),
        active_agents: delta(current.active_agents, previous.active_agents),
      },
    });
  } catch (err) {
    console.error('[admin/sales/kpis] error:', err);
    return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
  }
}
