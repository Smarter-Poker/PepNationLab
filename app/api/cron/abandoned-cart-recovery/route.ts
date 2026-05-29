import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';

/**
 * Abandoned cart recovery cron.
 *
 * Runs every 6 hours. Targets researchers whose cart has been sitting for
 * more than 24 hours but less than 14 days, and who have not received a
 * reminder in the past 7 days. Sends one in-app notification and (if the
 * user has SMS enabled + payment-reminder event opted in) one SMS via the
 * sms_outbox. Logs every send to the abandoned_cart_reminders ledger so
 * the recovery channel can be attributed when the user later checks out.
 *
 * Bounded to 200 users per run to keep the function within Vercel limits.
 */
export async function GET(req: Request) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  const partitionKey = new Date().toISOString().slice(0, 13);
  const claim = await claimCronRun('abandoned_cart_recovery', partitionKey);
  if (!claim) {
    return NextResponse.json({ skipped: true, reason: 'already_ran', partitionKey });
  }

  try {
    const supabase = await createServiceClient();

    const now = new Date();
    const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const cutoff14d = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const cutoff7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: candidates, error: fetchError } = await supabase
      .from('profiles')
      .select('id, full_name, cart_state, cart_updated_at, last_cart_reminder_at')
      .eq('role', 'researcher')
      .not('cart_state', 'is', null)
      .neq('cart_state', '[]')
      .lt('cart_updated_at', cutoff24h)
      .gt('cart_updated_at', cutoff14d)
      .or(`last_cart_reminder_at.is.null,last_cart_reminder_at.lt.${cutoff7d}`)
      .limit(200);

    if (fetchError) {
      await finishCronRun(claim.id, 'failed', `fetch: ${fetchError.message}`.slice(0, 500));
      return NextResponse.json({ error: 'fetch_failed' }, { status: 500 });
    }

    let sent = 0;
    let smsSent = 0;
    let skipped = 0;

    for (const candidate of candidates ?? []) {
      let cartItems: Array<{ retailPrice?: number; quantity?: number; name?: string }> = [];
      try {
        cartItems =
          typeof candidate.cart_state === 'string'
            ? JSON.parse(candidate.cart_state)
            : (candidate.cart_state as typeof cartItems);
      } catch {
        skipped++;
        continue;
      }

      if (!Array.isArray(cartItems) || cartItems.length === 0) {
        skipped++;
        continue;
      }

      const cartValue = cartItems.reduce((sum, item) => {
        const price = Number(item?.retailPrice) || 0;
        const qty = Number(item?.quantity) || 0;
        return sum + price * qty;
      }, 0);

      const firstName = candidate.full_name
        ? String(candidate.full_name).split(' ')[0]
        : 'Researcher';
      const itemCount = cartItems.reduce(
        (sum, item) => sum + (Number(item?.quantity) || 0),
        0
      );

      const subject = 'You Left Items In Your Cart';
      const body = `Hi ${firstName},\n\nYou Have ${itemCount} Item${itemCount === 1 ? '' : 's'} Waiting In Your Cart${cartValue > 0 ? ` (Total: $${cartValue.toFixed(2)})` : ''}. Log Back In To Complete Your Order Before Inventory Moves.\n\nBest,\nYour PepNationLab Team`;

      const { error: msgError } = await supabase.from('internal_messages').insert({
        sender_id: null,
        receiver_id: candidate.id,
        subject,
        body,
        type: 'notification',
        is_read: false,
      });
      if (msgError) {
        skipped++;
        continue;
      }

      let channel: 'in_app' | 'sms' | 'both' = 'in_app';
      try {
        const { data: prefs } = await supabase
          .from('notification_preferences')
          .select('sms_enabled, sms_phone, events_payment_reminder')
          .eq('user_id', candidate.id)
          .maybeSingle();
        if (
          prefs?.sms_enabled &&
          prefs.sms_phone &&
          prefs.events_payment_reminder !== false &&
          /^\+\d{10,15}$/.test(String(prefs.sms_phone).trim())
        ) {
          const smsBody = `PepNationLab: Hi ${firstName}, you have ${itemCount} item${itemCount === 1 ? '' : 's'} waiting in your cart${cartValue > 0 ? ` ($${cartValue.toFixed(2)})` : ''}. Log in to complete your order.`;
          const { error: smsErr } = await supabase.from('sms_outbox').insert({
            recipient_user_id: candidate.id,
            to_phone: String(prefs.sms_phone).trim(),
            body: smsBody.slice(0, 1000),
            event: 'abandoned_cart',
            related_order_id: null,
            status: 'pending',
            provider: 'twilio',
          });
          if (!smsErr) {
            channel = 'both';
            smsSent++;
          }
        }
      } catch {
        // SMS best-effort.
      }

      await supabase.from('abandoned_cart_reminders').insert({
        user_id: candidate.id,
        cart_state_snapshot: candidate.cart_state,
        cart_value: cartValue || null,
        channel,
      });

      await supabase
        .from('profiles')
        .update({ last_cart_reminder_at: new Date().toISOString() })
        .eq('id', candidate.id);

      sent++;
    }

    await finishCronRun(
      claim.id,
      'succeeded',
      `sent=${sent} smsSent=${smsSent} skipped=${skipped}`
    );

    return NextResponse.json({
      success: true,
      sent,
      smsSent,
      skipped,
      considered: candidates?.length ?? 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishCronRun(claim.id, 'failed', message.slice(0, 500));
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
