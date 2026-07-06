import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseRange, priorPeriod } from '@/lib/sales-range';
import { requireAgent } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const gate = await requireAgent();
  if (!gate.ok) return gate.response;
  const supabase = await createClient();

  const url = new URL(req.url);
  const { start, end } = parseRange(url.searchParams);
  const prior = priorPeriod(start, end);

  // R24 hotfix: RPCs require auth.uid(); call via user-authed client.
  const [{ data: current }, { data: previous }] = await Promise.all([
    supabase.rpc('agent_sales_kpis', { p_agent_id: gate.user.id, p_start: start.toISOString(), p_end: end.toISOString() }),
    supabase.rpc('agent_sales_kpis', { p_agent_id: gate.user.id, p_start: prior.start.toISOString(), p_end: prior.end.toISOString() }),
  ]);

  const c = current?.[0] ?? { revenue_cents: 0, profit_cents: 0, orders_count: 0, aov_cents: 0, new_researchers: 0, cancelled_count: 0 };
  const p = previous?.[0] ?? { revenue_cents: 0, profit_cents: 0, orders_count: 0, aov_cents: 0, new_researchers: 0, cancelled_count: 0 };

  const delta = (a: number, b: number) => (b === 0 ? null : ((a - b) / b) * 100);

  return NextResponse.json({
    range: { start: start.toISOString(), end: end.toISOString() },
    current: c,
    previous: p,
    deltas: {
      revenue: delta(Number(c.revenue_cents), Number(p.revenue_cents)),
      profit: delta(Number(c.profit_cents), Number(p.profit_cents)),
      orders: delta(Number(c.orders_count), Number(p.orders_count)),
      aov: delta(Number(c.aov_cents), Number(p.aov_cents)),
      newResearchers: delta(Number(c.new_researchers), Number(p.new_researchers)),
    },
  });
}
