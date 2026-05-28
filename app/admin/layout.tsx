import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

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
    href: '/admin/transactions',
    label: 'Transaction History',
    icon: <svg {...ICON_PROPS}><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
  },
  {
    href: '/admin/pricing',
    label: 'Pricing Tiers',
    icon: <svg {...ICON_PROPS}><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
  },
  {
    href: '/admin/statements',
    label: 'Statements',
    icon: <svg {...ICON_PROPS}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>,
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
        borderRight: 'var(--border-silver)',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0, left: 0, bottom: 0,
        zIndex: 50,
      }}>
        {/* Brand — clickable home link */}
        <Link href="/admin" style={{
          padding: 'var(--space-6)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          textDecoration: 'none',
          display: 'block',
        }}>
          <div style={{
            fontFamily: 'var(--font-brand)',
            fontSize: '0.92rem',
            fontWeight: 800,
            letterSpacing: '0.12em',
            color: 'var(--teal)',
            textShadow: '0 0 12px rgba(0,196,188,0.3)'
          }}>
            PEP NATION LAB
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--grey-400)', marginTop: 4 }}>
            Admin Control Panel
          </div>
        </Link>

        {/* Nav */}
        <nav style={{ padding: 'var(--space-4) 0', flex: 1 }}>
          {NAV.map(({ href, label, icon }) => {
            if (profile?.role === 'shipping' && href !== '/admin/orders') return null;
            
            return (
              <Link
                key={href}
                href={href}
                className="sidebar-nav-item"
                style={{ padding: 'var(--space-3) var(--space-5)' }}
              >
                <span style={{ fontSize: '0.9rem', color: 'var(--teal)' }}>{icon}</span>
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div style={{
          padding: 'var(--space-4) var(--space-5)',
          borderTop: '1px solid rgba(255,255,255,0.06)'
        }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--grey-400)', marginBottom: 'var(--space-2)' }}>
            Signed In As
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--silver)', marginBottom: 'var(--space-3)' }}>
            {profile?.full_name ?? (user.email ? `@${user.email.split('@')[0]}` : 'Admin')}
          </div>
          <Link href="/dashboard" style={{ fontSize: '0.78rem', color: 'var(--teal)', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 'var(--space-2)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Back To Dashboard
          </Link>
          <form action="/api/auth/signout" method="POST">
            <button type="submit" style={{
              fontSize: '0.75rem', color: 'var(--grey-400)',
              background: 'none', border: 'none', cursor: 'pointer', padding: 0
            }}>
              Sign Out
            </button>
          </form>
        </div>
      </aside>

      {/* Main content — constrained to viewport */}
      <main style={{ marginLeft: 240, flex: 1, minHeight: '100vh', maxWidth: 'calc(100vw - 240px)', overflowX: 'auto' }}>
        {children}
      </main>
    </div>
  );
}
