import type { SupabaseClient } from '@supabase/supabase-js';
import { deliverPushNow } from '@/lib/push-deliver';
import { pushTypeAllowed, eventToTypeKey } from '@/lib/push-prefs';

/**
 * Pretty-print an order id for the user (first 8 chars uppercase).
 */
export function shortOrderId(orderId: string | null | undefined): string {
  if (!orderId) return 'Unknown';
  return String(orderId).slice(0, 8).toUpperCase();
}

export type PushEvent =
  | 'order_approved'
  | 'order_shipped'
  | 'order_delivered'
  | 'payment_reminder'
  | 'message'
  | 'marketing'
  | 'admin_test'
  | 'self_test';

export interface EnqueuePushArgs {
  userId: string;
  title: string;
  body: string;
  url?: string;
  event: PushEvent | string;
  relatedOrderId?: string | null;
  tag?: string;
}

/**
 * Look up the recipient's notification_preferences, honour push opt-outs,
 * and insert a pending row into push_outbox. Returns the new row id, or
 * null when suppressed (push disabled, globally muted, per-type opt-out,
 * no prefs row). NEVER throws - notification side-effects must not break
 * the caller.
 */
export async function enqueuePush(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  { userId, title, body, url, event, relatedOrderId, tag }: EnqueuePushArgs
): Promise<string | null> {
  try {
    if (!userId || !title || !body) return null;

    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('push_enabled, mute_all, push_type_prefs')
      .eq('user_id', userId)
      .maybeSingle();

    // No prefs row, or push not turned on, or globally muted → drop silently.
    if (!prefs) return null;
    if (prefs.mute_all) return null;
    if (!prefs.push_enabled) return null;

    // Per-event opt-out (Notification Preferences page) is the single delivery
    // gate. Test events map to a null key and are never gated here so the Send
    // Test button always works.
    const typeKey = eventToTypeKey(String(event));
    if (typeKey && !pushTypeAllowed(prefs.push_type_prefs as Record<string, boolean> | null, typeKey)) {
      return null;
    }

    const { data, error } = await supabase
      .from('push_outbox')
      .insert({
        recipient_user_id: userId,
        title: String(title).slice(0, 120),
        body: String(body).slice(0, 500),
        url: url ?? null,
        tag: tag ?? null,
        event: String(event),
        related_order_id: relatedOrderId ?? null,
        status: 'pending',
      })
      .select('id')
      .single();

    if (error || !data) return null;

    // Deliver immediately so the recipient is alerted in seconds rather than
    // waiting up to 5 minutes for the push-dispatch cron. The outbox row stays
    // as the durability fallback; mark it sent so the cron does not resend.
    try {
      const sent = await deliverPushNow(supabase, userId, {
        title: String(title).slice(0, 120),
        body: String(body).slice(0, 500),
        url: url ?? undefined,
        tag: tag ?? String(event),
        vibrate: [120, 60, 120],
        renotify: true,
        urgency: 'high',
      });
      if (sent > 0) {
        await supabase
          .from('push_outbox')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', data.id)
          .then(() => undefined, () => undefined);
      }
    } catch {
      /* inline delivery is best-effort; the cron will retry the pending row */
    }

    return String(data.id);
  } catch {
    return null;
  }
}

export interface EnqueueOrderPushArgs {
  userId: string;
  orderId: string;
  event: 'order_approved' | 'order_shipped' | 'order_delivered' | 'payment_reminder';
  tracking?: string | null;
}

/**
 * Convenience wrapper for the four order-status push events. Builds the
 * Title Case title/body strings then
 * delegates to enqueuePush.
 */
export async function enqueueOrderPush(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  { userId, orderId, event, tracking }: EnqueueOrderPushArgs
): Promise<string | null> {
  const short = shortOrderId(orderId);
  let title = 'Pep Nation Lab';
  let body = '';
  switch (event) {
    case 'order_approved':
      title = `Order #${short} Approved`;
      body = 'Your Order Has Been Approved. Get Ready For Shipping.';
      break;
    case 'order_shipped':
      title = `Order #${short} Shipped`;
      body = tracking
        ? `Your Order Has Shipped. Tracking: ${tracking}`
        : 'Your Order Has Shipped.';
      break;
    case 'order_delivered':
      title = `Order #${short} Delivered`;
      body = 'Your Order Has Been Delivered. Thank You.';
      break;
    case 'payment_reminder':
      title = `Payment Reminder For Order #${short}`;
      body = 'A Payment Is Due On This Order. Please Review.';
      break;
  }

  return enqueuePush(supabase, {
    userId,
    title,
    body,
    url: `/orders/${orderId}`,
    event,
    relatedOrderId: orderId,
    tag: `order-${orderId}`,
  });
}
