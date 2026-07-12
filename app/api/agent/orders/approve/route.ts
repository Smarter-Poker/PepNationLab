// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { pickOne } from '@/lib/relations';
import { computeAgentCostForAgent, type AgentTier } from '@/lib/pricing';
import { enqueueWebhook, fetchOrderForWebhook } from '@/lib/webhook-dispatch';
import { assertSameOrigin } from '@/lib/csrf';
import { withIdempotency, readIdempotencyKey } from '@/lib/idempotency';
import { shortOrderId } from '@/lib/push-enqueue';
import { assertChainCanTransact } from '@/lib/billing-chain';
import { captureError } from '@/lib/sentry';
import { logError } from '@/lib/log';

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  try {
    const gate = await requireAgent();
    if (!gate.ok) return gate.response;

    const supabase = createAdminClient();
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
      .maybeSingle();

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
    const { data: billedProfile } = await supabase.from('profiles').select('tier').eq('id', primaryBilledAgentId).maybeSingle(); // @ts-ignore
    billedAgentTier = (billedProfile?.tier as AgentTier | null) ?? 'tier_3';

    for (const item of items) {
      const qty = Number(item.quantity) || 0;
      if (qty <= 0) continue;
      if (isSubAgentOrder) {
        const stored = Number(item.unit_super_agent_cost);
        if (Number.isFinite(stored) && stored >= 0) totalCogs += stored * qty;
        else if (item.product_id) totalCogs += (await computeAgentCostForAgent(supabase, item.product_id, primaryBilledAgentId, billedAgentTier) / 10) * qty; // @ts-ignore
      } else {
        const stored = Number(item.unit_cost_price);
        if (Number.isFinite(stored) && stored >= 0) totalCogs += stored * qty;
        else if (item.product_id) totalCogs += (await computeAgentCostForAgent(supabase, item.product_id, primaryBilledAgentId, billedAgentTier) / 10) * qty; // @ts-ignore
      }
    }

    const shippingCost = Number(order.shipping_cost) || 0;
    const totalOwed = totalCogs + shippingCost;

    const { data: primaryProfile, error: profileError } = await supabase
      .from('profiles').select('account_type, prepaid_balance, credit_limit')
      .eq('id', primaryBilledAgentId).maybeSingle(); // @ts-ignore

    if (profileError || !primaryProfile) return NextResponse.json({ error: 'Failed To Retrieve Billing Profile' }, { status: 500 });

    const chainCheck = await assertChainCanTransact(
      supabase,
      primaryBilledAgentId, // @ts-ignore
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

    // ATOMIC CLAIM (compare-and-swap) BEFORE any money movement. Two
    // concurrent approvals (agent on two devices, or agent + super-agent)
    // could both pass the status read above and double-deduct the prepaid
    // balance. The .in('status', ...) guard means exactly one request wins
    // the transition; the loser gets a clean 409 and moves no money.
    const finalAutoStatus = primaryProfile.account_type === 'credit' ? finalStatus : 'admin_approval_pending';
    const updatePayload: Record<string, string> = { status: finalAutoStatus, agent_approved_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    if (tracking_number && typeof tracking_number === 'string') updatePayload.tracking_number = tracking_number;

    const { data: claimedRows, error: updateError } = await supabase
      .from('orders')
      .update(updatePayload)
      .eq('id', orderId)
      .in('status', ['pending_customer_payment', 'agent_approval_pending'])
      .select('id');
    if (updateError) {
      logError('agent.orders.approve.claim_update', { orderId, agentId: primaryBilledAgentId }, updateError);
      captureError(updateError, { context: 'agent.orders.approve.claim_update', orderId });
      return NextResponse.json({ error: 'Failed To Update Order Status' }, { status: 500 });
    }
    if (!claimedRows || claimedRows.length === 0) {
      return NextResponse.json({ error: 'Order Was Already Processed. Please Refresh To See Its Current Status.' }, { status: 409 });
    }

    let prepaidDeducted = false;
    let oldBalance = 0;
    if (primaryProfile.account_type === 'prepaid') {
      oldBalance = Number(primaryProfile.prepaid_balance) || 0;
      const { data: deductSuccess, error: deductError } = await supabase.rpc('deduct_prepaid_balance', { agent_id: primaryBilledAgentId, amount: totalOwed }); // @ts-ignore
      if (deductError || !deductSuccess) {
        // Money did not move -- release the claim so the agent can retry.
        const { error: revertErr } = await supabase
          .from('orders')
          .update({ status: order.status, agent_approved_at: null as unknown as string, updated_at: new Date().toISOString() })
          .eq('id', orderId);
        if (revertErr) {
          captureError(revertErr, { context: 'agent.orders.approve.claim_revert_failed', severity: 'critical', orderId, previousStatus: order.status });
        }
        if (deductError) {
          logError('agent.orders.approve.deduct_prepaid', { orderId, agentId: primaryBilledAgentId, amount: totalOwed }, deductError);
          captureError(deductError, { context: 'agent.orders.approve.deduct_prepaid', orderId, agentId: primaryBilledAgentId, amount: totalOwed });
        }
        return NextResponse.json({ error: 'Failed To Deduct Balance. Please Try Again.' }, { status: 500 });
      }
      prepaidDeducted = true;
    }

    if (prepaidDeducted) {
      const newBalance = oldBalance - totalOwed;
      const { error: txError } = await supabase.from('balance_transactions').insert({
        agent_id: primaryBilledAgentId, type: 'order_charge', amount: totalOwed, // @ts-ignore
        balance_before: oldBalance, balance_after: newBalance,
        description: `Charge for Order ${orderId}`, reference_id: orderId, reference_type: 'order', created_by: callerId
      });
      if (txError) {
        console.error('[CRITICAL] balance_transactions insert failed after prepaid deduction', {
          orderId, agentId: primaryBilledAgentId, amount: totalOwed, error: txError.message
        });
        captureError(txError, { context: 'agent.orders.approve.ledger_insert', severity: 'critical', orderId, agentId: primaryBilledAgentId, amount: totalOwed });
      }
    }

    let effectiveStatus = finalAutoStatus;
    if (finalAutoStatus === 'approved_ship' || finalAutoStatus === 'approved_pickup') {
      // supabase-js returns RPC failures in { error } -- it does NOT throw.
      // The previous try/catch here never fired, so a failed credit charge
      // silently shipped unbilled goods.
      const { error: creditErr } = await supabase.rpc('charge_order_credit_line', { p_order_id: orderId, p_created_by: callerId });
      if (creditErr) {
        effectiveStatus = 'admin_approval_pending';
        logError('agent.orders.approve.charge_order_credit_line', { orderId, agentId: primaryBilledAgentId }, creditErr);
        captureError(creditErr, { context: 'agent.orders.approve.charge_order_credit_line', severity: 'critical', orderId, agentId: primaryBilledAgentId });
        // Do not leave the order shippable with no billing row -- demote to
        // manual admin review, mirroring app/api/orders/route.ts.
        const { error: demoteErr } = await supabase
          .from('orders')
          .update({ status: 'admin_approval_pending', updated_at: new Date().toISOString() })
          .eq('id', orderId);
        if (demoteErr) {
          captureError(demoteErr, { context: 'agent.orders.approve.charge_credit_demotion_failed', severity: 'critical', orderId });
        }
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
          title: effectiveStatus === 'admin_approval_pending' ? 'Order Needs Admin Approval' : 'Order Auto-Approved',
          body: effectiveStatus === 'admin_approval_pending'
            ? `Order #${short} ($${totalStr}) - Agent Approved (${fulfillmentMsg}). Review And Release To Fulfillment.`
            : `Order #${short} ($${totalStr}) - Agent Approved (${fulfillmentMsg}). Auto-Approved on Credit Line.`,
          type: 'system',
          url: `/admin/orders?status=${effectiveStatus}`,
        }));
        await supabase.from('notifications').insert(notifications);
      }
    } catch (err) {
      console.error('Failed to notify admins of pending approval', err);
    }

    return NextResponse.json({ success: true, status: effectiveStatus });
      },
    });
  } catch (error) {
    console.error('Agent Order Approve API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
