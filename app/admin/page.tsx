import { createServiceClient } from '@/lib/supabase/server';

export default async function AdminDashboard() {
  const supabase = await createServiceClient();

  // Parallel stats queries
  const [
    { count: totalResearchers },
    { count: totalAgents },
    { count: totalProducts },
    { count: pendingOrders },
    { data: recentOrders },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'researcher'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).in('role', ['agent', 'super_agent']),
    supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending_customer_payment'),
    supabase
      .from('orders')
      .select('id, status, total, payment_method, created_at, profiles(full_name)')
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const STATS = [
    { label: 'Researchers', value: totalResearchers ?? 0, color: 'var(--teal)', icon: '◎' },
    { label: 'Active Agents', value: totalAgents ?? 0, color: 'var(--teal)', icon: '◈' },
    { label: 'Active Products', value: totalProducts ?? 0, color: 'var(--silver)', icon: '⬡' },
    { label: 'Pending Orders', value: pendingOrders ?? 0, color: pendingOrders ? 'var(--red)' : 'var(--grey-400)', icon: '◉' },
  ];

  const STATUS_COLORS: Record<string, string> = {
    pending_customer_payment: 'var(--red)',
    agent_approval_pending:   '#F6AD55',
    approved_ship:            '#F6AD55',
    approved_pickup:          '#F6AD55',
    in_fulfillment:           'var(--teal)',
    shipped:                  'var(--teal)',
    delivered:                '#68D391',
    cancelled:                'var(--grey-400)',
  };

  const STATUS_LABELS: Record<string, string> = {
    pending_customer_payment: 'Pending Customer Payment',
    agent_approval_pending:   'Agent Approval Pending',
    approved_ship:            'Approved Ship',
    approved_pickup:          'Approved Pickup',
    in_fulfillment:           'In Fulfillment',
    shipped:                  'Shipped',
    delivered:                'Delivered',
    cancelled:                'Cancelled',
  };

  return (
    <div style={{ padding: 'var(--space-8)' }}>
      {/* Header */}
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h1 style={{ fontSize: '1.6rem', marginBottom: 'var(--space-2)' }}>
          Admin <span style={{ color: 'var(--teal)' }}>Dashboard</span>
        </h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--grey-400)' }}>
          Pep Nation Lab — Control Center
        </p>
      </div>

      {/* Stats */}
      <div className="grid-4" style={{ marginBottom: 'var(--space-8)' }}>
        {STATS.map(({ label, value, color, icon }) => (
          <div key={label} className="card-metal" style={{ padding: 'var(--space-5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '2rem', fontWeight: 800, fontFamily: 'var(--font-brand)', color, lineHeight: 1 }}>
                  {value}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--grey-400)', marginTop: 'var(--space-2)' }}>
                  {label}
                </div>
              </div>
              <span style={{ fontSize: '1.4rem', color, opacity: 0.6 }}>{icon}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        {/* Recent Orders */}
        <div className="card-metal" style={{ padding: 'var(--space-6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
            <h3 style={{ fontSize: '1rem' }}>Recent Orders</h3>
            <a href="/admin/orders" style={{ fontSize: '0.8rem', color: 'var(--teal)' }}>View All →</a>
          </div>

          {recentOrders && recentOrders.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {recentOrders.map((order) => {
                const profile = (order.profiles as unknown) as { full_name: string } | null;
                return (
                  <div key={order.id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: 'var(--space-3)',
                    background: 'var(--surface-1)',
                    borderRadius: 'var(--radius-md)',
                    border: 'var(--border-subtle)'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--silver)' }}>
                        {profile?.full_name ?? 'Unknown'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--grey-400)' }}>
                        {order.payment_method.toUpperCase()} • ${Number(order.total).toFixed(2)}
                      </div>
                    </div>
                    <div style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      color: STATUS_COLORS[order.status] ?? 'var(--grey-400)',
                      background: `${STATUS_COLORS[order.status] ?? 'var(--grey-400)'}15`,
                      padding: '2px var(--space-2)',
                      borderRadius: 'var(--radius-sm)',
                    }}>
                      {STATUS_LABELS[order.status] ?? order.status}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ fontSize: '0.85rem', color: 'var(--grey-400)', textAlign: 'center', padding: 'var(--space-6) 0' }}>
              No Orders Yet
            </p>
          )}
        </div>

        {/* Quick Actions */}
        <div className="card-metal" style={{ padding: 'var(--space-6)' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: 'var(--space-5)' }}>Quick Actions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {[
              { href: '/admin/products/new', label: 'Add New Product', desc: 'Add A Research Compound To The Catalog', color: 'var(--teal)' },
              { href: '/admin/researchers', label: 'Manage Researchers', desc: 'Upgrade Researchers To Agents', color: 'var(--silver)' },
              { href: '/admin/pricing', label: 'Edit Tier Pricing', desc: 'Adjust Multipliers For All 3 Tiers', color: 'var(--silver)' },
              { href: '/admin/orders', label: 'Process Orders', desc: 'Mark Payments Received, Update Status', color: pendingOrders ? 'var(--red)' : 'var(--silver)' },
            ].map(({ href, label, desc, color }) => (
              <a
                key={href}
                href={href}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  padding: 'var(--space-4)',
                  background: 'var(--surface-1)',
                  borderRadius: 'var(--radius-md)',
                  border: 'var(--border-subtle)',
                  textDecoration: 'none',
                  transition: 'border-color 0.2s',
                }}
              >
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color }}>{label}</span>
                <span style={{ fontSize: '0.76rem', color: 'var(--grey-400)' }}>{desc}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
