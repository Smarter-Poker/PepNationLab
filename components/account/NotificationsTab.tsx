'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import PushNotificationToggle from '@/components/PushNotificationToggle';

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

interface PushTypeState {
  push_enabled: boolean;
  push_type_prefs: Record<string, boolean>;
}

const COMMON_TIMEZONES: string[] = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'America/Honolulu',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Madrid',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Australia/Sydney',
  'UTC',
];

const EVENTS: Array<{
  key: string;
  label: string;
  description: string;
  inAppKey: keyof Prefs | null;
  pushKey: string | null;
}> = [
  { key: 'order_approved',  label: 'Order Approved',           description: 'When An Order You Placed Is Approved.',           inAppKey: 'events_order_approved',  pushKey: 'order_approved' },
  { key: 'order_shipped',   label: 'Order Shipped',            description: 'When Your Order Ships With Tracking.',            inAppKey: 'events_order_shipped',   pushKey: 'order_shipped' },
  { key: 'order_delivered', label: 'Order Delivered',          description: 'When A Carrier Marks Your Order Delivered.',      inAppKey: 'events_order_delivered', pushKey: 'order_delivered' },
  { key: 'payment_reminder',label: 'Payment Reminder',         description: 'When You Have An Outstanding Balance.',           inAppKey: 'events_payment_reminder',pushKey: 'payment_reminder' },
  { key: 'new_message',     label: 'New Message',              description: 'When You Receive A New Direct Or Group Message.', inAppKey: null,                     pushKey: 'new_message' },
  { key: 'new_research',    label: 'New Research',             description: 'When A Researcher Joins Your Team.',              inAppKey: null,                     pushKey: 'new_researcher' },
  { key: 'marketing',       label: 'Marketing & Announcements',description: 'Product News, Promotions, And System Alerts.',    inAppKey: null,                     pushKey: 'system' },
];

const QH_KEY = 'pepnationlab.quiet_hours';
const MUTE_KEY = 'pepnationlab.mute_all_until';

interface QuietHours {
  start: string;
  end: string;
  timezone: string;
}

function loadQuietHours(): QuietHours {
  if (typeof window === 'undefined') return { start: '22:00', end: '07:00', timezone: 'America/New_York' };
  try {
    const raw = window.localStorage.getItem(QH_KEY);
    if (raw) return JSON.parse(raw) as QuietHours;
  } catch {
    // ignore
  }
  return { start: '22:00', end: '07:00', timezone: 'America/New_York' };
}

export default function NotificationsTab() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [push, setPush] = useState<PushTypeState>({ push_enabled: false, push_type_prefs: {} });
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const [quietHours, setQuietHours] = useState<QuietHours>(() => loadQuietHours());
  const [mutedUntil, setMutedUntil] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(MUTE_KEY);
    if (!raw) return null;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n > Date.now() ? n : null;
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [aRes, bRes] = await Promise.all([
        fetch('/api/account/notifications').then((r) => r.json()),
        fetch('/api/account/notifications/push-types').then((r) => r.json()),
      ]);
      if (aRes?.preferences) setPrefs(aRes.preferences as Prefs);
      if (bRes && typeof bRes.push_enabled === 'boolean') {
        setPush({
          push_enabled: bRes.push_enabled,
          push_type_prefs: bRes.push_type_prefs ?? {},
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const patchPrefs = useCallback(async (key: keyof Prefs, next: boolean) => {
    setSavingKey(String(key));
    try {
      const res = await fetch('/api/account/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed To Save.');
      setPrefs((p) => (p ? { ...p, [key]: next } : p));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed To Save.';
      toast.error(msg);
    } finally {
      setSavingKey(null);
    }
  }, []);

  const patchPushType = useCallback(async (typeKey: string, next: boolean) => {
    setSavingKey(`push:${typeKey}`);
    try {
      const res = await fetch('/api/account/notifications/push-types', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: typeKey, enabled: next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed To Save.');
      setPush({
        push_enabled: json.push_enabled,
        push_type_prefs: json.push_type_prefs ?? {},
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed To Save.';
      toast.error(msg);
    } finally {
      setSavingKey(null);
    }
  }, []);

  const isInAppOn = (k: keyof Prefs | null): boolean => {
    if (!k || !prefs) return false;
    return !!prefs[k];
  };
  const isPushOn = (k: string | null): boolean => {
    if (!k) return false;
    return push.push_type_prefs[k] !== false;
  };

  const muteFor24h = () => {
    const until = Date.now() + 24 * 60 * 60 * 1000;
    setMutedUntil(until);
    try { window.localStorage.setItem(MUTE_KEY, String(until)); } catch { /* ignore */ }
    toast.success('Notifications Muted For 24 Hours On This Device.');
  };

  const clearMute = () => {
    setMutedUntil(null);
    try { window.localStorage.removeItem(MUTE_KEY); } catch { /* ignore */ }
  };

  const saveQuietHours = (next: Partial<QuietHours>) => {
    const merged = { ...quietHours, ...next };
    setQuietHours(merged);
    try { window.localStorage.setItem(QH_KEY, JSON.stringify(merged)); } catch { /* ignore */ }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <PushNotificationToggle showTypePrefs={false} />

      <div className="glass-panel" style={{ padding: 'var(--space-6)' }}>
        <h3 style={{ marginTop: 0, marginBottom: 'var(--space-2)', color: 'var(--teal)' }}>Notifications</h3>
        <p style={{ color: 'var(--silver)', fontSize: '0.85rem', margin: '0 0 var(--space-4)', lineHeight: 1.6 }}>
          Choose Which Events Reach You And On Which Channel. Email Is Currently Disabled Platform-Wide.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          {mutedUntil ? (
            <button type="button" className="btn btn-secondary btn-sm" onClick={clearMute}>
              Unmute Now (Muted Until {new Date(mutedUntil).toLocaleTimeString()})
            </button>
          ) : (
            <button type="button" className="btn btn-secondary btn-sm" onClick={muteFor24h}>
              Mute All Notifications For 24 Hours
            </button>
          )}
        </div>
      </div>

      <div className="glass-panel" style={{ padding: 'var(--space-6)' }}>
        <h4 style={{ marginTop: 0, marginBottom: 'var(--space-4)', color: 'var(--teal)' }}>
          Per-Event Channels
        </h4>

        {loading ? (
          <p style={{ color: 'var(--silver)', fontSize: '0.85rem' }}>Loading Preferences...</p>
        ) : (
          <div className="account-notifications-matrix">
            <table
              role="grid"
              className="account-matrix-table"
              style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}
            >
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: 'var(--space-2)', color: 'var(--silver)', fontWeight: 600 }}>Event</th>
                  <th style={{ textAlign: 'center', padding: 'var(--space-2)', color: 'var(--silver)', fontWeight: 600 }}>In-App</th>
                  <th style={{ textAlign: 'center', padding: 'var(--space-2)', color: 'var(--silver)', fontWeight: 600 }}>Push</th>
                  <th style={{ textAlign: 'center', padding: 'var(--space-2)', color: 'var(--silver)', fontWeight: 600 }}>
                    Email <span style={{ color: 'var(--red, #E53E3E)', fontSize: '0.7rem' }}>(Disabled)</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {EVENTS.map((evt) => (
                  <tr key={evt.key} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: 'var(--space-3)', verticalAlign: 'top' }}>
                      <div style={{ color: 'var(--white)', fontWeight: 600 }}>{evt.label}</div>
                      <div style={{ color: 'var(--silver)', fontSize: '0.78rem', marginTop: 2 }}>
                        {evt.description}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', padding: 'var(--space-3)' }}>
                      <CellToggle
                        on={isInAppOn(evt.inAppKey)}
                        disabled={!evt.inAppKey || savingKey === String(evt.inAppKey)}
                        onChange={(next) => evt.inAppKey && patchPrefs(evt.inAppKey, next)}
                        ariaLabel={`In-App ${evt.label}`}
                        unsupported={!evt.inAppKey}
                      />
                    </td>
                    <td style={{ textAlign: 'center', padding: 'var(--space-3)' }}>
                      <CellToggle
                        on={isPushOn(evt.pushKey)}
                        disabled={!evt.pushKey || savingKey === `push:${evt.pushKey}`}
                        onChange={(next) => evt.pushKey && patchPushType(evt.pushKey, next)}
                        ariaLabel={`Push ${evt.label}`}
                        unsupported={!evt.pushKey}
                      />
                    </td>
                    <td style={{ textAlign: 'center', padding: 'var(--space-3)' }}>
                      <span style={{ color: 'var(--silver)', fontSize: '0.78rem' }}>-</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className="account-matrix-cards" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {EVENTS.map((evt) => (
                <li
                  key={evt.key}
                  style={{
                    padding: 'var(--space-3)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: 'var(--space-3)',
                  }}
                >
                  <div style={{ color: 'var(--white)', fontWeight: 600, marginBottom: 2 }}>{evt.label}</div>
                  <div style={{ color: 'var(--silver)', fontSize: '0.78rem', marginBottom: 'var(--space-3)' }}>
                    {evt.description}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-2)' }}>
                    <CellLabel label="In-App">
                      <CellToggle
                        on={isInAppOn(evt.inAppKey)}
                        disabled={!evt.inAppKey || savingKey === String(evt.inAppKey)}
                        onChange={(next) => evt.inAppKey && patchPrefs(evt.inAppKey, next)}
                        ariaLabel={`In-App ${evt.label}`}
                        unsupported={!evt.inAppKey}
                      />
                    </CellLabel>
                    <CellLabel label="Push">
                      <CellToggle
                        on={isPushOn(evt.pushKey)}
                        disabled={!evt.pushKey || savingKey === `push:${evt.pushKey}`}
                        onChange={(next) => evt.pushKey && patchPushType(evt.pushKey, next)}
                        ariaLabel={`Push ${evt.label}`}
                        unsupported={!evt.pushKey}
                      />
                    </CellLabel>
                    <CellLabel label="Email">
                      <span style={{ color: 'var(--silver)', fontSize: '0.72rem' }}>Disabled</span>
                    </CellLabel>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="glass-panel" style={{ padding: 'var(--space-6)' }}>
        <h4 style={{ marginTop: 0, marginBottom: 'var(--space-2)', color: 'var(--teal)' }}>Quiet Hours</h4>
        <p style={{ color: 'var(--silver)', fontSize: '0.82rem', margin: '0 0 var(--space-4)', lineHeight: 1.6 }}>
          Notifications Will Be Silenced On This Device During The Window Below. Stored Locally In Your Browser.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 'var(--space-3)',
            alignItems: 'end',
          }}
        >
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" htmlFor="qh-start">Start</label>
            <input
              id="qh-start"
              type="time"
              className="form-input"
              value={quietHours.start}
              onChange={(e) => saveQuietHours({ start: e.target.value })}
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" htmlFor="qh-end">End</label>
            <input
              id="qh-end"
              type="time"
              className="form-input"
              value={quietHours.end}
              onChange={(e) => saveQuietHours({ end: e.target.value })}
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" htmlFor="qh-tz">Timezone</label>
            <select
              id="qh-tz"
              className="form-input"
              value={quietHours.timezone}
              onChange={(e) => saveQuietHours({ timezone: e.target.value })}
            >
              <option value="" disabled>Select Timezone</option>
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
          <div style={{ margin: 0 }}>
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%', height: '42px', maxWidth: 'none' }}
              onClick={() => toast.success('Quiet Hours Saved On This Device.')}
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .account-matrix-cards { display: none; }
        @media (max-width: 720px) {
          .account-matrix-table { display: none; }
          .account-matrix-cards { display: block; }
        }
      `}</style>
    </div>
  );
}

function CellLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <span style={{ color: 'var(--silver)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </span>
      {children}
    </div>
  );
}

function CellToggle({
  on,
  disabled,
  unsupported,
  onChange,
  ariaLabel,
}: {
  on: boolean;
  disabled?: boolean;
  unsupported?: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
}) {
  if (unsupported) {
    return <span style={{ color: 'var(--silver)', fontSize: '0.78rem' }}>-</span>;
  }
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!on)}
      style={{
        appearance: 'none',
        width: 42,
        height: 24,
        borderRadius: 999,
        background: on ? 'var(--teal)' : 'rgba(255,255,255,0.12)',
        border: '1px solid',
        borderColor: on ? 'rgba(192,184,168,0.5)' : 'rgba(255,255,255,0.18)',
        position: 'relative',
        cursor: disabled ? 'wait' : 'pointer',
        transition: 'background 0.15s ease',
        padding: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: on ? 20 : 2,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: 'var(--white)',
          transition: 'left 0.15s ease',
        }}
      />
    </button>
  );
}
