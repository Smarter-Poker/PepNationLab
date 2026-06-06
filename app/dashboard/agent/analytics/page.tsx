import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Storefront Analytics | Pep Nation Lab',
  robots: { index: false, follow: false },
};

interface MetricCardProps {
  label: string;
  value: string;
  sub?: string;
  index?: number;
}

function MetricCard({ label, value, sub, index = 0 }: MetricCardProps) {
  return (
    <div className="glass-panel hover-lift stagger-fade-in" style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', animationDelay: `${0.1 + index * 0.1}s` }}>
      <div style={{ color: 'var(--silver)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ color: 'var(--white)', fontSize: '1.6rem', fontWeight: 800, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ color: 'var(--silver)', fontSize: '0.78rem', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function money(cents: number | null | undefined): string {
  const n = typeof cents === 'number' ? cents : 0;
  return `$${(n / 100).toFixed(2)}`;
}

export default async function AgentAnalyticsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_super_agent')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || !['agent', 'super_agent', 'admin'].includes(profile.role ?? '')) {
    redirect('/dashboard');
  }

  const svc = await createServiceClient();

  const { data: rollup } = await svc
    .from('agent_storefront_analytics_30d')
    .select('pageviews_30d, unique_sessions_30d, add_to_cart_30d, checkout_starts_30d, orders_30d, revenue_cents_30d, conversion_pct_30d')
    .eq('agent_id', user.id)
    .maybeSingle();

  const metrics = rollup ?? {
    pageviews_30d: 0,
    unique_sessions_30d: 0,
    add_to_cart_30d: 0,
    checkout_starts_30d: 0,
    orders_30d: 0,
    revenue_cents_30d: 0,
    conversion_pct_30d: 0,
  };

  const { data: terms } = await svc
    .from('agent_top_search_terms_30d')
    .select('term, searches')
    .eq('agent_id', user.id)
    .order('searches', { ascending: false })
    .limit(15);

  const { data: topProducts } = await svc
    .from('agent_storefront_events')
    .select('product_id, products!product_id(name)')
    .eq('agent_id', user.id)
    .eq('event_type', 'product_view')
    .not('product_id', 'is', null)
    .gte('created_at', new Date(Date.now() - 30 * 24 * 3600_000).toISOString())
    .limit(2000);

  const productCounts = new Map<string, { name: string; views: number }>();
  for (const r of topProducts ?? []) {
    const id = String(r.product_id);
    const name = Array.isArray(r.products) ? r.products[0]?.name : (r.products as { name?: string } | null)?.name ?? id.slice(0, 8);
    const cur = productCounts.get(id) ?? { name, views: 0 };
    cur.views += 1;
    productCounts.set(id, cur);
  }
  const topRanked = Array.from(productCounts.values()).sort((a, b) => b.views - a.views).slice(0, 10);

  // Conversion funnel - ordered steps from first visit to completed order.
  // Bar widths are proportional to the top of the funnel (pageviews); each
  // row also shows step-over-step conversion against the previous stage.
  const funnelSteps = [
    { label: 'Pageviews', value: Number(metrics.pageviews_30d) || 0 },
    { label: 'Unique Sessions', value: Number(metrics.unique_sessions_30d) || 0 },
    { label: 'Add To Cart', value: Number(metrics.add_to_cart_30d) || 0 },
    { label: 'Checkouts Started', value: Number(metrics.checkout_starts_30d) || 0 },
    { label: 'Orders Completed', value: Number(metrics.orders_30d) || 0 },
  ];
  const funnelTop = funnelSteps[0].value;

  return (
    <div style={{ padding: 'var(--space-5)' }}>
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <Link href="/dashboard/agent" style={{ color: 'var(--teal)', fontSize: '0.85rem', textDecoration: 'none' }}>
          Back To Agent Dashboard
        </Link>
      </div>
      <h1 className="animated-gradient-text" style={{ color: 'var(--white)', fontSize: '1.5rem', marginBottom: 'var(--space-2)' }}>
        Storefront Analytics
      </h1>
      <p style={{ color: 'var(--silver)', fontSize: '0.92rem', marginBottom: 'var(--space-5)' }}>
        Last 30 Days. Includes Anonymous And Authenticated Visitors.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
        <MetricCard index={0} label="Pageviews" value={String(metrics.pageviews_30d)} />
        <MetricCard index={1} label="Unique Sessions" value={String(metrics.unique_sessions_30d)} />
        <MetricCard index={2} label="Add To Cart" value={String(metrics.add_to_cart_30d)} />
        <MetricCard index={3} label="Checkouts Started" value={String(metrics.checkout_starts_30d)} />
        <MetricCard index={4} label="Orders Completed" value={String(metrics.orders_30d)} />
        <MetricCard index={5} label="Revenue" value={money(Number(metrics.revenue_cents_30d))} />
        <MetricCard index={6} label="Conversion %" value={`${metrics.conversion_pct_30d ?? 0}%`} sub="Orders / Pageviews" />
      </div>

      {/* Conversion funnel */}
      <div className="glass-panel hover-lift stagger-fade-in" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-6)', animationDelay: '0.35s' }}>
        <h2 style={{ color: 'var(--white)', fontSize: '1.05rem', marginBottom: 'var(--space-1)' }}>Conversion Funnel</h2>
        <p style={{ color: 'var(--silver)', fontSize: '0.82rem', marginBottom: 'var(--space-4)' }}>
          Where Visitors Drop Off On The Way To An Order.
        </p>
        {funnelTop === 0 ? (
          <p style={{ color: 'var(--silver)', fontSize: '0.9rem' }}>No Traffic Recorded Yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {funnelSteps.map((step, i) => {
              const pctOfTop = funnelTop > 0 ? (step.value / funnelTop) * 100 : 0;
              const prev = i > 0 ? funnelSteps[i - 1].value : null;
              const stepPct = prev && prev > 0 ? (step.value / prev) * 100 : null;
              return (
                <div key={step.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                    <span style={{ color: 'var(--white)', fontSize: '0.85rem', fontWeight: 600 }}>{step.label}</span>
                    <span style={{ color: 'var(--silver)', fontSize: '0.82rem' }}>
                      <strong style={{ color: 'var(--white)', fontFamily: 'var(--font-brand)' }}>{step.value.toLocaleString()}</strong>
                      <span style={{ color: 'var(--grey-500)' }}> · {pctOfTop.toFixed(1)}%</span>
                      {stepPct !== null && (
                        <span style={{ color: 'var(--teal)' }}> · {stepPct.toFixed(0)}% Of Prev</span>
                      )}
                    </span>
                  </div>
                  <div style={{ height: 12, background: 'var(--surface-2)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${Math.max(step.value > 0 ? 2 : 0, pctOfTop)}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #B3A992 0%, #DCD3C3 100%)',
                        borderRadius: 'var(--radius-full)',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
        <div className="glass-panel hover-lift stagger-fade-in" style={{ padding: 'var(--space-4)', animationDelay: '0.4s' }}>
          <h2 style={{ color: 'var(--white)', fontSize: '1.05rem', marginBottom: 'var(--space-3)' }}>Top Search Terms</h2>
          {(!terms || terms.length === 0) ? (
            <p style={{ color: 'var(--silver)', fontSize: '0.9rem' }}>No Searches Recorded Yet.</p>
          ) : (
            <table style={{ width: '100%', fontSize: '0.88rem' }}>
              <tbody>
                {terms.map((t) => (
                  <tr key={t.term} style={{ }}>
                    <td style={{ padding: '6px 0', color: 'var(--white)' }}>{t.term}</td>
                    <td style={{ padding: '6px 0', color: 'var(--silver)', textAlign: 'right' }}>{t.searches}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="glass-panel hover-lift stagger-fade-in" style={{ padding: 'var(--space-4)', animationDelay: '0.5s' }}>
          <h2 style={{ color: 'var(--white)', fontSize: '1.05rem', marginBottom: 'var(--space-3)' }}>Top Viewed Products</h2>
          {topRanked.length === 0 ? (
            <p style={{ color: 'var(--silver)', fontSize: '0.9rem' }}>No Product Views Yet.</p>
          ) : (
            <table style={{ width: '100%', fontSize: '0.88rem' }}>
              <tbody>
                {topRanked.map((p) => (
                  <tr key={p.name} style={{ }}>
                    <td style={{ padding: '6px 0', color: 'var(--white)' }}>{p.name}</td>
                    <td style={{ padding: '6px 0', color: 'var(--silver)', textAlign: 'right' }}>{p.views} Views</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
