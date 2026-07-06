'use client';

import { useEffect, useState } from 'react';
import {
  enablePush,
  disablePush,
  sendTestPush,
  isWebPushSupported,
  notificationPermission,
} from '@/lib/push-client';
import { PUSH_TYPES, PUSH_GROUPS, pushTypeAllowed } from '@/lib/push-prefs';

const TEAL = 'var(--teal, #C0B8A8)';
const SILVER = 'rgba(192,184,168,0.65)';
const SURFACE = 'rgba(255,255,255,0.03)';
const BORDER = '1px solid rgba(255,255,255,0.08)';

/* Simple iOS-style on/off switch. */
function Switch({
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

export default function NotificationPreferencesClient({
  initialPushEnabled,
  initialMap,
}: {
  initialPushEnabled: boolean;
  initialMap: Record<string, boolean>;
}) {
  const [map, setMap] = useState<Record<string, boolean>>(initialMap || {});
  const [pushEnabled, setPushEnabled] = useState(initialPushEnabled);
  const [pushSupported, setPushSupported] = useState(true);
  const [pushPermission, setPushPermission] =
    useState<NotificationPermission | 'unsupported'>('default');
  const [masterBusy, setMasterBusy] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    // Browser-only APIs — must run after mount to avoid SSR mismatch
    const supported = isWebPushSupported();
    const permission = notificationPermission();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPushSupported(supported);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPushPermission(permission);
  }, []);

  const flash = (text: string, ok: boolean) => {
    setToast({ text, ok });
    window.setTimeout(() => setToast(null), 3000);
  };

  /* ── Master device push on/off ───────────────────────────────────── */
  const handleMaster = async () => {
    setMasterBusy(true);
    if (pushEnabled) {
      const r = await disablePush();
      if (r.ok) {
        setPushEnabled(false);
        flash('Push Turned Off On This Device.', true);
      } else {
        flash(r.error || 'Could Not Turn Off Push.', false);
      }
    } else {
      const r = await enablePush();
      if (r.ok) {
        setPushEnabled(true);
        setPushPermission('granted');
        flash('Push Notifications Enabled.', true);
      } else {
        flash(r.error || 'Could Not Enable Push.', false);
      }
    }
    setMasterBusy(false);
  };

  const handleTest = async () => {
    setMasterBusy(true);
    const r = await sendTestPush();
    flash(r.ok ? `Test Sent To ${r.sent ?? 1} Device(s).` : (r.error || 'Test Failed.'), !!r.ok);
    setMasterBusy(false);
  };

  /* ── Per-type instant toggle ──────────────────────────────────── */
  const isOn = (key: string) => pushTypeAllowed(map, key);

  const toggleType = async (key: string) => {
    const next = !isOn(key);
    const prevMap = map;
    // Optimistic: store only opt-outs (absent key = on).
    const optimistic = { ...map };
    if (next) delete optimistic[key];
    else optimistic[key] = false;
    setMap(optimistic);
    setBusyKey(key);
    try {
      const res = await fetch('/api/account/notifications/push-types', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, enabled: next }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setMap(prevMap);
        flash(j?.error || 'Could Not Save. Try Again.', false);
      } else {
        const j = await res.json();
        if (j?.push_type_prefs && typeof j.push_type_prefs === 'object') {
          setMap(j.push_type_prefs);
        }
      }
    } catch {
      setMap(prevMap);
      flash('Network Error. Try Again.', false);
    } finally {
      setBusyKey(null);
    }
  };

  const controlsDisabled = !pushEnabled;

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--black)', paddingTop: 'var(--nav-offset, 80px)', paddingBottom: 60 }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '20px 20px 0' }}>

        {/* Header */}
        <div style={{ marginBottom: 22 }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--white)', margin: '10px 0 4px' }}>
            Notification Preferences
          </h1>
          <p style={{ color: SILVER, fontSize: '0.84rem', margin: 0 }}>
            Choose Exactly Which Push Notifications You Receive On This Device.
          </p>
        </div>

        {/* Master push card */}
        <section style={{ background: SURFACE, border: BORDER, borderRadius: 14, padding: '18px 20px', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: 'var(--white)', fontSize: '0.98rem', fontWeight: 700 }}>
                Push Notifications
              </div>
              <div style={{ color: SILVER, fontSize: '0.78rem', marginTop: 3 }}>
                {!pushSupported
                  ? 'Not Supported On This Browser. Install The App To Your Home Screen To Enable Push.'
                  : pushPermission === 'denied'
                  ? 'Blocked In Your Browser Settings. Allow Notifications For This Site, Then Try Again.'
                  : pushEnabled
                  ? 'On For This Device. Toggle Individual Alerts Below.'
                  : 'Turn On To Receive Alerts Even When The App Is Closed.'}
              </div>
            </div>
            <Switch
              label="Push Notifications"
              checked={pushEnabled}
              busy={masterBusy}
              disabled={!pushSupported || pushPermission === 'denied'}
              onChange={handleMaster}
            />
          </div>
          {pushEnabled && (
            <button
              type="button"
              onClick={handleTest}
              disabled={masterBusy}
              style={{
                marginTop: 14, background: 'transparent', color: TEAL,
                border: `1px solid ${TEAL}`, borderRadius: 8, padding: '7px 16px',
                fontSize: '0.8rem', fontWeight: 600, cursor: masterBusy ? 'wait' : 'pointer',
              }}
            >
              Send A Test Notification
            </button>
          )}
        </section>

        {/* Per-type groups */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, opacity: controlsDisabled ? 0.55 : 1, transition: 'opacity 0.2s' }}>
          {PUSH_GROUPS.map((group) => {
            const rows = PUSH_TYPES.filter((t) => t.group === group);
            if (rows.length === 0) return null;
            return (
              <section key={group} style={{ background: SURFACE, border: BORDER, borderRadius: 14, padding: '8px 20px' }}>
                <h2 style={{ fontSize: '0.74rem', fontWeight: 700, color: TEAL, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '14px 0 6px' }}>
                  {group}
                </h2>
                {rows.map((row, i) => (
                  <div
                    key={row.key}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '13px 0',
                      borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.05)',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: 'var(--white)', fontSize: '0.88rem', fontWeight: 500 }}>{row.label}</div>
                      <div style={{ color: SILVER, fontSize: '0.74rem', marginTop: 2 }}>{row.desc}</div>
                    </div>
                    <Switch
                      label={row.label}
                      checked={isOn(row.key)}
                      busy={busyKey === row.key}
                      disabled={controlsDisabled}
                      onChange={() => toggleType(row.key)}
                    />
                  </div>
                ))}
              </section>
            );
          })}
        </div>

        {controlsDisabled && pushSupported && pushPermission !== 'denied' && (
          <p style={{ color: SILVER, fontSize: '0.78rem', textAlign: 'center', marginTop: 18 }}>
            Turn On Push Notifications Above To Customize Individual Alerts.
          </p>
        )}

        <p style={{ color: 'rgba(192,184,168,0.35)', fontSize: '0.72rem', textAlign: 'center', marginTop: 22 }}>
          Changes Save Automatically.
        </p>
      </div>

      {/* Toast */}
      {toast && (
        <div
          role="status"
          style={{
            position: 'fixed', left: '50%', bottom: 'max(20px, env(safe-area-inset-bottom, 20px))',
            transform: 'translateX(-50%)', zIndex: 2000,
            background: toast.ok ? 'rgba(192,184,168,0.95)' : 'rgba(229,62,62,0.95)',
            color: toast.ok ? '#0A1018' : '#FFFFFF',
            padding: '10px 18px', borderRadius: 10, fontSize: '0.82rem', fontWeight: 600,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)', maxWidth: '90vw',
          }}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}
