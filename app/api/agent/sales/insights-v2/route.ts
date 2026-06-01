// Round 24 Sales — auto-insights rules engine.
// Generates restock/dormancy/anomaly/coupon callouts.
import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Insight = { id: string; kind: 'restock' | 'dormant' | 'anomaly' | 'goal' | 'first_sale'; title: string; body: string };

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const svc = createServiceClient();
  const insights: Insight[] = [];

  // Low-stock callouts
  const { data: invRows } = await svc
    .from('agent_inventory')
    .select('product_id, on_hand, products(name)')
    .eq('agent_id', user.id)
    .lt('on_hand', 5)
    .limit(5);
  (invRows ?? []).forEach((r: any) => {
    insights.push({
      id: `restock-${r.product_id}`,
      kind: 'restock',
      title: 'Low Stock',
      body: `${r.products?.name ?? 'Product'} Down To ${r.on_hand} On Hand.`,
    });
  });

  // Dormant researchers — last order > 30 days
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: dormant } = await svc
    .from('profiles')
    .select('id, full_name, last_order_at')
    .eq('referring_agent_id', user.id)
    .lt('last_order_at', cutoff)
    .order('last_order_at', { ascending: true })
    .limit(3);
  (dormant ?? []).forEach((r: any) => {
    insights.push({
      id: `dormant-${r.id}`,
      kind: 'dormant',
      title: 'Dormant Researcher',
      body: `${r.full_name ?? 'Researcher'} Has Not Ordered In Over 30 Days.`,
    });
  });

  // Goal progress
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const { data: goal } = await svc
    .from('agent_sales_goals')
    .select('target_cents')
    .eq('agent_id', user.id)
    .eq('period_start', monthStart)
    .maybeSingle();
  if (goal) {
    const { data: mtd } = await svc.rpc('agent_sales_kpis', {
      p_agent_id: user.id,
      p_start: new Date(monthStart + 'T00:00:00Z').toISOString(),
      p_end: new Date().toISOString(),
    });
    const rev = Number(mtd?.[0]?.revenue_cents ?? 0);
    const pct = goal.target_cents > 0 ? Math.round((rev / Number(goal.target_cents)) * 100) : 0;
    insights.push({
      id: 'goal-progress',
      kind: 'goal',
      title: `Goal ${pct}% Reached`,
      body: `$${(rev / 100).toFixed(0)} Of $${(Number(goal.target_cents) / 100).toFixed(0)} Month To Date.`,
    });
  }

  return NextResponse.json({ insights });
}
