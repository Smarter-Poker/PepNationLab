'use client';

import Link from 'next/link';
import { isPlatformAdminId } from '@/lib/platform-admins';
import Image from 'next/image';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import NavbarNotificationBell from '@/components/NavbarNotificationBell';
import MessageBell from '@/components/MessageBell';
import NavbarWalletBadge from '@/components/NavbarWalletBadge';
import { getRoleNavLinks } from '@/components/roleNavLinks';
import MyQRCodeModal from './MyQRCodeModal';
import { evictAllCatalogCaches } from '@/lib/storefront-cache';
import { useModalA11y } from '@/lib/useModalA11y';
import GlobalCompletenessWidget from '@/components/GlobalCompletenessWidget';
import { toast } from 'sonner';
import { triggerInstall, isRunningAsApp, isKnownInstalled, subscribeInstallState, isIosSafari } from '@/lib/pwaInstall';
import dynamic from 'next/dynamic';
const PwaIosInstructions = dynamic(() => import('@/components/PwaIosInstructions'), { ssr: false });
import type { SupabaseClient } from '@supabase/supabase-js';
import { isLocale } from '@/lib/i18n';
import { SUPPORTED_LOCALES, LOCALE_LABELS, type Locale } from '@/lib/i18n/manufacturer-dict';
import { navLabel } from '@/lib/i18n/nav-dict';

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
  if (pathname === '/research' || pathname === '/research/')  return 'Research Library';
  if (pathname.startsWith('/research'))        return 'Research Library';
  if (pathname.startsWith('/research/match'))  return 'Find A Peptide';
  if (pathname.startsWith('/find-a-peptide'))  return 'Find A Peptide';
  if (pathname.startsWith('/products'))       return 'Products';
  if (pathname.startsWith('/about'))          return 'About';
  if (pathname.startsWith('/login'))          return 'Sign In';
  if (pathname.startsWith('/account'))        return 'Account';
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

export default function Navbar({ onMenuClick, isOpen, title, agentSlug: propAgentSlug }: { onMenuClick?: () => void; isOpen?: boolean; title?: string; agentSlug?: string } = {}) {
  const router = useRouter();
  const pathname = usePathname();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [profile, setProfile] = useState<{ full_name?: string | null; role?: string; referring_agent_id?: string | null; is_super_agent?: boolean | null; is_sub_agent?: boolean | null; is_manufacturer?: boolean | null; locale?: string | null; is_admin_account?: boolean | null } | null>(null);
  const [agentSlug, setAgentSlug] = useState<string | null>(null);
  const [agentName, setAgentName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showQRModal, setShowQRModal] = useState(false);
  // Whether to surface the manual "Download Pep Nation App" menu item: only
  // when NOT already installed (or running as the app) on this device.
  const [canOfferInstall, setCanOfferInstall] = useState(false);
  const [showIosInstructions, setShowIosInstructions] = useState(false);
  // Drawer language (Phase 1 of the trilingual agent surface). Shares the
  // manufacturer dashboard's localStorage key so one choice follows the user
  // across every surface.
  const [locale, setLocaleState] = useState<Locale>('en');

  const activeAgentSlug = propAgentSlug || agentSlug;

  const role = profile?.role ?? 'researcher';
  const displayName = profile?.full_name?.trim() || user?.email?.split('@')[0] || '';
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

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('pnl_locale');
      if (isLocale(stored)) setLocaleState(stored);
    } catch { /* storage unavailable - stay on the initial locale */ }
  }, []);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    try { window.localStorage.setItem('pnl_locale', l); } catch { /* ignore */ }
    // Best-effort account sync; the endpoint returns a harmless 403 for
    // non-manufacturer accounts.
    fetch('/api/manufacturer/locale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: l }),
    }).catch(() => { /* localStorage already holds the choice */ });
  };

  // A11y: focus trap + Escape close + focus restore while the drawer is open
  // (WCAG 2.1.2, 2.4.3).
  const drawerRef = useModalA11y<HTMLDivElement>(drawerOpen && !onMenuClick, { onClose: closeDrawer });

  const handleMenuClick = (href: string) => {
    if (href === '#SHOW_QR') {
      setShowQRModal(true);
      closeDrawer();
    } else {
      closeDrawer();
    }
  };

  // Manual PWA install entry. Offered when the app is NOT already installed.
  // On iOS we always show it (no beforeinstallprompt ever fires there) unless
  // already running as the installed app.
  useEffect(() => {
    const update = () => setCanOfferInstall(!isRunningAsApp() && (!isKnownInstalled() || isIosSafari()));
    update();
    return subscribeInstallState(update);
  }, []);

  const handleInstallClick = useCallback(async () => {
    closeDrawer();
    const result = await triggerInstall();
    if (result === 'ios-instructions') {
      // Show the full step-by-step iOS sheet instead of a plain toast
      setShowIosInstructions(true);
    } else if (result === 'unavailable') {
      toast('To Install, Open Your Browser Menu (Or The Address-Bar Install Icon) And Choose "Install App".', { duration: 6000 });
    } else if (result === 'already-installed') {
      toast('Pep Nation Lab Is Already Installed On This Device.');
    } else if (result === 'accepted') {
      setCanOfferInstall(false);
    }
  }, [closeDrawer]);

  const isPlatformAdmin = isPlatformAdminId(user?.id) || profile?.is_admin_account === true;
  // If a platform admin is actively browsing an /admin route, flip their mobile hamburger menu
  // to show the full admin navigation instead of their regular agent navigation.
  const effectiveMenuRole = (isPlatformAdmin && pathname.startsWith('/admin')) ? 'admin' : role;

  const roleLinks = user
    ? getRoleNavLinks(effectiveMenuRole, {
        isSuperAgent: profile?.is_super_agent === true,
        isSubAgent: profile?.is_sub_agent === true,
        isPlatformAdmin,
        storefrontHref: activeAgentSlug ? `/${activeAgentSlug}` : '/dashboard/agent',
        storefrontName: agentName || undefined,
        pathname,
      })
    : null;

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('menu=open')) {
      setDrawerOpen(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    const supabase = createClient();

    // Shared helper - fetches profile + agent slug/name for a given session user.
    // Extracted to avoid duplicating this logic between getSession and onAuthStateChange.
    const fetchUserProfile = async (userId: string) => {
      try {
        // Untyped handle: is_manufacturer postdates the checked-in generated
        // Database types (same pattern as the server clients).
        const { data } = await (supabase as unknown as SupabaseClient)
          .from('profiles')
          .select('full_name, role, referring_agent_id, is_super_agent, is_sub_agent, is_manufacturer, is_admin_account, locale')
          .eq('id', userId)
          .maybeSingle();
        if (data) {
          setProfile(data);
          // First login on a new device has no saved locale; seed it from the
          // account's stored preference (chosen at creation) so the user opens
          // in their language. An explicit localStorage choice always wins.
          try {
            const savedLocale = window.localStorage.getItem('pnl_locale');
            const accountLocale = (data as { locale?: string | null }).locale;
            if (!isLocale(savedLocale) && isLocale(accountLocale)) {
              window.localStorage.setItem('pnl_locale', accountLocale);
              setLocaleState(accountLocale);
              window.dispatchEvent(new CustomEvent('pnl-locale-changed', { detail: accountLocale }));
            }
          } catch { /* storage unavailable - stay on the initial locale */ }
          if (data.role === 'researcher' && data.referring_agent_id) {
            const { data: ap } = await supabase
              .from('agent_profiles')
              .select('slug, display_name')
              .eq('id', data.referring_agent_id)
              .maybeSingle();
            if (ap?.slug) setAgentSlug(ap.slug);
            if (ap?.display_name) setAgentName(ap.display_name);
          } else if ((data.role === 'agent' || data.role === 'super_agent') && data.is_sub_agent !== true) {
            const { data: ap } = await supabase
              .from('agent_profiles')
              .select('slug, display_name')
              .eq('id', userId)
              .maybeSingle();
            if (ap?.slug) setAgentSlug(ap.slug);
            if (ap?.display_name) setAgentName(ap.display_name);
          }
        }
      } catch {
        // profile fetch failure is non-fatal; navbar degrades gracefully
      } finally {
        setLoading(false);
      }
    };


    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser({ id: session.user.id, email: session.user.email });
        fetchUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    }).catch(() => { setLoading(false); });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (session) {
        setUser({ id: session.user.id, email: session.user.email });
        fetchUserProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
        setAgentSlug(null);
        setAgentName(null);
        setLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    evictAllCatalogCaches();
    window.location.replace('/');
  };

  const handleBack = () => {
    // Pure browser-back: always return to the exact previous page the user was
    // on. No computed parent-route hierarchy or history-length heuristics -- if
    // there is no history entry (cold load / direct link) the browser simply
    // stays put, which is the accepted trade-off for true back navigation.
    router.back();
  };

  const isStorefront = activeAgentSlug && pathname === `/${activeAgentSlug}`;
  const showBack = pathname !== '/' && !isStorefront;

  return (
    <>
      <nav
        className="nav pnl-navbar"
        aria-label="Primary"
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0,
          zIndex: 200,
          height: 'calc(60px + var(--safe-top, 0px))',
          paddingTop: 'var(--safe-top, 0px)',
          background: 'var(--nav-bg)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--nav-border)',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 'var(--space-3)',
          paddingRight: 'var(--space-3)',
          gap: 'var(--space-2)',
        }}
      >
        <button
          onClick={() => onMenuClick ? onMenuClick() : setDrawerOpen(o => !o)}
          aria-label="Open Navigation Menu"
          aria-expanded={onMenuClick ? undefined : drawerOpen}
          aria-controls={onMenuClick ? undefined : 'primary-nav-drawer'}
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
          <Image src="/images/hamburger-icon.png" alt="Menu" width={36} height={36} unoptimized style={{ display: 'block' }} />
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          {loading ? (
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--surface-2)' }} className="skeleton" />
          ) : user ? (
            <>
              <GlobalCompletenessWidget />
              <Link href={dashLink} aria-label={dashLabel} className="hover-scale-105" style={{ display: 'flex', alignItems: 'center', background: 'none', flexShrink: 0 }}>
                <Image
                  src={
                    role === 'admin' ? '/nav-icons/admin-dashboard.png' :
                    role.includes('agent') ? '/nav-icons/agent-dashboard.png' :
                    '/nav-icons/dashboard.png'
                  }
                  alt={dashLabel}
                  width={158}
                  height={74}
                  unoptimized
                  className="dashboard-icon"
                  style={{ height: 74, width: 'auto', maxWidth: '100%', objectFit: 'contain', display: 'block' }}
                />
              </Link>
              {activeAgentSlug && (
                <Link
                  href={`/checkout?agent=${encodeURIComponent(activeAgentSlug)}`}
                  aria-label="Cart"
                  className="hover-scale-105"
                  style={{ display: 'flex', alignItems: 'center', background: 'none', flexShrink: 0 }}
                >
                  <Image
                    src="/nav-icons/cart.png"
                    alt="Cart"
                    width={158}
                    height={76}
                    unoptimized
                    className="dashboard-icon"
                    style={{ height: 74, width: 'auto', maxWidth: '100%', objectFit: 'contain', display: 'block' }}
                  />
                </Link>
              )}
              <div
                style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
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
        id="primary-nav-drawer"
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation Menu"
        // A11y: remove the off-screen drawer from tab order and the
        // accessibility tree while closed (WCAG 2.4.3, 1.3.2).
        inert={!drawerOpen}
        aria-hidden={!drawerOpen}
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
            <Image src="/logo-mark.svg" alt="Pep Nation Lab" width={32} height={32} priority unoptimized />
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
              <div style={{ fontSize: '0.72rem', color: 'var(--grey-400)' }}>
                {navLabel(role.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '), locale)}
              </div>
            </div>
          </div>
        )}

        <nav aria-label="Menu" style={{ flex: 1, padding: 'var(--space-3) 0' }}>
          {roleLinks ? (
            roleLinks.map((l) => (
              <DrawerLink key={`${l.href}-${l.label}`} href={l.href} label={navLabel(l.label, locale)} onClick={() => handleMenuClick(l.href)} icon={l.icon} />
            ))
          ) : (
            <>
              <DrawerLink href={dashLink} label={navLabel('Home', locale)} onClick={closeDrawer}
                icon={<svg {...IP}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>}
              />
              {role !== 'researcher' && (
                <DrawerLink href="/products" label={navLabel('Products', locale)} onClick={closeDrawer}
                  icon={<svg {...IP}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>}
                />
              )}
              {role === 'researcher' && activeAgentSlug && (
                <DrawerLink href={`/${activeAgentSlug}`} label={agentName ? `${agentName}'s Research Store` : 'Pep Nation Research Store'} onClick={closeDrawer}
                  icon={<svg {...IP}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>}
                />
              )}
              <DrawerLink href="/about" label={navLabel('About', locale)} onClick={closeDrawer}
                icon={<svg {...IP}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
              />
              {!user && (
                <>
                  {/* Guest-accessible learning + research surfaces. These pages
                      are fully public; without links here a guest's menu was
                      just Home / Store / About / Sign In. */}
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: 'var(--space-2) 0' }} />
                  <DrawerLink href="/peptide-101" label={navLabel('Peptides 101 Course', locale)} onClick={closeDrawer}
                    icon={<svg {...IP}><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>}
                  />
                  <DrawerLink href="/research" label={navLabel('Research Library', locale)} onClick={closeDrawer}
                    icon={<svg {...IP}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>}
                  />
                  <DrawerLink href="/find-a-peptide" label={navLabel('Find A Peptide', locale)} onClick={closeDrawer}
                    icon={<svg {...IP}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>}
                  />
                  <DrawerLink href="/research/calculators" label={navLabel('Lab Tools Calculator', locale)} onClick={closeDrawer}
                    icon={<svg {...IP}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>}
                  />
                  <DrawerLink href="/coa" label={navLabel('COA Verification', locale)} onClick={closeDrawer}
                    icon={<svg {...IP}><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>}
                  />
                  <DrawerLink href="/help" label={navLabel('Help & FAQ', locale)} onClick={closeDrawer}
                    icon={<svg {...IP}><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
                  />
                  <DrawerLink href="/contact" label={navLabel('Contact', locale)} onClick={closeDrawer}
                    icon={<svg {...IP}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>}
                  />
                </>
              )}
              {user && (
                <>
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: 'var(--space-2) 0' }} />
                  <DrawerLink href={dashLink} label={navLabel(dashLabel, locale)} onClick={closeDrawer}
                    icon={<svg {...IP}><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>}
                  />
                  {!isMessenger && (
                    <DrawerLink href="/messenger" label={navLabel('Messenger', locale)} onClick={closeDrawer}
                      icon={<svg {...IP}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>}
                    />
                  )}
                  <DrawerLink href="/account" label={navLabel('Account Settings', locale)} onClick={closeDrawer}
                    icon={<svg {...IP}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>}
                  />
                  <DrawerLink href="/research/calculators" label={navLabel('Lab Tools Calculator', locale)} onClick={closeDrawer}
                    icon={<svg {...IP}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>}
                  />
                </>
              )}
            </>
          )}

          {user && (
            <>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: 'var(--space-2) 0' }} />
              {((profile as { is_manufacturer?: boolean | null })?.is_manufacturer === true || locale !== 'en') && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', padding: '10px var(--space-5)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--grey-400)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    {navLabel('Language', locale)}
                  </span>
                  <div role="group" aria-label="Language" style={{ display: 'inline-flex', gap: 2, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 999, padding: 2 }}>
                    {SUPPORTED_LOCALES.map((l) => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => setLocale(l)}
                        aria-pressed={l === locale}
                        style={{
                          border: 'none',
                          cursor: 'pointer',
                          borderRadius: 999,
                          padding: '3px 9px',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          background: l === locale ? 'var(--teal)' : 'transparent',
                          color: l === locale ? '#04221F' : 'var(--silver)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {LOCALE_LABELS[l]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {(role === 'admin' || role.includes('agent')) && (
                <DrawerLink
                  href={role === 'admin' ? '/admin/advertising' : '/advertising'}
                  label={navLabel('Advertising Hub', locale)}
                  onClick={closeDrawer}
                  icon={<svg {...IP}><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>}
                />
              )}
              <DrawerLink href="/account/help" label={navLabel('Help & Support', locale)} onClick={closeDrawer}
                icon={<svg {...IP}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="4.93" y1="4.93" x2="9.17" y2="9.17"/><line x1="14.83" y1="14.83" x2="19.07" y2="19.07"/><line x1="14.83" y1="9.17" x2="19.07" y2="4.93"/><line x1="4.93" y1="19.07" x2="9.17" y2="14.83"/></svg>}
              />
              <DrawerLink href="/peptide-101" label={navLabel('Peptide 101', locale)} onClick={closeDrawer}
                icon={<svg {...IP}><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>}
              />
              {canOfferInstall && (
                <button
                  onClick={handleInstallClick}
                  className="drawer-link"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    padding: '12px var(--space-5)',
                    color: 'var(--silver)',
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
                  <span style={{ display: 'inline-flex', opacity: 0.7 }}>
                    <svg {...IP}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  </span>
                  {navLabel('Download Pep Nation App', locale)}
                </button>
              )}
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
                {navLabel('Sign Out', locale)}
              </button>
            </>
          )}

          {!user && !loading && (
            <>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: 'var(--space-2) 0' }} />
              <DrawerLink href="/login" label={navLabel('Sign In', locale)} onClick={closeDrawer}
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
              <div style={{ fontSize: '0.65rem', color: 'var(--grey-400)', fontFamily: 'var(--font-brand)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 2 }}>{navLabel('Logged In As', locale)}</div>
              <div style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName || 'User'}</div>
            </div>
          </div>
        )}
      </div>
      )}

      <MyQRCodeModal open={showQRModal} onClose={() => setShowQRModal(false)} />
      {showIosInstructions && <PwaIosInstructions onClose={() => setShowIosInstructions(false)} />}

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
