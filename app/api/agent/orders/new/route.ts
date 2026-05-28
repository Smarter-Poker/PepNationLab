import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';

export async function POST(req: NextRequest) {
  try {
    const gate = await requireAgent();
    if (!gate.ok) return gate.response;

    const supabase = await createServiceClient();
    const agentId = gate.user.id;
    
    const body = await req.json();
    const { buyerName, buyerEmail, street, city, state, zip, items, total, shippingCost, paymentMethod } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Order must contain items' }, { status: 400 });
    }

    const safeTotal = Number(total) || 0;
    const safeShipping = Number(shippingCost) || 0;

    // A manual order created by the agent for a client.
    // We'll create an anonymous buyer in profiles if we wanted, or just store the buyer info on the order directly.
    // The current order schema has buyer_id, which references profiles. 
    // If the agent is logging it, we can just use the agent's ID as buyer_id but fill in buyer_name/email, 
    // OR create a dummy profile. Let's just use the agent's ID but store the correct shipping address.

    const { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert({
        agent_id: agentId,
        buyer_id: agentId, // Self-assigned for manual orders
        status: 'approved_ship', // Pre-approved since agent is making it manually
        fulfillment_method: 'ship',
        payment_method: paymentMethod || 'manual',
        subtotal: safeTotal - safeShipping,
        shipping_cost: safeShipping,
        total: safeTotal,
        shipping_address: { street, city, state, zipCode: zip, country: 'US' },
        buyer_name: buyerName,
        buyer_email: buyerEmail,
        agent_approved_at: new Date().toISOString()
      })
      .select()
      .single();

    if (orderError) {
      console.error(orderError);
      return NextResponse.json({ error: 'Failed to create manual order' }, { status: 500 });
    }

    // Insert order items
    const orderItemsToInsert = items.map((item: any) => ({
      order_id: newOrder.id,
      product_id: item.product_id,
      quantity: item.quantity,
      price_at_time: item.price
    }));

    if (orderItemsToInsert.length > 0) {
      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItemsToInsert);
        
      if (itemsError) {
        console.error(itemsError);
        return NextResponse.json({ error: 'Failed to add items to order' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, order: newOrder });

  } catch (error) {
    console.error('Manual Order API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
