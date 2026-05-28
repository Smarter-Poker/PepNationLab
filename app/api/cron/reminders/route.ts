import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';

export async function GET(req: Request) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  // Idempotency partition: one cart-reminder run per UTC date.
  const today = new Date();
  const partitionKey = today.toISOString().slice(0, 10);

  const claim = await claimCronRun('cart_reminders', partitionKey);
  if (!claim) {
    return NextResponse.json({ skipped: true, reason: 'already_ran', partitionKey });
  }

  try {
    const supabase = await createServiceClient();

    // Find users with items in cart, where the cart was last updated more
    // than 24 hours ago AND we have NOT already sent them a reminder in
    // the last 24 hours.
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
    const cutoff = twentyFourHoursAgo.toISOString();

    const { data: abandonedCarts, error: fetchError } = await supabase
      .from('profiles')
      .select('id, full_name, referring_agent_id, cart_state, cart_updated_at, last_cart_reminder_at')
      .not('cart_state', 'is', null)
      .neq('cart_state', '[]')
      .lt('cart_updated_at', cutoff)
      .or(`last_cart_reminder_at.is.null,last_cart_reminder_at.lt.${cutoff}`);

    if (fetchError) {
      await finishCronRun(claim.id, 'failed', `fetch: ${fetchError.message}`.slice(0, 500));
      return NextResponse.json({ error: 'Failed To Fetch Abandoned Carts' }, { status: 500 });
    }

    // Fallback sender if a researcher has no referring agent on file.
    const { data: adminUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .limit(1)
      .single();

    const fallbackSenderId = adminUser?.id;

    const messagesToInsert: Array<{
      sender_id: string;
      receiver_id: string;
      subject: string;
      body: string;
    }> = [];
    const profilesToUpdate: string[] = [];

    for (const user of abandonedCarts ?? []) {
      let cartItems: unknown[] = [];
      try {
        cartItems =
          typeof user.cart_state === 'string'
            ? JSON.parse(user.cart_state)
            : (user.cart_state as unknown[]);
      } catch {
        continue;
      }

      if (!Array.isArray(cartItems) || cartItems.length === 0) continue;

      const senderId = user.referring_agent_id || fallbackSenderId;
      if (!senderId) continue;

      const firstName = user.full_name ? String(user.full_name).split(' ')[0] : 'Researcher';

      messagesToInsert.push({
        sender_id: senderId,
        receiver_id: user.id,
        subject: 'You Left Items In Your Cart',
        body: `Hi ${firstName},\n\nWe Noticed You Left Some Research Materials In Your Cart. Your Items Have Been Reserved, But Inventory Is Moving Fast. Log Back In To Complete Your Checkout Before They Sell Out.\n\nBest,\nYour PepNationLab Team`,
      });

      profilesToUpdate.push(user.id);
    }

    if (messagesToInsert.length > 0) {
      const { error: msgError } = await supabase
        .from('internal_messages')
        .insert(messagesToInsert);
      if (msgError) {
        await finishCronRun(claim.id, 'failed', `insert messages: ${msgError.message}`.slice(0, 500));
        return NextResponse.json({ error: 'Failed To Send Reminders' }, { status: 500 });
      }

      // Bump last_cart_reminder_at — NOT cart_updated_at, which is owned by
      // the cart itself. Tracking the reminder time separately prevents us
      // from spamming the researcher and keeps the cart freshness intact.
      const now = new Date().toISOString();
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ last_cart_reminder_at: now })
        .in('id', profilesToUpdate);

      if (updateError) {
        console.error('Failed to update last_cart_reminder_at:', updateError);
      }
    }

    // Release inventory held by abandoned pending orders (default: 72 hours).
    let staleCancelled = 0;
    const { data: cancelledCount, error: cancelError } = await supabase.rpc(
      'cancel_stale_pending_orders',
      { p_hours: 72 }
    );
    if (cancelError) {
      console.error('cancel_stale_pending_orders failed:', cancelError);
    } else if (typeof cancelledCount === 'number') {
      staleCancelled = cancelledCount;
    }

    await finishCronRun(
      claim.id,
      'succeeded',
      `sent=${messagesToInsert.length} staleCancelled=${staleCancelled}`
    );

    return NextResponse.json({
      success: true,
      sentCount: messagesToInsert.length,
      staleCancelled,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Cron Reminders Error:', message);
    await finishCronRun(claim.id, 'failed', message.slice(0, 500));
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
