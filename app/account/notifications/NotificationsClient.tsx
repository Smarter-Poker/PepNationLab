'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  enablePush,
  disablePush,
  sendTestPush,
  isWebPushSupported,
  notificationPermission,
} from '@/lib/push-client';

interface Prefs {
  events_order_approved: boolean;
  events_order_shipped: boolean;
  events_order_delivered: boolean;
  events_payment_reminder: boolean;
  push_enabled: boolean;
  push_events_order: boolean;
  push_events_messages: boolean;
  push_events_marketing: boolean;
}

interface Props {
  initialPrefs: Prefs;
  userEmail: string;
}

const TEAL = '#00C4BC';
const SILVER = '#A8B4C0';
const SURFACE_2 = '#162230';

export default function NotificationsClient({ initialPrefs, userEmail }: Props) {
  const [prefs, setPrefs] = useState<Prefs>(initialPrefs);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // Push state tracked locally so the buttons reflect browser permission.
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    setPushSupported(isWebPushSupported());
    setPushPermission(notificationPermission());
  }, []);

  function update<K extends keyof Prefs>(key: K, value: Prefs[K]) {
    setPrefs((p) => ({ ...p, [key]: value }));
  }

  async function handleEnablePush() {
    setPushBusy(true);
    setPushMessage(null);
    const result = await enablePush();
    setPushPermission(notificationPermission());
    if (result.ok) {
      update('push_enabled', true);
      setPushMessage({ kind: 'ok', text: 'Push Notifications Enabled On This Device.' });
    } else {
      setPushMessage({ kind: 'err', text: result.error || 'Could Not Enable Push Notifications.' });
    }
    setPushBusy(false);
  }

  async function handleDisablePush() {
    setPushBusy(true);
    setPushMessage(null);
    const result = await disablePush();
    if (result.ok) {
      update('push_enabled', false);
      setPushMessage({ kind: 'ok', text: 'Push Notifications Disabled On This Device.' });
    } else {
      setPushMessage({ kind: 'err', text: result.error || 'Could Not Disable Push Notifications.' });
    }
    setPushBusy(false);
  }

  async function handleSendTestPush() {
    setPushBusy(true);
    setPushMessage(null);
    const result = await sendTestPush();
    if (result.ok) {
      setPushMessage({ kind: 'ok', text: 'Test Push Sent. Check Your Notifications.' });
    } else {
      setPushMessage({ kind: 'err', text: result.error || 'Test Push Did Not Send.' });
    }
    setPushBusy(false);
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/account/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          events_order_approved: prefs.events_order_approved,
          events_order_shipped: prefs.events_order_shipped,
          events_order_delivered: prefs.events_order_delivered,
          events_payment_reminder: prefs.events_payment_reminder,
          push_enabled: prefs.push_enabled,
          push_events_order: prefs.push_events_order,
          push_events_messages: prefs.push_events_messages,
          push_events_marketing: prefs.push_events_marketing,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ kind: 'err', text: data?.error || 'Save Failed.' });
      } else {
        setMessage({ kind: 'ok', text: 'Preferences Saved.' });
        if (data?.preferences) {
          setPrefs({
            events_order_approved: data.preferences.events_order_approved !== false,
            events_order_shipped: data.preferences.events_order_shipped !== false,
            events_order_delivered: data.preferences.events_order_delivered !== false,
            events_payment_reminder: data.preferences.events_payment_reminder !== false,
            push_enabled: !!data.preferences.push_enabled,
            push_events_order: data.preferences.push_events_order !== false,
            push_events_messages: data.preferences.push_events_messages !== false,
            push_events_marketing: !!data.preferences.push_events_marketing,
          });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save Failed.';
      setMessage({ kind: 'err', text: msg });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--black)', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <header style={{ marginBottom: '1.5rem' }}>
          <Link
            href="/dashboard"
            style={{ fontSize: '0.78rem', color: TEAL, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Back To Dashboard
          </Link>
          <h1 style={{ marginTop: '0.75rem', fontSize: '1.5rem', color: '#FFFFFF' }}>
            Notification Preferences
          </h1>
          <p style={{ marginTop: '0.5rem', color: SILVER, fontSize: '0.85rem' }}>
            Signed In As {userEmail}. Control How Pep Nation Lab Reaches You About Your Orders.
          </p>
        </header>

        <section className="card" style={{ padding: '1.5rem', background: SURFACE_2, borderRadius: '0.75rem', border: '1px solid rgba(255,255,255,0.06)', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.05rem', color: '#FFFFFF', marginBottom: '0.5rem' }}>
            Browser Push Notifications
          </h2>
          <p style={{ fontSize: '0.8rem', color: SILVER, marginBottom: '1rem' }}>
            Get Instant Order And Message Alerts In Your Browser, Even When This Tab Is Closed.
          </p>

          <div style={{ marginBottom: '1rem', fontSize: '0.8rem', color: SILVER }}>
            <span style={{ color: '#FFFFFF', fontWeight: 600 }}>Status:</span>{' '}
            {!pushSupported && <span style={{ color: '#F6AD55' }}>Not Supported In This Browser</span>}
            {pushSupported && pushPermission === 'default' && <span>Not Yet Requested</span>}
            {pushSupported && pushPermission === 'denied' && <span style={{ color: '#E53E3E' }}>Blocked By Browser Settings</span>}
            {pushSupported && pushPermission === 'granted' && prefs.push_enabled && <span style={{ color: TEAL }}>Enabled</span>}
            {pushSupported && pushPermission === 'granted' && !prefs.push_enabled && <span>Granted But Disabled</span>}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
            {pushSupported && !prefs.push_enabled && (
              <button
                type="button"
                onClick={handleEnablePush}
                disabled={pushBusy || pushPermission === 'denied'}
                style={{
                  background: TEAL, color: '#050A0F', border: 'none', borderRadius: '0.5rem',
                  padding: '0.55rem 1.25rem', fontWeight: 700, fontSize: '0.82rem',
                  cursor: pushBusy || pushPermission === 'denied' ? 'not-allowed' : 'pointer',
                  opacity: pushBusy || pushPermission === 'denied' ? 0.5 : 1,
                }}
              >
                {pushBusy ? 'Working...' : 'Enable Push Notifications'}
              </button>
            )}
            {pushSupported && prefs.push_enabled && (
              <>
                <button
                  type="button"
                  onClick={handleDisablePush}
                  disabled={pushBusy}
                  style={{
                    background: 'transparent', color: '#FFFFFF',
                    border: '1px solid rgba(255,255,255,0.18)', borderRadius: '0.5rem',
                    padding: '0.55rem 1.25rem', fontWeight: 600, fontSize: '0.82rem',
                    cursor: pushBusy ? 'not-allowed' : 'pointer', opacity: pushBusy ? 0.5 : 1,
                  }}
                >
                  {pushBusy ? 'Working...' : 'Disable Push Notifications'}
                </button>
                <button
                  type="button"
                  onClick={handleSendTestPush}
                  disabled={pushBusy}
                  style={{
                    background: 'transparent', color: TEAL,
                    border: `1px solid ${TEAL}`, borderRadius: '0.5rem',
                    padding: '0.55rem 1.25rem', fontWeight: 600, fontSize: '0.82rem',
                    cursor: pushBusy ? 'not-allowed' : 'pointer', opacity: pushBusy ? 0.5 : 1,
                  }}
                >
                  Send Test Push
                </button>
              </>
            )}
          </div>

          {pushMessage && (
            <div style={{ fontSize: '0.78rem', color: pushMessage.kind === 'ok' ? TEAL : '#E53E3E', marginBottom: '0.75rem' }}>
              {pushMessage.text}
            </div>
          )}

          <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1rem' }}>
            <h3 style={{ fontSize: '0.88rem', color: '#FFFFFF', marginBottom: '0.6rem' }}>
              Send Me A Push When:
            </h3>
            {([
              { key: 'push_events_order', label: 'My Order Status Changes' },
              { key: 'push_events_messages', label: 'I Receive A New Message' },
              { key: 'push_events_marketing', label: 'There Are New Products Or Promotions' },
            ] as const).map((row) => (
              <label
                key={row.key}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  cursor: 'pointer', padding: '0.4rem 0',
                  opacity: prefs.push_enabled ? 1 : 0.5,
                }}
              >
                <input
                  type="checkbox"
                  disabled={!prefs.push_enabled}
                  checked={prefs[row.key]}
                  onChange={(e) => update(row.key, e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: TEAL, cursor: prefs.push_enabled ? 'pointer' : 'not-allowed' }}
                />
                <span style={{ color: '#FFFFFF', fontSize: '0.85rem' }}>{row.label}</span>
              </label>
            ))}
          </div>

          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              style={{
                background: TEAL,
                color: '#050A0F',
                border: 'none',
                borderRadius: '0.5rem',
                padding: '0.65rem 1.5rem',
                fontWeight: 700,
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.5 : 1,
                fontSize: '0.88rem',
              }}
            >
              {saving ? 'Saving...' : 'Save Preferences'}
            </button>
            {message && (
              <span style={{ fontSize: '0.82rem', color: message.kind === 'ok' ? TEAL : '#E53E3E' }}>
                {message.text}
              </span>
            )}
          </div>
        </section>

        <p style={{ marginTop: '1.5rem', fontSize: '0.72rem', color: 'var(--grey-400)', textAlign: 'center' }}>
          Looking For Account Security? <Link href="/account/security" style={{ color: TEAL }}>Manage Two-Factor Authentication</Link>
        </p>
      </div>
    </div>
  );
}
