export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { parseRange } from '@/lib/sales-range';

/**
 * GET /api/admin/sales/timeseries
 * Returns daily revenue + profit data points for the selected period.
 * Groups orders by day in JS (avoids need for a new SQL RPC).
 */
export async function GET(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  try {
    const supabase = createAdminClient();
    const { start, end } = parseRange(req.nextUrl.searchParams);

    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        total, status, created_at, agent_id,
        order_items ( quantity, unit_cost_price, unit_retail_price, unit_super_agent_cost, unit_house_cost, products ( base_cost ) )
      `)
      .gte('created_at', start.toISOString())
      .lt('created_at', end.toISOString())
      .neq('status', 'cancelled')
      .limit(100000);

    if (error) throw error;

    // Group by day (YYYY-MM-DD in UTC)
    const byDay: Record<string, { revenue: number; profit: number; orders: number }> = {};

    for (const o of orders ?? []) {
      const day = o.created_at?.slice(0, 10) ?? '';
      if (!day) continue;
      if (!byDay[day]) byDay[day] = { revenue: 0, profit: 0, orders: 0 };
      const total = Number(o.total || 0);
      byDay[day].revenue += total;

      let houseProfit = 0;
      for (const item of ((o as any).order_items || [])) {
         const qty = Number(item.quantity || 1);
         const ucp = Number(item.unit_cost_price || 0);
         const urp = Number(item.unit_retail_price || 0);
         // Chained orders: house collects unit_super_agent_cost (see kpis route).
         const usc = Number(item.unit_super_agent_cost || 0);
         // unit_house_cost (top-of-chain cost, captured at checkout) is the
         // correct house collect under 3+ level chains (see kpis route).
         // Historical rows predate the column (NULL) and are 2-level sales,
         // where usc is correct -- the usc fallback keeps them unchanged.
         const uhc = Number(item.unit_house_cost || 0);
         const houseCollect = uhc > 0 ? uhc : (usc > 0 ? usc : ucp);
         const baseCostPer10 = Number(item.products?.base_cost || 0);
         const baseCostPerVial = baseCostPer10 / 10;
         
         if (o.agent_id) {
           houseProfit += (houseCollect - baseCostPerVial) * qty;
         } else {
           houseProfit += (urp - baseCostPerVial) * qty;
         }
      }
      
      byDay[day].profit += houseProfit;
      byDay[day].orders += 1;
    }

    // Fill every day in range so chart has no gaps
    const points: { day: string; revenue_cents: number; profit_cents: number; orders: number }[] = [];
    const cursor = new Date(start);
    while (cursor < end) {
      const key = cursor.toISOString().slice(0, 10);
      const d = byDay[key] ?? { revenue: 0, profit: 0, orders: 0 };
      points.push({
        day: key,
        revenue_cents: Math.round(d.revenue * 100),
        profit_cents: Math.round(d.profit * 100),
        orders: d.orders,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    return NextResponse.json({ points });
  } catch (err) {
    console.error('[admin/sales/timeseries] error:', err);
    return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
  }
}
