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

/** Notify user of a tax exemption status change */
export async function notifyTaxExemption(
  supabase: SupabaseClient,
  userId: string,
  action: 'approve' | 'reject' | 'expire',
  stateCode: string,
  rejectedReason?: string,
) {
  const titles = {
    approve: `Tax Exemption Approved — ${stateCode}`,
    reject: `Tax Exemption Rejected — ${stateCode}`,
    expire: `Tax Exemption Expired — ${stateCode}`,
  };
  const bodies = {
    approve: `Your tax exemption certificate for ${stateCode} is approved. Future orders to that state will be tax-exempt.`,
    reject: `Your tax exemption for ${stateCode} was rejected. Reason: ${rejectedReason ?? 'Not specified.'}`,
    expire: `Your tax exemption for ${stateCode} has expired. Please submit a renewed certificate.`,
  };
  await notify(supabase, {
    userId,
    type: 'system',
    title: titles[action],
    body: bodies[action],
    url: `/account/tax-exemptions`,
  });
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

/** Notify admin when any user submits a tax exemption for review */
export async function notifyAdminTaxSubmission(
  supabase: SupabaseClient,
  adminIds: string[],
  userName: string,
  stateCode: string,
) {
  await Promise.all(
    adminIds.map(adminId =>
      notify(supabase, {
        userId: adminId,
        type: 'system',
        title: `Tax Exemption Submitted — ${stateCode}`,
        body: `${userName} submitted a tax exemption certificate for ${stateCode}. Review required.`,
        url: `/admin/tax-exemptions`,
      })
    )
  );
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

/** Notify a user they received a new message in the messenger */
export async function notifyNewMessage(
  supabase: SupabaseClient,
  recipientId: string,
  senderName: string,
  messagePreview: string,
) {
  const preview = messagePreview.length > 80 ? `${messagePreview.slice(0, 77)}…` : messagePreview;
  await notify(supabase, {
    userId: recipientId,
    type: 'new_message',
    title: `New Message from ${senderName}`,
    body: preview,
    url: `/dashboard/messages`,
  });
}
