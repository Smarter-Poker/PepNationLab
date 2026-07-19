import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { pickOne } from '@/lib/relations';
import { computeAgentCostForAgent, type AgentTier } from '@/lib/pricing';
import { enqueueWebhook, fetchOrderForWebhook } from '@/lib/webhook-dispatch';
import { assertSameOrigin } from '@/lib/csrf';
import { withIdempotency, readIdempotencyKey } from '@/lib/idempotency';
import { shortOrderId, enqueueOrderPush } from '@/lib/push-enqueue';
import { assertChainCanTransact } from '@/lib/billing-chain';
import { captureError } from '@/lib/sentry';
import { logError } from '@/lib/log';
import { notifyOrderApproved, notifyOrderCancelled, notifyOrderAwaitingApproval, notifyAdmins } from '@/lib/notify';
import { emailConfigured, sendOrderApprovedEmail, sendOrderCancelledEmail } from '@/lib/email';
import { logOrderEvent } from '@/lib/order-events';

/**
 * Resolve a buyer's best deliverable email: verified contact email first,
 * auth email (already verified by the login flow) as fallback. Never throws.
 */
async function resolveBuyerEmail(
  supabase: ReturnType<typeof createAdminClient>,
  buyerId: string,
): Promise<{ email: string | null; fullName: string | null }> {
  try {
    const { data: prof } = await supabase
      .from('profiles')
      .select('contact_email, email_verified, full_name')
      .eq('id', buyerId)
      .maybeSingle();
    if (prof?.contact_email && prof.email_verified) {
      return { email: prof.contact_email, fullName: prof.full_name ?? null };
    }
    return { email: null, fullName: prof?.full_name ?? null };
  } catch {
    return { email: null, fullName: null };
  }
}

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
      .select('*, order_items(product_id, product_name, quantity, unit_cost_price, unit_super_agent_cost, fulfilled_locally), profiles!orders_agent_id_fkey(parent_agent_id, is_manufacturer)')
      .eq('id', orderId)
      .maybeSingle();

    if (orderError || !order) return NextResponse.json({ error: 'Order Not Found' }, { status: 404 });

    const orderAgentProfile = pickOne<{ parent_agent_id: string | null; is_manufacturer: boolean | null }>(order.profiles);
    const orderAgentParentId = orderAgentProfile?.parent_agent_id ?? null;
    const orderAgentIsManufacturer = orderAgentProfile?.is_manufacturer === true;

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
      // A cancel used to be silent for the buyer -- tell every party.
      try {
        const short = shortOrderId(orderId);
        await logOrderEvent(supabase, {
          orderId,
          event: 'cancelled',
          actorId: callerId,
          actorRole: 'agent',
          payload: { reason: 'Cancelled By Agent' },
        });
        if (order.buyer_id) {
          // notifyOrderCancelled handles both the in-app row and the push
          // (event order_cancelled) through the unified pipeline.
          await notifyOrderCancelled(supabase, order.buyer_id, orderId, short);
          if (emailConfigured()) {
            const buyer = await resolveBuyerEmail(supabase, order.buyer_id);
            if (buyer.email) {
              await sendOrderCancelledEmail({ to: buyer.email, fullName: buyer.fullName, orderId }).catch(() => {});
            }
          }
        }
        await notifyAdmins(supabase, {
          title: `Order #${short} Cancelled By Agent`,
          body: `Order #${short} ($${Number(order.total || 0).toFixed(2)}) Was Cancelled By Its Agent.`,
          url: `/admin/orders?highlight=${orderId}`,
          skipUserIds: [callerId],
        });
      } catch { /* notifications must not break the cancel */ }
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
      // The handoff used to be silent -- the super agent never knew an order
      // was sitting in their queue. Alert them (in-app + push) immediately.
      try {
        const short = shortOrderId(orderId);
        const totalFmt = `$${Number(order.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        if (orderAgentParentId) {
          await notifyOrderAwaitingApproval(supabase, orderAgentParentId, orderId, short, totalFmt);
        }
        await logOrderEvent(supabase, {
          orderId,
          event: 'forwarded_to_super',
          actorId: callerId,
          actorRole: 'agent',
          payload: { forwarded_to: orderAgentParentId },
        });
      } catch { /* notifications must not break the forward */ }
      return NextResponse.json({ success: true, status: finalStatus });
    }

    // MANUFACTURER ORDERS (2026-07-15): the store owner IS the factory/supplier.
    // They are never charged COGS or shipping to approve their own order -- the
    // researcher pays them directly and they remit the platform's commission via
    // manufacturer_ledger (recorded at checkout). Their stock is factory /
    // China-fulfilled and is not tracked in agent_inventory, so the on-hand
    // availability check and the prepaid/credit billing below do not apply.
    // Approving simply confirms fulfillment and moves the order to
    // approved_ship / approved_pickup. The manufacturer adds their own carrier
    // tracking via tracking_number; no platform (EasyPost) label is enqueued.
    if (orderAgentIsManufacturer) {
      const manuFinal = order.fulfillment_method === 'agent_pickup' ? 'approved_pickup' : 'approved_ship';
      const manuPayload: Record<string, string> = {
        status: manuFinal,
        agent_approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (tracking_number && typeof tracking_number === 'string') manuPayload.tracking_number = tracking_number;
      const { data: manuClaimed, error: manuErr } = await supabase
        .from('orders')
        .update(manuPayload)
        .eq('id', orderId)
        .in('status', ['pending_customer_payment', 'agent_approval_pending'])
        .select('id');
      if (manuErr) {
        logError('agent.orders.approve.manufacturer_claim', { orderId, agentId: order.agent_id }, manuErr);
        captureError(manuErr, { context: 'agent.orders.approve.manufacturer_claim', orderId });
        return NextResponse.json({ error: 'Failed To Update Order Status' }, { status: 500 });
      }
      if (!manuClaimed || manuClaimed.length === 0) {
        return NextResponse.json({ error: 'Order Was Already Processed. Please Refresh To See Its Current Status.' }, { status: 409 });
      }
      // Tell the buyer their order is approved (in-app + push + email).
      try {
        const short = shortOrderId(orderId);
        if (order.buyer_id) {
          await notifyOrderApproved(supabase, order.buyer_id, orderId, short);
          await enqueueOrderPush(supabase, { userId: order.buyer_id, orderId, event: 'order_approved' });
          if (emailConfigured()) {
            const buyer = await resolveBuyerEmail(supabase, order.buyer_id);
            if (buyer.email) {
              await sendOrderApprovedEmail({ to: buyer.email, fullName: buyer.fullName, orderId, pickup: manuFinal === 'approved_pickup' }).catch(() => {});
            }
          }
        }
        await logOrderEvent(supabase, {
          orderId,
          event: 'approved',
          actorId: callerId,
          actorRole: 'manufacturer',
          payload: { status: manuFinal },
        });
      } catch { /* notifications must not break the approval */ }
      return NextResponse.json({ success: true, status: manuFinal });
    }

    const primaryBilledAgentId = orderAgentParentId || order.agent_id;
    const isSubAgentOrder = !!orderAgentParentId && primaryBilledAgentId !== order.agent_id;

    interface OrderItem {
      quantity?: number;
      product_id?: string;
      product_name?: string;
      unit_cost_price?: number;
      unit_super_agent_cost?: number;
      fulfilled_locally?: boolean;
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
      .eq('id', primaryBilledAgentId).maybeSingle();

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
      const itemsToCheck = items.filter((item) => {
        if (!item.product_id) return false;
        const qtyRequired = Number(item.quantity) || 0;
        if (qtyRequired <= 0) return false;
        // Mirror the DB trigger's H10 guard: when the order was reserved at
        // checkout, reserve_inventory ALREADY deducted agent_inventory for
        // locally fulfilled lines, so re-checking on-hand stock here would
        // falsely block a fully reserved order.
        if (order.inventory_reserved === true && item.fulfilled_locally === true) return false;
        return true;
      });
      if (itemsToCheck.length > 0) {
        const productIds = Array.from(new Set(itemsToCheck.map((item) => item.product_id as string)));
        const { data: invRows } = await supabase
          .from('agent_inventory')
          .select('product_id, stock_count')
          .eq('agent_id', order.agent_id)
          .in('product_id', productIds);
        const stockByProduct = new Map<string, number>();
        for (const inv of (invRows ?? []) as Array<{ product_id: string; stock_count: number | null }>) {
          stockByProduct.set(inv.product_id, Number(inv.stock_count) || 0);
        }
        for (const item of itemsToCheck) {
          const qtyRequired = Number(item.quantity) || 0;
          const currentStock = stockByProduct.get(item.product_id as string) ?? 0;
          if (currentStock < qtyRequired) {
            return NextResponse.json({
              error: `Insufficient Inventory For "${item.product_name}". You Need ${qtyRequired} Units, But Only Have ${currentStock} In Stock. Please Purchase More Bulk Inventory Before Approving This Order.`
            }, { status: 400 });
          }
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
      const { data: deductSuccess, error: deductError } = await supabase.rpc('deduct_prepaid_balance', { agent_id: primaryBilledAgentId, amount: totalOwed });
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

    // The prepaid-charge ledger row is written atomically inside the
    // deduct_prepaid_balance RPC; a second manual balance_transactions insert
    // here double-recorded every prepaid order charge in the wallet ledger.

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

    // Post-approval fan-out: buyer (previously NEVER notified on the agent
    // approval path), admins (in-app + push), and the order timeline.
    try {
      const short = shortOrderId(orderId);
      const totalStr = Number(totalOwed).toFixed(2);
      const fulfillmentMsg = order.fulfillment_method === 'agent_pickup' ? 'For Pickup' : 'For Shipping';

      if (effectiveStatus === 'approved_ship' || effectiveStatus === 'approved_pickup') {
        if (order.buyer_id) {
          await notifyOrderApproved(supabase, order.buyer_id, orderId, short);
          await enqueueOrderPush(supabase, { userId: order.buyer_id, orderId, event: 'order_approved' });
          if (emailConfigured()) {
            const buyer = await resolveBuyerEmail(supabase, order.buyer_id);
            if (buyer.email) {
              await sendOrderApprovedEmail({ to: buyer.email, fullName: buyer.fullName, orderId, pickup: effectiveStatus === 'approved_pickup' }).catch(() => {});
            }
          }
        }
        await logOrderEvent(supabase, {
          orderId,
          event: 'approved',
          actorId: callerId,
          actorRole: 'agent',
          payload: { status: effectiveStatus, total_owed: totalOwed },
        });
      } else if (effectiveStatus === 'admin_approval_pending') {
        await logOrderEvent(supabase, {
          orderId,
          event: 'demoted_admin_review',
          actorId: callerId,
          actorRole: 'agent',
          payload: { total_owed: totalOwed },
        });
      }

      await notifyAdmins(supabase, {
        type: 'order_attention',
        title: effectiveStatus === 'admin_approval_pending' ? 'Order Needs Admin Approval' : 'Order Auto-Approved',
        body: effectiveStatus === 'admin_approval_pending'
          ? `Order #${short} ($${totalStr}) - Agent Approved (${fulfillmentMsg}). Review And Release To Fulfillment.`
          : `Order #${short} ($${totalStr}) - Agent Approved (${fulfillmentMsg}). Auto-Approved On Credit Line.`,
        url: `/admin/orders?status=${effectiveStatus}`,
      });
    } catch (err) {
      console.error('Failed to send post-approval notifications', err);
    }

    return NextResponse.json({ success: true, status: effectiveStatus });
      },
    });
  } catch (error) {
    console.error('Agent Order Approve API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
