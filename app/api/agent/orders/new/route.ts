import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { computeAgentCostForAgent, computeSubAgentBaselineCost, type AgentTier } from '@/lib/pricing';
import { assertSameOrigin } from '@/lib/csrf';
import { withIdempotency, readIdempotencyKey } from '@/lib/idempotency';
import { ManualOrderInputSchema } from '@/lib/schemas/order';

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAgent();
  if (!gate.ok) return gate.response;
  const agentId = gate.user.id;

  const rawBody: unknown = await req.json().catch(() => ({}));

  // Schema-locked body: quantities are bounded ints (1..10,000, matching
  // checkout), paymentMethod is the shared enum, buyer/address strings are
  // length-capped, and shippingCost must be a finite 0..1000 number. Prices
  // are still NEVER taken from the client -- the subtotal is recomputed from
  // the agent's catalog below.
  const validation = ManualOrderInputSchema.safeParse(rawBody);
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid Order Data.', details: validation.error.issues },
      { status: 400 }
    );
  }
  const body = validation.data;

  return withIdempotency({
    userId: agentId,
    route: '/api/agent/orders/new',
    key: readIdempotencyKey(req),
    request: body,
    handler: async () => {
  try {
    const supabase = createAdminClient();
    const { buyerName, buyerEmail, street, city, state, zip, items, subtotal: clientSubtotal, shippingCost, paymentMethod, fulfillmentMethod } = body;

    // Agent-entered shipping for a manual order. This is agent-authenticated
    // (not a researcher-facing exploit), but a typo or bad value should never
    // create an absurd charge, so clamp to a sane range and round to cents.
    const safeShipping = Math.min(1000, Math.max(0, Math.round((Number(shippingCost) || 0) * 100) / 100));
    const fulfillment = fulfillmentMethod === 'agent_pickup' ? 'agent_pickup' : 'ship';

    const { data: agentProfile, error: agentProfileError } = await supabase.from('profiles').select('tier, parent_agent_id, role, is_sub_agent, account_type, max_auto_approve_limit').eq('id', agentId).maybeSingle();
    if (agentProfileError || !agentProfile) return NextResponse.json({ error: 'Agent Profile Not Found.' }, { status: 404 });

    if ((agentProfile as { is_sub_agent?: boolean | null }).is_sub_agent === true) {
      return NextResponse.json(
        { error: 'Sub-Agents Cannot Create Manual Orders. Ask Your Agent To Place The Order.' },
        { status: 403 },
      );
    }

    const tier = (agentProfile.tier as AgentTier | null) ?? 'tier_3';
    const parentAgentId = agentProfile.parent_agent_id || null;

    const agentProductIds = items.map(i => i.agent_product_id).filter((v): v is string => typeof v === 'string');
    const fallbackProductIds = items.map(i => i.product_id).filter((v): v is string => typeof v === 'string');

    const baseQuery = supabase.from('agent_products').select('id, product_id, retail_price, products:product_id(name)').eq('agent_id', agentId);
    const { data: agentProducts, error: agentProductsError } = agentProductIds.length > 0
      ? await baseQuery.in('id', agentProductIds)
      : await baseQuery.in('product_id', fallbackProductIds);

    if (agentProductsError || !agentProducts) return NextResponse.json({ error: 'Failed To Resolve Catalog Pricing.' }, { status: 500 });

    const byId = new Map<string, { id: string; product_id: string; retail_price: number; product_name: string }>();
    const byProductId = new Map<string, { id: string; product_id: string; retail_price: number; product_name: string }>();
    for (const ap of agentProducts) {
      if (!ap.product_id) continue;
      const prod = Array.isArray((ap as any).products) ? (ap as any).products[0] : (ap as any).products;
      const row = { id: ap.id as string, product_id: ap.product_id as string, retail_price: Number(ap.retail_price) || 0, product_name: prod?.name || 'Unknown Product' };
      byId.set(row.id, row);
      byProductId.set(row.product_id, row);
    }

    let computedSubtotal = 0;
    const orderItems: Array<{ product_id: string; product_name: string; agent_product_id: string; quantity: number; unit_retail_price: number; unit_cost_price: number; unit_super_agent_cost: number | null; }> = [];

    for (const raw of items) {
      const rawQty = Number(raw.quantity);
      if (!Number.isFinite(rawQty) || rawQty < 1) {
        return NextResponse.json({ error: 'Each Item Must Have A Quantity Of At Least 1.' }, { status: 400 });
      }
      const qty = Math.floor(rawQty);
      const ap = (raw.agent_product_id && byId.get(raw.agent_product_id)) || (raw.product_id && byProductId.get(raw.product_id)) || null;
      if (!ap) return NextResponse.json({ error: 'One Or More Items Are Not In Your Catalog.' }, { status: 400 });

      const unitRetail = (Number(ap.retail_price) || 0) / 10;
      computedSubtotal += unitRetail * qty;
      const unitCost = (await computeAgentCostForAgent(supabase, ap.product_id, agentId, tier)) / 10;
      const unitSuperAgentCost = parentAgentId
        ? (await computeSubAgentBaselineCost(supabase, ap.product_id, parentAgentId)) / 10
        : null;
      orderItems.push({ product_id: ap.product_id, product_name: ap.product_name, agent_product_id: ap.id, quantity: qty, unit_retail_price: unitRetail, unit_cost_price: unitCost, unit_super_agent_cost: unitSuperAgentCost });
    }

    computedSubtotal = Math.round(computedSubtotal * 100) / 100;

    if (clientSubtotal != null) {
      const provided = Math.round((Number(clientSubtotal) || 0) * 100) / 100;
      if (Math.abs(provided - computedSubtotal) > 0.01) return NextResponse.json({ error: 'Order Total Does Not Match Catalog Pricing. Refresh The Order Form And Try Again.' }, { status: 422 });
    }

    const computedTotal = Math.round((computedSubtotal + safeShipping) * 100) / 100;

    const { data: newOrder, error: orderError } = await supabase.from('orders').insert({
      agent_id: agentId, buyer_id: null, status: 'agent_approval_pending',
      fulfillment_method: fulfillment, payment_method: paymentMethod || 'zelle',
      subtotal: computedSubtotal, shipping_cost: safeShipping, total: computedTotal,
      shipping_address: fulfillment === 'ship' ? { fullName: buyerName || '', street1: street || '', city: city || '', state: state || '', zip: zip || '', country: 'US' } : null,
      buyer_name: buyerName ?? null, buyer_email: buyerEmail ?? null,
    }).select('id').maybeSingle();

    if (orderError || !newOrder) {
      console.error('Manual Order Insert Error:', orderError);
      return NextResponse.json({ error: 'Failed To Create Manual Order.' }, { status: 500 });
    }

    const itemsPayload = orderItems.map(item => ({
      order_id: newOrder.id, product_id: item.product_id, product_name: item.product_name,
      agent_product_id: item.agent_product_id, quantity: item.quantity,
      unit_retail_price: item.unit_retail_price, unit_cost_price: item.unit_cost_price,
      unit_super_agent_cost: item.unit_super_agent_cost,
    }));

    const { error: itemsError } = await supabase.from('order_items').insert(itemsPayload);
    if (itemsError) {
      console.error('Manual Order Items Error:', itemsError);
      const { error: cleanupErr } = await supabase.from('orders').delete().eq('id', newOrder.id);
      if (cleanupErr) console.error('[CRITICAL] Orphan order cleanup failed:', newOrder.id, cleanupErr.message);
      return NextResponse.json({ error: 'Failed To Add Items To Order.' }, { status: 500 });
    }

    let prepaidCharged = false;
    const manualCogs = Math.round(
      (orderItems.reduce((s, it) => s + (Number(it.unit_cost_price) || 0) * it.quantity, 0) + safeShipping) * 100
    ) / 100;
    if (agentProfile.account_type === 'prepaid' && manualCogs > 0) {
      const { data: balRow } = await supabase.from('profiles').select('prepaid_balance').eq('id', agentId).maybeSingle();
      const balance = Number(balRow?.prepaid_balance) || 0;
      if (balance < manualCogs) {
        await supabase.from('order_items').delete().eq('order_id', newOrder.id);
        await supabase.from('orders').delete().eq('id', newOrder.id);
        return NextResponse.json({ error: `Insufficient Prepaid Balance. Requires $${manualCogs.toFixed(2)}, But Balance Is $${balance.toFixed(2)}. Please Recharge Your Account.` }, { status: 402 });
      }
      const { data: deductOk, error: deductErr } = await supabase.rpc('deduct_prepaid_balance', { agent_id: agentId, amount: manualCogs });
      if (deductErr || !deductOk) {
        await supabase.from('order_items').delete().eq('order_id', newOrder.id);
        await supabase.from('orders').delete().eq('id', newOrder.id);
        return NextResponse.json({ error: 'Failed To Deduct Prepaid Balance. Please Try Again.' }, { status: 500 });
      }
      prepaidCharged = true;
      await supabase.from('balance_transactions').insert({
        agent_id: agentId, type: 'order_charge', amount: manualCogs,
        balance_before: balance, balance_after: Math.round((balance - manualCogs) * 100) / 100,
        description: `Charge For Manual Order ${newOrder.id}`, reference_id: newOrder.id, reference_type: 'order', created_by: agentId,
      });
    }

    const limit = agentProfile.max_auto_approve_limit !== undefined && agentProfile.max_auto_approve_limit !== null ? Number(agentProfile.max_auto_approve_limit) : Infinity;
    const isUnderLimit = computedTotal <= limit;
    const finalAutoStatus = (agentProfile.account_type === 'credit' && isUnderLimit)
      ? (fulfillment === 'ship' ? 'approved_ship' : 'approved_pickup')
      : 'admin_approval_pending';

    const { error: approvalError } = await supabase.from('orders').update({
      status: finalAutoStatus, agent_approved_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', newOrder.id);

    if (approvalError) {
      console.error('Manual Order Approval Error:', approvalError);
      if (prepaidCharged) {
        try {
          await supabase.rpc('refund_prepaid_balance', { p_agent_id: agentId, p_amount: manualCogs });
        } catch (refundErr) {
          console.error('[CRITICAL] prepaid refund failed after manual order approval failure', newOrder.id, refundErr);
        }
      }
      await supabase.from('order_items').delete().eq('order_id', newOrder.id);
      await supabase.from('orders').delete().eq('id', newOrder.id);
      const message = approvalError.code === '23514' || /insufficient/i.test(approvalError.message) ? approvalError.message : 'Insufficient Inventory To Approve Manual Order.';
      return NextResponse.json({ error: message }, { status: 422 });
    }

    if (finalAutoStatus === 'approved_ship' || finalAutoStatus === 'approved_pickup') {
      const { error: creditErr } = await supabase.rpc('charge_order_credit_line', { p_order_id: newOrder.id, p_created_by: agentId });
      if (creditErr) {
        console.error('[CRITICAL] charge_order_credit_line Failed For Manual Order', newOrder.id, creditErr);
      }
    }

    try {
      const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'admin');
      if (admins && admins.length > 0) {
        const short = newOrder.id.slice(0, 8).toUpperCase();
        const totalStr = Number(computedTotal).toFixed(2);
        const fulfillmentMsg = fulfillment === 'ship' ? 'Ready For Shipping' : 'Ready For Agent Pickup';
        const notifications = admins.map((admin) => ({
          user_id: admin.id,
          title: finalAutoStatus === 'admin_approval_pending' ? 'Manual Order Needs Admin Approval' : 'Manual Order Auto-Approved',
          body: finalAutoStatus === 'admin_approval_pending'
            ? `Order #${short} ($${totalStr}) - Agent Created & Approved. Needs Admin Release (${fulfillmentMsg}).`
            : `Order #${short} ($${totalStr}) - Agent Created & Auto-Approved On Credit Line. (${fulfillmentMsg}).`,
          type: 'system',
          url: `/admin/orders?status=${finalAutoStatus}`,
        }));
        await supabase.from('notifications').insert(notifications);
      }
    } catch (err) {
      console.error('Failed to notify admins of manual order', err);
    }

    return NextResponse.json({ success: true, orderId: newOrder.id });
  } catch (error) {
    console.error('Manual Order API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
    }
  });
}
