'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import {
  Package, CheckCircle, Truck, Gift, XCircle, DollarSign, User,
  MessageSquare, FileText, Clock, ShoppingCart, Link2, Bell, X,
  ArrowRight, Phone, PhoneMissed, Tag, RefreshCw, TrendingUp,
  AlertTriangle,
} from 'lucide-react';

/* ─── Types (mirrors DB notifications.type CHECK constraint exactly) ────────── */
export type NotifType =
  | 'order_placed' | 'order_approved' | 'order_shipped' | 'order_delivered'
  | 'order_cancelled' | 'commission_earned' | 'new_researcher' | 'new_message'
  | 'invoice' | 'payment_reminder' | 'cart_reminder' | 'referral' | 'system'
  | 'low_stock' | 'incoming_call' | 'missed_call' | 'payment_confirmed'
  | 'order_attention' | 'coupon_redeemed' | 'support_message'
  | 'refill_reminder' | 'tier_levelup';

interface NotifItem {
  id: string;
  type: NotifType | string;
  title: string;
  body: string | null;
  url: string | null;
  read_at: string | null;
  created_at: string;
}

/* ─── Smart URL resolver ────────────────────────────────────────────────────── */
/**
 * Resolve the deepest meaningful page for a notification.
 *
 * Priority:
 *  1. Stored url that is non-null AND not the generic '/dashboard' fallback
 *     (old feed API code coerced null → '/dashboard'; we now fix that at
 *     source, but legacy rows in the DB may still have '/dashboard' stored)
 *  2. Type-based + title-pattern smart fallback using EXACT valid tab names
 *
 * Valid agent dashboard tabs (from AgentDashboardClient VALID_TABS):
 *   Overview | Sales & Accounting | Orders | Researchers | My Sub-Agents |
 *   My Agent Accounts | Store Products | Research Bundles | Inventory |
 *   Coupons | Storefront Config
 */
function resolveNotifUrl(n: NotifItem): string {
  const stored = n.url;

  /**
   * A stored URL is "generic" (i.e., too vague to be useful) when it is:
   * - null/empty
   * - a bare top-level fallback (/dashboard, /admin)
   * - a dashboard/agent URL with NO tab (just /dashboard/agent)
   * - a dashboard/agent URL with the DEFAULT tab (Overview — no content change on click)
   * - a dashboard/agent URL with an INVALID tab name (old broken lowercase tabs like
   *   ?tab=researchers, ?tab=commissions, ?tab=statements, ?tab=balance, ?tab=team,
   *   ?tab=products, ?tab=overview — these all silently render the Overview panel).
   *
   * Valid agent dashboard tabs (VALID_TABS in AgentDashboardClient):
   *   Overview | Sales & Accounting | Orders | Researchers | My Sub-Agents |
   *   My Agent Accounts | Store Products | Research Bundles | Inventory |
   *   Coupons | Storefront Config
   */
  const VALID_AGENT_TABS = new Set([
    'Overview', 'Sales+%26+Accounting', 'Sales & Accounting',
    'Orders', 'Researchers', 'My+Sub-Agents', 'My Sub-Agents',
    'My+Agent+Accounts', 'My Agent Accounts', 'Store+Products', 'Store Products',
    'Research+Bundles', 'Research Bundles', 'Inventory',
    'Coupons', 'Storefront+Config', 'Storefront Config',
  ]);

  function isGenericUrl(url: string | null): boolean {
    if (!url) return true;
    if (url === '/dashboard' || url === '/dashboard/agent' || url === '/admin') return true;
    // Dashboard agent with a tab param
    const tabMatch = url.match(/^\/dashboard\/agent\?tab=(.+?)(?:&|$)/);
    if (tabMatch) {
      const tab = decodeURIComponent(tabMatch[1]);
      // 'Overview' is the default — clicking it doesn't take you anywhere specific
      if (tab === 'Overview') return true;
      // Any unrecognised/invalid tab (old broken lowercase ones) → generic
      if (!VALID_AGENT_TABS.has(tab) && !VALID_AGENT_TABS.has(tabMatch[1])) return true;
    }
    return false;
  }

  /**
   * Upgrade an Orders-tab URL that names no specific order.
   *
   * Notifications created before the deep-link work stored a bare
   * `/dashboard/agent?tab=Orders`. That URL is "valid" (the tab exists), so it
   * was returned verbatim - and tapping it from the Orders tab navigated to
   * the page you were already on, which is exactly the reported "clicking the
   * notification doesn't take me to the notification's page". Every one of
   * these titles carries the order's short id (#0722A724), so recover it and
   * point at the actual order. Also future-proofs any new notification that
   * forgets the &order= param.
   */
  function withOrderDeepLink(url: string): string {
    if (!/^\/dashboard\/agent\?tab=Orders/.test(url)) return url;
    if (/[?&]order=/.test(url)) return url;
    const m = n.title.match(/#([A-Za-z0-9]{6,})/);
    if (!m) return url;
    return `${url}&order=${encodeURIComponent(m[1].toUpperCase())}`;
  }

  if (!isGenericUrl(stored)) return withOrderDeepLink(stored!);

  // ── Type-based smart routing ──────────────────────────────────────────────
  switch (n.type) {
    // Order lifecycle events — researcher side
    case 'order_placed':
    case 'order_approved':
    case 'order_shipped':
    case 'order_delivered':
    case 'order_cancelled':
    case 'payment_confirmed': {
      // /orders/[id] resolves a FULL uuid. The short id in a notification
      // title (#0722A724) is NOT one, so building `/orders/<short>` from it
      // sent every one of these fallbacks to "Order Not Found". The orders
      // list always resolves, so land there instead of on an error page.
      // (This is only a fallback - these notifications normally carry a
      // stored /orders/<uuid> url, which is used verbatim above.)
      return '/orders';
    }

    // Order attention — could be agent or admin view
    case 'order_attention': {
      const isAdmin = /admin/i.test(n.title) || /admin\s+release/i.test(n.body ?? '');
      if (isAdmin) return '/admin/orders?status=admin_approval_pending';
      const m = n.title.match(/#([A-Z0-9]+)/);
      return m
        ? `/dashboard/agent?tab=Orders&order=${encodeURIComponent(m[1])}`
        : '/dashboard/agent?tab=Orders';
    }

    case 'new_researcher':
      return '/dashboard/agent?tab=Researchers';

    case 'new_message':
      return '/messenger';

    case 'support_message':
      return '/admin/messenger';

    case 'incoming_call':
    case 'missed_call':
      return '/messenger';

    case 'commission_earned':
      return '/dashboard/agent?tab=Sales+%26+Accounting';

    case 'payment_reminder': {
      // "Did You Receive Payment? Order #XXXX" - the button that answers it
      // lives ON the order, not in Sales & Accounting.
      const m = n.title.match(/#([A-Za-z0-9]{6,})/);
      if (m) return `/dashboard/agent?tab=Orders&order=${encodeURIComponent(m[1].toUpperCase())}`;
      return '/dashboard/agent?tab=Sales+%26+Accounting';
    }

    case 'invoice':
      return '/dashboard/agent?tab=Sales+%26+Accounting';

    case 'coupon_redeemed':
      return '/dashboard/agent?tab=Coupons';

    case 'cart_reminder':
      return '/products';  // /cart doesn't exist; /products is the storefront

    case 'refill_reminder':
      return '/products';

    case 'low_stock':
      return '/admin/products';

    case 'tier_levelup':
      return '/dashboard/agent?tab=Overview';

    case 'referral':
      return '/dashboard/agent?tab=Sales+%26+Accounting';

    case 'system':
      if (/push.health/i.test(n.title))    return '/admin/push-health';
      if (/daily.digest/i.test(n.title))   return '/admin/attention';
      if (/margin/i.test(n.title))         return '/dashboard/agent?tab=Store+Products';
      if (/balance/i.test(n.title))        return '/dashboard/agent?tab=Sales+%26+Accounting';
      if (/promoted.*sub.agent/i.test(n.title) || /sub.agent/i.test(n.title))
                                           return '/dashboard/agent?tab=My+Sub-Agents';
      if (/agent.*status.*revoked/i.test(n.title))
                                           return '/dashboard';
      if (/subscription.*paused/i.test(n.title))
                                           return '/account/refills';
      if (/complete.*profile/i.test(n.title) || /welcome/i.test(n.title))
                                           return '/dashboard/agent?tab=Storefront+Config';
      return '/dashboard';

    default:
      return '/dashboard';
  }
}

/* ─── Icon map by type (all DB types covered) ───────────────────────────────── */
function NotifIcon({ type }: { type: string }) {
  const icons: Record<string, React.ReactNode> = {
    order_placed:      <Package      size={14} style={{ color: 'var(--teal)' }} />,
    order_approved:    <CheckCircle  size={14} style={{ color: '#48BB78' }} />,
    order_shipped:     <Truck        size={14} style={{ color: '#63B3ED' }} />,
    order_delivered:   <Gift         size={14} style={{ color: '#9F7AEA' }} />,
    order_cancelled:   <XCircle      size={14} style={{ color: '#F56565' }} />,
    commission_earned: <DollarSign   size={14} style={{ color: '#48BB78' }} />,
    new_researcher:    <User         size={14} style={{ color: '#A0AEC0' }} />,
    new_message:       <MessageSquare size={14} style={{ color: 'var(--teal)' }} />,
    support_message:   <MessageSquare size={14} style={{ color: '#F6AD55' }} />,
    invoice:           <FileText     size={14} style={{ color: '#F6AD55' }} />,
    payment_reminder:  <Clock        size={14} style={{ color: '#FC8181' }} />,
    payment_confirmed: <DollarSign   size={14} style={{ color: '#48BB78' }} />,
    cart_reminder:     <ShoppingCart size={14} style={{ color: '#F6AD55' }} />,
    refill_reminder:   <RefreshCw    size={14} style={{ color: '#63B3ED' }} />,
    referral:          <Link2        size={14} style={{ color: '#63B3ED' }} />,
    system:            <Bell         size={14} style={{ color: '#A0AEC0' }} />,
    order_attention:   <Clock        size={14} style={{ color: '#E53E3E' }} />,
    low_stock:         <AlertTriangle size={14} style={{ color: '#F6AD55' }} />,
    incoming_call:     <Phone        size={14} style={{ color: '#48BB78' }} />,
    missed_call:       <PhoneMissed  size={14} style={{ color: '#F56565' }} />,
    coupon_redeemed:   <Tag          size={14} style={{ color: '#9F7AEA' }} />,
    tier_levelup:      <TrendingUp   size={14} style={{ color: '#48BB78' }} />,
  };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }}>
      {icons[type] ?? <Bell size={14} style={{ color: '#A0AEC0' }} />}
    </span>
  );
}

/* ─── Time-ago helper ──────────────────────────────────────────────────────── */
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)  return 'Just Now';
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m Ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h Ago`;
  const d = Math.floor(h / 24);
  return `${d}d Ago`;
}


/* ─── Bell animation keyframe injection ────────────────────────────────────── */

const BELL_ANIM_ID = 'pnl-bell-ring';
function injectBellAnim() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(BELL_ANIM_ID)) return;
  const style = document.createElement('style');
  style.id = BELL_ANIM_ID;
  style.textContent = `
    @keyframes pnl-bell-ring {
      0%   { transform: rotate(0deg); }
      15%  { transform: rotate(15deg); }
      30%  { transform: rotate(-12deg); }
      45%  { transform: rotate(10deg); }
      60%  { transform: rotate(-7deg); }
      75%  { transform: rotate(4deg); }
      90%  { transform: rotate(-2deg); }
      100% { transform: rotate(0deg); }
    }
    @keyframes pnl-badge-pop {
      0%   { transform: scale(0.5); opacity: 0; }
      70%  { transform: scale(1.25); }
      100% { transform: scale(1); opacity: 1; }
    }
    @keyframes pnl-notif-slide {
      from { opacity: 0; transform: translateX(8px); }
      to   { opacity: 1; transform: translateX(0); }
    }
    .pnl-notif-item { animation: pnl-notif-slide 0.2s ease both; }
  `;
  document.head.appendChild(style);
}

/* ══════════════════════════════════════════════════════════════════════════════
   Main Component
══════════════════════════════════════════════════════════════════════════════ */
export default function NavbarNotificationBell() {
  const router = useRouter();
  const [open, setOpen]           = useState(false);
  const [items, setItems]         = useState<NotifItem[]>([]);
  const [unread, setUnread]       = useState(0);
  const [loading, setLoading]     = useState(true);
  const [ringing, setRinging]     = useState(false);
  const [userId, setUserId]       = useState<string | null>(null);
  const dropdownRef               = useRef<HTMLDivElement>(null);
  const channelRef                = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null);
  // Unique per-mount suffix for the realtime topic. Two bells can legitimately
  // mount at once (a page and a segment layout both rendering a Navbar); with
  // the singleton browser client, sharing one topic returns the FIRST bell's
  // already-subscribed channel and the second .on() throws, crashing the whole
  // route. Distinct topics keep every mount isolated.
  const channelInstanceId         = useRef(Math.random().toString(36).slice(2));

  // Inject bell CSS once
  useEffect(() => { injectBellAnim(); }, []);

  // ── Close on click-outside ────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // ── Load notifications from API ────────────────────────────────────────────
  const loadFeed = useCallback(async () => {
    try {
      const res = await fetch('/api/account/notifications/feed', { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      setItems(json.recent ?? []);
      setUnread(json.unread_count ?? 0);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  // ── Mark notifications as read ────────────────────────────────────────────
  const markAllRead = useCallback(async () => {
    const unreadIds = items.filter(n => !n.read_at).map(n => Number(n.id));
    if (unreadIds.length === 0) return;
    try {
      await fetch('/api/account/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      setItems(prev => prev.map(n => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
      setUnread(0);
    } catch { /* ignore */ }
  }, [items]);

  // ── Mark ONE notification read (fires when the user taps it) ────────
  // Tapping a notification navigates away, which cancels the open-panel
  // auto-mark timer, so the tapped row must persist its OWN read state or it
  // reappears unread on the next feed load. Optimistic update + best-effort
  // POST with keepalive so the request survives the navigation.
  const markOneRead = useCallback((id: string) => {
    const wasUnread = items.some(n => String(n.id) === id && !n.read_at);
    setItems(prev => prev.map(n => String(n.id) === id ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n));
    if (wasUnread) setUnread(prev => Math.max(0, prev - 1));
    try {
      void fetch('/api/account/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [Number(id)] }),
        keepalive: true,
      });
    } catch { /* best-effort */ }
  }, [items]);

  // ── Get current userId for Realtime subscription ──────────────────────────
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });
  }, []);

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadFeed();
  }, [loadFeed]);

  // ── Supabase Realtime: subscribe to new notifications for current user ────
  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();

    // Clean up existing channel before creating new one
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Realtime is strictly best-effort: if the subscription fails for any
    // reason the bell still works via the fetch-based feed - it must never
    // take the page down with it.
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
      .channel(`notifications:${userId}:${channelInstanceId.current}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newItem = payload.new as NotifItem;
            setItems(prev => [newItem, ...prev].slice(0, 20));
            setUnread(prev => prev + 1);
            setRinging(true);
            setTimeout(() => setRinging(false), 800);
            // Live on-screen toast so a new order or message surfaces instantly
            // without opening the bell or refreshing the page.
            try {
              const dest = newItem.url || '/dashboard';
              toast(newItem.title, {
                description: newItem.body || undefined,
                action: {
                  label: 'View',
                  onClick: () => {
                    if (dest.startsWith('http')) {
                      try {
                        const urlObj = new URL(dest);
                        const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
                        if (urlObj.origin === currentOrigin) {
                          router.push(urlObj.pathname + urlObj.search + urlObj.hash);
                          return;
                        }
                      } catch (e) {
                        // Fallback
                      }
                      window.location.href = dest;
                    } else {
                      router.push(dest);
                    }
                  },
                },
              });
            } catch { /* toast best-effort */ }
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
              try { navigator.vibrate([100, 50, 100]); } catch { /* haptics best-effort */ }
            }
            try {
              const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.frequency.value = 880;
              gain.gain.setValueAtTime(0.08, ctx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
              osc.start();
              osc.stop(ctx.currentTime + 0.4);
            } catch { /* audio not available */ }
          } else if (payload.eventType === 'UPDATE') {
            const updatedItem = payload.new as NotifItem;
            setItems(prev => {
              const oldItem = prev.find(n => n.id === updatedItem.id);
              const wasUnread = oldItem ? !oldItem.read_at : (payload.old && (payload.old as Record<string, unknown>).read_at === null);
              if (wasUnread && updatedItem.read_at !== null) {
                setUnread(u => Math.max(0, u - 1));
              }
              return prev.map(n => n.id === updatedItem.id ? updatedItem : n);
            });
          }
        }
      )
      .subscribe();

      channelRef.current = channel;
    } catch (err) {
      console.error('[NavbarNotificationBell] realtime subscribe failed (bell falls back to fetch feed):', err);
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
      channelRef.current = null;
    };
  }, [userId]);

  // ── When dropdown opens: mark all read after 1.5s ────────────────────────
  useEffect(() => {
    if (!open || unread === 0) return;
    const t = setTimeout(() => markAllRead(), 1500);
    return () => clearTimeout(t);
  }, [open, unread, markAllRead]);

  // ── Toggle dropdown ─────────────────────────────────────────────────────────
  const handleBellClick = () => {
    setOpen(v => !v);
    if (!open) loadFeed();
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      {/* ── Bell Button ──────────────────────────────────────────────────── */}
      <button
        id="notification-bell-btn"
        onClick={handleBellClick}
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
        aria-expanded={open}
        style={{
          position: 'relative',
          background: open ? 'rgba(192,184,168,0.08)' : 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 8,
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          transition: 'background 0.2s',
          animation: ringing ? 'pnl-bell-ring 0.8s ease' : 'none',
          transformOrigin: 'top center',
        }}
        onMouseEnter={e => { if (!open) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
        onMouseLeave={e => { if (!open) e.currentTarget.style.background = 'none'; }}
      >
        <Image
          src="/images/notification-bell-trimmed.png"
          alt="Notifications"
          width={40} height={40} unoptimized
          style={{ width: 40, height: 40, transition: 'opacity 0.2s', display: 'block', objectFit: 'contain' }}
        />

        {/* Unread badge */}
        {unread > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 2,
              right: 2,
              background: '#E53E3E',
              color: '#fff',
              fontSize: '0.58rem',
              fontWeight: 800,
              minWidth: 16,
              height: 16,
              borderRadius: 999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              lineHeight: 1,
              boxShadow: '0 2px 6px rgba(229,62,62,0.4)',
              animation: 'pnl-badge-pop 0.3s ease both',
            }}
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* ── Dropdown Panel (Full Screen) ────────────────────────────────────── */}
      {open && typeof document !== 'undefined' && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            width: '100%',
            height: '100dvh',
            background: 'rgba(10,14,20,0.98)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            zIndex: 99999, // Super high z-index to cover everything
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header */}
          <div style={{
            padding: 'max(24px, env(safe-area-inset-top)) 16px 14px',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--white)', fontWeight: 700, fontSize: '0.9rem' }}>
                Notifications
              </span>
              {unread > 0 && (
                <span style={{
                  background: '#E53E3E',
                  color: '#fff',
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  borderRadius: 99,
                  padding: '2px 6px',
                }}>
                  {unread} New
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--teal)',
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    padding: 0,
                    fontWeight: 600,
                  }}
                >
                  Mark All Read
                </button>
              )}
              <Link
                href="/account?tab=notifications"
                onClick={() => setOpen(false)}
                style={{ color: 'rgba(192,184,168,0.6)', fontSize: '0.72rem', textDecoration: 'none', marginRight: 8 }}
              >
                Settings
              </Link>
              <button
                onClick={() => setOpen(false)}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  color: 'var(--white)',
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  lineHeight: 1,
                }}
                aria-label="Close notifications"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading && items.length === 0 ? (
              <div style={{ padding: '24px 16px', color: 'rgba(192,184,168,0.5)', textAlign: 'center', fontSize: '0.82rem' }}>
                Loading...
              </div>
            ) : items.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                <div style={{ display: 'inline-flex', marginBottom: 12, color: 'rgba(255,255,255,0.15)' }}><Bell size={36} /></div>
                <div style={{ color: 'rgba(192,184,168,0.5)', fontSize: '0.82rem' }}>
                  No Notifications Yet
                </div>
                <div style={{ color: 'rgba(192,184,168,0.3)', fontSize: '0.72rem', marginTop: 4 }}>
                  You Will See Orders, Messages, And Updates Here
                </div>
              </div>
            ) : (
              items.map((n, i) => {
                const dest = resolveNotifUrl(n);
                return (
                  <div
                    key={n.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      markOneRead(String(n.id));
                      setOpen(false);
                      router.push(dest);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        markOneRead(String(n.id));
                        setOpen(false);
                        router.push(dest);
                      }
                    }}
                    className="pnl-notif-item"
                    style={{
                      display: 'flex',
                      gap: 12,
                      padding: '12px 16px',
                      borderBottom: i < items.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      textDecoration: 'none',
                      background: !n.read_at ? 'rgba(192,184,168,0.04)' : 'transparent',
                      transition: 'background 0.15s',
                      animationDelay: `${i * 20}ms`,
                      position: 'relative',
                      cursor: 'pointer',
                    }}
                  >
                    {/* Unread indicator dot */}
                    {!n.read_at && (
                      <span style={{
                        position: 'absolute',
                        top: '50%',
                        left: 6,
                        transform: 'translateY(-50%)',
                        width: 5,
                        height: 5,
                        borderRadius: '50%',
                        background: 'var(--teal)',
                        flexShrink: 0,
                      }} />
                    )}
                    <div style={{ paddingLeft: !n.read_at ? 4 : 0, flexShrink: 0, marginTop: 1 }}>
                      <NotifIcon type={n.type} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        color: n.read_at ? 'rgba(255,255,255,0.7)' : 'var(--white)',
                        fontSize: '0.84rem',
                        fontWeight: n.read_at ? 400 : 600,
                        lineHeight: 1.3,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        textTransform: 'capitalize',
                      }}>
                        {n.title}
                      </div>
                      {n.body && (
                        <div style={{
                          color: 'rgba(192,184,168,0.55)',
                          fontSize: '0.75rem',
                          marginTop: 2,
                          lineHeight: 1.4,
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          textTransform: 'capitalize',
                        }}>
                          {n.body}
                        </div>
                      )}
                      <div style={{ color: 'rgba(192,184,168,0.3)', fontSize: '0.68rem', marginTop: 4 }}>
                        {timeAgo(n.created_at)}
                      </div>
                    </div>
                  </div>
                );
              })

            )}
          </div>

          {/* Footer */}
          <div style={{
            padding: '10px 16px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingBottom: 'max(10px, env(safe-area-inset-bottom))'
          }}>
            <Link
              href="/account?tab=notifications"
              onClick={() => setOpen(false)}
              style={{
                color: 'var(--teal)',
                fontSize: '0.78rem',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                View All Notifications <ArrowRight size={13} />
              </span>
            </Link>
            <Link
              href="/messenger"
              onClick={() => setOpen(false)}
              style={{
                color: 'rgba(192,184,168,0.45)',
                fontSize: '0.72rem',
                textDecoration: 'none',
              }}
            >
              Open Messenger
            </Link>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
