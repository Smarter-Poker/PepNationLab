export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import AdminAnalytics from '@/components/AdminAnalytics';
import AdminOverviewSparkline from '@/components/AdminOverviewSparkline';
import AdminDashboardRealtime from '@/components/AdminDashboardRealtime';
import { fetchAdminMetrics, computeGmvDelta, timeAgo } from '@/lib/admin-metrics';
import { getImpersonationContext } from '@/lib/impersonation';

import AdminOverviewImageMap from '@/components/AdminOverviewImageMap';

const ICON_PROPS = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function formatCurrency(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatAuditAction(action: string): string {
  return action
    .split('_')
    .map((w) => (w.length === 0 ? '' : w[0].toUpperCase() + w.slice(1)))
    .join(' ');
}

export default async function AdminDashboard({ searchParams }: { searchParams: { view?: string } }) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();

  if (profile?.role !== 'admin') {
    return redirect('/dashboard');
  }

  // Next.js 15 requires awaiting searchParams, we do it safely:
  const resolvedParams = await Promise.resolve(searchParams);
  if (resolvedParams?.view !== 'metrics') {
    return <AdminOverviewImageMap />;
  }

  const metrics = await fetchAdminMetrics(user.id);
  const delta = computeGmvDelta(metrics.gmvLast7, metrics.gmvPrior7);
  const impersonation = await getImpersonationContext();
  const activeImpersonation =
    impersonation && impersonation.impersonatorId === user.id ? impersonation : null;

  const KPIS: Array<{
    label: string;
    value: string;
    sub?: string;
    href: string;
    color: string;
    icon: React.ReactNode;
    trend?: { direction: 'up' | 'down' | 'flat'; pct: number };
  }> = [
    {
      label: "Today's GMV",
      value: formatCurrency(metrics.gmvToday),
      sub: `Last 7 Days: ${formatCurrency(metrics.gmvLast7)}`,
      href: '/admin/sales',
      color: 'var(--teal)',
      icon: <svg {...ICON_PROPS}><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
      trend: { direction: delta.direction, pct: delta.pct },
    },
    {
      label: 'Pending Admin Approval',
      value: String(metrics.pendingAdminApproval),
      sub: 'Awaiting Payment Confirmation',
      href: '/admin/orders?status=pending_customer_payment',
      color: metrics.pendingAdminApproval > 0 ? 'var(--red)' : 'var(--grey-400)',
      icon: <svg {...ICON_PROPS}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
    },
    {
      label: 'Pending Agent Approval',
      value: String(metrics.pendingAgentApproval),
      sub: 'Awaiting Agent Decision',
      href: '/admin/orders?status=agent_approval_pending',
      color: metrics.pendingAgentApproval > 0 ? '#00E5FF' : 'var(--grey-400)',
      icon: <svg {...ICON_PROPS}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>,
    },
    {
      label: 'Awaiting My Approval',
      value: String(metrics.awaitingAdminApproval),
      sub: 'Agent-Approved, Needs Admin Release',
      href: '/admin/orders?status=admin_approval_pending',
      color: metrics.awaitingAdminApproval > 0 ? 'var(--red)' : 'var(--grey-400)',
      icon: <svg {...ICON_PROPS}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>,
    },
    {
      label: 'Ready To Ship',
      value: String(metrics.readyToShip),
      sub: 'Approved, Awaiting Label',
      href: '/admin/orders?status=approved_ship',
      color: metrics.readyToShip > 0 ? '#00E5FF' : 'var(--grey-400)',
      icon: <svg {...ICON_PROPS}><rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>,
    },
    {
      label: 'Ready For Pickup',
      value: String(metrics.readyForPickup),
      sub: 'Agent-Approved, Awaiting Fulfillment',
      href: '/admin/orders?status=approved_pickup',
      color: metrics.readyForPickup > 0 ? '#00E5FF' : 'var(--grey-400)',
      icon: <svg {...ICON_PROPS}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>,
    },
    {
      label: 'Awaiting Tracking',
      value: String(metrics.awaitingTracking),
      sub: 'In Fulfillment',
      href: '/admin/orders?status=in_fulfillment',
      color: metrics.awaitingTracking > 0 ? 'var(--teal)' : 'var(--grey-400)',
      icon: <svg {...ICON_PROPS}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>,
    },
    {
      label: 'Low Stock Alerts',
      value: String(metrics.lowStockCount),
      sub: 'At Or Below Threshold',
      href: '/admin/products',
      color: metrics.lowStockCount > 0 ? 'var(--red)' : 'var(--grey-400)',
      icon: <svg {...ICON_PROPS}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>,
    },
    {
      label: 'Master Out Of Stock',
      value: String(metrics.outOfStockCount),
      sub: 'Active Products At Zero',
      href: '/admin/products',
      color: metrics.outOfStockCount > 0 ? 'var(--red)' : 'var(--grey-400)',
      icon: <svg {...ICON_PROPS}><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></svg>,
    },
    {
      label: 'Unpaid Statements',
      value: String(metrics.unpaidStatementsCount),
      sub: `Outstanding: ${formatCurrency(metrics.unpaidStatementsTotal)}`,
      href: '/admin/statements',
      color: metrics.unpaidStatementsCount > 0 ? 'var(--red)' : 'var(--grey-400)',
      icon: <svg {...ICON_PROPS}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>,
    },
    {
      label: 'New Researchers (24h)',
      value: String(metrics.newResearchers24h),
      sub: 'Past 24 Hours',
      href: '/admin/researchers',
      color: 'var(--teal)',
      icon: <svg {...ICON_PROPS}><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></svg>,
    },
    {
      label: 'Active Agents',
      value: String(metrics.activeAgents),
      sub: 'Currently Selling',
      href: '/admin/agents',
      color: 'var(--silver)',
      icon: <svg {...ICON_PROPS}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
    },
    {
      label: 'GMV Trend',
      value: delta.direction === 'flat' ? '—' : `${delta.direction === 'up' ? '+' : '-'}${delta.pct.toFixed(1)}%`,
      sub: 'Last 7 Vs Prior 7',
      href: '/admin/sales',
      color: delta.direction === 'up' ? '#68D391' : delta.direction === 'down' ? 'var(--red)' : 'var(--grey-400)',
      icon: <svg {...ICON_PROPS}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>,
    },
  ];

  return (
    <div style={{ padding: 'var(--space-8)' }}>
      <AdminDashboardRealtime />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-8)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <h1 style={{ fontSize: '1.6rem', margin: 0 }}>Admin Dashboard</h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--grey-400)', margin: 0, fontFamily: 'var(--font-brand)', letterSpacing: '0.5px' }}>
          Pep Nation Lab Control Center
        </p>
      </div>

      {activeImpersonation && (
        <div
          style={{
            background: 'rgba(229,62,62,0.12)',
            border: '1px solid rgba(229,62,62,0.5)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-4) var(--space-5)',
            marginBottom: 'var(--space-6)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            color: 'var(--red)',
            fontSize: '0.85rem',
            fontWeight: 600,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span>
            Active Impersonation: Viewing As {activeImpersonation.targetName ?? 'User'} ({activeImpersonation.targetRole})
          </span>
        </div>
      )}

      <div className="grid-4" style={{ marginBottom: 'var(--space-8)' }}>
        {KPIS.map(({ label, value, sub, href, color, icon, trend }) => (
          <Link
            key={label}
            href={href}
            className="glass-panel admin-kpi-card"
            style={{
              display: 'block',
              textDecoration: 'none',
              transition: 'transform 0.18s',
            }}
          >
            <div className="" style={{ padding: 'var(--space-5)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="metal-text" style={{ fontSize: '1.7rem', fontWeight: 800, color, lineHeight: 1.1, fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {value}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--silver)', marginTop: 'var(--space-2)', fontWeight: 600 }}>
                    {label}
                  </div>
                  {sub && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--grey-400)', marginTop: 4 }}>
                      {sub}
                    </div>
                  )}
                  {trend && trend.direction !== 'flat' && (
                    <div style={{ marginTop: 6, fontSize: '0.72rem', color: trend.direction === 'up' ? '#68D391' : 'var(--red)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        {trend.direction === 'up'
                          ? <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                          : <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
                        }
                      </svg>
                      <span>{trend.pct.toFixed(1)}%</span>
                    </div>
                  )}
                </div>
                <span style={{ color, opacity: 0.6, flexShrink: 0, marginLeft: 8 }}>{icon}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid-2" style={{ marginBottom: 'var(--space-8)' }}>
        <div className="glass-panel">
          <div className="" style={{ padding: 'var(--space-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
              <h3 style={{ fontSize: '1rem', margin: 0 }}>Sales Last 30 Days</h3>
              <Link href="/admin/sales" style={{ fontSize: '0.8rem', color: 'var(--teal)', textDecoration: 'none' }}>View Sales</Link>
            </div>
            <AdminOverviewSparkline data={metrics.sparkline} />
          </div>
        </div>

        <div className="glass-panel">
          <div className="" style={{ padding: 'var(--space-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
              <h3 style={{ fontSize: '1rem', margin: 0 }}>Low Stock Items</h3>
              <Link href="/admin/products" style={{ fontSize: '0.8rem', color: 'var(--teal)', textDecoration: 'none' }}>Manage Products</Link>
            </div>
            {metrics.lowStockList.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--grey-400)', textAlign: 'center', padding: 'var(--space-6) 0' }}>
                No Items At Or Below Low Stock Threshold
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {metrics.lowStockList.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: 'var(--space-3)',
                      background: 'var(--surface-1)',
                      borderRadius: 'var(--radius-md)',
                      border: 'var(--border-subtle)',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--silver)' }}>{p.name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--grey-400)' }}>Threshold: {p.low_stock_threshold}</div>
                    </div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: p.inventory_count === 0 ? 'var(--red)' : '#00E5FF' }}>
                      {p.inventory_count} Left
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* fix-55 #5: Top Agents Leaderboard */}
      {metrics.topAgents.length > 0 && (
        <div className="glass-panel" style={{ marginBottom: 'var(--space-8)' }}>
          <div className="" style={{ padding: 'var(--space-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
              <h3 style={{ fontSize: '1rem', margin: 0 }}>Top Agents (30 Days)</h3>
              <Link href="/admin/agents" style={{ fontSize: '0.8rem', color: 'var(--teal)', textDecoration: 'none' }}>Manage Agents</Link>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <th style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'left', fontSize: '0.7rem', color: 'var(--grey-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', width: 48 }}>Rank</th>
                  <th style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'left', fontSize: '0.7rem', color: 'var(--grey-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Agent</th>
                  <th style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right', fontSize: '0.7rem', color: 'var(--grey-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Orders</th>
                  <th style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right', fontSize: '0.7rem', color: 'var(--grey-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>GMV</th>
                </tr>
              </thead>
              <tbody>
                {metrics.topAgents.map((a, idx) => (
                  <tr key={a.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: 'var(--space-2) var(--space-3)', fontSize: '0.82rem', color: 'var(--silver)', fontWeight: 700 }}>#{idx + 1}</td>
                    <td style={{ padding: 'var(--space-2) var(--space-3)', fontSize: '0.85rem', color: 'var(--white)' }}>
                      <Link href={`/admin/transactions?agent=${encodeURIComponent(a.id)}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                        {a.name}
                      </Link>
                    </td>
                    <td style={{ padding: 'var(--space-2) var(--space-3)', fontSize: '0.82rem', color: 'var(--silver)', textAlign: 'right' }}>{a.orderCount}</td>
                    <td style={{ padding: 'var(--space-2) var(--space-3)', fontSize: '0.82rem', color: 'var(--teal)', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(a.gmv)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid-2" style={{ marginBottom: 'var(--space-8)' }}>
        <div className="glass-panel">
          <div className="" style={{ padding: 'var(--space-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
              <h3 style={{ fontSize: '1rem', margin: 0 }}>Top SKUs (30 Days)</h3>
              <Link href="/admin/sales" style={{ fontSize: '0.8rem', color: 'var(--teal)', textDecoration: 'none' }}>Full Sales</Link>
            </div>
            {metrics.topSkus.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--grey-400)', textAlign: 'center', padding: 'var(--space-6) 0' }}>
                No Sales In The Last 30 Days
              </p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <th style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'left', fontSize: '0.7rem', color: 'var(--grey-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Product</th>
                    <th style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right', fontSize: '0.7rem', color: 'var(--grey-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Qty</th>
                    <th style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right', fontSize: '0.7rem', color: 'var(--grey-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.topSkus.map((sku) => (
                    <tr key={sku.name} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: 'var(--space-2) var(--space-3)', fontSize: '0.82rem', color: 'var(--silver)' }}>{sku.name}</td>
                      <td style={{ padding: 'var(--space-2) var(--space-3)', fontSize: '0.82rem', color: 'var(--white)', textAlign: 'right', fontWeight: 600 }}>{sku.quantity}</td>
                      <td style={{ padding: 'var(--space-2) var(--space-3)', fontSize: '0.82rem', color: 'var(--teal)', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(sku.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="glass-panel">
          <div className="" style={{ padding: 'var(--space-6)' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: 'var(--space-5)' }}>Recent Admin Activity</h3>
            {metrics.auditLog.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--grey-400)', textAlign: 'center', padding: 'var(--space-6) 0' }}>
                No Recorded Admin Activity
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', maxHeight: 380, overflowY: 'auto' }}>
                {metrics.auditLog.map((entry) => {
                  const actor = entry.actor_name || entry.actor_email || 'System';
                  return (
                    <div
                      key={entry.id}
                      style={{
                        display: 'flex',
                        gap: 'var(--space-3)',
                        padding: 'var(--space-3)',
                        background: 'var(--surface-1)',
                        borderRadius: 'var(--radius-md)',
                        border: 'var(--border-subtle)',
                      }}
                    >
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--teal)', marginTop: 8, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.82rem', color: 'var(--silver)' }}>
                          <span style={{ fontWeight: 700, color: 'var(--white)' }}>{actor}</span>
                          {' '}
                          <span style={{ color: 'var(--grey-400)' }}>{formatAuditAction(entry.action)}</span>
                          {entry.entity_type && (
                            <> <span style={{ color: 'var(--grey-400)' }}>On</span> <span style={{ color: 'var(--silver)' }}>{formatAuditAction(entry.entity_type)}</span></>
                          )}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--grey-400)', marginTop: 2 }}>
                          {timeAgo(entry.created_at)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <AdminAnalytics />
    </div>
  );
}
