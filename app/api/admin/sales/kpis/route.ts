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
        .select('id, total, discount_amount, shipping_cost, status, agent_id, created_at')
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
        const total = Number(o.total || 0);
        const discount = Number(o.discount_amount || 0);
        const shipping = Number(o.shipping_cost || 0);
        revenue += total;
        profit += total - discount - shipping;
        if (o.agent_id) {
          agentRevenue += total;
          agentSet.add(o.agent_id);
        } else {
          directRevenue += total;
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
