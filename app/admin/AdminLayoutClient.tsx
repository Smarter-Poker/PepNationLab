'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AdminMessageBell from '@/components/AdminMessageBell';
import Navbar from '@/components/Navbar';
import AdminRealtimeRefresher from '@/components/AdminRealtimeRefresher';

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
  { href: '/admin', label: 'Dashboard', icon: <svg {...ICON_PROPS}><rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" /><rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" /></svg> },
  { href: '/admin/search', label: 'Global Search', icon: <svg {...ICON_PROPS}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg> },
  { href: '/admin/products', label: 'Products', icon: <svg {...ICON_PROPS}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg> },
  { href: '/admin/store-preview', label: 'Store Preview', icon: <svg {...ICON_PROPS}><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="3" y1="9" x2="21" y2="9" /></svg> },
  { href: '/admin/agents', label: 'Agents', icon: <svg {...ICON_PROPS}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg> },
  { href: '/admin/network', label: 'Network', icon: <svg {...ICON_PROPS}><circle cx="12" cy="5" r="3" /><circle cx="5" cy="19" r="3" /><circle cx="19" cy="19" r="3" /><line x1="12" y1="8" x2="5" y2="16" /><line x1="12" y1="8" x2="19" y2="16" /></svg> },
  { href: '/admin/researchers', label: 'Researchers', icon: <svg {...ICON_PROPS}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg> },
  { href: '/admin/sales', label: 'Sales & Revenue', icon: <svg {...ICON_PROPS}><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg> },
  { href: '/admin/orders', label: 'Orders', icon: <svg {...ICON_PROPS}><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg> },
  { href: '/messenger?compose=1', label: 'Find User', icon: <svg {...ICON_PROPS}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>, action: true },
  { href: '/messenger', label: 'Messenger', icon: <svg {...ICON_PROPS}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg> },
  { href: '/admin/agent-notes', label: 'Shadow Notes', icon: <svg {...ICON_PROPS}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="9" y1="13" x2="15" y2="13" /></svg> },
  { href: '/admin/referrals', label: 'Referrals', icon: <svg {...ICON_PROPS}><path d="M17 11a4 4 0 1 0-8 0M3 21h18M5 21a7 7 0 0 1 14 0"/></svg> },
  { href: '/admin/transactions', label: 'Transactions', icon: <svg {...ICON_PROPS}><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg> },
  { href: '/admin/pricing', label: 'Pricing', icon: <svg {...ICON_PROPS}><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg> },
  { href: '/admin/coupons', label: 'Coupons', icon: <svg {...ICON_PROPS}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg> },
  { href: '/admin/flash-sales', label: 'Flash Sales', icon: <svg {...ICON_PROPS}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg> },
  { href: '/admin/cart-recovery', label: 'Cart Recovery', icon: <svg {...ICON_PROPS}><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></svg> },
  { href: '/admin/moderation', label: 'Moderation', icon: <svg {...ICON_PROPS}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg> },
  { href: '/admin/statements', label: 'Statements', icon: <svg {...ICON_PROPS}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg> },
  { href: '/admin/settings', label: 'Account Settings', icon: <svg {...ICON_PROPS}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
  { href: '/admin/settings/shipping', label: 'Shipping Settings', icon: <svg {...ICON_PROPS}><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> },
  { href: '/admin/audit', label: 'Audit Log', icon: <svg {...ICON_PROPS}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
];

export function AdminLayoutClient({
  children,
  adminName,
}: {
  children: React.ReactNode;
  adminName: string;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  return (
    <>
      {/* fix-57 #7: global admin Realtime refresher — server components re-fetch on orders/notifications events. */}
      <AdminRealtimeRefresher />

      <Navbar onMenuClick={() => setSidebarOpen(o => !o)} isOpen={sidebarOpen} />

      <div style={{ minHeight: '100dvh', background: 'var(--black)', display: 'flex', paddingTop: 'var(--nav-offset, 60px)' }}>

      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5,10,15,0.6)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            zIndex: 490,
          }}
        />
      )}

      <aside
        className={`admin-sidebar${sidebarOpen ? ' open' : ''}`}
        style={{
          width: 240,
          background: 'var(--black-2)',
          borderRight: '1px solid rgba(192,184,168,0.12)',
          padding: 'var(--space-4) 0',
          position: 'sticky',
          top: 'var(--nav-offset, 60px)',
          alignSelf: 'flex-start',
          height: 'calc(100dvh - var(--nav-offset, 60px))',
          overflowY: 'auto',
          zIndex: 500,
        }}
      >
        <div style={{ padding: '0 var(--space-4) var(--space-3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--teal)', fontWeight: 700 }}>
              Admin
            </div>
            <div style={{ fontSize: '0.95rem', color: 'var(--ivory)', marginTop: 2 }}>
              {adminName}
            </div>
          </div>
          <AdminMessageBell />
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 var(--space-2)' }}>
          {NAV.map((item) => {
            const hrefRoute = item.href.split('?')[0];
            const active = !item.action && pathname === hrefRoute;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 12px',
                  borderRadius: 8,
                  color: active ? 'var(--teal)' : 'var(--ivory)',
                  background: active ? 'rgba(192,184,168,0.08)' : 'transparent',
                  textDecoration: 'none',
                  fontSize: '0.88rem',
                  fontWeight: active ? 600 : 500,
                }}
              >
                <span style={{ display: 'inline-flex', width: 18, justifyContent: 'center' }}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <main style={{ flex: 1, minWidth: 0, padding: 'var(--space-4)', boxSizing: 'border-box', maxWidth: '100%' }}>
        {children}
      </main>

      </div>
    </>
  );
}
