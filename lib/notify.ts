/**
 * lib/notify.ts
 *
 * Central notification enqueue helper.
 * - Inserts into `notifications` table (in-app bell feed)
 * - Optionally queues a web push via push_outbox if user opted in
 *
 * Always fire-and-forget from API routes — never let a notification failure
 * block the primary operation (order creation, message send, etc.)
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type NotificationType =
  | 'order_placed'
  | 'order_approved'
  | 'order_shipped'
  | 'order_delivered'
  | 'order_cancelled'
  | 'commission_earned'
  | 'new_researcher'
  | 'new_message'
  | 'invoice'
  | 'payment_reminder'
  | 'cart_reminder'
  | 'referral'
  | 'system';

export interface NotifyOptions {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  url?: string;
  /** If true, also queue a web push (subject to user prefs). Default: true */
  withPush?: boolean;
}

/**
 * Enqueue an in-app notification + optional web push.
 *
 * Uses the service/admin client (bypasses RLS so any user can be notified).
 * Never throws — all errors are swallowed and logged.
 */
export async function notify(
  supabase: SupabaseClient,
  opts: NotifyOptions,
): Promise<void> {
  const { userId, type, title, body, url, withPush = true } = opts;

  try {
    // 1. In-app notification row
    const { error } = await supabase.from('notifications').insert({
      user_id: userId,
      type,
      title,
      body: body ?? null,
      url: url ?? null,
    });

    if (error) {
      console.error('[notify] insert error:', error.message, { userId, type, title });
    }
  } catch (err) {
    console.error('[notify] unexpected insert error:', err);
  }

  if (!withPush) return;

  try {
    // 2. Check user push preferences
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('push_enabled, push_events_order, push_events_messages, push_events_marketing, mute_all')
      .eq('user_id', userId)
      .maybeSingle();

    if (!prefs?.push_enabled || prefs?.mute_all) return;

    // Check per-event preference
    const orderTypes: NotificationType[] = [
      'order_placed', 'order_approved', 'order_shipped', 'order_delivered', 'order_cancelled',
    ];
    const messageTypes: NotificationType[] = ['new_message'];
    const marketingTypes: NotificationType[] = ['commission_earned', 'referral', 'cart_reminder', 'system'];

    if (orderTypes.includes(type) && !prefs.push_events_order) return;
    if (messageTypes.includes(type) && !prefs.push_events_messages) return;
    if (marketingTypes.includes(type) && !prefs.push_events_marketing) return;

    // 3. Queue web push
    await supabase.from('push_outbox').insert({
      recipient_user_id: userId,
      title,
      body: body ?? null,
      url: url ?? null,
      tag: type,
      status: 'pending',
    });
  } catch (err) {
    console.error('[notify] push enqueue error:', err);
  }
}

/** Convenience: notify an agent that a new order was placed on their storefront */
export async function notifyOrderPlaced(
  supabase: SupabaseClient,
  agentId: string,
  orderId: string,
  shortId: string,
  researcherName: string,
) {
  await notify(supabase, {
    userId: agentId,
    type: 'order_placed',
    title: `New Order #${shortId}`,
    body: `${researcherName} placed a new order on your storefront.`,
    url: `/dashboard/agent?tab=orders`,
  });
}

/** Notify researcher their order was approved */
export async function notifyOrderApproved(
  supabase: SupabaseClient,
  buyerId: string,
  orderId: string,
  shortId: string,
) {
  await notify(supabase, {
    userId: buyerId,
    type: 'order_approved',
    title: `Order #${shortId} Approved`,
    body: 'Your order has been approved and is being prepared.',
    url: `/orders/${orderId}`,
  });
}

/** Notify researcher their order has shipped */
export async function notifyOrderShipped(
  supabase: SupabaseClient,
  buyerId: string,
  orderId: string,
  shortId: string,
  tracking?: string,
) {
  await notify(supabase, {
    userId: buyerId,
    type: 'order_shipped',
    title: `Order #${shortId} Shipped`,
    body: tracking ? `Tracking: ${tracking}` : 'Your order is on its way!',
    url: `/orders/${orderId}`,
  });
}

/** Notify researcher their order was delivered */
export async function notifyOrderDelivered(
  supabase: SupabaseClient,
  buyerId: string,
  orderId: string,
  shortId: string,
) {
  await notify(supabase, {
    userId: buyerId,
    type: 'order_delivered',
    title: `Order #${shortId} Delivered`,
    body: 'Your order has been delivered. Thank you!',
    url: `/orders/${orderId}`,
  });
}

/** Notify agent a commission was earned */
export async function notifyCommissionEarned(
  supabase: SupabaseClient,
  agentId: string,
  amountFormatted: string,
  orderId: string,
) {
  await notify(supabase, {
    userId: agentId,
    type: 'commission_earned',
    title: `Commission Earned: ${amountFormatted}`,
    body: 'A commission has been credited to your account.',
    url: `/dashboard/agent?tab=commissions`,
  });
}

/** Notify agent a new researcher joined their team */
export async function notifyNewResearcher(
  supabase: SupabaseClient,
  agentId: string,
  researcherName: string,
) {
  await notify(supabase, {
    userId: agentId,
    type: 'new_researcher',
    title: `New Researcher: ${researcherName}`,
    body: `${researcherName} has joined your team.`,
    url: `/dashboard/agent?tab=researchers`,
  });
}

/** Notify user of a new message */
export async function notifyNewMessage(
  supabase: SupabaseClient,
  recipientId: string,
  senderName: string,
  preview: string,
) {
  await notify(supabase, {
    userId: recipientId,
    type: 'new_message',
    title: `Message From ${senderName}`,
    body: preview.length > 120 ? preview.slice(0, 120) + '…' : preview,
    url: '/messenger',
  });
}
