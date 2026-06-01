'use client';

/**
 * PushNotificationToggle — the single, real device-push enrollment control.
 *
 * Unlike the old per-dashboard panels that only called
 * Notification.requestPermission() (which shows the iOS prompt but never
 * registers a deliverable subscription), this wraps the full enablePush()
 * flow from lib/push-client: request permission -> pushManager.subscribe()
 * with the current VAPID key -> persist to push_subscriptions. It is
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

interface Props {
  /** Optional heading shown above the control. */
  title?: string;
  /** Optional supporting line under the heading. */
  description?: string;
}

export default function PushNotificationToggle({
  title = 'Device Notifications',
  description = 'Get Alerts On This Device For Incoming Calls And Messages Even When The App Is Closed.',
}: Props) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

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

  const dotColor =
    subscribed && permission === 'granted' ? 'var(--teal)'
    : permission === 'denied' ? 'var(--red)'
    : 'var(--grey-500)';

  return (
    <div
      className="card-glass"
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
        </>
      )}
    </div>
  );
}
