/**
 * lib/notify.ts
 *
 * Central notification enqueue helper.
 * - Inserts into `notifications` table (in-app bell feed)
 * - Optionally queues a web push via push_outbox if user opted in
 *
 * Always fire-and-forget from API routes - never let a notification failure
 * block the primary operation (order creation, message send, etc.)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { enqueuePush } from '@/lib/push-enqueue';

export type NotificationType =
  | 'order_placed'
  | 'order_approved'
  | 'order_shipped'
  | 'order_delivered'
  | 'order_cancelled'
  | 'payment_confirmed'
  | 'order_attention'
  | 'commission_earned'
  | 'new_researcher'
  | 'new_message'
  | 'invoice'
  | 'payment_reminder'
  | 'cart_reminder'
  | 'refill_reminder'
  | 'tier_levelup'
  | 'referral'
  | 'system'
  | 'coupon_redeemed'
  | 'support_message';

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
 * Never throws - all errors are swallowed and logged.
 */
export async function notify(
  supabase: SupabaseClient,
  opts: NotifyOptions,
): Promise<void> {
  const { userId, type, title, body, url, withPush = true } = opts;

  try {
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

  // Single push pipeline: enqueuePush owns preference gating (push_enabled /
  // mute_all / per-type prefs via eventToTypeKey), the push_outbox audit row,
  // and immediate delivery with the 5-minute cron as durability fallback.
  // notify() previously re-implemented all of that with a slightly different
  // outbox row shape (no event / related_order_id), which double-fetched prefs
  // and fragmented the audit trail.
  try {
    await enqueuePush(supabase, {
      userId,
      title,
      body: body ?? title,
      url,
      event: type,
      tag: type,
    });
  } catch (err) {
    console.error('[notify] push enqueue error:', err);
  }
}

/**
 * Fan a notification out to every admin account (in-app + push each).
 * Optionally skip specific user ids (e.g. an admin who already received a
 * store-owner notification for the same event). Never throws.
 */
export async function notifyAdmins(
  supabase: SupabaseClient,
  opts: { type?: NotificationType; title: string; body: string; url?: string; skipUserIds?: string[] },
): Promise<void> {
  try {
    const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'admin');
    const skip = new Set(opts.skipUserIds ?? []);
    const targets = (admins ?? []).map((a: { id: string }) => a.id).filter((id) => !skip.has(id));
    if (targets.length === 0) return;
    await Promise.allSettled(
      targets.map((id) =>
        notify(supabase, {
          userId: id,
          type: opts.type ?? 'system',
          title: opts.title,
          body: opts.body,
          url: opts.url,
        }),
      ),
    );
  } catch (err) {
    console.error('[notify] notifyAdmins error:', err);
  }
}

/** Notify the buyer that their peer-to-peer payment was confirmed by the seller. */
export async function notifyPaymentConfirmed(
  supabase: SupabaseClient,
  buyerId: string,
  orderId: string,
  shortId: string,
  totalFormatted: string,
) {
  await notify(supabase, {
    userId: buyerId,
    type: 'payment_confirmed',
    title: `Payment Confirmed For Order #${shortId}`,
    body: `Your Payment Of ${totalFormatted} Was Confirmed. Your Order Is Now Moving To Approval And Fulfillment.`,
    url: `/orders/${orderId}`,
  });
}

/** Notify a super agent that a downline order was placed on a store they back. */
export async function notifyDownlineOrderPlaced(
  supabase: SupabaseClient,
  superAgentId: string,
  orderId: string,
  shortId: string,
  totalFormatted: string,
  storeLabel: string,
) {
  await notify(supabase, {
    userId: superAgentId,
    type: 'order_placed',
    title: `Downline Sale: Order #${shortId}`,
    body: `A ${totalFormatted} Order Was Just Placed On ${storeLabel} In Your Downline.`,
    url: `/dashboard?tab=Orders`,
  });
}

/** Notify a super agent that an order is waiting on THEIR approval. */
export async function notifyOrderAwaitingApproval(
  supabase: SupabaseClient,
  approverId: string,
  orderId: string,
  shortId: string,
  totalFormatted: string,
) {
  await notify(supabase, {
    userId: approverId,
    type: 'order_attention',
    title: `Order #${shortId} Awaits Your Approval`,
    body: `A ${totalFormatted} Order Has Been Forwarded To You For Approval. Please Review It Now.`,
    url: `/dashboard?tab=Orders`,
  });
}

/**
 * Staleness escalation: an order has been sitting without confirmation.
 * Sent to the responsible agent, their upline, and (at higher levels) admins.
 */
export async function notifyOrderAttention(
  supabase: SupabaseClient,
  recipientId: string,
  opts: { orderId: string; shortId: string; hoursWaiting: number; who: 'agent' | 'upline' | 'admin'; agentName?: string | null; url?: string },
) {
  const hrs = Math.floor(opts.hoursWaiting);
  const title = opts.who === 'agent'
    ? `Action Needed: Order #${opts.shortId} Is Waiting On You`
    : `Unconfirmed Order Alert: #${opts.shortId}`;
  const body = opts.who === 'agent'
    ? `Order #${opts.shortId} Has Been Waiting ${hrs} Hours Without Confirmation. Please Review And Confirm It Now.`
    : `${opts.agentName || 'An Agent'} Has Not Confirmed Order #${opts.shortId} For ${hrs} Hours. Please Follow Up.`;
  await notify(supabase, {
    userId: recipientId,
    type: 'order_attention',
    title,
    body,
    url: opts.url ?? (opts.who === 'admin' ? '/admin/orders' : '/dashboard?tab=Orders'),
  });
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
  const fmt = `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
    body: `An invoice for $${totalOwed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} has been generated for the week of ${weekStart}.`,
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
    body: `Reminder: Your invoice for $${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} is overdue. Please make payment promptly.`,
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
    body: `You have ${itemCount} item${itemCount !== 1 ? 's' : ''} waiting${cartValue > 0 ? ` ($${cartValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})` : ''}. Complete your order before inventory moves.`,
    url: '/cart',
  });
}

/**
 * Notify a researcher it may be time to reorder (21-day refill drip).
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

/** Notify an agent they leveled up. */
export async function notifyTierLevelUp(
  supabase: SupabaseClient,
  agentId: string,
  newLevelName: string,
) {
  await notify(supabase, {
    userId: agentId,
    type: 'tier_levelup',
    title: `Level Up: ${newLevelName}`,
    body: `Achievement Unlocked. You reached the ${newLevelName} tier - your Agent Cost just dropped. Keep the momentum going.`,
    url: '/dashboard/agent?tab=overview',
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
          title: `Referral Reward: $${referrerAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          body: `You earned $${referrerAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} in store credit for referring a new researcher.`,
          url: `/dashboard`,
        })
      : Promise.resolve(),
    refereeAmount > 0
      ? notify(supabase, {
          userId: refereeId,
          type: 'referral',
          title: `Welcome Bonus: $${refereeAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          body: `You received $${refereeAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} in store credit as a welcome bonus.`,
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
    title: `Account Balance Updated: +$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    body: description ?? `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} has been added to your account balance.`,
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
    title: 'You Have Been Promoted To Sub-Agent!',
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
    body: `Your subscription order for $${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} has been created. Sign in to send payment.`,
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
  await notify(supabase, {
    userId: recipientId,
    type: 'new_message',
    title: `New Message from ${senderName}`,
    body: preview,
    url: `/messenger?conv=${conversationId}`,
    withPush: false,
  });
}

/**
 * Notify an agent that one of their coupons was just redeemed.
 * Body line surfaces the discount + revenue so the agent sees the value
 * the coupon drove without having to open the dashboard.
 */
export async function notifyCouponRedeemed(
  supabase: SupabaseClient,
  agentId: string,
  code: string,
  discountAmount: number,
  orderTotal: number,
  orderId: string,
  shortId: string,
) {
  const discount = `$${(Number.isFinite(discountAmount) ? discountAmount : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const total = `$${(Number.isFinite(orderTotal) ? orderTotal : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  await notify(supabase, {
    userId: agentId,
    type: 'coupon_redeemed',
    title: `Coupon ${code} Redeemed`,
    body: `A researcher used ${code} on order #${shortId} - ${discount} off a ${total} order.`,
    url: `/dashboard/agent?tab=Coupons`,
  });
}

/** Notify the admin that a researcher sent a new message in a support thread. */
export async function notifySupportMessage(
  supabase: SupabaseClient,
  adminId: string,
  senderName: string,
  preview: string,
  conversationId: string,
) {
  const body = preview.length > 80 ? `${preview.slice(0, 77)}…` : preview;
  await notify(supabase, {
    userId: adminId,
    type: 'support_message',
    title: `Support - ${senderName}`,
    body,
    url: `/messenger?conversation=${conversationId}`,
  });
}

/** Notify agent that their sub-agent is earning a higher profit margin than them. */
export async function notifyMarginWarning(
  supabase: SupabaseClient,
  agentId: string,
) {
  await notify(supabase, {
    userId: agentId,
    type: 'system',
    title: `Low Margin Warning`,
    body: `Your Sub-Agents are currently earning a higher profit than you on some products. While you are still making the minimum 10% profit, you should consider raising your retail prices.`,
    url: `/dashboard/agent?tab=products`,
  });
}

/** Notify agent of high credit utilization or low prepaid balance */
export async function notifyAccountAlert(
  supabase: SupabaseClient,
  agentId: string,
  title: string,
  body: string,
) {
  await notify(supabase, {
    userId: agentId,
    type: 'system',
    title,
    body,
    url: `/dashboard/agent?tab=balance`,
  });
}
