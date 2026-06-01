'use client';

/**
 * Browser-side helpers for enrolling in web push.
 *
 * These functions are intentionally defensive: they no-op (returning a
 * structured result) on browsers without service worker / push support,
 * and surface a user-readable error string on failure rather than throwing.
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
    const keyRes = await fetch('/api/push/vapid-public-key', { cache: 'no-store' });
    const keyJson = (await keyRes.json()) as { key?: string };
    const vapidKey = keyJson.key || '';
    if (!vapidKey) {
      return { ok: false, error: 'Push Notifications Are Not Configured On The Server Yet.' };
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { ok: false, error: 'Permission Was Not Granted.' };
    }

    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    const wantKey = urlBase64ToUint8Array(vapidKey);
    let subscription = await reg.pushManager.getSubscription();

    // Self-heal: if a subscription already exists but was created with a
    // different VAPID key (e.g. the server keypair was rotated), every push
    // to it fails with VapidPkHashMismatch. Drop the stale one so we can
    // re-subscribe with the current key.
    if (subscription && !applicationServerKeyMatches(subscription.options?.applicationServerKey ?? null, wantKey)) {
      try {
        await subscription.unsubscribe();
      } catch {
        // Best-effort — proceed to re-subscribe regardless.
      }
      subscription = null;
    }

    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: wantKey,
      });
    }

    const sub = subscription.toJSON() as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };
    if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
      return { ok: false, error: 'Could Not Read Subscription Keys.' };
    }

    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
        userAgent: navigator.userAgent,
        deviceLabel: navigator.platform || null,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: data?.error || 'Failed To Save Subscription.' };
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
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    if (!reg) return { ok: true };
    const subscription = await reg.pushManager.getSubscription();
    if (!subscription) return { ok: true };
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    await fetch('/api/push/subscribe', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint }),
    });
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown Error.';
    return { ok: false, error: msg };
  }
}

export async function sendTestPush(): Promise<{ ok: boolean; error?: string; sent?: number }> {
  try {
    const res = await fetch('/api/push/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Pep Nation Lab Test',
        body: 'If You See This, Push Notifications Are Working.',
      }),
    });
    const data = (await res.json()) as { ok?: boolean; sent?: number; error?: string };
    if (!res.ok) return { ok: false, error: data.error || 'Test Push Failed.' };
    return { ok: !!data.ok, sent: data.sent };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown Error.';
    return { ok: false, error: msg };
  }
}
