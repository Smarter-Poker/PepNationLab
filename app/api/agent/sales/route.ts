import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAgentOrAdmin } from '@/lib/admin-auth';
import { pickOne } from '@/lib/relations';

export async function GET(req: NextRequest) {
  try {
    const gate = await requireAgentOrAdmin();
    if (!gate.ok) return gate.response;

    const supabase = createAdminClient();
    const agentId = gate.user.id;

    // 1. Fetch all researchers under this agent
    const { data: researchers, error: researchersError } = await supabase
      .from('profiles')
      .select('id, full_name, email, cart_state, cart_updated_at')
      .eq('referring_agent_id', agentId)
      .eq('role', 'researcher')
      .limit(1000);

    if (researchersError) {
      return NextResponse.json({ error: 'An Unexpected Error Occurred.' }, { status: 500 });
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

    // 1.5. Fetch direct downlines (sub-agents reporting to this agent) so a
    // super agent's Sales And Accounting view rolls up their downline's
    // orders instead of only their own. Mirrors the downline lookup used by
    // sub-agent-rollup/route.ts and the SSR page at dashboard/agent/page.tsx.
    const { data: downlines, error: downlinesError } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('parent_agent_id', agentId);

    if (downlinesError) {
      return NextResponse.json({ error: 'An Unexpected Error Occurred.' }, { status: 500 });
    }

    const downlineNames = new Map<string, string | null>(
      (downlines || []).map((d: any) => [d.id, d.full_name ?? null])
    );
    const agentIds = [agentId, ...(downlines || []).map((d: any) => d.id)];

    // 2. Fetch all orders for this agent and its direct downlines
    // Explicit column lists instead of '*, order_items(*)': this fetch is
    // capped at 2500 orders, and the wildcard pulled every order and line-item
    // column into the route. The order columns below are exactly the ones the
    // mapping further down reads; the order_items columns cover the route's
    // profit math (unit_retail_price, unit_cost_price, unit_super_agent_cost,
    // quantity) plus the raw items passthrough consumed by
    // components/AgentSales.tsx (product_name, quantity, unit_retail_price,
    // unit_cost_price).
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(
        'id, buyer_id, agent_id, status, fulfillment_method, payment_method, shipping_address, ' +
        'shipping_cost, subtotal, total, discount_amount, coupon_code, created_at, ' +
        'tracking_number, label_url, ' +
        'order_items(id, order_id, product_id, product_name, quantity, unit_retail_price, unit_cost_price, unit_super_agent_cost), ' +
        'profiles!orders_buyer_id_fkey(full_name, email)'
      )
      .in('agent_id', agentIds)
      // Exclude wholesale restock orders from the sales view.
      // Restocks were appearing as zero-profit 'sales' in the agent dashboard.
      .eq('is_wholesale_restock', false)
      // Exclude cancelled orders so voided sales don't distort profit/discount totals
      // (matches coupon-performance, redemptions, and sub-agent-rollup readers).
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(2500);

    if (ordersError) {
      return NextResponse.json({ error: 'An Unexpected Error Occurred.' }, { status: 500 });
    }

    // Calculate profit for each order.
    // - Own sales (agent_id === agentId): the agent's true margin is
    //     profit = retail (customer paid, net of coupon) - cost (what agent
    //              pays the platform) - shipping (also billed to the agent)
    //   Shipping is included because the platform bills the agent for it on
    //   the weekly statement, even though the customer paid retail shipping.
    // - Downline sales (agent_id is a direct downline): this agent doesn't
    //   own the retail sale, it earns the markup it set for that downline,
    //   i.e. the spread between what the downline owes (unit_cost_price) and
    //   what the downline's cost is upstream of this agent
    //   (unit_super_agent_cost). Shipping is a pass-through re-billed to the
    //   downline, and discounts are borne by the downline's own margin, so
    //   neither factors into this agent's downline profit.
    // Exclude agent self-buys (the buyer IS the store's own agent) from the
    // sales view. Like wholesale restocks, these are zero-margin agent stock
    // purchases -- an agent self-buy always prices retail == cost, so counting
    // them showed phantom "revenue" with $0 profit/commission on the dashboard.
    const sales = orders.filter((o: any) => o.buyer_id !== o.agent_id).map((o: any) => {
      const isDownlineOrder = o.agent_id !== agentId;

      let profit: number;

      if (isDownlineOrder) {
        let spread = 0;
        for (const item of o.order_items || []) {
          const cost = Number(item.unit_cost_price) || 0;
          const superAgentCost = item.unit_super_agent_cost != null
            ? Number(item.unit_super_agent_cost)
            : cost;
          spread += (cost - superAgentCost) * Number(item.quantity);
        }
        profit = spread;
      } else {
        let totalRetail = 0;
        let totalCost = 0;

        for (const item of o.order_items || []) {
          totalRetail += Number(item.unit_retail_price) * Number(item.quantity);
          totalCost += Number(item.unit_cost_price) * Number(item.quantity);
        }

        const discount = Number(o.discount_amount) || 0;
        const shippingCost = Number(o.shipping_cost) || 0;
        totalRetail -= discount;

        profit = totalRetail - totalCost - shippingCost;
      }

      // o.profiles from Supabase FK join may be an array.
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
        shipping_cost: Number(o.shipping_cost || 0),
        subtotal: Number(o.subtotal || 0),
        total: Number(o.total || 0),
        discount_amount: Number(o.discount_amount || 0),
        coupon_code: o.coupon_code,
        created_at: o.created_at,
        buyer_name: buyer?.full_name || buyer?.email || null,
        buyer_email: buyer?.email || null,
        tracking_number: o.tracking_number,
        label_url: o.label_url,
        agent_id: o.agent_id,
        is_sub_agent_order: isDownlineOrder,
        is_downline_order: isDownlineOrder,
        downline_agent_id: isDownlineOrder ? o.agent_id : null,
        downline_agent_name: isDownlineOrder ? (downlineNames.get(o.agent_id) ?? null) : null,
        profit: Number(profit.toFixed(2)),
        items: o.order_items
      };
    });

    return NextResponse.json({ data: { liveCarts, sales } });
  } catch (error) {
    console.error('Agent Sales API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
