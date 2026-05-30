import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import AdminMessageBell from '@/components/AdminMessageBell';

const ICON_PROPS = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const NAV = [
  {
    href: '/admin',
    label: 'Dashboard',
    icon: <svg {...ICON_PROPS}><rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" /><rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" /></svg>,
  },
  {
    href: '/admin/products',
    label: 'Products',
    icon: <svg {...ICON_PROPS}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>,
  },
  {
    href: '/admin/store-preview',
    label: 'Store Preview',
    icon: <svg {...ICON_PROPS}><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" /></svg>,
  },
  {
    href: '/admin/agents',
    label: 'Agents',
    icon: <svg {...ICON_PROPS}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  },
  {
    href: '/admin/invitations',
    label: 'Invitations',
    icon: <svg {...ICON_PROPS}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>,
  },
  {
    href: '/admin/researchers',
    label: 'Researchers',
    icon: <svg {...ICON_PROPS}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>,
  },
  {
    href: '/admin/sales',
    label: 'Sales & Revenue',
    icon: <svg {...ICON_PROPS}><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg>,
  },
  {
    href: '/admin/orders',
    label: 'Orders',
    icon: <svg {...ICON_PROPS}><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>,
  },
  {
    href: '/admin/restock',
    label: 'Wholesale Restock',
    icon: <svg {...ICON_PROPS}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><path d="M7.5 4.21l9 5.16" /></svg>,
  },
  {
    href: '/admin/subscriptions',
    label: 'Subscriptions',
    icon: <svg {...ICON_PROPS}><circle cx="12" cy="12" r="10"/><polyline points="12 8 12 12 14 14"/></svg>,
  },
  {
    href: '/admin/referrals',
    label: 'Referrals',
    icon: <svg {...ICON_PROPS}><path d="M17 11a4 4 0 1 0-8 0M3 21h18M5 21a7 7 0 0 1 14 0"/></svg>,
  },
  {
    href: '/admin/refunds',
    label: 'Refunds',
    icon: <svg {...ICON_PROPS}><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>,
  },
  {
    href: '/admin/rma',
    label: 'Returns',
    icon: <svg {...ICON_PROPS}><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
  },
  {
    href: '/admin/store-credits',
    label: 'Store Credits',
    icon: <svg {...ICON_PROPS}><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
  },
  {
    href: '/admin/transactions',
    label: 'Transactions',
    icon: <svg {...ICON_PROPS}><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>,
  },
  {
    href: '/admin/pricing',
    label: 'Pricing',
    icon: <svg {...ICON_PROPS}><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
  },
  {
    href: '/admin/tax-rules',
    label: 'Tax Rules',
    icon: <svg {...ICON_PROPS}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>,
  },
  {
    href: '/admin/tax-exemptions',
    label: 'Tax Exemptions',
    icon: <svg {...ICON_PROPS}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="9 15 11 17 15 13"/></svg>,
  },
  {
    href: '/admin/scheduled-prices',
    label: 'Scheduled Prices',
    icon: <svg {...ICON_PROPS}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  },
  {
    href: '/admin/coupons',
    label: 'Coupons',
    icon: <svg {...ICON_PROPS}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>,
  },
  {
    href: '/admin/statements',
    label: 'Statements',
    icon: <svg {...ICON_PROPS}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>,
  },
  {
    href: '/admin/commissions',
    label: 'Commissions',
    icon: <svg {...ICON_PROPS}><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
  },
  {
    href: '/admin/messages',
    label: 'Messages',
    icon: <svg {...ICON_PROPS}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>,
  },
  {
    href: '/admin/push',
    label: 'Push Log',
    icon: <svg {...ICON_PROPS}><path d="M22 8v6a2 2 0 0 1-2 2h-7l-4 4v-4H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" /></svg>,
  },
  {
    href: '/admin/webhooks',
    label: 'Webhooks',
    icon: <svg {...ICON_PROPS}><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>,
  },
  {
    href: '/admin/settings/shipping',
    label: 'Shipping Settings',
    icon: <svg {...ICON_PROPS}><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  },
  {
    href: '/admin/audit',
    label: 'Audit Log',
    icon: <svg {...ICON_PROPS}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  },
  {
    href: '/admin/push',
    label: 'Push Log',
    icon: <svg {...ICON_PROPS}><path d="M22 8v6a2 2 0 0 1-2 2h-7l-4 4v-4H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" /></svg>,
  },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single();

  if (profile?.role === 'shipping') {
    redirect('/shipping');
  }

  if (profile?.role !== 'admin') {
    redirect('/dashboard');
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--black)', display: 'flex' }}>
      {/* Sidebar */}
      <aside style={{
        width: 240,
        minHeight: '100vh',
        background: 'var(--black-2)',
        borderRight: 'var(--border-teal)',
        padding: 'var(--space-4) 0',
        position: 'sticky',
        top: 0,
        alignSelf: 'flex-start',
        height: '100vh',
        overflowY: 'auto',
        flexShrink: 0,
      }}>
        <div style={{ padding: '0 var(--space-4) var(--space-4)' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--white)', textDecoration: 'none' }}>
            <span style={{ fontFamily: 'var(--font-brand)', fontSize: '1.05rem', letterSpacing: '0.1em' }}>
              PEP NATION LAB
            </span>
          </Link>
          <div style={{ marginTop: 'var(--space-1)', color: 'var(--silver)', fontSize: '0.78rem' }}>Admin</div>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 var(--space-2)' }}>
          {NAV.map(({ href, label, icon }) => {
            return (
              <Link
                key={href}
                href={href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--silver)',
                  fontSize: '0.85rem',
                  textDecoration: 'none',
                  transition: 'background 0.15s, color 0.15s',
                }}
                className="admin-nav-link"
              >
                <span style={{ display: 'inline-flex', width: 16, height: 16 }}>{icon}</span>
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
        <div style={{ padding: 'var(--space-4) var(--space-4) 0' }}>
          <div style={{ color: 'var(--silver)', fontSize: '0.75rem' }}>
            Signed In As
          </div>
          <div style={{ color: 'var(--white)', fontSize: '0.88rem', marginTop: 2 }}>
            {profile?.full_name ?? 'Admin'}
          </div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          position: 'sticky',
          top: 0,
          background: 'var(--black)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          padding: 'var(--space-3) var(--space-5)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 10,
        }}>
          <span style={{ color: 'var(--silver)', fontSize: '0.85rem' }}>Admin Dashboard</span>
          <AdminMessageBell />
        </div>
        {children}
      </main>
      <style>{`
        .admin-nav-link:hover {
          background: rgba(255,255,255,0.04);
          color: var(--white);
        }
      `}</style>
    </div>
  );
}
