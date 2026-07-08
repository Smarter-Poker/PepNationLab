// R24 hotfix - Sales auto-insights.
// Uses real schema: agent_inventory.stock_count, derives dormancy via orders join.
// All RPC calls use user-authed client so SECURITY DEFINER caller-check passes.
import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireAgentOrAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Insight = { id: string; kind: 'restock' | 'dormant' | 'anomaly' | 'goal' | 'first_sale'; title: string; body: string };

export async function GET() {
  const gate = await requireAgentOrAdmin();
  if (!gate.ok) return gate.response;
  const supabase = await createClient();

  const svc = await createServiceClient();
  const insights: Insight[] = [];

  // Low stock (real column: stock_count)
  const { data: invRows } = await svc
    .from('agent_inventory')
    .select('product_id, stock_count, products(name)')
    .eq('agent_id', gate.user.id)
    .lt('stock_count', 5)
    .limit(5);
  (invRows ?? []).forEach((r: any) => {
    insights.push({
      id: `restock-${r.product_id}`,
      kind: 'restock',
      title: 'Low Stock',
      body: `${r.products?.name ?? 'Product'} Down To ${r.stock_count} On Hand.`,
    });
  });

  // Dormant researchers - derive last_order via orders join
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: researchers } = await svc
    .from('profiles')
    .select('id, full_name')
    .eq('referring_agent_id', gate.user.id)
    .eq('role', 'researcher')
    .limit(50);
  for (const r of researchers ?? []) {
    const { data: latest } = await svc
      .from('orders')
      .select('created_at')
      .eq('buyer_id', r.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!latest || latest.created_at < cutoff) {
      insights.push({
        id: `dormant-${r.id}`,
        kind: 'dormant',
        title: 'Dormant Researcher',
        body: `${r.full_name ?? 'Researcher'} Has Not Ordered In Over 30 Days.`,
      });
      if (insights.filter(i => i.kind === 'dormant').length >= 3) break;
    }
  }

  // Goal progress - call agent_sales_kpis via USER-authed client
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const { data: goal } = await svc
    .from('agent_sales_goals')
    .select('target_cents')
    .eq('agent_id', gate.user.id)
    .eq('period_start', monthStart)
    .maybeSingle();
  if (goal) {
    const { data: mtd } = await supabase.rpc('agent_sales_kpis', {
      p_agent_id: gate.user.id,
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
