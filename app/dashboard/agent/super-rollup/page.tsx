import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Super-Agent Rollup | Pep Nation Lab',
  robots: { index: false, follow: false },
};

function money(cents: number | null | undefined): string {
  const n = typeof cents === 'number' ? cents : 0;
  return `$${(n / 100).toFixed(2)}`;
}

interface SubRow {
  agent_id: string;
  display_name: string;
  slug: string | null;
  pageviews: number;
  orders: number;
  revenue_cents: number;
  margin_earned: number;
}

export default async function SuperAgentRollupPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_super_agent')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || (!profile.is_super_agent && profile.role !== 'admin')) {
    redirect('/dashboard/agent');
  }

  const svc = await createServiceClient();

  const { data: downline } = await svc
    .from('profiles')
    .select('id, full_name, username')
    .eq('parent_agent_id', user.id);

  const subIds = (downline ?? []).map((d) => d.id);

  const { data: storefronts } = subIds.length
    ? await svc.from('agent_profiles').select('id, display_name, slug').in('id', subIds)
    : { data: [] as Array<{ id: string; display_name: string | null; slug: string | null }> };
  const storefrontMap = new Map(
    (storefronts ?? []).map((s) => [String(s.id), { display_name: s.display_name ?? '', slug: s.slug ?? null }])
  );

  const { data: analytics } = subIds.length
    ? await svc
        .from('agent_storefront_analytics_30d')
        .select('agent_id, pageviews_30d, orders_30d, revenue_cents_30d')
        .in('agent_id', subIds)
    : { data: [] };
  const analyticsMap = new Map(
    (analytics ?? []).map((a) => [String(a.agent_id), a])
  );

  const rangeStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: subOrders } = subIds.length
    ? await svc
        .from('orders')
        .select('agent_id, order_items(quantity, unit_cost_price, unit_super_agent_cost)')
        .in('agent_id', subIds)
        .in('status', ['approved_ship', 'approved_pickup', 'in_fulfillment', 'shipped', 'delivered'])
        .eq('is_wholesale_restock', false)
        .gte('created_at', rangeStart)
    : { data: [] };

  const marginMap = new Map<string, number>();
  for (const o of subOrders ?? []) {
    const aid = String(o.agent_id);
    const cur = marginMap.get(aid) ?? 0;
    let orderProfit = 0;
    const items = (o.order_items as Array<{ quantity: number; unit_cost_price: number | null; unit_super_agent_cost: number | null }>) ?? [];
    for (const item of items) {
       const q = Number(item.quantity) || 0;
       if (q <= 0) continue;
       const cost = Number(item.unit_cost_price) || 0;
       const superCost = Number(item.unit_super_agent_cost) || 0;
       if (cost > superCost) {
          orderProfit += (cost - superCost) * q;
       }
    }
    marginMap.set(aid, cur + orderProfit);
  }

  const rows: SubRow[] = (downline ?? []).map((d) => {
    const sf = storefrontMap.get(String(d.id));
    const a = analyticsMap.get(String(d.id)) as { pageviews_30d?: number; orders_30d?: number; revenue_cents_30d?: number } | undefined;
    return {
      agent_id: d.id,
      display_name: sf?.display_name || d.full_name || d.username || 'Agent',
      slug: sf?.slug ?? null,
      pageviews: a?.pageviews_30d ?? 0,
      orders: a?.orders_30d ?? 0,
      revenue_cents: a?.revenue_cents_30d ?? 0,
      margin_earned: marginMap.get(String(d.id)) ?? 0,
    };
  });

  const totals = rows.reduce(
    (acc, r) => ({
      pageviews: acc.pageviews + r.pageviews,
      orders: acc.orders + r.orders,
      revenue_cents: acc.revenue_cents + r.revenue_cents,
      margin_earned: acc.margin_earned + r.margin_earned,
    }),
    { pageviews: 0, orders: 0, revenue_cents: 0, margin_earned: 0 }
  );

  return (
    <div style={{ padding: 'var(--space-5)' }}>
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <Link href="/dashboard/agent" style={{ color: 'var(--teal)', fontSize: '0.85rem', textDecoration: 'none' }}>
          Back To Agent Dashboard
        </Link>
      </div>
      <h1 className="animated-gradient-text" style={{ color: 'var(--white)', fontSize: '1.5rem', marginBottom: 'var(--space-2)' }}>
        Super-Agent Rollup
      </h1>
      <p style={{ color: 'var(--silver)', fontSize: '0.92rem', marginBottom: 'var(--space-5)' }}>
        Aggregate Activity Across {rows.length} Sub-Agent{rows.length === 1 ? '' : 's'} — Last 30 Days.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
        <div className="card-glass hover-lift stagger-fade-in" style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', animationDelay: '0.1s' }}>
          <div style={{ color: 'var(--silver)', fontSize: '0.78rem', textTransform: 'uppercase' }}>Sub-Agents</div>
          <div style={{ color: 'var(--white)', fontSize: '1.6rem', fontWeight: 800, marginTop: 4 }}>{rows.length}</div>
        </div>
        <div className="card-glass hover-lift stagger-fade-in" style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', animationDelay: '0.2s' }}>
          <div style={{ color: 'var(--silver)', fontSize: '0.78rem', textTransform: 'uppercase' }}>Total Pageviews</div>
          <div style={{ color: 'var(--white)', fontSize: '1.6rem', fontWeight: 800, marginTop: 4 }}>{totals.pageviews}</div>
        </div>
        <div className="card-glass hover-lift stagger-fade-in" style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', animationDelay: '0.3s' }}>
          <div style={{ color: 'var(--silver)', fontSize: '0.78rem', textTransform: 'uppercase' }}>Total Orders</div>
          <div style={{ color: 'var(--white)', fontSize: '1.6rem', fontWeight: 800, marginTop: 4 }}>{totals.orders}</div>
        </div>
        <div className="card-glass hover-lift stagger-fade-in" style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', animationDelay: '0.4s' }}>
          <div style={{ color: 'var(--silver)', fontSize: '0.78rem', textTransform: 'uppercase' }}>Total Revenue</div>
          <div style={{ color: 'var(--white)', fontSize: '1.6rem', fontWeight: 800, marginTop: 4 }}>{money(totals.revenue_cents)}</div>
        </div>
        <div className="card-glass hover-lift stagger-fade-in" style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', animationDelay: '0.5s' }}>
          <div style={{ color: 'var(--silver)', fontSize: '0.78rem', textTransform: 'uppercase' }}>Margin Earned</div>
          <div style={{ color: 'var(--white)', fontSize: '1.6rem', fontWeight: 800, marginTop: 4 }}>${totals.margin_earned.toFixed(2)}</div>
        </div>
      </div>

      <div className="card-metal hover-lift stagger-fade-in" style={{ padding: 0, overflow: 'hidden', animationDelay: '0.6s' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <th style={{ textAlign: 'left', padding: 'var(--space-3)', color: 'var(--silver)' }}>Agent</th>
              <th style={{ textAlign: 'right', padding: 'var(--space-3)', color: 'var(--silver)' }}>Pageviews</th>
              <th style={{ textAlign: 'right', padding: 'var(--space-3)', color: 'var(--silver)' }}>Orders</th>
              <th style={{ textAlign: 'right', padding: 'var(--space-3)', color: 'var(--silver)' }}>Revenue</th>
              <th style={{ textAlign: 'right', padding: 'var(--space-3)', color: 'var(--silver)' }}>Margin Earned</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 'var(--space-5)', color: 'var(--silver)', textAlign: 'center' }}>
                  You Have No Sub-Agents Yet.
                </td>
              </tr>
            ) : rows.map((r) => (
              <tr key={r.agent_id} className="table-row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding: 'var(--space-3)', color: 'var(--white)' }}>
                  {r.display_name}
                  {r.slug && <span style={{ color: 'var(--silver)', fontSize: '0.78rem', marginLeft: 8 }}>/{r.slug}</span>}
                </td>
                <td style={{ padding: 'var(--space-3)', color: 'var(--silver)', textAlign: 'right' }}>{r.pageviews}</td>
                <td style={{ padding: 'var(--space-3)', color: 'var(--silver)', textAlign: 'right' }}>{r.orders}</td>
                <td style={{ padding: 'var(--space-3)', color: 'var(--white)', textAlign: 'right' }}>{money(r.revenue_cents)}</td>
                <td style={{ padding: 'var(--space-3)', color: 'var(--white)', textAlign: 'right' }}>${r.margin_earned.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
