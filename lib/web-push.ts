import webpush from 'web-push';

/**
 * VAPID + payload-encrypted web-push dispatcher.
 *
 * Reads VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY from env. When any
 * of the three are missing this returns `{ ok: false, error: 'web_push_not_configured' }`
 * instead of throwing, so callers can no-op gracefully in environments where
 * push is not yet provisioned.
 */

let configured = false;
let configError: string | null = null;

function ensureConfigured(): boolean {
  if (configured) return true;
  if (configError) return false;

  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!subject || !publicKey || !privateKey) {
    configError = 'web_push_not_configured';
    return false;
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
    return true;
  } catch (err) {
    configError = err instanceof Error ? err.message : 'vapid_setup_failed';
    return false;
  }
}

export interface PushSubscriptionKeys {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
  requireInteraction?: boolean;
  /** Vibration pattern (Android haptics). Defaults applied in the service worker. */
  vibrate?: number[];
  /** Re-alert (sound/vibrate) even when a notification with the same tag exists. */
  renotify?: boolean;
  /** Notification action buttons (e.g. Accept / Decline for calls). */
  actions?: { action: string; title: string }[];
  /** Delivery urgency hint to the push service. */
  urgency?: 'very-low' | 'low' | 'normal' | 'high';
}

export interface PushSendResult {
  ok: boolean;
  statusCode?: number;
  error?: string;
  expired?: boolean;
}

/**
 * Send a single encrypted web-push notification. Never throws - all failures
 * are returned as `{ ok: false, error }`. `expired` is true when the push
 * service indicates the subscription is permanently dead (HTTP 404 / 410)
 * so the caller can deactivate the subscription row.
 */
export async function sendWebPush(
  sub: PushSubscriptionKeys,
  payload: PushPayload
): Promise<PushSendResult> {
  if (!ensureConfigured()) {
    return { ok: false, error: configError || 'web_push_not_configured' };
  }

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? '/',
    tag: payload.tag,
    icon: payload.icon ?? '/logo-mark.svg',
    badge: payload.badge ?? '/logo-mark.svg',
    requireInteraction: payload.requireInteraction,
    vibrate: payload.vibrate,
    renotify: payload.renotify,
    actions: payload.actions,
  });

  try {
    const result = await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      body,
      // 24h TTL so a push still lands when the device reconnects; high urgency
      // so messages/calls alert promptly rather than being batched.
      { TTL: 86400, urgency: payload.urgency ?? 'high' }
    );
    return { ok: true, statusCode: result.statusCode };
  } catch (err: unknown) {
    const status =
      typeof err === 'object' && err !== null && 'statusCode' in err
        ? Number((err as { statusCode: number }).statusCode)
        : undefined;
    const message =
      err instanceof Error ? err.message : 'unknown_push_error';
    const expired = status === 404 || status === 410;
    return {
      ok: false,
      statusCode: status,
      error: message.slice(0, 300),
      expired,
    };
  }
}

export function isWebPushConfigured(): boolean {
  return ensureConfigured();
}
