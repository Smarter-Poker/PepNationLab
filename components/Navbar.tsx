'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import NavbarNotificationBell from '@/components/NavbarNotificationBell';
import MessageBell from '@/components/MessageBell';

/* ─────────────────────────────────────────────
   Page title resolution — maps route prefixes
   to human-readable, title-case labels.
   ───────────────────────────────────────────── */
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
  if (pathname.startsWith('/become-agent'))   return 'Become An Agent';
  if (pathname.startsWith('/login'))          return 'Sign In';
  if (pathname.startsWith('/account'))        return 'Account';
  if (pathname.startsWith('/orders'))         return 'My Orders';
  if (pathname.startsWith('/checkout'))       return 'Checkout';
  if (pathname.startsWith('/shipping'))       return 'Shipping';
  if (pathname.startsWith('/invite'))         return 'Invitation';

  // Agent storefront slugs — single-segment paths
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 1 && !pathname.startsWith('/api')) {
    if (role.includes('agent') || role === 'researcher') return 'Agent Storefront';
  }

  return 'Pep Nation Lab';
}

/* ─────────────────────────────────────────────
   Mobile / slide-out nav drawer items
   ───────────────────────────────────────────── */
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
  return (
    <Link
      href={href}
      onClick={onClick}
      style={{
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
      }}
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
  const [profile, setProfile] = useState<{ full_name?: string | null; role?: string; referring_agent_id?: string | null } | null>(null);
  const [agentSlug, setAgentSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);


  const role = profile?.role ?? 'researcher';
  const displayName = profile?.full_name || user?.email?.split('@')[0] || '';
  const pageTitle = resolveTitle(pathname, role);
  const finalTitle = title || pageTitle;
  const isMessenger = pathname.startsWith('/messenger');

  // Dashboard link based on role
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

  // Lock body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auth state
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser({ id: session.user.id, email: session.user.email });
        supabase
          .from('profiles')
          .select('full_name, role, referring_agent_id')
          .eq('id', session.user.id)
          .maybeSingle()
          .then(({ data }) => {
            if (data) {
              setProfile(data);
              // If researcher, look up their agent's storefront slug
              if (data.role === 'researcher' && data.referring_agent_id) {
                supabase
                  .from('agent_profiles')
                  .select('slug')
                  .eq('id', data.referring_agent_id)
                  .maybeSingle()
                  .then(({ data: ap }) => { if (ap?.slug) setAgentSlug(ap.slug); });
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
          .select('full_name, role, referring_agent_id')
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
                  .then(({ data: ap }) => { if (ap?.slug) setAgentSlug(ap.slug); });
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

  // ── Smart Hierarchical Back Button ───────────────────────────────────────
  // We conditionally use native browser history if available. If the user landed
  // on a deep link directly (empty history stack), we route them up the app hierarchy.
  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    // Fallback: Logical Parent Routes
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

  return (
    <>
      {/* ══════════════════════════════════════════
          HEADER BAR
      ══════════════════════════════════════════ */}
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
        {/* LEFT: Hamburger */}
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
          {(isOpen !== undefined ? isOpen : drawerOpen) ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          ) : (
            <img src="/images/hamburger-icon.png" alt="Menu" width={36} height={36} style={{ display: 'block' }} />
          )}
        </button>

        {/* Back arrow */}
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
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.5))', transition: 'opacity 0.2s', display: 'block' }} onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')} onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
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

            {/* Vertical divider */}
            <div style={{ width: 1, height: 22, background: 'var(--surface-3)', flexShrink: 0, marginLeft: 4 }} />
          </>
        )}

        {/* CENTER: Page title */}
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <span style={{
            fontFamily: 'var(--font-brand)',
            fontSize: '0.9rem',
            fontWeight: 800,
            color: 'var(--nav-title)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: 'block',
          }}>
            {finalTitle}
          </span>
        </div>

        {/* RIGHT: Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>
          {loading ? (
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--surface-2)' }} className="skeleton" />
          ) : user ? (
            <>
              {/* Messenger / Notification Bell */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <MessageBell onViewAll={() => router.push('/messenger')} />
                <NavbarNotificationBell />
              </div>

              <Link href={dashLink} aria-label={dashLabel} style={{ display: 'flex', alignItems: 'center', padding: 8, transition: 'transform 0.2s', background: 'none' }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                <img 
                  src={
                    role === 'admin' ? '/nav-icons/admin-dashboard.png' :
                    role.includes('agent') ? '/nav-icons/agent-dashboard.png' :
                    '/nav-icons/dashboard.png'
                  } 
                  alt={dashLabel} 
                  width={42} 
                  height={42} 
                  style={{ objectFit: 'contain', display: 'block' }} 
                />
              </Link>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}
                onClick={() => setDrawerOpen(o => !o)}
                title={displayName}
              >
                <span
                  className="nav-display-name"
                  style={{
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: 'var(--nav-title)',
                    maxWidth: 130,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {displayName}
                </span>
              </div>
            </>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost btn-sm">Sign In</Link>
              <Link href="/become-agent" className="btn btn-primary btn-sm" style={{ fontSize: '0.78rem', padding: '6px 10px' }}>
                Join
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* ══════════════════════════════════════════
          SLIDE-OUT DRAWER (global site nav — not shown when admin controls hamburger)
      ══════════════════════════════════════════ */}
      {/* Backdrop */}
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

      {/* Drawer panel — only rendered for non-admin pages */}
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

        {/* User info in drawer */}
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

        {/* Navigation links */}
        <nav style={{ flex: 1, padding: 'var(--space-3) 0', paddingBottom: 'calc(var(--space-6) + env(safe-area-inset-bottom, 24px))' }}>
          {/* Common links */}
          <DrawerLink href={dashLink} label="Home" onClick={closeDrawer}
            icon={<svg {...IP}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>}
          />
          {/* Products link — hidden for researchers (they use their agent's storefront) */}
          {role !== 'researcher' && (
            <DrawerLink href="/products" label="Products" onClick={closeDrawer}
              icon={<svg {...IP}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>}
            />
          )}
          {/* Researchers see their agent's storefront instead */}
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

              {/* Dashboard */}
              <DrawerLink href={dashLink} label={dashLabel} onClick={closeDrawer}
                icon={<svg {...IP}><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>}
              />

              {/* Messenger — only shown when NOT on messenger page */}
              {!isMessenger && (
                <DrawerLink href="/messenger" label="Messenger" onClick={closeDrawer}
                  icon={<svg {...IP}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>}
                />
              )}

              {/* Agent-specific */}
              {role.includes('agent') && (
                <>
                  <DrawerLink href="/dashboard/agent" label="My Store" onClick={closeDrawer}
                    icon={<svg {...IP}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>}
                  />
                </>
              )}

              {/* Researcher */}
              {role === 'researcher' && (
                <DrawerLink href="/become-agent" label="Become An Agent" onClick={closeDrawer}
                  icon={<svg {...IP}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>}
                />
              )}

              <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: 'var(--space-2) 0' }} />

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
              <DrawerLink href="/become-agent" label="Become An Agent" onClick={closeDrawer}
                icon={<svg {...IP}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>}
              />
            </>
          )}
        </nav>
      </div>
      )} {/* end !onMenuClick drawer panel */}


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
