import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createServiceClient();

    // Find users with items in cart, updated more than 24 hours ago
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const { data: abandonedCarts, error: fetchError } = await supabase
      .from('profiles')
      .select('id, full_name, referring_agent_id, cart_state, cart_updated_at')
      .not('cart_state', 'is', null)
      .not('cart_state', 'eq', '[]')
      .lt('cart_updated_at', twentyFourHoursAgo.toISOString());

    if (fetchError) {
      return NextResponse.json({ error: 'Failed to fetch abandoned carts' }, { status: 500 });
    }

    if (!abandonedCarts || abandonedCarts.length === 0) {
      return NextResponse.json({ success: true, message: 'No abandoned carts found needing reminders.', sentCount: 0 });
    }

    // Get the admin ID to use as a fallback sender
    const { data: adminUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .limit(1)
      .single();

    const fallbackSenderId = adminUser?.id;

    const messagesToInsert = [];
    const profilesToUpdate = [];

    for (const user of abandonedCarts) {
      let cartItems = [];
      try {
        cartItems = typeof user.cart_state === 'string' ? JSON.parse(user.cart_state) : user.cart_state;
      } catch (e) {
        continue;
      }

      if (!cartItems || cartItems.length === 0) continue;

      const senderId = user.referring_agent_id || fallbackSenderId;
      if (!senderId) continue; // Should rarely happen, but just in case

      const firstName = user.full_name ? user.full_name.split(' ')[0] : 'Researcher';

      messagesToInsert.push({
        sender_id: senderId,
        receiver_id: user.id,
        subject: 'You left items in your cart!',
        body: `Hi ${firstName},\n\nWe noticed you left some research materials in your cart. Your items have been reserved, but inventory is moving fast. Log back in to complete your checkout before they sell out!\n\nBest,\nYour PepNationLab Team`,
      });

      profilesToUpdate.push(user.id);
    }

    if (messagesToInsert.length > 0) {
      // 1. Send the messages
      const { error: msgError } = await supabase.from('internal_messages').insert(messagesToInsert);
      if (msgError) {
        console.error('Failed to insert reminder messages:', msgError);
        return NextResponse.json({ error: 'Failed to send reminders' }, { status: 500 });
      }

      // 2. Update the cart_updated_at so we don't spam them immediately again
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ cart_updated_at: new Date().toISOString() })
        .in('id', profilesToUpdate);

      if (updateError) {
        console.error('Failed to update cart timestamps:', updateError);
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Sent ${messagesToInsert.length} cart reminders via Cron.`, 
      sentCount: messagesToInsert.length 
    });

  } catch (error) {
    console.error('Cron Reminders Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
