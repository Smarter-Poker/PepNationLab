'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AvatarUpload from '@/components/AvatarUpload';
import {
  enablePush,
  disablePush,
  sendTestPush,
  isWebPushSupported,
  notificationPermission,
} from '@/lib/push-client';
import { PUSH_TYPES, PUSH_GROUPS, pushTypeAllowed } from '@/lib/push-prefs';
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

/* --- Style constants -------------------------------------------------------- */
const TEAL    = 'var(--teal, #C0B8A8)';
const SILVER  = 'rgba(192,184,168,0.65)';
const SURFACE = 'rgba(255,255,255,0.03)';
const BORDER  = '1px solid rgba(255,255,255,0.08)';



/* ==============================================================================
   Notification Center Page
============================================================================== */
export default function NotificationCenterClient({
  initialPrefs,
  initialTypeMap,
  sessionProfile,
}: {
  initialPrefs: Prefs;
  initialTypeMap?: Record<string, boolean>;
  sessionProfile: any;
}) {

  /* -- Preferences state -------------------------------------------------- */
  const [prefs, setPrefs]         = useState<Prefs>(initialPrefs);
  const [saving, setSaving]       = useState(false);
  const [saveMsg, setSaveMsg]     = useState<{ text: string; ok: boolean } | null>(null);

  /* -- Per-type push prefs (default-on: only an explicit false opts out) -- */
  const [typeMap, setTypeMap]     = useState<Record<string, boolean>>(initialTypeMap || {});
  const [busyTypeKey, setBusyTypeKey] = useState<string | null>(null);

  /* -- Push state --------------------------------------------------------- */
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [pushBusy, setPushBusy]   = useState(false);
  const [pushMsg, setPushMsg]     = useState<{ text: string; ok: boolean } | null>(null);

  /* -- Push support check ------------------------------------------------- */
  useEffect(() => {
    setPushSupported(isWebPushSupported());
    setPushPermission(notificationPermission());
  }, []);

  /* -- Save preferences (in-app + privacy) -------------------------------- */
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
        setSaveMsg({ text: 'Preferences Saved.', ok: true });
        if (json.preferences) setPrefs(json.preferences);
      } else {
        setSaveMsg({ text: json.error || 'Save Failed.', ok: false });
      }
    } catch {
      setSaveMsg({ text: 'Network Error. Please Try Again.', ok: false });
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 4000);
    }
  };

  /* -- Per-type push instant toggle --------------------------------------- */
  const isTypeOn = (key: string) => pushTypeAllowed(typeMap, key);

  const toggleType = async (key: string) => {
    const next = !isTypeOn(key);
    const prev = typeMap;
    // Default-on storage: store only opt-outs, so an absent key reads as ON.
    const optimistic = { ...typeMap };
    if (next) delete optimistic[key];
    else optimistic[key] = false;
    setTypeMap(optimistic);
    setBusyTypeKey(key);
    try {
      const res = await fetch('/api/account/notifications/push-types', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, enabled: next }),
      });
      if (!res.ok) {
        setTypeMap(prev);
        setPushMsg({ text: 'Could Not Save That Toggle. Try Again.', ok: false });
        setTimeout(() => setPushMsg(null), 3000);
      } else {
        const j = await res.json();
        if (j?.push_type_prefs && typeof j.push_type_prefs === 'object') {
          setTypeMap(j.push_type_prefs);
        }
      }
    } catch {
      setTypeMap(prev);
      setPushMsg({ text: 'Network Error. Try Again.', ok: false });
      setTimeout(() => setPushMsg(null), 3000);
    } finally {
      setBusyTypeKey(null);
    }
  };

  /* -- Push enable/disable ------------------------------------------------ */
  const handleEnablePush = async () => {
    setPushBusy(true);
    setPushMsg(null);
    const r = await enablePush();
    if (r.ok) {
      setPrefs(p => ({ ...p, push_enabled: true }));
      setPushMsg({ text: 'Push Notifications Enabled!', ok: true });
      setPushPermission('granted');
    } else {
      setPushMsg({ text: r.error || 'Failed To Enable Push.', ok: false });
    }
    setPushBusy(false);
  };

  const handleDisablePush = async () => {
    setPushBusy(true);
    setPushMsg(null);
    const r = await disablePush();
    if (r.ok) {
      setPrefs(p => ({ ...p, push_enabled: false }));
      setPushMsg({ text: 'Push Notifications Disabled.', ok: true });
    } else {
      setPushMsg({ text: r.error || 'Failed To Disable Push.', ok: false });
    }
    setPushBusy(false);
  };

  const handleTestPush = async () => {
    setPushBusy(true);
    setPushMsg(null);
    const r = await sendTestPush();
    if (r.ok) {
      setPushMsg({ text: `Test Push Sent To ${r.sent ?? 1} Device(s).`, ok: true });
    } else {
      setPushMsg({ text: r.error || 'Test Push Failed.', ok: false });
    }
    setPushBusy(false);
  };

  const typesDisabled = !prefs.push_enabled;

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--black)',
      paddingTop: 80,
      paddingBottom: 60,
    }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 20px' }}>

        {/* Page title */}
        <div style={{ marginBottom: 22 }}>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--white)', margin: 0 }}>
            Notification Settings
          </h1>
          <p style={{ color: SILVER, fontSize: '0.85rem', marginTop: 6 }}>
            Choose Which Alerts You Receive Here. The Bell In The Header Shows Your Live Feed.
          </p>
        </div>

        {/* == SETTINGS =================================================== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Profile Picture Upload */}
            <section style={{ background: SURFACE, border: BORDER, borderRadius: 14, padding: '20px 22px' }}>
              <h2 style={{ fontSize: '1rem', color: 'var(--white)', fontWeight: 700, margin: '0 0 4px' }}>
                Profile Picture
              </h2>
              <p style={{ color: SILVER, fontSize: '0.78rem', marginBottom: 18, marginTop: 4 }}>
                Upload An Avatar Or Logo To Appear In Messenger Instead Of A Generic Initial.
              </p>
              <AvatarUpload 
                currentAvatarUrl={sessionProfile?.avatar_url ?? null} 
                name={sessionProfile?.full_name ?? sessionProfile?.username ?? sessionProfile?.email ?? 'User'} 
              />
            </section>

            {/* Unified Notifications Section */}
            <section style={{ background: SURFACE, border: BORDER, borderRadius: 14, padding: '20px 22px' }}>
              <h2 style={{ fontSize: '1rem', color: 'var(--white)', fontWeight: 700, margin: '0 0 16px' }}>
                Alert Preferences
              </h2>

              {/* Master Toggle */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', paddingBottom: 20, borderBottom: BORDER }}>
                <input
                  type="checkbox"
                  checked={pushSupported && pushPermission === 'granted' && prefs.push_enabled}
                  disabled={pushBusy || (pushSupported && pushPermission === 'denied')}
                  onChange={(e) => {
                    if (e.target.checked) handleEnablePush();
                    else handleDisablePush();
                  }}
                  style={{ width: 18, height: 18, accentColor: TEAL, cursor: 'pointer' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ color: 'var(--white)', fontSize: '0.9rem', fontWeight: 700 }}>Enable Push Notifications</div>
                  <div style={{ color: SILVER, fontSize: '0.78rem', marginTop: 2 }}>
                    Receive alerts on your device even when the browser is closed. Turn this on to enable the alerts below.
                    {pushSupported && pushPermission === 'denied' && (
                      <span style={{ color: '#E53E3E', marginLeft: 6 }}>(Blocked - Check Browser Settings)</span>
                    )}
                  </div>
                </div>
                {pushSupported && pushPermission === 'granted' && prefs.push_enabled && (
                  <button
                    onClick={(e) => { e.preventDefault(); handleTestPush(); }}
                    disabled={pushBusy}
                    style={{
                      background: 'transparent', color: TEAL, border: `1px solid ${TEAL}`,
                      borderRadius: 6, padding: '6px 12px', fontSize: '0.75rem', fontWeight: 600,
                      cursor: pushBusy ? 'wait' : 'pointer', opacity: pushBusy ? 0.5 : 1,
                    }}
                  >
                    Test
                  </button>
                )}
              </label>

              {pushMsg && (
                <div style={{ fontSize: '0.78rem', color: pushMsg.ok ? TEAL : '#E53E3E', marginTop: 12, marginBottom: 4 }}>
                  {pushMsg.text}
                </div>
              )}

              {/* Push Category Toggles (dependent on master toggle) */}
              <div style={{ marginLeft: 32, marginTop: 20, opacity: typesDisabled ? 0.55 : 1, transition: 'opacity 0.2s' }}>
                <h3 style={{ fontSize: '0.85rem', color: 'var(--white)', fontWeight: 600, marginBottom: 12 }}>
                  Push Alert Categories
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {PUSH_GROUPS.map((group) => {
                    const rows = PUSH_TYPES.filter((t) => t.group === group);
                    if (rows.length === 0) return null;
                    return (
                      <div key={group} style={{ marginBottom: 10 }}>
                        <h4 style={{ fontSize: '0.72rem', fontWeight: 700, color: TEAL, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>
                          {group}
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {rows.map((row) => (
                            <label key={row.key} style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: typesDisabled ? 'not-allowed' : 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={isTypeOn(row.key)}
                                disabled={typesDisabled || busyTypeKey === row.key}
                                onChange={() => toggleType(row.key)}
                                style={{ width: 16, height: 16, accentColor: TEAL, cursor: typesDisabled ? 'not-allowed' : 'pointer' }}
                              />
                              <div>
                                <div style={{ color: 'var(--white)', fontSize: '0.82rem', fontWeight: 500 }}>{row.label}</div>
                                <div style={{ color: SILVER, fontSize: '0.7rem' }}>{row.desc}</div>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* In-App Toggles (independent of push) */}
              <div style={{ marginTop: 30, paddingTop: 20, borderTop: BORDER }}>
                <h3 style={{ fontSize: '0.85rem', color: 'var(--white)', fontWeight: 600, marginBottom: 12 }}>
                  In-App Notification Bell
                </h3>
                <p style={{ color: SILVER, fontSize: '0.75rem', marginBottom: 16 }}>
                  Control which events appear in the notification bell at the top of the screen.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {([
                    { key: 'events_order_approved', label: 'Order Approved', desc: 'When Your Order Gets Approved' },
                    { key: 'events_order_shipped',  label: 'Order Shipped',  desc: 'When Your Order Ships With Tracking' },
                    { key: 'events_order_delivered',label: 'Order Delivered',desc: 'When Your Order Is Delivered' },
                    { key: 'events_payment_reminder',label: 'Payment Reminders', desc: 'Outstanding Balance Reminders' },
                  ] as const).map(row => (
                    <label key={row.key} style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={prefs[row.key]}
                        onChange={e => setPrefs(p => ({ ...p, [row.key]: e.target.checked }))}
                        style={{ width: 16, height: 16, accentColor: TEAL, cursor: 'pointer' }}
                      />
                      <div>
                        <div style={{ color: 'var(--white)', fontSize: '0.82rem', fontWeight: 500 }}>{row.label}</div>
                        <div style={{ color: SILVER, fontSize: '0.7rem' }}>{row.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Privacy Prefs */}
              <div style={{ marginTop: 30, paddingTop: 20, borderTop: BORDER }}>
                <h3 style={{ fontSize: '0.85rem', color: 'var(--white)', fontWeight: 600, marginBottom: 12 }}>
                  Privacy
                </h3>
                <label style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={prefs.send_read_receipts}
                    onChange={e => setPrefs(p => ({ ...p, send_read_receipts: e.target.checked }))}
                    style={{ width: 16, height: 16, accentColor: TEAL, cursor: 'pointer' }}
                  />
                  <div>
                    <div style={{ color: 'var(--white)', fontSize: '0.82rem', fontWeight: 500 }}>Send Read Receipts</div>
                    <div style={{ color: SILVER, fontSize: '0.7rem' }}>Allow Others To See When You Have Read Their Messages.</div>
                  </div>
                </label>
              </div>
            </section>

            {/* Save button (in-app + privacy prefs; per-type push saves instantly) */}
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
              Need To Change Your Password?{' '}
              <Link href="/account/security" style={{ color: TEAL }}>Account Security</Link>
            </p>
          </div>
      </div>
    </div>
  );
}
