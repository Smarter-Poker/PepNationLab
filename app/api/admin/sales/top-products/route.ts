export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { parseRange } from '@/lib/sales-range';

/**
 * GET /api/admin/sales/top-products
 * Returns top 10 products by revenue for the selected period.
 * Joins order_items → orders to filter by date range and non-cancelled status.
 */
export async function GET(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  try {
    const supabase = createAdminClient();
    const { start, end } = parseRange(req.nextUrl.searchParams);

    const { data, error } = await supabase
      .from('order_items')
      .select(`
        product_name,
        quantity,
        unit_retail_price,
        unit_cost_price,
        unit_super_agent_cost,
        products ( base_cost ),
        orders!inner(created_at, status, agent_id)
      `)
      .neq('orders.status', 'cancelled')
      .gte('orders.created_at', start.toISOString())
      .lt('orders.created_at', end.toISOString())
      .limit(50000);

    if (error) throw error;

    // Aggregate by product_name
    const map: Record<string, { revenue: number; cogs: number; houseProfit: number; units: number }> = {};
    for (const item of data ?? []) {
      const name = item.product_name ?? 'Unknown';
      if (!map[name]) map[name] = { revenue: 0, cogs: 0, houseProfit: 0, units: 0 };
      const qty = Number(item.quantity || 1);
      const retail = Number(item.unit_retail_price || 0);
      const ucp = Number(item.unit_cost_price || 0);
      // Chained orders: house collects unit_super_agent_cost (see kpis route).
      const usc = Number(item.unit_super_agent_cost || 0);
      const houseCollect = usc > 0 ? usc : ucp;
      const baseCostPer10 = Number((item.products as any)?.base_cost || 0);
      const baseCostPerVial = baseCostPer10 / 10;
      
      const isAgentOrder = !!(item.orders as any)?.agent_id;
      const houseProfit = isAgentOrder 
        ? (houseCollect - baseCostPerVial) * qty 
        : (retail - baseCostPerVial) * qty;

      map[name].revenue += isAgentOrder ? (houseCollect * qty) : (retail * qty);
      map[name].cogs += baseCostPerVial * qty;
      map[name].houseProfit += houseProfit;
      map[name].units += qty;
    }

    const products = Object.entries(map)
      .map(([name, v]) => ({
        name,
        revenue_cents: Math.round(v.revenue * 100),
        cogs_cents: Math.round(v.cogs * 100),
        profit_cents: Math.round(v.houseProfit * 100),
        units: v.units,
      }))
      .sort((a, b) => b.revenue_cents - a.revenue_cents)
      .slice(0, 10);

    return NextResponse.json({ products });
  } catch (err) {
    console.error('[admin/sales/top-products] error:', err);
    return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
  }
}
