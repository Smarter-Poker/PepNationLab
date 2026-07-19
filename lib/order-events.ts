/**
 * lib/order-events.ts
 *
 * Unified per-order timeline. Every meaningful lifecycle moment is appended
 * to public.order_events (service-role writes only; RLS grants reads to the
 * buyer, the agent of record, their parent super agent, and admins).
 *
 * Best-effort by design: logging an event must NEVER break or slow the
 * money path, so every failure is swallowed after a console line.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type OrderEventName =
  | 'placed'
  | 'auto_approved'
  | 'payment_confirmed'
  | 'approved'
  | 'forwarded_to_super'
  | 'demoted_admin_review'
  | 'cancelled'
  | 'shipped'
  | 'delivered'
  | 'status_changed'
  | 'payment_reminder_sent'
  | 'stale_escalated';

export interface LogOrderEventArgs {
  orderId: string;
  event: OrderEventName;
  actorId?: string | null;
  actorRole?: string | null;
  payload?: Record<string, unknown>;
}

export async function logOrderEvent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  { orderId, event, actorId, actorRole, payload }: LogOrderEventArgs,
): Promise<void> {
  try {
    const { error } = await supabase.from('order_events').insert({
      order_id: orderId,
      event,
      actor_id: actorId ?? null,
      actor_role: actorRole ?? null,
      payload: payload ?? {},
    });
    if (error) {
      console.error('[order-events] insert failed:', error.message, { orderId, event });
    }
  } catch (err) {
    console.error('[order-events] insert threw:', err);
  }
}
