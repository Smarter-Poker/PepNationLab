import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { pickOne } from '@/lib/relations';
import { computeAgentCostForAgent, type AgentTier } from '@/lib/pricing';
import { enqueueWebhook, fetchOrderForWebhook } from '@/lib/webhook-dispatch';
import { assertSameOrigin } from '@/lib/csrf';
import { withIdempotency, readIdempotencyKey } from '@/lib/idempotency';
import { shortOrderId } from '@/lib/push-enqueue';
import { assertChainCanTransact } from '@/lib/billing-chain';

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  try {
    const gate = await requireAgent();
    if (!gate.ok) return gate.response;

    const supabase = await createServiceClient();
    const callerId = gate.user.id;
    const body = await req.json().catch(() => ({}));
    const { orderId, newStatus, tracking_number } = body;

    if (!orderId || !newStatus) return NextResponse.json({ error: 'Order ID And Status Required' }, { status: 400 });
    const VALID_AGENT_TRANSITIONS = new Set(['approved_ship', 'approved_pickup', 'cancelled']);
    if (!VALID_AGENT_TRANSITIONS.has(newStatus)) {
      return NextResponse.json({ error: 'Invalid Agent Status Transition. Must Be Approved_Ship, Approved_Pickup, Or Cancelled.' }, { status: 400 });
    }

    return withIdempotency({
      userId: callerId,
      route: '/api/agent/orders/approve',
      key: readIdempotencyKey(req),
      request: { orderId, newStatus, tracking_number },
      handler: async () => {

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, order_items(product_id, product_name, quantity, unit_cost_price, unit_super_agent_cost), profiles!orders_agent_id_fkey(parent_agent_id)')
      .eq('id', orderId)
      .single();

    if (orderError || !order) return NextResponse.json({ error: 'Order Not Found' }, { status: 404 });

    const orderAgentProfile = pickOne<{ parent_agent_id: string | null }>(order.profiles);
    const orderAgentParentId = orderAgentProfile?.parent_agent_id ?? null;

    if (order.agent_id !== callerId && orderAgentParentId !== callerId) {
      return NextResponse.json({ error: 'Unauthorized To Modify This Order' }, { status: 403 });
    }
    if (order.status !== 'pending_customer_payment' && order.status !== 'agent_approval_pending') {
      return NextResponse.json({ error: 'Order Is No Longer Pending Approval' }, { status: 400 });
    }

    if (newStatus === 'cancelled') {
      const { error: cancelError } = await supabase.rpc('cancel_order', {
        p_order_id: orderId,
        p_reason: 'Cancelled By Agent',
        p_refund_type: 'none',
        p_actor_id: callerId,
      });
      if (cancelError) {
        console.error('Cancel order RPC failed:', cancelError.message);
        return NextResponse.json({ error: 'Failed To Cancel Order. Please Try Again.' }, { status: 500 });
      }
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
      return NextResponse.json({ success: true, status: 'cancelled' });
    }

    let finalStatus = newStatus;
    if (order.agent_id === callerId && orderAgentParentId !== null && (newStatus === 'approved_ship' || newStatus === 'approved_pickup')) {
      finalStatus = 'agent_approval_pending';
    }

    if (finalStatus === 'agent_approval_pending') {
      const updatePayload: Record<string, string> = { status: finalStatus, updated_at: new Date().toISOString() };
      const { error: updateError } = await supabase.from('orders').update(updatePayload).eq('id', orderId);
      if (updateError) return NextResponse.json({ error: 'Failed To Forward Order To Super Agent' }, { status: 500 });
      return NextResponse.json({ success: true, status: finalStatus });
    }

    const primaryBilledAgentId = orderAgentParentId || order.agent_id;
    const isSubAgentOrder = !!orderAgentParentId && primaryBilledAgentId !== order.agent_id;

    interface OrderItem {
      quantity?: number;
      product_id?: string;
      product_name?: string;
      unit_cost_price?: number;
      unit_super_agent_cost?: number;
    }
    let totalCogs = 0;
    const items = (order.order_items as OrderItem[]) || [];

    let billedAgentTier: AgentTier = 'tier_3';
    const { data: billedProfile } = await supabase.from('profiles').select('tier').eq('id', primaryBilledAgentId).maybeSingle();
    billedAgentTier = (billedProfile?.tier as AgentTier | null) ?? 'tier_3';

    for (const item of items) {
      const qty = Number(item.quantity) || 0;
      if (qty <= 0) continue;
      if (isSubAgentOrder) {
        const stored = Number(item.unit_super_agent_cost);
        if (Number.isFinite(stored) && stored >= 0) totalCogs += stored * qty;
        else if (item.product_id) totalCogs += (await computeAgentCostForAgent(supabase, item.product_id, primaryBilledAgentId, billedAgentTier) / 10) * qty;
      } else {
        const stored = Number(item.unit_cost_price);
        if (Number.isFinite(stored) && stored >= 0) totalCogs += stored * qty;
        else if (item.product_id) totalCogs += (await computeAgentCostForAgent(supabase, item.product_id, primaryBilledAgentId, billedAgentTier) / 10) * qty;
      }
    }

    const shippingCost = Number(order.shipping_cost) || 0;
    const totalOwed = totalCogs + shippingCost;

    const { data: primaryProfile, error: profileError } = await supabase
      .from('profiles').select('account_type, prepaid_balance, credit_limit')
      .eq('id', primaryBilledAgentId).single();

    if (profileError || !primaryProfile) return NextResponse.json({ error: 'Failed To Retrieve Billing Profile' }, { status: 500 });

    const chainCheck = await assertChainCanTransact(
      supabase,
      primaryBilledAgentId,
      totalOwed,
      order.agent_id,
    );
    if (!chainCheck.ok) {
      return NextResponse.json(
        { error: chainCheck.error, detail: chainCheck.detail },
        { status: chainCheck.status }
      );
    }

    if (primaryProfile.account_type === 'prepaid') {
      const balance = Number(primaryProfile.prepaid_balance) || 0;
      if (balance < totalOwed) {
        return NextResponse.json({
          error: `Insufficient Prepaid Balance. Requires $${totalOwed.toFixed(2)}, But Balance Is $${balance.toFixed(2)}. Please Recharge Your Account.`
        }, { status: 402 });
      }
    }

    if (order.agent_id && order.fulfillment_method === 'ship') {
      for (const item of items) {
        if (!item.product_id) continue;
        const qtyRequired = Number(item.quantity) || 0;
        if (qtyRequired <= 0) continue;
        const { data: invData } = await supabase.from('agent_inventory').select('stock_count').eq('agent_id', order.agent_id).eq('product_id', item.product_id).maybeSingle();
        const currentStock = Number(invData?.stock_count) || 0;
        if (currentStock < qtyRequired) {
          return NextResponse.json({
            error: `Insufficient Inventory For "${item.product_name}". You Need ${qtyRequired} Units, But Only Have ${currentStock} In Stock. Please Purchase More Bulk Inventory Before Approving This Order.`
          }, { status: 400 });
        }
      }
    }

    // BUG 8 fix: use atomic RPC that wraps balance deduction + order status
    // update in a single Postgres transaction. Eliminates the TOCTOU window
    // where money is deducted but the order stays in agent_approval_pending
    // if the second step fails.
    const amountToDeduct = primaryProfile.account_type === 'prepaid' ? totalOwed : 0;
    const finalAutoStatus = primaryProfile.account_type === 'credit' ? finalStatus : 'admin_approval_pending';
    const trackingArg = (tracking_number && typeof tracking_number === 'string') ? tracking_number : null;

    const { data: approveResult, error: approveError } = await supabase.rpc('approve_agent_order_atomic', {
      p_order_id:    orderId,
      p_agent_id:    primaryBilledAgentId,
      p_amount:      amountToDeduct,
      p_new_status:  finalAutoStatus,
      p_tracking_no: trackingArg,
    });

    if (approveError || !approveResult?.ok) {
      const reason = approveResult?.error || approveError?.message || 'unknown';
      console.error('[agent/orders/approve] atomic approve RPC failed', { orderId, reason });
      if (reason === 'insufficient_balance') {
        return NextResponse.json({ error: 'Insufficient Prepaid Balance To Approve This Order.' }, { status: 400 });
      }
      return NextResponse.json({ error: 'Failed To Approve Order. Please Try Again.' }, { status: 500 });
    }

    const prepaidDeducted = amountToDeduct > 0;

    // Note: the balance_transactions ledger record is written inside the
    // approve_agent_order_atomic RPC — no duplicate insert needed here.


    if (finalAutoStatus === 'approved_ship' || finalAutoStatus === 'approved_pickup') {
      try {
        await supabase.rpc('charge_order_credit_line', { p_order_id: orderId, p_created_by: callerId });
      } catch (creditErr) {
        console.error('[CRITICAL] charge_order_credit_line failed — order approved but credit line not charged:', {
          orderId,
          agentId: primaryBilledAgentId,
          error: creditErr instanceof Error ? creditErr.message : String(creditErr),
        });
      }
    }

    try {
      const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'admin');
      if (admins && admins.length > 0) {
        const short = shortOrderId(orderId);
        const totalStr = Number(totalOwed).toFixed(2);
        const fulfillmentMsg = order.fulfillment_method === 'agent_pickup' ? 'For Pickup' : 'For Shipping';
        const notifications = admins.map((admin) => ({
          user_id: admin.id,
          title: finalAutoStatus === 'admin_approval_pending' ? 'Order Needs Admin Approval' : 'Order Auto-Approved',
          body: finalAutoStatus === 'admin_approval_pending'
            ? `Order #${short} ($${totalStr}) - Agent Approved (${fulfillmentMsg}). Review And Release To Fulfillment.`
            : `Order #${short} ($${totalStr}) - Agent Approved (${fulfillmentMsg}). Auto-Approved on Credit Line.`,
          type: 'system',
          url: `/admin/orders?status=${finalAutoStatus}`,
        }));
        await supabase.from('notifications').insert(notifications);
      }
    } catch (err) {
      console.error('Failed to notify admins of pending approval', err);
    }

    return NextResponse.json({ success: true, status: finalAutoStatus });
      },
    });
  } catch (error) {
    console.error('Agent Order Approve API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
