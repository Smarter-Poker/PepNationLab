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

  const statIcon = {
    width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.8,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  };

  const STATS = [
    {
      label: 'Researchers', value: totalResearchers ?? 0, color: 'var(--teal)',
      icon: <svg {...statIcon}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>,
    },
    {
      label: 'Active Agents', value: totalAgents ?? 0, color: 'var(--teal)',
      icon: <svg {...statIcon}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
    },
    {
      label: 'Active Products', value: totalProducts ?? 0, color: 'var(--silver)',
      icon: <svg {...statIcon}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /></svg>,
    },
    {
      label: 'Pending Orders', value: pendingOrders ?? 0, color: pendingOrders ? 'var(--red)' : 'var(--grey-400)',
      icon: <svg {...statIcon}><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>,
    },
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
            <a href="/admin/orders" style={{ fontSize: '0.8rem', color: 'var(--teal)' }}>View All</a>
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
              { href: '/admin/researchers', label: 'Create New Agent', desc: 'Set Up A New Agent With Pricing Tier & Storefront', color: 'var(--teal)' },
              { href: '/admin/sales', label: 'Sales & Revenue', desc: 'View Revenue By Agent, Transaction Ledgers', color: 'var(--silver)' },
              { href: '/admin/orders', label: 'Process Orders', desc: 'Mark Payments Received, Approve For Shipment', color: pendingOrders ? 'var(--red)' : 'var(--silver)' },
              { href: '/admin/pricing', label: 'Edit Tier Pricing', desc: 'Adjust Multipliers For All 3 Tiers', color: 'var(--silver)' },
              { href: '/admin/statements', label: 'Agent Statements', desc: 'Generate And Mark Weekly Billing Statements', color: 'var(--silver)' },
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
