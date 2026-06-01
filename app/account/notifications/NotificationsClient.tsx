'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  enablePush,
  disablePush,
  sendTestPush,
  isWebPushSupported,
  notificationPermission,
} from '@/lib/push-client';
import type { LucideIcon } from 'lucide-react';
import {
  Package, CheckCircle, Truck, PartyPopper, XCircle, DollarSign, User,
  MessageCircle, FileText, Clock, ShoppingCart, Link2, Bell,
} from 'lucide-react';

/* --- Types ------------------------------------------------------------------ */
interface NotifItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  url: string | null;
  read_at: string | null;
  created_at: string;
}

interface Prefs {
  events_order_approved: boolean;
  events_order_shipped: boolean;
  events_order_delivered: boolean;
  events_payment_reminder: boolean;
  push_enabled: boolean;
  push_events_order: boolean;
  push_events_messages: boolean;
  push_events_marketing: boolean;
  send_read_receipts: boolean;
}

/* --- Helpers ---------------------------------------------------------------- */
function timeAgo(iso: string): string {
  const d = Date.now() - new Date(iso).getTime();
  const s = Math.floor(d / 1000);
  if (s < 60)  return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return new Date(iso).toLocaleDateString();
}

const TYPE_ICON: Record<string, LucideIcon> = {
  order_placed:      Package,
  order_approved:    CheckCircle,
  order_shipped:     Truck,
  order_delivered:   PartyPopper,
  order_cancelled:   XCircle,
  commission_earned: DollarSign,
  new_researcher:    User,
  new_message:       MessageCircle,
  invoice:           FileText,
  payment_reminder:  Clock,
  cart_reminder:     ShoppingCart,
  referral:          Link2,
  system:            Bell,
};

const TYPE_LABEL: Record<string, string> = {
  order_placed:     'Order Placed',
  order_approved:   'Order Approved',
  order_shipped:    'Order Shipped',
  order_delivered:  'Order Delivered',
  order_cancelled:  'Order Cancelled',
  commission_earned:'Commission',
  new_researcher:   'New Researcher',
  new_message:      'Message',
  invoice:          'Invoice',
  payment_reminder: 'Payment Reminder',
  cart_reminder:    'Cart Reminder',
  referral:         'Referral',
  system:           'System',
};

/* --- Style constants -------------------------------------------------------- */
const TEAL    = 'var(--teal, #C0B8A8)';
const SILVER  = 'rgba(192,184,168,0.65)';
const SURFACE = 'rgba(255,255,255,0.03)';
const BORDER  = '1px solid rgba(255,255,255,0.08)';

/* ==============================================================================
   Notification Center Page
============================================================================== */
import AvatarUpload from '@/components/AvatarUpload';

export default function NotificationCenterClient({ initialPrefs, sessionProfile }: { initialPrefs: Prefs, sessionProfile: any }) {
  const [activeTab, setActiveTab] = useState<'notifications' | 'settings'>('notifications');

  /* -- Notifications state ------------------------------------------------ */
  const [items, setItems]         = useState<NotifItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');

  /* -- Preferences state -------------------------------------------------- */
  const [prefs, setPrefs]         = useState<Prefs>(initialPrefs);
  const [saving, setSaving]       = useState(false);
  const [saveMsg, setSaveMsg]     = useState<{ text: string; ok: boolean } | null>(null);

  /* -- Push state --------------------------------------------------------- */
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [pushBusy, setPushBusy]   = useState(false);
  const [pushMsg, setPushMsg]     = useState<{ text: string; ok: boolean } | null>(null);

  /* -- Load feed ---------------------------------------------------------- */
  const loadFeed = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch('/api/account/notifications/feed', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        setItems(json.recent ?? []);
      }
    } catch { /* ignore */ } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => { loadFeed(); }, [loadFeed]);

  /* -- Push support check ------------------------------------------------- */
  useEffect(() => {
    setPushSupported(isWebPushSupported());
    setPushPermission(notificationPermission());
  }, []);

  /* -- Mark individual as read ---------------------------------------------- */
  const markRead = async (id: string) => {
    setItems(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
    await fetch('/api/account/notifications/mark-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [Number(id)] }),
    }).catch(() => { /* ignore */ });
  };

  /* -- Mark all read ------------------------------------------------------ */
  const markAllRead = async () => {
    await fetch('/api/account/notifications/mark-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    }).catch(() => { /* ignore */ });
    setItems(prev => prev.map(n => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
  };

  /* -- Save preferences --------------------------------------------------- */
  const save = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch('/api/account/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      });
      const json = await res.json();
      if (res.ok) {
        setSaveMsg({ text: 'Preferences saved.', ok: true });
        if (json.preferences) setPrefs(json.preferences);
      } else {
        setSaveMsg({ text: json.error || 'Save failed.', ok: false });
      }
    } catch {
      setSaveMsg({ text: 'Network error. Please try again.', ok: false });
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 4000);
    }
  };

  /* -- Push enable/disable ------------------------------------------------ */
  const handleEnablePush = async () => {
    setPushBusy(true);
    setPushMsg(null);
    const r = await enablePush();
    if (r.ok) {
      setPrefs(p => ({ ...p, push_enabled: true }));
      setPushMsg({ text: 'Push notifications enabled!', ok: true });
      setPushPermission('granted');
    } else {
      setPushMsg({ text: r.error || 'Failed to enable push.', ok: false });
    }
    setPushBusy(false);
  };

  const handleDisablePush = async () => {
    setPushBusy(true);
    setPushMsg(null);
    const r = await disablePush();
    if (r.ok) {
      setPrefs(p => ({ ...p, push_enabled: false }));
      setPushMsg({ text: 'Push notifications disabled.', ok: true });
    } else {
      setPushMsg({ text: r.error || 'Failed to disable push.', ok: false });
    }
    setPushBusy(false);
  };

  const handleTestPush = async () => {
    setPushBusy(true);
    setPushMsg(null);
    const r = await sendTestPush();
    if (r.ok) {
      setPushMsg({ text: `Test push sent to ${r.sent ?? 1} device(s).`, ok: true });
    } else {
      setPushMsg({ text: r.error || 'Test push failed.', ok: false });
    }
    setPushBusy(false);
  };

  /* -- Filtered items ----------------------------------------------------- */
  const filteredItems = filterType === 'all'
    ? items
    : filterType === 'unread'
    ? items.filter(n => !n.read_at)
    : items.filter(n => n.type === filterType);

  const unreadCount = items.filter(n => !n.read_at).length;

  /* -- Tabs --------------------------------------------------------------- */
  const tabs = [
    { key: 'notifications', label: 'Notifications' },
    { key: 'settings', label: 'Settings' },
  ] as const;

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--black)',
      paddingTop: 80,
      paddingBottom: 60,
    }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 20px' }}>

        {/* Page title */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--white)', margin: 0 }}>
            Notification Center
          </h1>
          <p style={{ color: SILVER, fontSize: '0.85rem', marginTop: 6 }}>
            Manage your alerts, preferences, and push notifications.
          </p>
        </div>

        {/* Tab bar */}
        <div style={{
          display: 'flex',
          gap: 4,
          background: SURFACE,
          border: BORDER,
          borderRadius: 12,
          padding: 4,
          marginBottom: 24,
        }}>
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                flex: 1,
                padding: '9px 0',
                border: 'none',
                borderRadius: 10,
                background: activeTab === t.key ? TEAL : 'transparent',
                color: activeTab === t.key ? 'var(--black)' : SILVER,
                fontWeight: activeTab === t.key ? 700 : 500,
                fontSize: '0.84rem',
                cursor: 'pointer',
                transition: 'all 0.18s',
              }}
            >
              {t.label}
              {t.key === 'notifications' && unreadCount > 0 && (
                <span style={{
                  background: activeTab === 'notifications' ? 'rgba(0,0,0,0.3)' : '#E53E3E',
                  color: '#fff',
                  fontSize: '0.65rem',
                  borderRadius: 99,
                  padding: '1px 6px',
                  marginLeft: 6,
                  fontWeight: 800,
                }}>
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* == NOTIFICATIONS TAB ============================================== */}
        {activeTab === 'notifications' && (
          <div>
            {/* Filter bar */}
            <div style={{
              display: 'flex',
              gap: 8,
              marginBottom: 16,
              flexWrap: 'wrap',
              alignItems: 'center',
            }}>
              <div style={{ flex: 1, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['all', 'unread', 'order_placed', 'order_approved', 'order_shipped', 'new_message', 'commission_earned', 'new_researcher'].map(f => (
                  <button
                    key={f}
                    onClick={() => setFilterType(f)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 99,
                      border: `1px solid ${filterType === f ? TEAL : 'rgba(255,255,255,0.1)'}`,
                      background: filterType === f ? 'rgba(192,184,168,0.1)' : 'transparent',
                      color: filterType === f ? TEAL : SILVER,
                      fontSize: '0.72rem',
                      cursor: 'pointer',
                      fontWeight: filterType === f ? 600 : 400,
                      transition: 'all 0.15s',
                    }}
                  >
                    {f === 'all' ? 'All' : f === 'unread' ? `Unread (${unreadCount})` : (TYPE_LABEL[f] ?? f)}
                  </button>
                ))}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: TEAL,
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    padding: '5px 0',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div style={{
              background: SURFACE,
              border: BORDER,
              borderRadius: 14,
              overflow: 'hidden',
            }}>
              {loadingList ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: SILVER, fontSize: '0.85rem' }}>
                  Loading notifications...
                </div>
              ) : filteredItems.length === 0 ? (
                <div style={{ padding: '48px 20px', textAlign: 'center' }}>
                  <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}><Bell size={40} color={SILVER} /></div>
                  <div style={{ color: SILVER, fontSize: '0.88rem', fontWeight: 600 }}>
                    {filterType === 'unread' ? 'All caught up!' : 'No notifications yet'}
                  </div>
                  <div style={{ color: 'rgba(192,184,168,0.35)', fontSize: '0.75rem', marginTop: 6 }}>
                    {filterType === 'unread'
                      ? 'You have no unread notifications.'
                      : 'Orders, messages, and updates will appear here.'}
                  </div>
                </div>
              ) : (
                filteredItems.map((n, i) => (
                  <div
                    key={n.id}
                    style={{
                      display: 'flex',
                      gap: 14,
                      padding: '14px 18px',
                      borderBottom: i < filteredItems.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                      background: !n.read_at ? 'rgba(192,184,168,0.03)' : 'transparent',
                      transition: 'background 0.15s',
                      alignItems: 'flex-start',
                    }}
                  >
                    {/* Icon */}
                    <div style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: !n.read_at ? 'rgba(192,184,168,0.1)' : 'rgba(255,255,255,0.04)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.15rem',
                      flexShrink: 0,
                    }}>
                      {(() => { const Ico = TYPE_ICON[n.type] ?? Bell; return <Ico size={18} color="var(--white)" />; })()}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{
                          color: !n.read_at ? 'var(--white)' : 'rgba(255,255,255,0.65)',
                          fontSize: '0.87rem',
                          fontWeight: !n.read_at ? 600 : 400,
                          textTransform: 'capitalize',
                        }}>
                          {n.title}
                        </span>
                        {!n.read_at && (
                          <span style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: TEAL,
                            flexShrink: 0,
                          }} />
                        )}
                        <span style={{ color: 'rgba(192,184,168,0.3)', fontSize: '0.68rem', marginLeft: 'auto' }}>
                          {timeAgo(n.created_at)}
                        </span>
                      </div>
                      {n.body && (
                        <div style={{ color: SILVER, fontSize: '0.78rem', marginTop: 3, lineHeight: 1.45, textTransform: 'capitalize' }}>
                          {n.body}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                        {n.url && (
                          <Link
                            href={n.url}
                            style={{ color: TEAL, fontSize: '0.74rem', textDecoration: 'none', fontWeight: 600 }}
                            onClick={() => !n.read_at && markRead(n.id)}
                          >
                            View
                          </Link>
                        )}
                        {!n.read_at && (
                          <button
                            onClick={() => markRead(n.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'rgba(192,184,168,0.4)',
                              fontSize: '0.7rem',
                              cursor: 'pointer',
                              padding: 0,
                            }}
                          >
                            Mark read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* == SETTINGS TAB =================================================== */}
        {activeTab === 'settings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Profile Picture Upload */}
            <section style={{ background: SURFACE, border: BORDER, borderRadius: 14, padding: '20px 22px' }}>
              <h2 style={{ fontSize: '1rem', color: 'var(--white)', fontWeight: 700, margin: '0 0 4px' }}>
                Profile Picture
              </h2>
              <p style={{ color: SILVER, fontSize: '0.78rem', marginBottom: 18, marginTop: 4 }}>
                Upload an avatar or logo to appear in Messenger instead of a generic initial.
              </p>
              <AvatarUpload 
                currentAvatarUrl={sessionProfile?.avatar_url ?? null} 
                name={sessionProfile?.full_name ?? sessionProfile?.username ?? sessionProfile?.email ?? 'User'} 
              />
            </section>

            {/* In-app event prefs */}
            <section style={{ background: SURFACE, border: BORDER, borderRadius: 14, padding: '20px 22px' }}>
              <h2 style={{ fontSize: '1rem', color: 'var(--white)', fontWeight: 700, margin: '0 0 4px' }}>
                In-App Notifications
              </h2>
              <p style={{ color: SILVER, fontSize: '0.78rem', marginBottom: 18, marginTop: 4 }}>
                Control which events appear in your notification bell.
              </p>
              {([
                { key: 'events_order_approved', label: 'Order Approved', desc: 'When your order gets approved' },
                { key: 'events_order_shipped',  label: 'Order Shipped',  desc: 'When your order ships with tracking' },
                { key: 'events_order_delivered',label: 'Order Delivered',desc: 'When your order is delivered' },
                { key: 'events_payment_reminder',label: 'Payment Reminders', desc: 'Outstanding balance reminders' },
              ] as const).map(row => (
                <label
                  key={row.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '10px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={prefs[row.key]}
                    onChange={e => setPrefs(p => ({ ...p, [row.key]: e.target.checked }))}
                    style={{ width: 17, height: 17, accentColor: TEAL, cursor: 'pointer' }}
                  />
                  <div>
                    <div style={{ color: 'var(--white)', fontSize: '0.85rem', fontWeight: 500 }}>{row.label}</div>
                    <div style={{ color: SILVER, fontSize: '0.72rem' }}>{row.desc}</div>
                  </div>
                </label>
              ))}
            </section>

            {/* Privacy Prefs */}
            <section style={{ background: SURFACE, border: BORDER, borderRadius: 14, padding: '20px 22px' }}>
              <h2 style={{ fontSize: '1rem', color: 'var(--white)', fontWeight: 700, margin: '0 0 4px' }}>
                Privacy
              </h2>
              <p style={{ color: SILVER, fontSize: '0.78rem', marginBottom: 18, marginTop: 4 }}>
                Manage your privacy settings for messaging.
              </p>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '10px 0',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={prefs.send_read_receipts}
                  onChange={e => setPrefs(p => ({ ...p, send_read_receipts: e.target.checked }))}
                  style={{ width: 17, height: 17, accentColor: TEAL, cursor: 'pointer' }}
                />
                <div>
                  <div style={{ color: 'var(--white)', fontSize: '0.85rem', fontWeight: 500 }}>Send Read Receipts</div>
                  <div style={{ color: SILVER, fontSize: '0.72rem' }}>Allow others to see when you have read their messages.</div>
                </div>
              </label>
            </section>

            {/* Browser push */}
            <section style={{ background: SURFACE, border: BORDER, borderRadius: 14, padding: '20px 22px' }}>
              <h2 style={{ fontSize: '1rem', color: 'var(--white)', fontWeight: 700, margin: '0 0 4px' }}>
                Browser Push Notifications
              </h2>
              <p style={{ color: SILVER, fontSize: '0.78rem', marginBottom: 16, marginTop: 4 }}>
                Receive alerts even when the browser tab is closed or minimized.
              </p>

              {/* Status */}
              <div style={{ marginBottom: 14, fontSize: '0.8rem' }}>
                <span style={{ color: 'var(--white)', fontWeight: 600 }}>Status: </span>
                {!pushSupported && <span style={{ color: '#F6AD55' }}>Not supported in this browser</span>}
                {pushSupported && pushPermission === 'default' && <span style={{ color: SILVER }}>Not yet enabled</span>}
                {pushSupported && pushPermission === 'denied' && <span style={{ color: '#E53E3E' }}>Blocked - check browser settings</span>}
                {pushSupported && pushPermission === 'granted' && prefs.push_enabled && <span style={{ color: TEAL }}>Active</span>}
                {pushSupported && pushPermission === 'granted' && !prefs.push_enabled && <span style={{ color: SILVER }}>Granted but disabled</span>}
              </div>

              {/* Enable/disable buttons */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                {pushSupported && !prefs.push_enabled && (
                  <button
                    onClick={handleEnablePush}
                    disabled={pushBusy || pushPermission === 'denied'}
                    style={{
                      background: TEAL, color: 'var(--black)', border: 'none',
                      borderRadius: 8, padding: '9px 18px', fontWeight: 700,
                      fontSize: '0.82rem', cursor: pushBusy ? 'wait' : 'pointer',
                      opacity: (pushBusy || pushPermission === 'denied') ? 0.5 : 1,
                    }}
                  >
                    {pushBusy ? 'Working...' : 'Enable Push Notifications'}
                  </button>
                )}
                {pushSupported && prefs.push_enabled && (
                  <>
                    <button
                      onClick={handleDisablePush}
                      disabled={pushBusy}
                      style={{
                        background: 'transparent', color: 'var(--white)',
                        border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8,
                        padding: '9px 18px', fontWeight: 600, fontSize: '0.82rem',
                        cursor: pushBusy ? 'wait' : 'pointer', opacity: pushBusy ? 0.5 : 1,
                      }}
                    >
                      {pushBusy ? 'Working...' : 'Disable Push'}
                    </button>
                    <button
                      onClick={handleTestPush}
                      disabled={pushBusy}
                      style={{
                        background: 'transparent', color: TEAL,
                        border: `1px solid ${TEAL}`, borderRadius: 8,
                        padding: '9px 18px', fontWeight: 600, fontSize: '0.82rem',
                        cursor: pushBusy ? 'wait' : 'pointer', opacity: pushBusy ? 0.5 : 1,
                      }}
                    >
                      Send Test Push
                    </button>
                  </>
                )}
              </div>
              {pushMsg && (
                <div style={{ fontSize: '0.78rem', color: pushMsg.ok ? TEAL : '#E53E3E', marginBottom: 12 }}>
                  {pushMsg.text}
                </div>
              )}

              {/* Per-type push controls live on the dedicated Notification
                  Preferences page, which is the single source of truth for
                  which push types are delivered. The old coarse order/messages/
                  marketing bucket checkboxes were removed to avoid two competing
                  controls (the buckets no longer gate delivery). */}
              {prefs.push_enabled && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14 }}>
                  <h3 style={{ fontSize: '0.85rem', color: 'var(--white)', fontWeight: 600, marginBottom: 6 }}>
                    Choose Which Alerts You Receive
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: 'rgba(192,184,168,0.65)', margin: '0 0 12px' }}>
                    Turn Individual Push Notifications On Or Off On The Notification Preferences Page.
                  </p>
                  <Link
                    href="/account/notification-preferences"
                    style={{
                      display: 'inline-block', background: 'transparent', color: TEAL,
                      border: `1px solid ${TEAL}`, borderRadius: 8, padding: '9px 18px',
                      fontWeight: 600, fontSize: '0.82rem', textDecoration: 'none',
                    }}
                  >
                    Manage Notification Preferences
                  </Link>
                </div>
              )}
            </section>

            {/* Save button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <button
                onClick={save}
                disabled={saving}
                style={{
                  background: TEAL, color: 'var(--black)', border: 'none',
                  borderRadius: 10, padding: '11px 28px', fontWeight: 700,
                  fontSize: '0.88rem', cursor: saving ? 'wait' : 'pointer',
                  opacity: saving ? 0.5 : 1,
                }}
              >
                {saving ? 'Saving...' : 'Save Preferences'}
              </button>
              {saveMsg && (
                <span style={{ fontSize: '0.82rem', color: saveMsg.ok ? TEAL : '#E53E3E' }}>
                  {saveMsg.text}
                </span>
              )}
            </div>

            <p style={{ fontSize: '0.7rem', color: 'rgba(192,184,168,0.3)', textAlign: 'center' }}>
              Need to change your password?{' '}
              <Link href="/account/security" style={{ color: TEAL }}>Account Security</Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
