
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgentOrAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/sales/insights
 *
 * Drill-down analytics for the agent's Sales tab:
 *   - topProducts : best sellers by revenue (qty + revenue), top 5
 *   - topBuyers   : highest-spending researchers (spend + orders), top 5
 *   - revenue30   : collected revenue in the last 30 days
 *   - orders30    : collected order count in the last 30 days
 *
 * "Collected" mirrors the dashboard revenue definition so numbers line up.
 */

const COLLECTED_STATUSES = ['approved_ship', 'approved_pickup', 'in_fulfillment', 'shipped', 'delivered'];
const DAY_MS = 24 * 60 * 60 * 1000;

// Supabase .in() has a practical ceiling; chunk large id lists.
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function GET() {
  try {
    const gate = await requireAgentOrAdmin();
    if (!gate.ok) return gate.response;

    const agentId = gate.user.id;
    const svc = await createServiceClient();

    // Collected orders for this agent (cap to a sane recent window for product joins).
    const { data: orders, error: oErr } = await svc
      .from('orders')
      .select('id, buyer_id, buyer_name, total, created_at')
      .eq('agent_id', agentId)
      .in('status', COLLECTED_STATUSES) // @ts-ignore
      .order('created_at', { ascending: false })
      .limit(2000);

    if (oErr) {
      console.error('[insights] orders error:', oErr.message);
      return NextResponse.json({ error: 'Failed To Load Sales Insights.' }, { status: 500 });
    }

    const orderRows = orders ?? [];
    const cutoff30 = Date.now() - 30 * DAY_MS;

    // Top buyers + 30-day rollup
    const buyerAgg = new Map<string, { name: string; spend: number; orders: number }>();
    let revenue30 = 0;
    let orders30 = 0;
    for (const o of orderRows) {
      const bid = (o.buyer_id as string | null) ?? 'unknown';
      const name = (o.buyer_name as string | null) || 'Researcher';
      const total = Number(o.total ?? 0);
      const agg = buyerAgg.get(bid) ?? { name, spend: 0, orders: 0 };
      agg.spend += total;
      agg.orders += 1;
      buyerAgg.set(bid, agg);

      if (o.created_at && new Date(o.created_at as string).getTime() >= cutoff30) {
        revenue30 += total;
        orders30 += 1;
      }
    }

    const topBuyers = Array.from(buyerAgg.values())
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 5)
      .map((b) => ({ name: b.name, spend: Number(b.spend.toFixed(2)), orders: b.orders }));

    // Top products: aggregate order_items for the collected order ids
    const orderIds = orderRows.map((o) => o.id as string);
    const productAgg = new Map<string, { qty: number; revenue: number }>();
    for (const ids of chunk(orderIds, 800)) {
      if (ids.length === 0) continue;
      const { data: items } = await svc
        .from('order_items')
        .select('product_name, quantity, unit_retail_price, order_id')
        .in('order_id', ids);
      for (const it of items ?? []) {
        const name = (it.product_name as string | null) || 'Unknown Product';
        const qty = Number(it.quantity ?? 0);
        const revenue = qty * Number(it.unit_retail_price ?? 0);
        const agg = productAgg.get(name) ?? { qty: 0, revenue: 0 };
        agg.qty += qty;
        agg.revenue += revenue;
        productAgg.set(name, agg);
      }
    }

    const topProducts = Array.from(productAgg.entries())
      .map(([name, v]) => ({ name, qty: v.qty, revenue: Number(v.revenue.toFixed(2)) }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return NextResponse.json({
      topProducts,
      topBuyers,
      revenue30: Number(revenue30.toFixed(2)),
      orders30,
    });
  } catch (err) {
    console.error('[insights] unexpected:', err);
    return NextResponse.json({ error: 'Internal Server Error.' }, { status: 500 });
  }
}
