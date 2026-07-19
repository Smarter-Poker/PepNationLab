/**
 * lib/push-deliver.ts
 *
 * Low-latency inline web-push delivery.
 *
 * enqueuePush() / notify() write a durable row into push_outbox (drained by
 * the every-5-minutes /api/cron/push-dispatch cron). That guarantees
 * eventual delivery, but a 5-minute delay is useless for a new message or
 * alert. This helper sends the push to the recipient's active subscriptions
 * *immediately*, mirroring the call-ring path, so messages and notifications
 * land in seconds. The outbox row stays as the durability fallback.
 *
 * Never throws - notification side-effects must never break the caller.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { sendWebPush, isWebPushConfigured, type PushPayload } from '@/lib/web-push';

interface SubRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Send `payload` to every active subscription for `userId` right now.
 * Deactivates subscriptions the push service reports as permanently dead
 * (HTTP 404 / 410). Returns the number of subscriptions the push service
 * accepted (it accepts and queues even when the device is currently offline).
 */
export async function deliverPushNow(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string,
  payload: PushPayload,
): Promise<number> {
  if (!userId || !isWebPushConfigured()) return 0;

  try {
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', userId)
      .eq('is_active', true);

    let sent = 0;
    for (const s of (subs ?? []) as SubRow[]) {
      const result = await sendWebPush(
        { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
        payload,
      ).catch(() => ({ ok: false as const, expired: false }));

      if (result.ok) {
        sent += 1;
      } else if ((result as { expired?: boolean }).expired) {
        // Permanently dead subscription - stop sending to it.
        await supabase
          .from('push_subscriptions')
          .update({ is_active: false, last_failure_reason: 'expired' })
          .eq('id', s.id)
          .then(() => undefined, () => undefined);
      }
    }
    return sent;
  } catch {
    return 0;
  }
}
