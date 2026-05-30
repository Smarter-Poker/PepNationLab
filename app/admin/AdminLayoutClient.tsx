'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AdminMessageBell from '@/components/AdminMessageBell';
import Navbar from '@/components/Navbar';

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
  { href: '/admin/products', label: 'Products', icon: <svg {...ICON_PROPS}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg> },
  { href: '/admin/store-preview', label: 'Store Preview', icon: <svg {...ICON_PROPS}><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" /></svg> },
  { href: '/admin/agents', label: 'Agents', icon: <svg {...ICON_PROPS}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg> },
  { href: '/admin/invitations', label: 'Invitations', icon: <svg {...ICON_PROPS}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg> },
  { href: '/admin/researchers', label: 'Researchers', icon: <svg {...ICON_PROPS}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg> },
  { href: '/admin/sales', label: 'Sales & Revenue', icon: <svg {...ICON_PROPS}><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg> },
  { href: '/admin/orders', label: 'Orders', icon: <svg {...ICON_PROPS}><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg> },
  { href: '/admin/restock', label: 'Wholesale Restock', icon: <svg {...ICON_PROPS}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><path d="M7.5 4.21l9 5.16" /></svg> },
  { href: '/admin/subscriptions', label: 'Subscriptions', icon: <svg {...ICON_PROPS}><circle cx="12" cy="12" r="10"/><polyline points="12 8 12 12 14 14"/></svg> },
  { href: '/admin/referrals', label: 'Referrals', icon: <svg {...ICON_PROPS}><path d="M17 11a4 4 0 1 0-8 0M3 21h18M5 21a7 7 0 0 1 14 0"/></svg> },
  { href: '/admin/store-credits', label: 'Store Credits', icon: <svg {...ICON_PROPS}><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> },
  { href: '/admin/transactions', label: 'Transactions', icon: <svg {...ICON_PROPS}><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg> },
  { href: '/admin/pricing', label: 'Pricing', icon: <svg {...ICON_PROPS}><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg> },
  { href: '/admin/tax-rules', label: 'Tax Rules', icon: <svg {...ICON_PROPS}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg> },
  { href: '/admin/tax-exemptions', label: 'Tax Exemptions', icon: <svg {...ICON_PROPS}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="9 15 11 17 15 13"/></svg> },
  { href: '/admin/scheduled-prices', label: 'Scheduled Prices', icon: <svg {...ICON_PROPS}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
  { href: '/admin/coupons', label: 'Coupons', icon: <svg {...ICON_PROPS}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg> },
  { href: '/admin/statements', label: 'Statements', icon: <svg {...ICON_PROPS}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg> },
  { href: '/admin/commissions', label: 'Commissions', icon: <svg {...ICON_PROPS}><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg> },
  { href: '/admin/messages', label: 'Messages', icon: <svg {...ICON_PROPS}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg> },
  { href: '/admin/push', label: 'Push Log', icon: <svg {...ICON_PROPS}><path d="M22 8v6a2 2 0 0 1-2 2h-7l-4 4v-4H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" /></svg> },
  { href: '/admin/webhooks', label: 'Webhooks', icon: <svg {...ICON_PROPS}><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg> },
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

  // Close sidebar on route change
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  // Lock body scroll when sidebar is open on mobile
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  return (
    <>
      {/* ── Global site header — same as every other page ── */}
      <Navbar />

      <div style={{ minHeight: '100dvh', background: 'var(--black)', display: 'flex', paddingTop: 60 }}>

      {/* ── Mobile sidebar backdrop ── */}
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

      {/* ── Sidebar ── */}
      <aside
        className={`admin-sidebar${sidebarOpen ? ' open' : ''}`}
        style={{
          width: 240,
          background: 'var(--black-2)',
          borderRight: '1px solid rgba(192,184,168,0.12)',
          padding: 'var(--space-4) 0',
          position: 'sticky',
          top: 60,
          alignSelf: 'flex-start',
          height: 'calc(100vh - 60px)',
          overflowY: 'auto',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '0 var(--space-4) var(--space-4)' }}>
          <div style={{ color: 'var(--silver)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Admin Panel</div>
          <div style={{ color: 'var(--white)', fontSize: '0.88rem', marginTop: 4, fontWeight: 600 }}>{adminName}</div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 var(--space-2)' }}>
          {NAV.map(({ href, label, icon }) => {
            // Exact match for /admin dashboard, prefix match for sub-pages
            const isActive = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);
            return (
              <Link
                key={`${href}-${label}`}
                href={href}
                className="admin-nav-link"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  color: isActive ? 'var(--teal)' : 'var(--silver)',
                  fontSize: '0.85rem',
                  textDecoration: 'none',
                  transition: 'background 0.15s, color 0.15s',
                  background: isActive ? 'rgba(192,184,168,0.08)' : 'transparent',
                  borderLeft: isActive ? '2px solid var(--teal)' : '2px solid transparent',
                }}
              >
                <span style={{ display: 'inline-flex', width: 16, height: 16, opacity: isActive ? 1 : 0.65 }}>{icon}</span>
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* ── Sign Out ── */}
        <div style={{ padding: 'var(--space-3) var(--space-2)', marginTop: 'auto', paddingBottom: 'max(var(--space-4), env(safe-area-inset-bottom, 16px))' }}>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', marginBottom: 'var(--space-3)' }} />
          <form action="/api/auth/signout" method="post">
            <button
              type="submit"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                background: 'transparent',
                border: 'none',
                color: 'var(--red)',
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'background 0.15s',
                textAlign: 'left',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(229,62,62,0.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>Sign Out</span>
            </button>
          </form>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main
        className="admin-main"
        style={{
          flex: 1,
          minWidth: 0,
          overflowX: 'hidden',
          overflowY: 'auto',
          /* -webkit-overflow-scrolling for iOS momentum scroll on admin pages */
          WebkitOverflowScrolling: 'touch' as const,
        }}
      >

        {/* Mobile-only sidebar toggle — compact, doesn't duplicate the Navbar */}
        <div className="admin-mobile-topbar">
          <button
            onClick={() => setSidebarOpen(o => !o)}
            aria-label="Open Admin Menu"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--silver)',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: '0.82rem',
              fontWeight: 600,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 7h18M3 12h18M3 17h18" />
            </svg>
            Admin Menu
          </button>
        </div>

        {children}

      </main>

      <style>{`
        .admin-nav-link:hover {
          background: rgba(255,255,255,0.04) !important;
          color: var(--white) !important;
        }
        /* Mobile-only topbar: visible on mobile, hidden on desktop */
        .admin-mobile-topbar {
          display: none;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          padding: 4px 0;
        }
        /* Mobile: sidebar is a fixed drawer, hidden off-screen by default */
        @media (max-width: 1024px) {
          .admin-mobile-topbar { display: flex; }
          .admin-sidebar {
            position: fixed !important;
            top: 60px !important;
            left: 0 !important;
            height: calc(100dvh - 60px) !important;
            z-index: 500 !important;
            transform: translateX(-100%) !important;
            transition: transform 0.25s ease !important;
            box-shadow: 4px 0 24px rgba(0,0,0,0.4) !important;
          }
          .admin-sidebar.open {
            transform: translateX(0) !important;
          }
        }
        /* Desktop: sidebar is sticky in the flex row */
        @media (min-width: 1025px) {
          .admin-sidebar {
            position: sticky !important;
            transform: none !important;
            box-shadow: none !important;
          }
        }
      `}</style>
    </div>
    </>
  );
}
