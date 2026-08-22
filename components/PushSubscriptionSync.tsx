'use client';

/**
 * PushSubscriptionSync — silent self-heal for web-push enrollment.
 *
 * WHY THIS EXISTS (incident 2026-08-04): the platform admin stopped receiving
 * every mobile push for days while the server showed nothing but success —
 * FCM and Apple kept answering 2xx for subscriptions whose devices had long
 * since rotated, reinstalled, or been reassigned. The app only ever wrote a
 * subscription at the moment a user clicked "Enable" (FirstRunNotificationPrompt
 * / PushNotificationToggle), and the first-run prompt marks itself done in
 * localStorage forever. So the moment a device's subscription rotted, there
 * was NO code path anywhere that would ever repair it.
 *
 * This component closes that hole: on every app boot (and again when the PWA
 * is resumed from the background), if — and only if — notification permission
 * is ALREADY granted and a user is signed in, it re-runs the enablePush()
 * enrollment. With permission already granted this is completely silent:
 * Notification.requestPermission() resolves immediately without UI, the
 * existing subscription is reused (or re-created if the browser dropped it,
 * or replaced if the VAPID key rotated), and the server upsert refreshes the
 * push_subscriptions row — re-activating rows that were wrongly deactivated
 * and re-claiming endpoints after account switches on a shared device.
 *
 * It never prompts: if permission is 'default' or 'denied' it does nothing,
 * leaving the ask to the explicit UI surfaces.
 *
 * Throttled to once per hour per device via localStorage so app-open spam
 * costs nothing.
 */

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { isWebPushSupported, notificationPermission, enablePush } from '@/lib/push-client';

const THROTTLE_KEY = 'pnl_push_sync_at';
const THROTTLE_MS = 60 * 60 * 1000; // 1 hour

function throttled(): boolean {
  try {
    const last = Number(localStorage.getItem(THROTTLE_KEY) || 0);
    return Number.isFinite(last) && Date.now() - last < THROTTLE_MS;
  } catch {
    return false;
  }
}

function stampThrottle(): void {
  try { localStorage.setItem(THROTTLE_KEY, String(Date.now())); } catch { /* ignore */ }
}

export default function PushSubscriptionSync() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;
    let running = false;

    const sync = async () => {
      if (running || cancelled) return;
      running = true;
      try {
        if (!isWebPushSupported()) return;
        // Permission not granted -> never prompt from a background sync.
        if (notificationPermission() !== 'granted') return;
        if (throttled()) return;

        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user || cancelled) return;

        // Permission is already granted, so this is a silent re-enrollment:
        // requestPermission() no-ops, the subscription is fetched or minted,
        // stale-VAPID-key subscriptions are dropped and re-created, and the
        // server row is upserted back to active.
        const r = await enablePush();
        if (r.ok) stampThrottle();
      } catch {
        /* best-effort — never let a sync failure surface to the user */
      } finally {
        running = false;
      }
    };

    // After hydration settles; not worth competing with first paint.
    const t = window.setTimeout(sync, 5000);

    // PWAs resume rather than reload, so app boot alone would miss devices
    // that stay "open" for weeks. Re-check whenever the app comes back to
    // the foreground (still behind the 1-hour throttle).
    const onVisible = () => {
      if (document.visibilityState === 'visible') void sync();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return null;
}
