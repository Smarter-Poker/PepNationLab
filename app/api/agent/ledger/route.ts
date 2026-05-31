import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { pickOne } from '@/lib/relations';

export async function GET(req: Request) {
  try {
    const gate = await requireAgent();
    if (!gate.ok) return gate.response;

    const agentId = gate.user.id;
    const supabase = await createServiceClient();

    // Fetch all completed retail orders for this agent
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id, 
        created_at, 
        total, 
        shipping_cost, 
        tax_amount,
        discount_amount,
        status,
        fulfillment_method,
        buyer:profiles!orders_buyer_id_fkey(full_name, email),
        order_items(quantity, unit_retail_price, unit_cost_price)
      `)
      .eq('agent_id', agentId)
      .eq('is_wholesale_restock', false)
      // BUG-7 FIX: was .not('status','eq','cancelled') which included
      // pending_customer_payment and agent_approval_pending orders —
      // uncollected revenue was being counted as collected in totals.
      .in('status', ['approved_ship', 'approved_pickup', 'in_fulfillment', 'shipped', 'delivered'])
      .order('created_at', { ascending: false });

    if (ordersError) {
      return NextResponse.json({ error: 'Failed to load ledger data' }, { status: 500 });
    }

    let totalCollected = 0;
    let totalOwed = 0;
    let totalProfit = 0;

    const formattedLedger = (orders || []).map(order => {
      let cogs = 0;
      let retailSubtotal = 0;

      order.order_items?.forEach((item: any) => {
        cogs += Number(item.unit_cost_price) * Number(item.quantity);
        retailSubtotal += Number(item.unit_retail_price) * Number(item.quantity);
      });

      // The agent collects the total from the customer
      const collected = Number(order.total);
      
      // The agent owes the Admin/SuperAgent the COGS + Shipping
      const owed = cogs + Number(order.shipping_cost || 0);

      const profit = collected - owed;

      totalCollected += collected;
      totalOwed += owed;
      totalProfit += profit;

      // BUG-13 FIX: Supabase nested FK joins return arrays even on single-row
      // relations. Direct property access on an array returns undefined.
      // Use pickOne() to unwrap correctly.
      const buyer = pickOne<{ full_name?: string; email?: string }>(order.buyer as any);

      return {
        id: order.id,
        date: order.created_at,
        customer: buyer?.full_name || buyer?.email || 'Anonymous',
        status: order.status,
        collected,
        owed,
        profit
      };
    });

    return NextResponse.json({
      summary: {
        totalCollected,
        totalOwed,
        totalProfit
      },
      transactions: formattedLedger
    });

  } catch (error) {
    console.error('Ledger Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
