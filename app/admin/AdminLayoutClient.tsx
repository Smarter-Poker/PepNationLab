'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AdminMessageBell from '@/components/AdminMessageBell';
import Navbar from '@/components/Navbar';
import AdminRealtimeRefresher from '@/components/AdminRealtimeRefresher';
import MyQRCodeModal from '@/components/MyQRCodeModal';

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
  { href: '/admin', label: 'Admin Dashboard', icon: <svg {...ICON_PROPS}><rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" /><rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" /></svg> },
  { href: '/admin/pricing', label: 'Pricing', icon: <svg {...ICON_PROPS}><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg> },
  { href: '/admin/products', label: 'Products', icon: <svg {...ICON_PROPS}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg> },
  { href: '/admin/admin-store', label: 'Admin Store', icon: <svg {...ICON_PROPS}><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg> },
  { href: '/admin/store-preview', label: 'Visit Storefront', icon: <svg {...ICON_PROPS}><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="3" y1="9" x2="21" y2="9" /></svg> },
  { href: '/wallet', label: 'Wallet', icon: <svg {...ICON_PROPS}><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></svg> },
  { href: '/admin/payments', label: 'Agent Payments', icon: <svg {...ICON_PROPS}><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg> },
  { href: '/admin/statements', label: 'Statements', icon: <svg {...ICON_PROPS}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg> },
  { href: '/admin/credit-increases', label: 'Credit Requests', icon: <svg {...ICON_PROPS}><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg> },
  { href: '/admin/disputes', label: 'Disputes', icon: <svg {...ICON_PROPS}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg> },
  { href: '/messenger', label: 'Messenger', icon: <svg {...ICON_PROPS}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg> },
  { href: '/admin/search', label: 'Global Search', icon: <svg {...ICON_PROPS}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg> },
  { href: '/messenger?compose=1', label: 'Find User', icon: <svg {...ICON_PROPS}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>, action: true },
  { href: '/admin/orders', label: 'Orders And Fulfillment', icon: <svg {...ICON_PROPS}><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg> },
  { href: '/dashboard/agent?tab=Storefront+Config', label: 'Storefront Configure', icon: <svg {...ICON_PROPS}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg> },
  { href: '/admin/agents', label: 'My Agents', icon: <svg {...ICON_PROPS}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg> },
  { href: '/admin/researchers', label: 'My Researchers', icon: <svg {...ICON_PROPS}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg> },
  { href: '/admin/transactions', label: 'Transactions', icon: <svg {...ICON_PROPS}><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg> },
  { href: '/admin/agent-notes', label: 'Shadow Notes', icon: <svg {...ICON_PROPS}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="9" y1="13" x2="15" y2="13" /></svg> },
  { href: '/admin/network', label: 'Network', icon: <svg {...ICON_PROPS}><circle cx="12" cy="5" r="3" /><circle cx="5" cy="19" r="3" /><circle cx="19" cy="19" r="3" /><line x1="12" y1="8" x2="5" y2="16" /><line x1="12" y1="8" x2="19" y2="16" /></svg> },
  { href: '/dashboard/agent?tab=Inventory', label: 'Local Instock Inventory', icon: <svg {...ICON_PROPS}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg> },
  { href: '/admin/sales', label: 'Sales And Revenue', icon: <svg {...ICON_PROPS}><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg> },
  { href: '/research', label: 'Research Library', icon: <svg {...ICON_PROPS}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg> },
  { href: '/admin/coupons', label: 'Coupons', icon: <svg {...ICON_PROPS}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg> },
  { href: '/admin/catalog-risk', label: 'Catalog Risk', icon: <svg {...ICON_PROPS}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg> },
  { href: '/research/calculators', label: 'Lab Tools Calculator', icon: <svg {...ICON_PROPS}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg> },
  { href: '/lab-journal', label: 'Lab Journal', icon: <svg {...ICON_PROPS}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg> },
  { href: '/admin/settings/shipping', label: 'Global Shipping Settings', icon: <svg {...ICON_PROPS}><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> },
  { href: '/admin/referrals', label: 'Referrals', icon: <svg {...ICON_PROPS}><path d="M17 11a4 4 0 1 0-8 0M3 21h18M5 21a7 7 0 0 1 14 0"/></svg> },
  { href: '/admin/flash-sales', label: 'Flash Sale', icon: <svg {...ICON_PROPS}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg> },
  { href: '/admin/cart-recovery', label: 'Cart Recovery', icon: <svg {...ICON_PROPS}><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></svg> },
  { href: '/admin/moderation', label: 'Moderation', icon: <svg {...ICON_PROPS}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg> },
  { href: '#SHOW_QR', label: 'My QR Code', icon: <svg {...ICON_PROPS}><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="3" height="3" /><rect x="19" y="14" width="2" height="2" /><rect x="14" y="19" width="2" height="2" /><rect x="19" y="19" width="2" height="2" /></svg>, action: 'qr' },
  { href: '/admin/audit', label: 'Audit Log', icon: <svg {...ICON_PROPS}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
  { href: '/admin/settings', label: 'Account Settings', icon: <svg {...ICON_PROPS}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
  { href: '/api/auth/signout', label: 'Log Out', icon: <svg {...ICON_PROPS}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>, action: 'logout' },
];

export function AdminLayoutClient({
  children,
  adminName,
}: {
  children: React.ReactNode;
  adminName: string;
}) {
  const pathname = usePathname();
  const [showQRModal, setShowQRModal] = useState(false);

  return (
    <>
      <AdminRealtimeRefresher />

      <Navbar />

      <div style={{ minHeight: '100dvh', background: 'var(--black)', display: 'flex', paddingTop: 'var(--nav-offset, 60px)' }}>

      <aside
        className="admin-sidebar"
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
          display: 'flex',
          flexDirection: 'column',
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

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 var(--space-2)', flex: 1 }}>
          {NAV.map((item) => {
            const hrefRoute = item.href.split('?')[0];
            const active = !item.action && pathname === hrefRoute;
            
            const commonStyle = {
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
              cursor: 'pointer',
              border: 'none',
              width: '100%',
              textAlign: 'left' as const,
              fontFamily: 'inherit',
            };

            if (item.action === 'logout') {
              return (
                <form key={item.href} action={item.href} method="POST">
                  <button type="submit" style={commonStyle}>
                    <span style={{ display: 'inline-flex', width: 18, justifyContent: 'center' }}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </button>
                </form>
              );
            }

            if (item.action === 'qr') {
              return (
                <button
                  key={item.href}
                  onClick={(e) => { e.preventDefault(); setShowQRModal(true); }}
                  style={commonStyle}
                >
                  <span style={{ display: 'inline-flex', width: 18, justifyContent: 'center' }}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </button>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => {}}
                style={commonStyle}
              >
                <span style={{ display: 'inline-flex', width: 18, justifyContent: 'center' }}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div style={{
          padding: 'var(--space-4)',
          paddingBottom: 'max(var(--space-4), env(safe-area-inset-bottom, 16px))',
          background: 'rgba(0,0,0,0.2)',
          marginTop: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)'
        }}>
          <div style={{ 
            width: 36, height: 36, borderRadius: '50%', 
            background: 'var(--teal)', color: '#000', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', 
            fontWeight: 800, fontSize: '1rem', flexShrink: 0
          }}>
            {adminName ? adminName.charAt(0).toUpperCase() : '?'}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--grey-400)', fontFamily: 'var(--font-brand)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 2 }}>
              Logged In As
            </div>
            <div style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {adminName || 'Admin'}
            </div>
          </div>
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0, padding: 'var(--space-4)', boxSizing: 'border-box', maxWidth: '100%' }}>
        {children}
      </main>

      </div>
      
      {showQRModal && (
        <MyQRCodeModal open={true} onClose={() => { window.location.hash = ''; setShowQRModal(false); }} />
      )}
    </>
  );
}
