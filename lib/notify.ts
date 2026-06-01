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
import { deliverPushNow } from '@/lib/push-deliver';
import { pushTypeAllowed } from '@/lib/push-prefs';

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
  | 'refill_reminder'
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
      .select('push_enabled, mute_all, push_type_prefs')
      .eq('user_id', userId)
      .maybeSingle();

    if (!prefs?.push_enabled || prefs?.mute_all) return;

    // Single push-delivery gate: a push type is sent unless the user explicitly
    // turned it off on the Notification Preferences page (push_type_prefs is a
    // default-on map; an absent key reads as ON). This is authoritative — the
    // older coarse push_events_order/messages/marketing buckets are no longer
    // consulted here (push_events_marketing defaulted false and was silently
    // suppressing commission/referral/cart/system pushes regardless of the
    // per-type toggle). Existing explicit bucket opt-outs were folded into
    // push_type_prefs by migration 20260605080000.
    if (!pushTypeAllowed(prefs.push_type_prefs as Record<string, boolean> | null, type)) return;

    // 3. Queue web push (durable fallback) ...
    const { data: outbox } = await supabase
      .from('push_outbox')
      .insert({
        recipient_user_id: userId,
        title,
        body: body ?? null,
        url: url ?? null,
        tag: type,
        status: 'pending',
      })
      .select('id')
      .single();

    // ... then deliver it immediately so the user is alerted in seconds
    // (with sound + haptics) instead of waiting for the 5-minute cron.
    const sent = await deliverPushNow(supabase, userId, {
      title,
      body: body ?? '',
      url: url ?? undefined,
      tag: type,
      vibrate: [120, 60, 120],
      renotify: true,
      urgency: 'high',
    });
    if (sent > 0 && outbox?.id) {
      await supabase
        .from('push_outbox')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', outbox.id)
        .then(() => undefined, () => undefined);
    }
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

/** Notify researcher/buyer their order was cancelled */
export async function notifyOrderCancelled(
  supabase: SupabaseClient,
  buyerId: string,
  orderId: string,
  shortId: string,
) {
  await notify(supabase, {
    userId: buyerId,
    type: 'order_cancelled',
    title: `Order #${shortId} Cancelled`,
    body: 'Your order has been cancelled. Contact support if you have questions.',
    url: `/orders/${orderId}`,
  });
}

/** Notify agent a commission payout was processed */
export async function notifyCommissionPayout(
  supabase: SupabaseClient,
  agentId: string,
  amount: number,
  method: string,
) {
  const fmt = `$${amount.toFixed(2)}`;
  await notify(supabase, {
    userId: agentId,
    type: 'commission_earned',
    title: `Commission Payout: ${fmt}`,
    body: `Your commission payout of ${fmt} has been processed via ${method}.`,
    url: `/dashboard/agent?tab=commissions`,
  });
}

/** Notify sub-agent/researcher an invoice was generated */
export async function notifyInvoiceGenerated(
  supabase: SupabaseClient,
  recipientId: string,
  weekStart: string,
  totalOwed: number,
) {
  await notify(supabase, {
    userId: recipientId,
    type: 'invoice',
    title: `Invoice Generated: Week of ${weekStart}`,
    body: `An invoice for $${totalOwed.toFixed(2)} has been generated for the week of ${weekStart}.`,
    url: `/dashboard/agent?tab=statements`,
  });
}

/** Notify user of an overdue invoice / payment reminder */
export async function notifyPaymentReminder(
  supabase: SupabaseClient,
  recipientId: string,
  invoiceSubject: string,
  amount: number,
) {
  await notify(supabase, {
    userId: recipientId,
    type: 'payment_reminder',
    title: `Payment Due: ${invoiceSubject}`,
    body: `Reminder: Your invoice for $${amount.toFixed(2)} is overdue. Please make payment promptly.`,
    url: `/dashboard/agent?tab=statements`,
  });
}

/** Notify researcher of an abandoned cart */
export async function notifyCartReminder(
  supabase: SupabaseClient,
  recipientId: string,
  itemCount: number,
  cartValue: number,
) {
  await notify(supabase, {
    userId: recipientId,
    type: 'cart_reminder',
    title: 'You left items in your cart',
    body: `You have ${itemCount} item${itemCount !== 1 ? 's' : ''} waiting${cartValue > 0 ? ` ($${cartValue.toFixed(2)})` : ''}. Complete your order before inventory moves.`,
    url: '/cart',
  });
}

/**
 * Notify a researcher it may be time to reorder (21-day refill drip).
 * In-app bell + push (gated by the refill_reminder push type, default-on).
 * The conversational Messenger DM from the agent is sent separately by the
 * /api/cron/refill-reminders job — this only covers the bell + web push.
 */
export async function notifyRefillReminder(
  supabase: SupabaseClient,
  researcherId: string,
  firstName: string,
) {
  const who = firstName && firstName.trim().length > 0 ? firstName.trim() : 'there';
  await notify(supabase, {
    userId: researcherId,
    type: 'refill_reminder',
    title: 'Time To Restock?',
    body: `Hey ${who}, it has been a few weeks since your last order. Tap to browse and reorder when you are ready.`,
    url: '/products',
  });
}

/** Notify referrer and referee of reward credit */
export async function notifyReferralReward(
  supabase: SupabaseClient,
  referrerId: string,
  refereeId: string,
  referrerAmount: number,
  refereeAmount: number,
) {
  await Promise.all([
    referrerAmount > 0
      ? notify(supabase, {
          userId: referrerId,
          type: 'referral',
          title: `Referral Reward: $${referrerAmount.toFixed(2)}`,
          body: `You earned $${referrerAmount.toFixed(2)} in store credit for referring a new researcher.`,
          url: `/dashboard`,
        })
      : Promise.resolve(),
    refereeAmount > 0
      ? notify(supabase, {
          userId: refereeId,
          type: 'referral',
          title: `Welcome Bonus: $${refereeAmount.toFixed(2)}`,
          body: `You received $${refereeAmount.toFixed(2)} in store credit as a welcome bonus.`,
          url: `/dashboard`,
        })
      : Promise.resolve(),
  ]);
}



/** Notify agent of a prepaid balance recharge or store credit grant */
export async function notifyBalanceRecharge(
  supabase: SupabaseClient,
  userId: string,
  amount: number,
  description?: string,
) {
  await notify(supabase, {
    userId,
    type: 'system',
    title: `Account Balance Updated: +$${amount.toFixed(2)}`,
    body: description ?? `$${amount.toFixed(2)} has been added to your account balance.`,
    url: `/dashboard/agent?tab=balance`,
  });
}

/** Notify researcher they have been promoted to Sub-Agent */
export async function notifyPromotedToAgent(
  supabase: SupabaseClient,
  newAgentId: string,
  agentSlug: string,
  superAgentName: string,
) {
  await notify(supabase, {
    userId: newAgentId,
    type: 'system',
    title: 'You\'ve Been Promoted to Sub-Agent!',
    body: `${superAgentName} has promoted you to Sub-Agent. Your storefront is now live at /${agentSlug}.`,
    url: `/${agentSlug}`,
  });
}

/** Notify super-agent when they successfully promote a researcher to sub-agent */
export async function notifyPromotionSuccess(
  supabase: SupabaseClient,
  superAgentId: string,
  promotedName: string,
  agentSlug: string,
) {
  await notify(supabase, {
    userId: superAgentId,
    type: 'new_researcher',
    title: `${promotedName} Promoted to Sub-Agent`,
    body: `${promotedName} is now a Sub-Agent on your team. Storefront: /${agentSlug}.`,
    url: `/dashboard/agent?tab=team`,
  });
}

/** Notify sub-agent they were revoked / demoted back to researcher */
export async function notifyRoleRevoked(
  supabase: SupabaseClient,
  userId: string,
  superAgentName: string,
) {
  await notify(supabase, {
    userId,
    type: 'system',
    title: 'Agent Status Revoked',
    body: `Your Sub-Agent status has been revoked by ${superAgentName}. Your account has been restored to Researcher.`,
    url: `/dashboard`,
  });
}



/** Notify agent their auto-subscription order was created */
export async function notifySubscriptionOrder(
  supabase: SupabaseClient,
  researcherId: string,
  shortId: string,
  total: number,
) {
  await notify(supabase, {
    userId: researcherId,
    type: 'order_placed',
    title: `Auto-Replenish Order #${shortId} Created`,
    body: `Your subscription order for $${total.toFixed(2)} has been created. Sign in to send payment.`,
    url: `/orders`,
  });
}

/** Notify researcher their auto-subscription was paused */
export async function notifySubscriptionPaused(
  supabase: SupabaseClient,
  researcherId: string,
  reason: string,
) {
  await notify(supabase, {
    userId: researcherId,
    type: 'system',
    title: 'Auto-Replenish Subscription Paused',
    body: `Your subscription was paused: ${reason}. Visit your account to update it.`,
    url: `/account/subscriptions`,
  });
}

/** Notify agent/admin of a new order placed via Admin panel override */
export async function notifyAdminOrderStatusChange(
  supabase: SupabaseClient,
  buyerId: string,
  orderId: string,
  shortId: string,
  newStatus: string,
  tracking?: string | null,
) {
  const statusMap: Record<string, { title: string; body: string; type: NotificationType }> = {
    approved_ship:    { type: 'order_approved',   title: `Order #${shortId} Approved`,   body: 'Your order has been approved and is being prepared for shipment.' },
    approved_pickup:  { type: 'order_approved',   title: `Order #${shortId} Approved`,   body: 'Your order has been approved and is ready for pickup.' },
    shipped:          { type: 'order_shipped',    title: `Order #${shortId} Shipped`,    body: tracking ? `Tracking: ${tracking}` : 'Your order is on its way!' },
    delivered:        { type: 'order_delivered',  title: `Order #${shortId} Delivered`,  body: 'Your order has been delivered. Thank you!' },
    cancelled:        { type: 'order_cancelled',  title: `Order #${shortId} Cancelled`,  body: 'Your order has been cancelled by an administrator.' },
  };
  const mapped = statusMap[newStatus];
  if (!mapped) return;
  await notify(supabase, {
    userId: buyerId,
    type: mapped.type,
    title: mapped.title,
    body: mapped.body,
    url: `/orders/${orderId}`,
  });
}

export async function notifyNewMessage(
  supabase: SupabaseClient,
  recipientId: string,
  senderName: string,
  messagePreview: string,
  conversationId: string,
) {
  const preview = messagePreview.length > 80 ? `${messagePreview.slice(0, 77)}…` : messagePreview;
  // In-app bell row only — the message web-push is sent by enqueuePush() in the
  // send-message route, so disable push here to avoid a duplicate notification.
  await notify(supabase, {
    userId: recipientId,
    type: 'new_message',
    title: `New Message from ${senderName}`,
    body: preview,
    url: `/messenger?conv=${conversationId}`,
    withPush: false,
  });
}
