'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

/* ─── Types ────────────────────────────────────────────────────────────────── */
export type NotifType =
  | 'order_placed' | 'order_approved' | 'order_shipped' | 'order_delivered'
  | 'order_cancelled' | 'commission_earned' | 'new_researcher' | 'new_message'
  | 'invoice' | 'payment_reminder' | 'cart_reminder' | 'referral' | 'system';

interface NotifItem {
  id: string;
  type: NotifType | string;
  title: string;
  body: string | null;
  url: string | null;
  read_at: string | null;
  created_at: string;
}

/* ─── Icon map by type ─────────────────────────────────────────────────────── */
function NotifIcon({ type }: { type: string }) {
  const icons: Record<string, string> = {
    order_placed:    '📦',
    order_approved:  '✅',
    order_shipped:   '🚚',
    order_delivered: '🎉',
    order_cancelled: '❌',
    commission_earned: '💰',
    new_researcher:  '👤',
    new_message:     '💬',
    invoice:         '📄',
    payment_reminder: '⏰',
    cart_reminder:   '🛒',
    referral:        '🔗',
    system:          '🔔',
  };
  return <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{icons[type] ?? '🔔'}</span>;
}

/* ─── Time-ago helper ──────────────────────────────────────────────────────── */
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)  return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
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
  const [open, setOpen]           = useState(false);
  const [items, setItems]         = useState<NotifItem[]>([]);
  const [unread, setUnread]       = useState(0);
  const [loading, setLoading]     = useState(true);
  const [ringing, setRinging]     = useState(false);
  const [userId, setUserId]       = useState<string | null>(null);
  const dropdownRef               = useRef<HTMLDivElement>(null);
  const channelRef                = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null);

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

  // ── Get current userId for Realtime subscription ──────────────────────────
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });
  }, []);

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => { loadFeed(); }, [loadFeed]);

  // ── Supabase Realtime: subscribe to new notifications for current user ────
  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();

    // Clean up existing channel before creating new one
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`notifications:${userId}`)
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
                  onClick: () => { window.location.href = dest; },
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
              const wasUnread = oldItem ? !oldItem.read_at : (payload.old && (payload.old as any).read_at === null);
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

    return () => {
      supabase.removeChannel(channel);
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
        <img
          src="/images/notification-bell.png"
          alt="Notifications"
          width={34} height={34}
          style={{ transition: 'opacity 0.2s', display: 'block' }}
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

      {/* ── Dropdown Panel ────────────────────────────────────────────────── */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 50,
            right: 0,
            width: 360,
            maxWidth: '92vw',
            background: 'rgba(10,14,20,0.98)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(192,184,168,0.12)',
            borderRadius: 16,
            boxShadow: '0 20px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(192,184,168,0.05)',
            zIndex: 1000,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '14px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
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
                  {unread} new
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
                  Mark all read
                </button>
              )}
              <Link
                href="/account/notifications"
                onClick={() => setOpen(false)}
                style={{ color: 'rgba(192,184,168,0.6)', fontSize: '0.72rem', textDecoration: 'none' }}
              >
                Settings
              </Link>
            </div>
          </div>

          {/* Notification list */}
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {loading && items.length === 0 ? (
              <div style={{ padding: '24px 16px', color: 'rgba(192,184,168,0.5)', textAlign: 'center', fontSize: '0.82rem' }}>
                Loading…
              </div>
            ) : items.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', marginBottom: 8 }}>🔔</div>
                <div style={{ color: 'rgba(192,184,168,0.5)', fontSize: '0.82rem' }}>
                  No notifications yet
                </div>
                <div style={{ color: 'rgba(192,184,168,0.3)', fontSize: '0.72rem', marginTop: 4 }}>
                  You&apos;ll see orders, messages, and updates here
                </div>
              </div>
            ) : (
              items.map((n, i) => (
                <Link
                  key={n.id}
                  href={n.url || '/dashboard'}
                  onClick={() => setOpen(false)}
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
                </Link>
              ))
            )}
          </div>

          {/* Footer */}
          <div style={{
            padding: '10px 16px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <Link
              href="/account/notifications"
              onClick={() => setOpen(false)}
              style={{
                color: 'var(--teal)',
                fontSize: '0.78rem',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              View all notifications →
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
        </div>
      )}
    </div>
  );
}
