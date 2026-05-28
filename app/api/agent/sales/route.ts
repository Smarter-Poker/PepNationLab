import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';

export async function GET(req: NextRequest) {
  try {
    const gate = await requireAgent();
    if (!gate.ok) return gate.response;

    const supabase = await createServiceClient();
    const agentId = gate.user.id;

    // 1. Fetch all researchers under this agent
    const { data: researchers, error: researchersError } = await supabase
      .from('profiles')
      .select('id, full_name, email, cart_state, cart_updated_at')
      .eq('referring_agent_id', agentId);

    if (researchersError) {
      return NextResponse.json({ error: researchersError.message }, { status: 500 });
    }

    // Filter to only researchers with active carts
    const liveCarts = researchers
      .filter(r => r.cart_state && Array.isArray(r.cart_state) && r.cart_state.length > 0)
      .map(r => ({
        id: r.id,
        name: r.full_name || r.email,
        email: r.email,
        cart: r.cart_state,
        updated_at: r.cart_updated_at
      }))
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    // 2. Fetch all orders for this agent
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*, order_items(*), profiles!orders_buyer_id_fkey(full_name, email)')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false });

    if (ordersError) {
      return NextResponse.json({ error: ordersError.message }, { status: 500 });
    }

    // Calculate profit for each order. The agent's true margin is:
    //   profit = retail (customer paid, net of coupon) - cost (what agent
    //            pays the platform) - shipping (also billed to the agent)
    // Shipping is included because the platform bills the agent for it on
    // the weekly statement, even though the customer paid retail shipping.
    const sales = orders.map((o: any) => {
      let totalRetail = 0;
      let totalCost = 0;

      for (const item of o.order_items || []) {
        totalRetail += Number(item.unit_retail_price) * Number(item.quantity);
        totalCost += Number(item.unit_cost_price) * Number(item.quantity);
      }

      const discount = Number(o.discount_amount) || 0;
      const shippingCost = Number(o.shipping_cost) || 0;
      totalRetail -= discount;

      const profit = totalRetail - totalCost - shippingCost;

      return {
        id: o.id,
        status: o.status,
        created_at: o.created_at,
        buyer_name: o.profiles?.full_name || o.profiles?.email,
        subtotal: o.subtotal,
        discount_amount: o.discount_amount,
        shipping_cost: o.shipping_cost,
        total: o.total,
        profit,
        items: o.order_items
      };
    });

    return NextResponse.json({ data: { liveCarts, sales } });
  } catch (error) {
    console.error('Agent Sales API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
