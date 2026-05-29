import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { pickOne } from '@/lib/relations';
import { computeAgentCost, type AgentTier } from '@/lib/pricing';
import { enqueueOrderPush } from '@/lib/push-enqueue';
import { enqueueWebhook, fetchOrderForWebhook } from '@/lib/webhook-dispatch';

export async function POST(req: NextRequest) {
  try {
    const gate = await requireAgent();
    if (!gate.ok) return gate.response;

    const supabase = await createServiceClient();
    const callerId = gate.user.id;
    const body = await req.json();
    const { orderId, newStatus, tracking_number } = body;

    if (!orderId || !newStatus) return NextResponse.json({ error: 'Order ID and Status required' }, { status: 400 });
    if (!newStatus.startsWith('approved_') && newStatus !== 'cancelled') return NextResponse.json({ error: 'Invalid agent status transition' }, { status: 400 });

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, order_items(product_id, product_name, quantity, unit_cost_price, unit_super_agent_cost), profiles!orders_agent_id_fkey(parent_agent_id)')
      .eq('id', orderId)
      .single();

    if (orderError || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const orderAgentProfile = pickOne<{ parent_agent_id: string | null }>(order.profiles);
    const orderAgentParentId = orderAgentProfile?.parent_agent_id ?? null;

    if (order.agent_id !== callerId && orderAgentParentId !== callerId) {
      return NextResponse.json({ error: 'Unauthorized to modify this order' }, { status: 403 });
    }
    if (order.status !== 'pending_customer_payment' && order.status !== 'agent_approval_pending') {
      return NextResponse.json({ error: 'Order is no longer pending approval' }, { status: 400 });
    }

    if (newStatus === 'cancelled') {
      await supabase.from('orders').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', orderId);
      void (async () => {
        try {
          const orderPayload = await fetchOrderForWebhook(supabase, orderId);
          if (orderPayload) {
            await enqueueWebhook(supabase, {
              event: 'order.cancelled',
              agentId: (orderPayload as { agent_id?: string | null }).agent_id ?? null,
              payload: { order: orderPayload },
              relatedOrderId: orderId,
            });
          }
        } catch { /* webhook errors must not break the cancel */ }
      })();
      return NextResponse.json({ success: true, status: 'cancelled' });
    }

    const primaryBilledAgentId = orderAgentParentId || order.agent_id;
    const isSubAgentOrder = !!orderAgentParentId && primaryBilledAgentId !== order.agent_id;

    let totalCogs = 0;
    const items = (order.order_items as any[]) || [];

    let billedAgentTier: AgentTier = 'tier_3';
    if (!isSubAgentOrder) {
      const { data: billedProfile } = await supabase.from('profiles').select('tier').eq('id', primaryBilledAgentId).maybeSingle();
      billedAgentTier = (billedProfile?.tier as AgentTier | null) ?? 'tier_3';
    }

    for (const item of items) {
      const qty = Number(item.quantity) || 0;
      if (qty <= 0) continue;
      if (isSubAgentOrder) {
        const stored = Number(item.unit_super_agent_cost);
        if (Number.isFinite(stored) && stored > 0) totalCogs += stored * qty;
        else if (item.product_id) totalCogs += (await computeAgentCost(supabase, item.product_id, billedAgentTier)) * qty;
      } else {
        const stored = Number(item.unit_cost_price);
        if (Number.isFinite(stored) && stored > 0) totalCogs += stored * qty;
        else if (item.product_id) totalCogs += (await computeAgentCost(supabase, item.product_id, billedAgentTier)) * qty;
      }
    }

    const shippingCost = Number(order.shipping_cost) || 0;
    const totalOwed = totalCogs + shippingCost;

    const { data: primaryProfile, error: profileError } = await supabase
      .from('profiles').select('account_type, prepaid_balance, credit_limit')
      .eq('id', primaryBilledAgentId).single();

    if (profileError || !primaryProfile) return NextResponse.json({ error: 'Failed to retrieve billing profile' }, { status: 500 });

    if (primaryProfile.account_type === 'prepaid') {
      const balance = Number(primaryProfile.prepaid_balance) || 0;
      if (balance < totalOwed) {
        return NextResponse.json({
          error: `Insufficient Prepaid Balance. Requires $${totalOwed.toFixed(2)}, but balance is $${balance.toFixed(2)}. Please recharge your account.`
        }, { status: 402 });
      }
    } else if (primaryProfile.account_type === 'credit') {
      const { data: statements } = await supabase.from('weekly_statements').select('total_owed').eq('agent_id', primaryBilledAgentId).eq('status', 'pending_payment');
      let currentUnbilled = 0;
      statements?.forEach((s) => (currentUnbilled += Number(s.total_owed) || 0));

      const { data: approvedOrders } = await supabase
        .from('orders')
        .select('id, shipping_cost, statement_orders(statement_id), order_items(quantity, unit_cost_price, unit_super_agent_cost), agent_id')
        .eq('agent_id', primaryBilledAgentId)
        .in('status', ['approved_ship', 'approved_pickup', 'in_fulfillment', 'shipped', 'delivered']);

      let inFlight = 0;
      for (const o of approvedOrders ?? []) {
        const links = (o.statement_orders as unknown) as Array<{ statement_id: string | null }> | null;
        if (Array.isArray(links) && links.some((l) => l?.statement_id)) continue;
        const ship = Number((o as { shipping_cost?: unknown }).shipping_cost) || 0;
        const its = ((o as { order_items?: unknown }).order_items ?? []) as Array<{ quantity: number; unit_cost_price: number | null; unit_super_agent_cost: number | null; }>;
        let orderCogs = 0;
        for (const it of its) {
          const qty = Number(it.quantity) || 0;
          const cost = Number(it.unit_cost_price);
          orderCogs += (Number.isFinite(cost) && cost > 0 ? cost : 0) * qty;
        }
        inFlight += orderCogs + ship;
      }

      const creditLimit = Number(primaryProfile.credit_limit) || 0;
      const projected = currentUnbilled + inFlight + totalOwed;
      if (projected > creditLimit) {
        return NextResponse.json({
          error: `Credit Limit Exceeded. Approving this order would push outstanding balance to $${projected.toFixed(2)} (Limit: $${creditLimit.toFixed(2)}). Please pay your pending weekly statements.`,
        }, { status: 403 });
      }
    }

    if (order.agent_id) {
      for (const item of items) {
        if (!item.product_id) continue;
        const qtyRequired = Number(item.quantity) || 0;
        if (qtyRequired <= 0) continue;
        const { data: invData } = await supabase.from('agent_inventory').select('stock_count').eq('agent_id', order.agent_id).eq('product_id', item.product_id).single();
        const currentStock = Number(invData?.stock_count) || 0;
        if (currentStock < qtyRequired) {
          return NextResponse.json({
            error: `Insufficient Inventory for "${item.product_name}". You need ${qtyRequired} units, but only have ${currentStock} in stock. Please purchase more bulk inventory before approving this order.`
          }, { status: 400 });
        }
      }
    }

    let prepaidDeducted = false;
    let oldBalance = 0;
    if (primaryProfile.account_type === 'prepaid') {
      oldBalance = Number(primaryProfile.prepaid_balance) || 0;
      const { data: deductSuccess, error: deductError } = await supabase.rpc('deduct_prepaid_balance', { agent_id: primaryBilledAgentId, amount: totalOwed });
      if (deductError || !deductSuccess) return NextResponse.json({ error: 'Failed to deduct balance. Please try again.' }, { status: 500 });
      prepaidDeducted = true;
    }

    const updatePayload: any = { status: newStatus, agent_approved_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    if (tracking_number && typeof tracking_number === 'string') updatePayload.tracking_number = tracking_number;

    const { error: updateError } = await supabase.from('orders').update(updatePayload).eq('id', orderId);
    if (updateError) {
      if (prepaidDeducted) {
        try { await supabase.rpc('deduct_prepaid_balance', { agent_id: primaryBilledAgentId, amount: -totalOwed }); } catch {}
      }
      return NextResponse.json({ error: 'Failed to update order status' }, { status: 500 });
    }

    if (prepaidDeducted) {
      const newBalance = oldBalance - totalOwed;
      await supabase.from('balance_transactions').insert({
        agent_id: primaryBilledAgentId, type: 'order_charge', amount: totalOwed,
        balance_before: oldBalance, balance_after: newBalance,
        description: `Charge for Order ${orderId}`, reference_id: orderId, reference_type: 'order', created_by: callerId
      });
    }

    // Fire-and-forget push notification — never blocks order completion.
    if ((newStatus === 'approved_ship' || newStatus === 'approved_pickup') && order.buyer_id) {
      try {
        await enqueueOrderPush(supabase, {
          userId: order.buyer_id,
          orderId,
          event: 'order_approved',
        });
      } catch { /* push failures must not break the order */ }
    }

    // Fire-and-forget webhook: order.approved
    void (async () => {
      try {
        const orderPayload = await fetchOrderForWebhook(supabase, orderId);
        if (orderPayload) {
          await enqueueWebhook(supabase, {
            event: 'order.approved',
            agentId: (orderPayload as { agent_id?: string | null }).agent_id ?? null,
            payload: { order: orderPayload },
            relatedOrderId: orderId,
          });
        }
      } catch { /* webhook errors must not break the order */ }
    })();

    return NextResponse.json({ success: true, status: newStatus });
  } catch (error) {
    console.error('Agent Order Approve API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
