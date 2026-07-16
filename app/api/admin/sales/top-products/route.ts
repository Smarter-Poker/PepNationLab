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
        orders!inner(created_at, status)
      `)
      .neq('orders.status', 'cancelled')
      .gte('orders.created_at', start.toISOString())
      .lt('orders.created_at', end.toISOString())
      .limit(50000);

    if (error) throw error;

    // Aggregate by product_name
    const map: Record<string, { revenue: number; cogs: number; units: number }> = {};
    for (const item of data ?? []) {
      const name = item.product_name ?? 'Unknown';
      if (!map[name]) map[name] = { revenue: 0, cogs: 0, units: 0 };
      const qty = Number(item.quantity || 1);
      const retail = Number(item.unit_retail_price || 0);
      const cost = Number(item.unit_cost_price || 0);
      map[name].revenue += retail * qty;
      map[name].cogs += cost * qty;
      map[name].units += qty;
    }

    const products = Object.entries(map)
      .map(([name, v]) => ({
        name,
        revenue_cents: Math.round(v.revenue * 100),
        cogs_cents: Math.round(v.cogs * 100),
        profit_cents: Math.round((v.revenue - v.cogs) * 100),
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
