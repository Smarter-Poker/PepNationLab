import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { parseRange, priorPeriod } from '@/lib/sales-range';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const { start, end } = parseRange(url.searchParams);
  const prior = priorPeriod(start, end);

  const svc = createServiceClient();
  const [{ data: current }, { data: previous }] = await Promise.all([
    svc.rpc('agent_sales_kpis', { p_agent_id: user.id, p_start: start.toISOString(), p_end: end.toISOString() }),
    svc.rpc('agent_sales_kpis', { p_agent_id: user.id, p_start: prior.start.toISOString(), p_end: prior.end.toISOString() }),
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
