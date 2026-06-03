'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import NavbarNotificationBell from '@/components/NavbarNotificationBell';
import MessageBell from '@/components/MessageBell';
import NavbarWalletBadge from '@/components/NavbarWalletBadge';
import WalletCard from '@/components/WalletCard';
import { getRoleNavLinks } from '@/components/roleNavLinks';
import MyQRCodeModal from './MyQRCodeModal';

function resolveTitle(pathname: string, role: string): string {
  if (pathname === '/')               return 'Pep Nation Lab';
  if (pathname.startsWith('/admin/products')) return 'Product Catalog';
  if (pathname.startsWith('/admin/agents'))   return 'Agents';
  if (pathname.startsWith('/admin/orders'))   return 'Orders';
  if (pathname.startsWith('/admin/sales'))    return 'Sales & Revenue';
  if (pathname.startsWith('/admin/pricing'))  return 'Pricing';
  if (pathname.startsWith('/admin/researchers')) return 'Researchers';
  if (pathname.startsWith('/admin/invitations')) return 'Invitations';
  if (pathname.startsWith('/admin/commissions')) return 'Commissions';
  if (pathname.startsWith('/admin/coupons'))  return 'Coupons';
  if (pathname.startsWith('/admin/statements')) return 'Statements';
  if (pathname.startsWith('/admin/restock'))  return 'Wholesale Restock';
  if (pathname.startsWith('/admin/transactions')) return 'Transactions';
  if (pathname.startsWith('/admin/webhooks')) return 'Webhooks';
  if (pathname.startsWith('/admin/settings')) return 'Admin Settings';
  if (pathname.startsWith('/admin/audit'))    return 'Audit Log';
  if (pathname.startsWith('/admin/push'))     return 'Push Notifications';
  if (pathname.startsWith('/admin/moderation')) return 'Message Moderation';
  if (pathname.startsWith('/admin/messenger')) return 'Messenger';
  if (pathname.startsWith('/admin/subscriptions')) return 'Subscriptions';

  if (pathname.startsWith('/admin/scheduled-prices')) return 'Scheduled Prices';
  if (pathname.startsWith('/admin/store-credits')) return 'Store Credits';
  if (pathname.startsWith('/admin/store-preview')) return 'Store Preview';
  if (pathname.startsWith('/admin/referrals')) return 'Referrals';
  if (pathname.startsWith('/admin/sms'))      return 'SMS';
  if (pathname.startsWith('/admin'))          return 'Admin Dashboard';
  if (pathname.startsWith('/messenger'))      return 'Messenger';
  if (pathname.startsWith('/dashboard/agent')) return 'Agent Dashboard';
  if (pathname.startsWith('/dashboard'))      return 'Dashboard';
  if (pathname.startsWith('/products'))       return 'Products';
  if (pathname.startsWith('/about'))          return 'About';
  if (pathname.startsWith('/login'))          return 'Sign In';
  if (pathname.startsWith('/account'))        return 'Account';
  if (pathname.startsWith('/lab-tools'))      return 'Lab Tools';
  if (pathname.startsWith('/orders'))         return 'My Orders';
  if (pathname.startsWith('/checkout'))       return 'Checkout';
  if (pathname.startsWith('/shipping'))       return 'Shipping';
  if (pathname.startsWith('/invite'))         return 'Invitation';

  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 1 && !pathname.startsWith('/api')) {
    if (role.includes('agent') || role === 'researcher') return 'Agent Storefront';
  }

  return 'Pep Nation Lab';
}

function DrawerLink({
  href,
  label,
  icon,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  const commonStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
    padding: '12px var(--space-5)',
    color: 'var(--silver)',
    fontSize: '0.95rem',
    fontWeight: 500,
    textDecoration: 'none',
    borderLeft: '3px solid transparent',
    transition: 'all 0.15s',
    minHeight: 48,
    background: 'none',
    border: 'none',
    borderLeftColor: 'transparent',
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left',
  };

  if (href === '#SHOW_QR') {
    return (
      <button
        onClick={(e) => { e.preventDefault(); onClick(); }}
        style={commonStyles}
        className="drawer-link"
      >
        <span style={{ display: 'inline-flex', opacity: 0.7 }}>{icon}</span>
        {label}
      </button>
    );
  }

  return (
    <Link
      href={href}
      onClick={onClick}
      style={commonStyles}
      className="drawer-link"
    >
      <span style={{ display: 'inline-flex', opacity: 0.7 }}>{icon}</span>
      {label}
    </Link>
  );
}

const IP = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export default function Navbar({ onMenuClick, isOpen, title }: { onMenuClick?: () => void; isOpen?: boolean; title?: string } = {}) {
  const router = useRouter();
  const pathname = usePathname();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [profile, setProfile] = useState<{ full_name?: string | null; role?: string; referring_agent_id?: string | null; is_super_agent?: boolean | null; is_sub_agent?: boolean | null } | null>(null);
  const [agentSlug, setAgentSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showQRModal, setShowQRModal] = useState(false);


  const role = profile?.role ?? 'researcher';
  const displayName = profile?.full_name || user?.email?.split('@')[0] || '';
  const pageTitle = resolveTitle(pathname, role);
  const finalTitle = title || pageTitle;
  const isMessenger = pathname.startsWith('/messenger');

  const dashLink = role === 'admin'
    ? '/admin'
    : role.includes('agent')
    ? '/dashboard/agent'
    : '/dashboard';
  const dashLabel = role === 'admin'
    ? 'Admin Dashboard'
    : role.includes('agent')
    ? 'Agent Dashboard'
    : 'Dashboard';

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const handleMenuClick = (href: string) => {
    if (href === '#SHOW_QR') {
      setShowQRModal(true);
      closeDrawer();
    } else {
      closeDrawer();
    }
  };

  // Canonical per-role hamburger menu — identical on every page for a given
  // role. Null for researchers / logged-out, who keep the generic drawer links.
  const roleLinks = user
    ? getRoleNavLinks(role, {
        isSuperAgent: profile?.is_super_agent === true,
        isSubAgent: profile?.is_sub_agent === true,
        storefrontHref: agentSlug ? `/${agentSlug}` : '/dashboard/agent',
      })
    : null;

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser({ id: session.user.id, email: session.user.email });
        supabase
          .from('profiles')
          .select('full_name, role, referring_agent_id, is_super_agent, is_sub_agent')
          .eq('id', session.user.id)
          .maybeSingle()
          .then(({ data }) => {
            if (data) {
              setProfile(data);
              // A sub-agent is role='agent' + is_sub_agent=true and has no
              // storefront, so only fetch a storefront slug for non-sub agents.
              if (data.role === 'researcher' && data.referring_agent_id) {
                supabase
                  .from('agent_profiles')
                  .select('slug')
                  .eq('id', data.referring_agent_id)
                  .maybeSingle()
                  .then(({ data: ap }) => {
                    if (ap?.slug) setAgentSlug(ap.slug);
                  });
              } else if ((data.role === 'agent' || data.role === 'super_agent') && data.is_sub_agent !== true) {
                supabase
                  .from('agent_profiles')
                  .select('slug')
                  .eq('id', session.user.id)
                  .maybeSingle()
                  .then(({ data: ap }) => {
                    if (ap?.slug) setAgentSlug(ap.slug);
                  });
              }
            }
            setLoading(false);
          });
      } else {
        setLoading(false);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (session) {
        setUser({ id: session.user.id, email: session.user.email });
        supabase
          .from('profiles')
          .select('full_name, role, referring_agent_id, is_super_agent, is_sub_agent')
          .eq('id', session.user.id)
          .maybeSingle()
          .then(({ data }) => {
            if (data) {
              setProfile(data);
              if (data.role === 'researcher' && data.referring_agent_id) {
                supabase
                  .from('agent_profiles')
                  .select('slug')
                  .eq('id', data.referring_agent_id)
                  .maybeSingle()
                  .then(({ data: ap }) => {
                    if (ap?.slug) setAgentSlug(ap.slug);
                  });
              } else if ((data.role === 'agent' || data.role === 'super_agent') && data.is_sub_agent !== true) {
                supabase
                  .from('agent_profiles')
                  .select('slug')
                  .eq('id', session.user.id)
                  .maybeSingle()
                  .then(({ data: ap }) => {
                    if (ap?.slug) setAgentSlug(ap.slug);
                  });
              }
            }
          });
      } else {
        setUser(null);
        setProfile(null);
        setAgentSlug(null);
      }
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);


  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.replace('/');
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    if (pathname.startsWith('/admin/')) {
      router.push('/admin');
    } else if (pathname.startsWith('/account/')) {
      router.push(dashLink);
    } else if (pathname.match(/^\/[^\/]+\/product\//)) {
      const slug = pathname.split('/')[1];
      router.push(`/${slug}/store`);
    } else {
      router.push(dashLink);
    }
  };

  const showBack = pathname !== '/';

  // QR popup details — sub-agents recruit via /invite?ref (no storefront);
  // agents/super-agents share their storefront slug.

  return (
    <>
      <nav
        className="nav pnl-navbar"
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0,
          zIndex: 200,
          height: 60,
          background: 'var(--nav-bg)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--nav-border)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 var(--space-3)',
          gap: 'var(--space-2)',
        }}
      >
        <button
          onClick={() => onMenuClick ? onMenuClick() : setDrawerOpen(o => !o)}
          aria-label="Open Navigation Menu"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--silver)',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 8,
            flexShrink: 0,
            transition: 'background 0.15s',
          }}
        >
          <img src="/images/hamburger-icon.png" alt="Menu" width={36} height={36} style={{ display: 'block' }} />
        </button>

        {showBack && (
          <>
            <button
              onClick={handleBack}
              aria-label="Go Back"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--silver)',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 8,
                flexShrink: 0,
              }}
            >
              <div style={{ width: 36, height: 36, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg className="hover-fade" width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.5))', display: 'block' }}>
                  <defs>
                    <linearGradient id="premium-metal-body" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#E2E8F0" />
                      <stop offset="40%" stopColor="#FFFFFF" />
                      <stop offset="60%" stopColor="#94A3B8" />
                      <stop offset="100%" stopColor="#64748B" />
                    </linearGradient>
                    <linearGradient id="premium-metal-edge" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#FFFFFF" />
                      <stop offset="100%" stopColor="#475569" />
                    </linearGradient>
                  </defs>
                  <path d="M11 5L3 12L11 19V15H21V9H11V5Z" fill="url(#premium-metal-body)" stroke="url(#premium-metal-edge)" strokeWidth="1" strokeLinejoin="round" />
                </svg>
              </div>
            </button>

            <div style={{ width: 1, height: 22, background: 'var(--surface-3)', flexShrink: 0, marginLeft: 4 }} />
          </>
        )}

        {!loading && user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <MessageBell onViewAll={() => router.push('/messenger')} />
            <NavbarNotificationBell />
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }} aria-hidden="true" />

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>
          {loading ? (
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--surface-2)' }} className="skeleton" />
          ) : user ? (
            <>
              <Link href={dashLink} aria-label={dashLabel} className="hover-scale-105" style={{ display: 'flex', alignItems: 'center', padding: 4, background: 'none', flexShrink: 0, marginRight: 4, position: 'relative', left: -8 }}>
                <img
                  src={
                    role === 'admin' ? '/nav-icons/admin-dashboard.png' :
                    role.includes('agent') ? '/nav-icons/agent-dashboard.png' :
                    '/nav-icons/dashboard.png'
                  }
                  alt={dashLabel}
                  width={158}
                  height={74}
                  className="dashboard-icon"
                  style={{ width: 158, height: 'auto', maxWidth: '100%', objectFit: 'contain', display: 'block' }}
                />
              </Link>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', position: 'relative', left: -8 }}
                title={displayName}
              >
                <NavbarWalletBadge />
              </div>
            </>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost btn-sm">Sign In</Link>
            </>
          )}
        </div>
      </nav>

      {!onMenuClick && drawerOpen && (
        <div
          onClick={closeDrawer}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5,10,15,0.6)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            zIndex: 300,
            animation: 'navBackdropIn 0.2s ease',
          }}
        />
      )}

      {!onMenuClick && (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: 280,
          background: 'var(--black-2)',
          borderRight: '1px solid var(--nav-border)',
          zIndex: 400,
          display: 'flex',
          flexDirection: 'column',
          transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
          overflowY: 'auto',
          boxShadow: drawerOpen ? '4px 0 40px rgba(0,0,0,0.6)' : 'none',
          willChange: 'transform',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          padding: 'var(--space-4) var(--space-5)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          minHeight: 64,
        }}>
          <Link href={dashLink} onClick={closeDrawer} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', textDecoration: 'none' }}>
            <Image src="/logo-mark.svg" alt="Pep Nation Lab" width={32} height={32} priority />
            <span style={{ fontFamily: 'var(--font-brand)', fontSize: '0.95rem', fontWeight: 800, color: 'var(--teal)', letterSpacing: '0.08em' }}>
              PEP NATION LAB
            </span>
          </Link>
        </div>

        {user && (
          <div style={{
            padding: 'var(--space-4) var(--space-5)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, color: 'var(--white)', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {displayName}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--grey-400)', textTransform: 'capitalize' }}>
                {role.replace('_', ' ')}
              </div>
            </div>
          </div>
        )}

        <nav style={{ flex: 1, padding: 'var(--space-3) 0' }}>
          
          {/* Role-based menu: identical for a given role on EVERY page, so the
              hamburger matches that role's dashboard menu everywhere. Admin /
              agent / super-agent / sub-agent render their canonical menu; all
              other states (researchers, logged-out) keep the generic links. */}
          {roleLinks ? (
            roleLinks.map((l) => (
              <DrawerLink key={`${l.href}-${l.label}`} href={l.href} label={l.label} onClick={() => handleMenuClick(l.href)} icon={l.icon} />
            ))
          ) : (
            <>
              <DrawerLink href={dashLink} label="Home" onClick={closeDrawer}
                icon={<svg {...IP}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>}
              />
              {role !== 'researcher' && (
                <DrawerLink href="/products" label="Products" onClick={closeDrawer}
                  icon={<svg {...IP}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>}
                />
              )}
              {role === 'researcher' && agentSlug && (
                <DrawerLink href={`/${agentSlug}`} label="Visit Your Store" onClick={closeDrawer}
                  icon={<svg {...IP}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>}
                />
              )}
              <DrawerLink href="/about" label="About" onClick={closeDrawer}
                icon={<svg {...IP}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
              />

              {user && (
                <>
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: 'var(--space-2) 0' }} />
                  <DrawerLink href={dashLink} label={dashLabel} onClick={closeDrawer}
                    icon={<svg {...IP}><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>}
                  />
                  {!isMessenger && (
                    <DrawerLink href="/messenger" label="Messenger" onClick={closeDrawer}
                      icon={<svg {...IP}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>}
                    />
                  )}
                  <DrawerLink href="/account" label="Account Settings" onClick={closeDrawer}
                    icon={<svg {...IP}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>}
                  />
                  <DrawerLink href="/lab-tools" label="Lab Tools Calculator" onClick={closeDrawer}
                    icon={<svg {...IP}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>}
                  />
                </>
              )}
            </>
          )}

          {user && (
            <>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: 'var(--space-2) 0' }} />

              <DrawerLink href="/account/help" label="Help & Support" onClick={closeDrawer}
                icon={<svg {...IP}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="4.93" y1="4.93" x2="9.17" y2="9.17"/><line x1="14.83" y1="14.83" x2="19.07" y2="19.07"/><line x1="14.83" y1="9.17" x2="19.07" y2="4.93"/><line x1="4.93" y1="19.07" x2="9.17" y2="14.83"/></svg>}
              />

              <button
                onClick={() => { closeDrawer(); handleSignOut(); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: '12px var(--space-5)',
                  color: 'var(--red)',
                  fontSize: '0.95rem',
                  fontWeight: 500,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'left',
                  minHeight: 48,
                }}
              >
                <svg {...IP} stroke="var(--red)"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                Sign Out
              </button>
            </>
          )}

          {!user && !loading && (
            <>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: 'var(--space-2) 0' }} />
              <DrawerLink href="/login" label="Sign In" onClick={closeDrawer}
                icon={<svg {...IP}><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>}
              />
            </>
          )}
        </nav>

        {user && profile && (
          <div style={{
            padding: 'var(--space-4)',
            paddingBottom: 'max(var(--space-4), env(safe-area-inset-bottom, 16px))',
            borderTop: '1px solid rgba(255,255,255,0.05)',
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
              {displayName ? displayName.charAt(0).toUpperCase() : '?'}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--grey-400)', fontFamily: 'var(--font-brand)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 2 }}>
                Logged in as
              </div>
              <div style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {displayName || 'User'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--teal)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.email}
              </div>
            </div>
          </div>
        )}
      </div>
      )} {/* end !onMenuClick drawer panel */}

      <MyQRCodeModal open={showQRModal} onClose={() => setShowQRModal(false)} />

      <style>{`
        .pnl-navbar { }
        .drawer-link:hover {
          color: var(--teal) !important;
          background: rgba(192,184,168,0.07);
          border-left-color: var(--teal) !important;
        }
        @keyframes navBackdropIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @media (max-width: 480px) {
          .nav-display-name { display: none !important; }
        }
      `}</style>
    </>
  );
}
