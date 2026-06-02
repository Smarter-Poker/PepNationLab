'use client';

import { useState, useEffect } from 'react';
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

/* iOS-style on/off switch for per-type push toggles. */
function PushSwitch({
  checked,
  disabled,
  busy,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  busy?: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled || busy}
      onClick={onChange}
      style={{
        position: 'relative',
        width: 46,
        height: 28,
        flexShrink: 0,
        borderRadius: 999,
        border: 'none',
        cursor: disabled || busy ? 'not-allowed' : 'pointer',
        background: checked ? TEAL : 'rgba(255,255,255,0.14)',
        opacity: disabled ? 0.4 : busy ? 0.7 : 1,
        transition: 'background 0.2s ease, opacity 0.2s ease',
        padding: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: checked ? 21 : 3,
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: checked ? '#0A1018' : '#FFFFFF',
          transition: 'left 0.2s ease, background 0.2s ease',
          boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
        }}
      />
    </button>
  );
}

/* ==============================================================================
   Notification Center Page
============================================================================== */
import AvatarUpload from '@/components/AvatarUpload';

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
                Upload an avatar or logo to appear in Messenger instead of a generic initial.
              </p>
              <AvatarUpload 
                currentAvatarUrl={sessionProfile?.avatar_url ?? null} 
                name={sessionProfile?.full_name ?? sessionProfile?.username ?? sessionProfile?.email ?? 'User'} 
              />
            </section>

            {/* Browser push master toggle */}
            <section style={{ background: SURFACE, border: BORDER, borderRadius: 14, padding: '20px 22px' }}>
              <h2 style={{ fontSize: '1rem', color: 'var(--white)', fontWeight: 700, margin: '0 0 4px' }}>
                Push Notifications
              </h2>
              <p style={{ color: SILVER, fontSize: '0.78rem', marginBottom: 16, marginTop: 4 }}>
                Receive alerts even when the browser tab is closed or minimized. Turn This On, Then Choose Exactly Which Alerts You Want Below.
              </p>

              {/* Status */}
              <div style={{ marginBottom: 14, fontSize: '0.8rem' }}>
                <span style={{ color: 'var(--white)', fontWeight: 600 }}>Status: </span>
                {!pushSupported && <span style={{ color: '#00E5FF' }}>Not supported in this browser</span>}
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
                <div style={{ fontSize: '0.78rem', color: pushMsg.ok ? TEAL : '#E53E3E' }}>
                  {pushMsg.text}
                </div>
              )}
            </section>

            {/* Per-type push controls — every notification, by category */}
            <section style={{ background: SURFACE, border: BORDER, borderRadius: 14, padding: '20px 22px' }}>
              <h2 style={{ fontSize: '1rem', color: 'var(--white)', fontWeight: 700, margin: '0 0 4px' }}>
                Choose Which Alerts You Receive
              </h2>
              <p style={{ color: SILVER, fontSize: '0.78rem', marginBottom: 4, marginTop: 4 }}>
                Turn Any Notification On Or Off. Organized By Category. Changes Save Automatically.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14, opacity: typesDisabled ? 0.55 : 1, transition: 'opacity 0.2s' }}>
                {PUSH_GROUPS.map((group) => {
                  const rows = PUSH_TYPES.filter((t) => t.group === group);
                  if (rows.length === 0) return null;
                  return (
                    <div key={group}>
                      <h3 style={{ fontSize: '0.72rem', fontWeight: 700, color: TEAL, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 2px' }}>
                        {group}
                      </h3>
                      {rows.map((row, i) => (
                        <div
                          key={row.key}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 14,
                            padding: '12px 0',
                            borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.05)',
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ color: 'var(--white)', fontSize: '0.87rem', fontWeight: 500 }}>{row.label}</div>
                            <div style={{ color: SILVER, fontSize: '0.73rem', marginTop: 2 }}>{row.desc}</div>
                          </div>
                          <PushSwitch
                            label={row.label}
                            checked={isTypeOn(row.key)}
                            busy={busyTypeKey === row.key}
                            disabled={typesDisabled}
                            onChange={() => toggleType(row.key)}
                          />
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>

              {typesDisabled && pushSupported && pushPermission !== 'denied' && (
                <p style={{ color: SILVER, fontSize: '0.76rem', marginTop: 14 }}>
                  Turn On Push Notifications Above To Customize These Individual Alerts.
                </p>
              )}
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
              Need to change your password?{' '}
              <Link href="/account/security" style={{ color: TEAL }}>Account Security</Link>
            </p>
          </div>
      </div>
    </div>
  );
}
