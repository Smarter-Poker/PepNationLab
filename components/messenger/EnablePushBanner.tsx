'use client';

/**
 * EnablePushBanner - a slim, dismissible prompt at the top of the messenger
 * for devices that have never enrolled in web push.
 *
 * Why this exists (owner report 2026-08-19): a group call rang out server-side
 * perfectly - realtime broadcast, bell notification, push_outbox row - but one
 * member's push was skipped with `no_subscription`. He had simply never turned
 * on Device Notifications, and nothing in the messenger ever asked him to. A
 * closed or backgrounded browser can ONLY ring via web push, so a user without
 * a subscription silently misses every call. This banner closes that gap where
 * it matters most: the messenger itself.
 *
 * Hidden when: push is unsupported, permission is denied (the settings page
 * explains recovery), the device is already subscribed, or the user dismissed
 * it within the last 7 days.
 */

import { useCallback, useEffect, useState } from 'react';
import { BellRing, X } from 'lucide-react';
import { toast } from 'sonner';
import { isWebPushSupported, notificationPermission, enablePush } from '@/lib/push-client';

const DISMISS_KEY = 'pnl_messenger_push_banner_dismissed_at';
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function recentlyDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const at = Number(raw);
    return Number.isFinite(at) && Date.now() - at < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

export default function EnablePushBanner() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!isWebPushSupported()) return;
        const perm = notificationPermission();
        if (perm === 'denied' || perm === 'unsupported') return;
        if (recentlyDismissed()) return;
        const reg = await navigator.serviceWorker.getRegistration('/sw.js');
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        if (!cancelled && !sub) setVisible(true);
      } catch {
        /* stay hidden on any detection failure */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleEnable = useCallback(async () => {
    setBusy(true);
    try {
      const r = await enablePush();
      if (r.ok) {
        toast.success('Notifications Enabled On This Device', {
          description: 'Incoming Calls And Messages Will Now Alert You Even When The App Is Closed.',
        });
        setVisible(false);
      } else {
        toast.error('Could Not Enable Notifications', { description: r.error });
        if (notificationPermission() === 'denied') setVisible(false);
      }
    } finally {
      setBusy(false);
    }
  }, []);

  const handleDismiss = useCallback(() => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* best-effort */ }
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Enable Device Notifications"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        margin: '0 10px 8px',
        borderRadius: 10,
        border: '1px solid rgba(0, 196, 188, 0.35)',
        background: 'rgba(0, 196, 188, 0.08)',
        flexShrink: 0,
      }}
    >
      <BellRing size={18} aria-hidden="true" style={{ color: 'var(--teal, #00C4BC)', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--white, #FFFFFF)' }}>
          Never Miss A Call
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--grey-400, #A8B4C0)', lineHeight: 1.4 }}>
          Turn On Notifications So Calls And Messages Reach This Device Even When The App Is Closed.
        </div>
      </div>
      <button
        type="button"
        onClick={handleEnable}
        disabled={busy}
        style={{
          flexShrink: 0,
          padding: '7px 12px',
          borderRadius: 8,
          border: 0,
          background: 'var(--teal, #00C4BC)',
          color: '#000',
          fontWeight: 700,
          fontSize: '0.78rem',
          cursor: busy ? 'wait' : 'pointer',
          opacity: busy ? 0.7 : 1,
        }}
      >
        {busy ? 'Enabling' : 'Enable'}
      </button>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss Notification Prompt"
        style={{
          flexShrink: 0,
          background: 'transparent',
          border: 0,
          color: 'var(--grey-400, #A8B4C0)',
          cursor: 'pointer',
          padding: 4,
          display: 'flex',
        }}
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
