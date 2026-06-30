import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  try {
    const gate = await requireAdmin();
    if (!gate.ok) return gate.response;

    const supabase = await createServiceClient();

    // Find users with items in cart, updated more than 24 hours ago
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const { data: abandonedCarts, error: fetchError } = await supabase
      .from('profiles')
      .select('id, full_name, referring_agent_id, cart_state, cart_updated_at, last_cart_reminder_at')
      .not('cart_state', 'is', null)
      .not('cart_state', 'eq', '[]')
      .lt('cart_updated_at', twentyFourHoursAgo.toISOString());

    if (fetchError) {
      return NextResponse.json({ error: 'Failed To Fetch Abandoned Carts' }, { status: 500 });
    }

    if (!abandonedCarts || abandonedCarts.length === 0) {
      return NextResponse.json({ success: true, message: 'No Abandoned Carts Found Needing Reminders.', sentCount: 0 });
    }

    const messagesToInsert = [];
    const profilesToUpdate = [];

    const adminId = gate.userId;

    for (const user of abandonedCarts) {
      let cartItems = [];
      try {
        cartItems = typeof user.cart_state === 'string' ? JSON.parse(user.cart_state) : user.cart_state;
      } catch (e) {
        continue;
      }

      if (!cartItems || cartItems.length === 0) continue;

      if (
        user.last_cart_reminder_at &&
        new Date(user.last_cart_reminder_at).getTime() > Date.now() - 24 * 60 * 60 * 1000
      ) {
        continue;
      }

      const senderId = user.referring_agent_id || adminId;
      const firstName = user.full_name ? user.full_name.split(' ')[0] : 'Researcher';

      messagesToInsert.push({
        sender_id: senderId,
        receiver_id: user.id,
        subject: 'You Left Items In Your Cart',
        body: `Hi ${firstName},\n\nWe noticed you left some research materials in your cart. Your items have been reserved, but inventory is moving fast. Log back in to complete your checkout before they sell out!\n\nBest,\nYour PepNationLab Team`,
      });

      profilesToUpdate.push(user.id);
    }

    if (messagesToInsert.length > 0) {
      const { error: msgError } = await supabase.from('internal_messages').insert(messagesToInsert);
      if (msgError) {
        console.error('Failed to insert reminder messages:', msgError);
        return NextResponse.json({ error: 'Failed To Send Reminders' }, { status: 500 });
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ last_cart_reminder_at: new Date().toISOString() })
        .in('id', profilesToUpdate);

      if (updateError) {
        console.error('Failed to update cart reminder timestamps:', updateError);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Sent ${messagesToInsert.length} cart reminders.`,
      sentCount: messagesToInsert.length
    });

  } catch (error) {
    console.error('Cart Reminders Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
