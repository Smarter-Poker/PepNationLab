// R24 phase 6 — Super-agent rollup of sub-agent sales.
import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { parseRange } from '@/lib/sales-range';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const svc = createServiceClient();
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

  const rows = [];
  for (const sub of subAgents ?? []) {
    const { data: kpis } = await svc.rpc('agent_sales_kpis', {
      p_agent_id: sub.id,
      p_start: start.toISOString(),
      p_end: end.toISOString(),
    });
    const k = kpis?.[0] ?? { revenue_cents: 0, profit_cents: 0, orders_count: 0 };
    rows.push({
      sub_agent_id: sub.id,
      name: sub.full_name ?? sub.username ?? sub.email,
      revenue_cents: Number(k.revenue_cents),
      profit_cents: Number(k.profit_cents),
      orders_count: Number(k.orders_count),
    });
  }
  rows.sort((a, b) => b.revenue_cents - a.revenue_cents);
  return NextResponse.json({ rows });
}
