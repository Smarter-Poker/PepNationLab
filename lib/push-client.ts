'use client';

/**
 * Browser-side helpers for enrolling in web push.
 *
 * These functions are intentionally defensive: they no-op (returning a
 * structured result) on browsers without service worker / push support,
 * and surface a user-readable error string on failure rather than throwing.
 *
 * HARDENED (2026-08-06) after a real device sat on "Enabling..." forever:
 *  - EVERY await is wrapped in a hard timeout. iOS in particular is known to
 *    wedge indefinitely inside pushManager.subscribe() (and occasionally
 *    serviceWorker.ready); before this, one hung promise froze the enable
 *    flow with no error, no retry, and no way out short of killing the app.
 *  - Notification.requestPermission() now runs FIRST, before any network
 *    fetch. iOS only honours the permission request while the user's tap
 *    gesture is still "active"; the old order (fetch VAPID key over the
 *    network, THEN ask) could burn that window on a slow connection and the
 *    prompt would never appear.
 *  - pushManager.subscribe() gets one automatic retry after force-dropping
 *    any half-dead existing subscription - the documented recovery for the
 *    wedged-subscription state.
 *  - Every failure path returns a specific, user-readable reason.
 */

export interface EnableResult {
  ok: boolean;
  error?: string;
  endpoint?: string;
}

export interface DisableResult {
  ok: boolean;
  error?: string;
}

/**
 * Hard timeout wrapper. A push-enrollment step that hangs is
 * indistinguishable from success to the UI, so no step may run unbounded.
 */
function withTimeout<T>(p: Promise<T>, ms: number, step: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`${step} Timed Out. Please Try Again.`)),
      ms,
    );
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const buffer = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let i = 0; i < rawData.length; i++) {
    buffer[i] = rawData.charCodeAt(i);
  }
  return buffer;
}

/**
 * True when an existing push subscription was created with the same VAPID
 * application server key we are about to use. A mismatch means the push
 * service will reject every send with VapidPkHashMismatch, so the stale
 * subscription must be dropped and re-created.
 */
function applicationServerKeyMatches(existing: ArrayBuffer | null, want: Uint8Array): boolean {
  if (!existing) return false;
  const a = new Uint8Array(existing);
  if (a.length !== want.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== want[i]) return false;
  }
  return true;
}

export function isWebPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export async function enablePush(): Promise<EnableResult> {
  if (!isWebPushSupported()) {
    return { ok: false, error: 'Push Notifications Are Not Supported In This Browser.' };
  }

  try {
    // 1. PERMISSION FIRST - before any network hop, while the user's tap
    //    gesture is still active (iOS requires this). Already-granted
    //    resolves instantly with no UI. The generous timeout is for a human
    //    reading the OS dialog, not for the API.
    let permission: NotificationPermission = Notification.permission;
    if (permission !== 'granted') {
      permission = await withTimeout(
        Promise.resolve(Notification.requestPermission()),
        90_000,
        'The Permission Prompt',
      );
    }
    if (permission !== 'granted') {
      // 'denied' is sticky: the browser will not prompt again until the user
      // unblocks the site in settings. 'default' means they dismissed the
      // prompt and can simply try again. Surface the difference so the UI can
      // show the right recovery path instead of a dead-end.
      return {
        ok: false,
        error: permission === 'denied'
          ? 'Notifications Are Blocked For This Site In Your Device Settings.'
          : 'You Closed The Permission Box Before Choosing Allow.',
      };
    }

    // 2. Server VAPID key.
    const keyRes = await withTimeout(
      fetch('/api/push/vapid-public-key', { cache: 'no-store' }),
      10_000,
      'Fetching The Server Key',
    );
    const keyJson = (await keyRes.json()) as { key?: string };
    const vapidKey = keyJson.key || '';
    if (!vapidKey) {
      return { ok: false, error: 'Push Notifications Are Not Configured On The Server Yet.' };
    }

    // 3. Service worker.
    const reg = await withTimeout(
      navigator.serviceWorker.register('/sw.js'),
      10_000,
      'Registering The Service Worker',
    );
    await withTimeout(navigator.serviceWorker.ready, 10_000, 'Starting The Service Worker');

    const wantKey = urlBase64ToUint8Array(vapidKey);
    let subscription = await withTimeout(
      reg.pushManager.getSubscription(),
      8_000,
      'Reading The Current Subscription',
    );

    // Self-heal: if a subscription already exists but was created with a
    // different VAPID key (e.g. the server keypair was rotated), every push
    // to it fails with VapidPkHashMismatch. Drop the stale one so we can
    // re-subscribe with the current key.
    if (subscription && !applicationServerKeyMatches(subscription.options?.applicationServerKey ?? null, wantKey)) {
      try {
        await withTimeout(subscription.unsubscribe(), 8_000, 'Removing The Old Subscription');
      } catch {
        // Best-effort - proceed to re-subscribe regardless.
      }
      subscription = null;
    }

    // 4. Subscribe - with one automatic recovery retry. iOS (and
    //    occasionally Chrome) can wedge subscribe() forever when a previous
    //    subscription is in a half-dead state; the fix is to force-drop
    //    whatever exists and subscribe fresh.
    if (!subscription) {
      try {
        subscription = await withTimeout(
          reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: wantKey }),
          20_000,
          'Creating The Subscription',
        );
      } catch {
        try {
          const stale = await withTimeout(reg.pushManager.getSubscription(), 5_000, 'Reading The Current Subscription');
          if (stale) await withTimeout(stale.unsubscribe(), 5_000, 'Removing The Old Subscription');
        } catch { /* best-effort cleanup before the retry */ }
        subscription = await withTimeout(
          reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: wantKey }),
          15_000,
          'Creating The Subscription',
        );
      }
    }

    const sub = subscription.toJSON() as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };
    if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
      return { ok: false, error: 'Could Not Read Subscription Keys.' };
    }

    // 5. Persist to the server (this is what actually routes pushes here).
    const res = await withTimeout(
      fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
          userAgent: navigator.userAgent,
          deviceLabel: navigator.platform || null,
        }),
      }),
      10_000,
      'Saving The Subscription',
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: (data as { error?: string })?.error || 'Failed To Save Subscription.' };
    }

    return { ok: true, endpoint: sub.endpoint };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown Error.';
    return { ok: false, error: msg };
  }
}

export async function disablePush(): Promise<DisableResult> {
  if (!isWebPushSupported()) {
    return { ok: true };
  }
  try {
    const reg = await withTimeout(
      navigator.serviceWorker.getRegistration('/sw.js'),
      8_000,
      'Finding The Service Worker',
    );
    if (!reg) return { ok: true };
    const subscription = await withTimeout(reg.pushManager.getSubscription(), 8_000, 'Reading The Current Subscription');
    if (!subscription) return { ok: true };
    const endpoint = subscription.endpoint;
    await withTimeout(subscription.unsubscribe(), 10_000, 'Removing The Subscription');
    await withTimeout(
      fetch('/api/push/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint }),
      }),
      10_000,
      'Updating The Server',
    );
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown Error.';
    return { ok: false, error: msg };
  }
}

export async function sendTestPush(): Promise<{ ok: boolean; error?: string; sent?: number }> {
  try {
    const res = await withTimeout(
      fetch('/api/push/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Pep Nation Lab Test',
          body: 'If You See This, Push Notifications Are Working.',
        }),
      }),
      20_000,
      'Sending The Test',
    );
    const data = (await res.json()) as { ok?: boolean; sent?: number; error?: string };
    if (!res.ok) return { ok: false, error: data.error || 'Test Push Failed.' };
    return { ok: !!data.ok, sent: data.sent };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown Error.';
    return { ok: false, error: msg };
  }
}
