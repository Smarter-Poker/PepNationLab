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

    // Calculate profit for each order
    const sales = orders.map((o: any) => {
      let totalRetail = 0;
      let totalCost = 0;

      for (const item of o.order_items || []) {
        totalRetail += Number(item.unit_retail_price) * Number(item.quantity);
        totalCost += Number(item.unit_cost_price) * Number(item.quantity);
      }

      // If the order had a coupon discount applied, subtract it from the retail price
      // because the agent passed the savings to the customer. Profit is what's left.
      const discount = Number(o.discount_amount) || 0;
      totalRetail -= discount;

      const profit = Math.max(0, totalRetail - totalCost);

      return {
        id: o.id,
        status: o.status,
        created_at: o.created_at,
        buyer_name: o.profiles?.full_name || o.profiles?.email,
        subtotal: o.subtotal,
        discount_amount: o.discount_amount,
        shipping_cost: o.shipping_cost,
        total: o.total,
        profit: profit,
        items: o.order_items
      };
    });

    return NextResponse.json({ data: { liveCarts, sales } });
  } catch (error) {
    console.error('Agent Sales API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
