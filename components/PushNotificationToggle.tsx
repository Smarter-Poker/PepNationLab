'use client';

/**
 * PushNotificationToggle - the single, real device-push enrollment control
 * PLUS the full per-category notification preferences.
 *
 * Device side: wraps the full enablePush() flow from lib/push-client (request
 * permission -> pushManager.subscribe() with the current VAPID key -> persist
 * to push_subscriptions). Per-type side: lists every push notification type
 * (lib/push-prefs) grouped by category, each individually toggleable on/off,
 * saved instantly to notification_preferences.push_type_prefs. It is
 * role-agnostic and used by every dashboard (admin, agent, super agent,
 * sub agent, researcher) so the experience is identical everywhere.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  isWebPushSupported,
  notificationPermission,
  enablePush,
  disablePush,
  sendTestPush,
} from '@/lib/push-client';
import { PUSH_TYPES, PUSH_GROUPS, pushTypeAllowed } from '@/lib/push-prefs';

interface Props {
  /** Optional heading shown above the control. */
  title?: string;
  /** Optional supporting line under the heading. */
  description?: string;
  /** Show the per-category notification type toggles (default true). */
  showTypePrefs?: boolean;
}

/* Teal on/off switch matching the platform design system. */
function TealSwitch({
  checked,
  busy,
  onChange,
  label,
}: {
  checked: boolean;
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
      disabled={busy}
      onClick={onChange}
      style={{
        position: 'relative',
        width: 44,
        height: 26,
        flexShrink: 0,
        borderRadius: 999,
        border: 'none',
        cursor: busy ? 'wait' : 'pointer',
        background: checked ? 'var(--teal)' : 'rgba(255,255,255,0.16)',
        opacity: busy ? 0.7 : 1,
        transition: 'background 0.2s ease, opacity 0.2s ease',
        padding: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: checked ? 21 : 3,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: checked ? '#05131a' : '#FFFFFF',
          transition: 'left 0.2s ease, background 0.2s ease',
          boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
        }}
      />
    </button>
  );
}

export default function PushNotificationToggle({
  title = 'Device Notifications',
  description = 'Get Alerts On This Device For Incoming Calls And Messages Even When The App Is Closed.',
  showTypePrefs = true,
}: Props) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Per-type push preferences (default-on: only an explicit false opts out).
  const [typeMap, setTypeMap] = useState<Record<string, boolean>>({});
  const [typesLoaded, setTypesLoaded] = useState(false);
  const [busyTypeKey, setBusyTypeKey] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const sup = isWebPushSupported();
    setSupported(sup);
    setPermission(notificationPermission());
    if (!sup) {
      setSubscribed(false);
      return;
    }
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      setSubscribed(!!sub);
    } catch {
      setSubscribed(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Load the saved per-type map once.
  useEffect(() => {
    if (!showTypePrefs) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/account/notifications/push-types', { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          if (!cancelled && json?.push_type_prefs && typeof json.push_type_prefs === 'object') {
            setTypeMap(json.push_type_prefs);
          }
        }
      } catch {
        /* leave defaults (all on) */
      } finally {
        if (!cancelled) setTypesLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [showTypePrefs]);

  const onEnable = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await enablePush();
      if (r.ok) {
        setMsg({ text: 'Notifications Enabled On This Device.', ok: true });
        await refresh();
      } else {
        setMsg({ text: r.error || 'Could Not Enable Notifications.', ok: false });
        setPermission(notificationPermission());
      }
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const onDisable = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await disablePush();
      if (r.ok) {
        setMsg({ text: 'Notifications Disabled On This Device.', ok: true });
        await refresh();
      } else {
        setMsg({ text: r.error || 'Could Not Disable Notifications.', ok: false });
      }
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const onTest = useCallback(async () => {
    setTestBusy(true);
    setMsg(null);
    try {
      const r = await sendTestPush();
      if (r.ok) {
        setMsg({ text: `Test Notification Sent To ${r.sent ?? 0} Device${r.sent === 1 ? '' : 's'}.`, ok: true });
      } else {
        setMsg({ text: r.error || 'Test Notification Failed.', ok: false });
      }
    } finally {
      setTestBusy(false);
    }
  }, []);

  const isTypeOn = (key: string) => pushTypeAllowed(typeMap, key);

  const toggleType = useCallback(async (key: string) => {
    const next = !pushTypeAllowed(typeMap, key);
    const prev = typeMap;
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
        setMsg({ text: 'Could Not Save That Toggle. Try Again.', ok: false });
      } else {
        const j = await res.json();
        if (j?.push_type_prefs && typeof j.push_type_prefs === 'object') setTypeMap(j.push_type_prefs);
      }
    } catch {
      setTypeMap(prev);
      setMsg({ text: 'Network Error. Try Again.', ok: false });
    } finally {
      setBusyTypeKey(null);
    }
  }, [typeMap]);

  const dotColor =
    subscribed && permission === 'granted' ? 'var(--teal)'
    : permission === 'denied' ? 'var(--red)'
    : 'var(--grey-500)';

  const canShowTypes = showTypePrefs && supported !== false && permission !== 'unsupported' && permission !== 'denied';

  return (
    <div
      className="glass-panel"
      style={{ padding: 'var(--space-5)', borderRadius: 'var(--radius-md)' }}
    >
      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--white)', margin: '0 0 4px' }}>{title}</h3>
      <p style={{ fontSize: '0.82rem', color: 'var(--silver)', margin: '0 0 var(--space-4)', lineHeight: 1.6 }}>{description}</p>

      {supported === false || permission === 'unsupported' ? (
        <p style={{ fontSize: '0.85rem', color: 'var(--grey-400)', margin: 0 }}>
          This Browser Does Not Support Push Notifications. On iPhone Or iPad, Add Pep Nation Lab To Your Home Screen First, Then Open It From There.
        </p>
      ) : permission === 'denied' ? (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--red)', marginTop: 5, flexShrink: 0 }} />
          <div>
            <p style={{ fontSize: '0.85rem', color: 'var(--white)', margin: '0 0 4px', fontWeight: 600 }}>Notifications Are Blocked</p>
            <p style={{ fontSize: '0.78rem', color: 'var(--grey-400)', margin: 0, lineHeight: 1.6 }}>
              Your Device Has Blocked Notifications For This App. Enable Them In Your Device Settings Under Pep Nation Lab, Then Reload.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: dotColor, flexShrink: 0, boxShadow: subscribed ? `0 0 8px ${dotColor}` : 'none' }} />
              <div>
                <p style={{ fontSize: '0.85rem', color: 'var(--white)', margin: '0 0 2px', fontWeight: 600 }}>
                  {subscribed ? 'Enabled On This Device' : 'Not Enabled On This Device'}
                </p>
                <p style={{ fontSize: '0.75rem', color: 'var(--grey-400)', margin: 0 }}>
                  {subscribed ? 'You Will Receive Real-Time Alerts Here.' : 'Turn On To Receive Alerts On This Device.'}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexShrink: 0 }}>
              {subscribed ? (
                <>
                  <button type="button" onClick={onTest} disabled={testBusy} className="btn btn-ghost btn-sm">
                    {testBusy ? 'Sending...' : 'Send Test'}
                  </button>
                  <button type="button" onClick={onDisable} disabled={busy} className="btn btn-secondary btn-sm">
                    {busy ? 'Saving...' : 'Disable'}
                  </button>
                </>
              ) : (
                <button type="button" onClick={onEnable} disabled={busy} className="btn btn-primary btn-sm">
                  {busy ? 'Enabling...' : 'Enable Notifications'}
                </button>
              )}
            </div>
          </div>
          {msg && (
            <p style={{ fontSize: '0.8rem', marginTop: 'var(--space-3)', marginBottom: 0, color: msg.ok ? 'var(--teal)' : 'var(--red)' }}>
              {msg.text}
            </p>
          )}

          {/* Per-category notification type toggles */}
          {canShowTypes && (
            <div style={{ marginTop: 'var(--space-5)', paddingTop: 'var(--space-4)', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--white)', fontWeight: 600, margin: '0 0 2px' }}>
                Choose Which Alerts You Receive
              </p>
              <p style={{ fontSize: '0.76rem', color: 'var(--grey-400)', margin: '0 0 4px' }}>
                Turn Any Notification On Or Off, By Category. Changes Save Automatically.
              </p>
              {!subscribed && (
                <p style={{ fontSize: '0.72rem', color: 'var(--grey-500)', margin: '0 0 10px' }}>
                  Enable Device Notifications Above To Actually Receive These On This Device.
                </p>
              )}

              {!typesLoaded ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--grey-400)', margin: '10px 0 0' }}>Loading Your Alert Preferences...</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginTop: 'var(--space-3)' }}>
                  {PUSH_GROUPS.map((group) => {
                    const rows = PUSH_TYPES.filter((t) => t.group === group);
                    if (rows.length === 0) return null;
                    return (
                      <div key={group}>
                        <h4 style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 2px' }}>
                          {group}
                        </h4>
                        {rows.map((row, i) => (
                          <div
                            key={row.key}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                              padding: '11px 0',
                              borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.05)',
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ color: 'var(--white)', fontSize: '0.85rem', fontWeight: 500 }}>{row.label}</div>
                              <div style={{ color: 'var(--grey-400)', fontSize: '0.72rem', marginTop: 2 }}>{row.desc}</div>
                            </div>
                            <TealSwitch
                              label={row.label}
                              checked={isTypeOn(row.key)}
                              busy={busyTypeKey === row.key}
                              onChange={() => toggleType(row.key)}
                            />
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
