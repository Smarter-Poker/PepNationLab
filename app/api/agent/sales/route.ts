import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { pickOne } from '@/lib/relations';

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
      .eq('referring_agent_id', agentId)
      .eq('role', 'researcher');

    if (researchersError) {
      return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
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
      // BUG-14 FIX: exclude wholesale restock orders from the sales view.
      // Restocks were appearing as zero-profit 'sales' in the agent dashboard.
      .eq('is_wholesale_restock', false)
      .order('created_at', { ascending: false });

    if (ordersError) {
      return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
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

      // BUG-15 FIX: o.profiles from Supabase FK join may be an array.
      // Direct .full_name access on an array returns undefined.
      // Use pickOne() to correctly unwrap the single-row relation.
      const buyer = pickOne<{ full_name?: string; email?: string }>((o as any).profiles);
      return {
        id: o.id,
        buyer_id: o.buyer_id,
        status: o.status,
        fulfillment_method: o.fulfillment_method,
        payment_method: o.payment_method,
        shipping_address: o.shipping_address,
        shipping_cost: o.shipping_cost,
        subtotal: o.subtotal,
        total: o.total,
        discount_amount: o.discount_amount,
        coupon_code: o.coupon_code,
        created_at: o.created_at,
        buyer_name: buyer?.full_name || buyer?.email || null,
        buyer_email: buyer?.email || null,
        tracking_number: o.tracking_number,
        label_url: o.label_url,
        agent_id: o.agent_id,
        is_sub_agent_order: o.is_sub_agent_order,
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
