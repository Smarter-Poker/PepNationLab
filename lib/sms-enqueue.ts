import type { SupabaseClient } from '@supabase/supabase-js';

export type OrderSmsEvent =
  | 'order_approved'
  | 'order_shipped'
  | 'order_delivered'
  | 'payment_reminder';

export interface EnqueueOrderSmsArgs {
  userId: string;
  orderId: string | null;
  event: OrderSmsEvent;
  body: string;
}

/**
 * Looks up the recipient's notification_preferences, honours opt-out, and
 * inserts a pending row into sms_outbox to be drained by the hourly cron.
 *
 * Returns the new row id, or null when the message was suppressed (user
 * disabled SMS, event opt-out, no phone on file, etc). NEVER throws —
 * notification failures must not break the calling order workflow.
 */
export async function enqueueOrderSms(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  { userId, orderId, event, body }: EnqueueOrderSmsArgs
): Promise<string | null> {
  try {
    if (!userId || !body) return null;

    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('sms_enabled, sms_phone, events_order_approved, events_order_shipped, events_order_delivered, events_payment_reminder')
      .eq('user_id', userId)
      .maybeSingle();

    if (!prefs) return null;
    if (!prefs.sms_enabled) return null;
    if (!prefs.sms_phone) return null;

    const eventFlagMap: Record<OrderSmsEvent, keyof typeof prefs> = {
      order_approved: 'events_order_approved',
      order_shipped: 'events_order_shipped',
      order_delivered: 'events_order_delivered',
      payment_reminder: 'events_payment_reminder',
    };
    const flag = eventFlagMap[event];
    if (flag && prefs[flag] === false) return null;

    const phone = String(prefs.sms_phone).trim();
    if (!/^\+\d{10,15}$/.test(phone)) return null;

    const { data, error } = await supabase
      .from('sms_outbox')
      .insert({
        recipient_user_id: userId,
        to_phone: phone,
        body: body.slice(0, 1000),
        event,
        related_order_id: orderId,
        status: 'pending',
        provider: 'twilio',
      })
      .select('id')
      .single();

    if (error || !data) return null;
    return String(data.id);
  } catch {
    // Notification side-effects must never bubble up.
    return null;
  }
}

/**
 * Pretty-print an order id for the user (first 8 chars uppercase).
 */
export function shortOrderId(orderId: string | null | undefined): string {
  if (!orderId) return 'Unknown';
  return String(orderId).slice(0, 8).toUpperCase();
}
