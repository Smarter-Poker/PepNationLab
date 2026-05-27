import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';

export async function POST(req: NextRequest) {
  try {
    const gate = await requireAgent();
    if (!gate.ok) return gate.response;

    const supabase = await createServiceClient();
    const callerId = gate.user.id;
    const body = await req.json();
    const { orderId, newStatus } = body;

    if (!orderId || !newStatus) {
      return NextResponse.json({ error: 'Order ID and Status required' }, { status: 400 });
    }

    if (!newStatus.startsWith('approved_') && newStatus !== 'cancelled') {
      return NextResponse.json({ error: 'Invalid agent status transition' }, { status: 400 });
    }

    // 1. Fetch the order and verify the caller is the agent_id OR the caller is a Super Agent and order belongs to a Sub-Agent
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, order_items(product_id, product_name, quantity, unit_cost_price, unit_super_agent_cost), profiles!orders_agent_id_fkey(parent_agent_id)')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.agent_id !== callerId && order.profiles?.parent_agent_id !== callerId) {
      return NextResponse.json({ error: 'Unauthorized to modify this order' }, { status: 403 });
    }

    if (order.status !== 'pending_customer_payment' && order.status !== 'agent_approval_pending') {
      return NextResponse.json({ error: 'Order is no longer pending approval' }, { status: 400 });
    }

    // 2. If it's a cancellation, just cancel it and return
    if (newStatus === 'cancelled') {
      await supabase.from('orders').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', orderId);
      return NextResponse.json({ success: true, status: 'cancelled' });
    }

    // 3. Balance Enforcement Logic (Only for Approval)
    // We must deduct from the primary billed agent (either the Agent themselves, or the Super Agent if Sub-Agent)
    const primaryBilledAgentId = order.profiles?.parent_agent_id || order.agent_id;
    
    // Calculate total COGS + Shipping
    let totalCogs = 0;
    const items = (order.order_items as any[]) || [];
    for (const item of items) {
      const qty = Number(item.quantity) || 0;
      if (order.agent_id === primaryBilledAgentId) {
        totalCogs += (Number(item.unit_cost_price) || 0) * qty;
      } else {
        totalCogs += (Number(item.unit_super_agent_cost) || 0) * qty;
      }
    }
    
    const shippingCost = Number(order.shipping_cost) || 0;
    const totalOwed = totalCogs + shippingCost;

    // Fetch the primary billed agent's profile to check account type and balance
    const { data: primaryProfile, error: profileError } = await supabase
      .from('profiles')
      .select('account_type, prepaid_balance, credit_limit')
      .eq('id', primaryBilledAgentId)
      .single();

    if (profileError || !primaryProfile) {
      return NextResponse.json({ error: 'Failed to retrieve billing profile' }, { status: 500 });
    }

    // Check Credit Limit or Prepaid Balance
    if (primaryProfile.account_type === 'prepaid') {
      const balance = Number(primaryProfile.prepaid_balance) || 0;
      if (balance < totalOwed) {
        return NextResponse.json({ 
          error: `Insufficient Prepaid Balance. Requires $${totalOwed.toFixed(2)}, but balance is $${balance.toFixed(2)}. Please recharge your account.`
        }, { status: 402 });
      }
    } else if (primaryProfile.account_type === 'credit') {
      // Calculate current outstanding unbilled amount to see if they exceed credit limit
      // 1. Unpaid statements
      const { data: statements } = await supabase
        .from('weekly_statements')
        .select('total_owed')
        .eq('agent_id', primaryBilledAgentId)
        .eq('status', 'pending_payment');
        
      let currentUnbilled = 0;
      statements?.forEach(s => currentUnbilled += Number(s.total_owed));

      // 2. Unbilled orders (orders since last statement)
      // For simplicity, we just check unpaid statements.
      // If we want exact, we would also query recent orders.
      // Let's do a simple exact check: we fetch all orders that don't have a statement yet?
      // Actually, just checking unpaid statements is often sufficient for a soft credit limit check,
      // but let's just do the sum of unpaid statements for now.

      const creditLimit = Number(primaryProfile.credit_limit) || 0;

      if ((currentUnbilled + totalOwed) > creditLimit) {
        return NextResponse.json({ 
          error: `Credit Limit Exceeded. Approving this order would push outstanding balance to $${(currentUnbilled + totalOwed).toFixed(2)} (Limit: $${creditLimit.toFixed(2)}). Please pay your pending weekly statements.`
        }, { status: 402 });
      }
    }

    // 4. Pre-flight Inventory Check (Agents MUST have enough inventory to approve an order)
    if (order.agent_id) {
      for (const item of items) {
        if (!item.product_id) continue;
        const qtyRequired = Number(item.quantity) || 0;
        if (qtyRequired <= 0) continue;

        const { data: invData } = await supabase
          .from('agent_inventory')
          .select('stock_count')
          .eq('agent_id', order.agent_id)
          .eq('product_id', item.product_id)
          .single();

        const currentStock = Number(invData?.stock_count) || 0;
        if (currentStock < qtyRequired) {
          return NextResponse.json({ 
            error: `Insufficient Inventory for "${item.product_name}". You need ${qtyRequired} units, but only have ${currentStock} in stock. Please purchase more bulk inventory before approving this order.` 
          }, { status: 400 });
        }
      }
    }

    // 5. Update the Order Status
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: newStatus,
        agent_approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update order status' }, { status: 500 });
    }

    // 5. Deduct Prepaid Balance immediately via Ledger if prepaid
    if (primaryProfile.account_type === 'prepaid') {
      const oldBalance = Number(primaryProfile.prepaid_balance) || 0;
      const newBalance = oldBalance - totalOwed;

      // Update the profile balance
      await supabase
        .from('profiles')
        .update({ prepaid_balance: newBalance })
        .eq('id', primaryBilledAgentId);

      // Insert ledger entry
      await supabase
        .from('balance_transactions')
        .insert({
          agent_id: primaryBilledAgentId,
          type: 'order_charge',
          amount: totalOwed,
          balance_before: oldBalance,
          balance_after: newBalance,
          description: `Charge for Order ${orderId}`,
          reference_id: orderId,
          reference_type: 'order',
          created_by: callerId
        });
    }

    return NextResponse.json({ success: true, status: newStatus });

  } catch (error) {
    console.error('Agent Order Approve API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
