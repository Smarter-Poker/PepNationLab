// R24 hotfix — Super-agent rollup of sub-agent sales.
// Aggregates directly on the orders table (service client) instead of looping
// through the auth-checked agent_sales_kpis RPC (which rejects service-role).
import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { parseRange } from '@/lib/sales-range';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const svc = await createServiceClient();
  const { data: profile } = await svc
    .from('profiles')
    .select('id, is_super_agent, role')
    .eq('id', user.id)
    .single();
  if (!profile?.is_super_agent && profile?.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { data: subAgents } = await svc
    .from('profiles')
    .select('id, full_name, email, username')
    .eq('parent_agent_id', user.id);
  const subIds = (subAgents ?? []).map((s: any) => s.id);
  if (subIds.length === 0) return NextResponse.json({ rows: [] });

  const { start, end } = parseRange(new URL(req.url).searchParams);

  // Single query: pull all live orders for the sub-agent set, aggregate in JS.
  const { data: orders } = await svc
    .from('orders')
    .select('agent_id, total, discount_amount, shipping_cost, status, is_wholesale_restock, created_at')
    .in('agent_id', subIds)
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString())
    .neq('status', 'cancelled');

  const agg: Record<string, { revenue: number; profit: number; orders: number }> = {};
  for (const id of subIds) agg[id] = { revenue: 0, profit: 0, orders: 0 };
  (orders ?? []).forEach((o: any) => {
    if (o.is_wholesale_restock) return;
    const a = agg[o.agent_id];
    if (!a) return;
    const total = Number(o.total || 0);
    const ship = Number(o.shipping_cost || 0);
    a.revenue += total;
    a.profit += total - ship; // simplified: revenue net of shipping cost
    a.orders += 1;
  });

  const rows = (subAgents ?? []).map((s: any) => ({
    sub_agent_id: s.id,
    name: s.full_name ?? s.username ?? s.email,
    revenue_cents: Math.round(agg[s.id].revenue * 100),
    profit_cents: Math.round(agg[s.id].profit * 100),
    orders_count: agg[s.id].orders,
  })).sort((a, b) => b.revenue_cents - a.revenue_cents);

  return NextResponse.json({ rows });
}
