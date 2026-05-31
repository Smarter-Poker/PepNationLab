import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { computeAgentCost, computeSubAgentBaselineCost, type AgentTier } from '@/lib/pricing';
import { assertSameOrigin } from '@/lib/csrf';

interface ManualOrderItemInput {
  product_id?: string;
  agent_product_id?: string;
  quantity?: number;
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  try {
    const gate = await requireAgent();
    if (!gate.ok) return gate.response;

    const supabase = await createServiceClient();
    const agentId = gate.user.id;

    const body = await req.json();
    const { buyerName, buyerEmail, street, city, state, zip, items, subtotal: clientSubtotal, shippingCost, paymentMethod, fulfillmentMethod } = body as {
      buyerName?: string; buyerEmail?: string; street?: string; city?: string; state?: string; zip?: string;
      items?: ManualOrderItemInput[]; subtotal?: number; shippingCost?: number; paymentMethod?: string; fulfillmentMethod?: string;
    };

    if (!Array.isArray(items) || items.length === 0) return NextResponse.json({ error: 'Order Must Contain Items.' }, { status: 400 });

    const safeShipping = Number(shippingCost) || 0;
    const fulfillment = fulfillmentMethod === 'agent_pickup' ? 'agent_pickup' : 'ship';

    const { data: agentProfile, error: agentProfileError } = await supabase.from('profiles').select('tier, parent_agent_id, role, is_sub_agent').eq('id', agentId).single();
    if (agentProfileError || !agentProfile) return NextResponse.json({ error: 'Agent Profile Not Found.' }, { status: 404 });

    // SACA: sub-agents do not own a storefront and therefore cannot create
    // manual orders. They can only earn commission on orders placed via the
    // parent's storefront — manual order creation belongs to the storefront
    // owner. Reject with a clear error instead of silently failing on the
    // empty agent_products query below.
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
      // BUG-9 FIX: Math.max(1, ...) was silently promoting qty=0 to qty=1,
      // and the if (qty <= 0) continue below was dead/unreachable code.
      // Validate quantity >= 1 first, then floor for float safety.
      const rawQty = Number(raw.quantity);
      if (!Number.isFinite(rawQty) || rawQty < 1) {
        return NextResponse.json({ error: 'Each item must have a quantity of at least 1.' }, { status: 400 });
      }
      const qty = Math.floor(rawQty);
      const ap = (raw.agent_product_id && byId.get(raw.agent_product_id)) || (raw.product_id && byProductId.get(raw.product_id)) || null;
      if (!ap) return NextResponse.json({ error: 'One Or More Items Are Not In Your Catalog.' }, { status: 400 });

      // retail_price is stored as a 10-pack price; divide by 10 for per-vial unit price.
      // Quantity is the number of individual vials (consistent with storefront orders model).
      const unitRetail = (Number(ap.retail_price) || 0) / 10;
      computedSubtotal += unitRetail * qty;
      // computeAgentCost / computeSubAgentBaselineCost return per-10-vial-pack costs.
      // Divide by 10 to get per-vial cost, consistent with the per-vial unit_retail_price
      // and per-vial quantity stored in order_items (same model as orders/route.ts).
      const unitCost = (await computeAgentCost(supabase, ap.product_id, tier)) / 10;
      const unitSuperAgentCost = parentAgentId
        ? (await computeSubAgentBaselineCost(supabase, ap.product_id, parentAgentId)) / 10
        : null;
      orderItems.push({ product_id: ap.product_id, product_name: ap.product_name, agent_product_id: ap.id, quantity: qty, unit_retail_price: unitRetail, unit_cost_price: unitCost, unit_super_agent_cost: unitSuperAgentCost });
    }

    // BUG-10 FIX: round BEFORE the mismatch check, not after.
    // Floating-point accumulation across many items can make the pre-round value
    // differ enough from the post-round value to cause spurious 422 rejections.
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
      shipping_address: fulfillment === 'ship' ? { street, city, state, zipCode: zip, country: 'US' } : null,
      buyer_name: buyerName ?? null, buyer_email: buyerEmail ?? null,
    }).select('id').single();

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
      // BUG-19 FIX: log rollback errors instead of silently ignoring them.
      const { error: cleanupErr } = await supabase.from('orders').delete().eq('id', newOrder.id);
      if (cleanupErr) console.error('[CRITICAL] Orphan order cleanup failed:', newOrder.id, cleanupErr.message);
      return NextResponse.json({ error: 'Failed To Add Items To Order.' }, { status: 500 });
    }

    const approvedStatus = fulfillment === 'ship' ? 'approved_ship' : 'approved_pickup';
    const { error: approvalError } = await supabase.from('orders').update({
      status: approvedStatus, agent_approved_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', newOrder.id);

    if (approvalError) {
      console.error('Manual Order Approval Error:', approvalError);
      await supabase.from('order_items').delete().eq('order_id', newOrder.id);
      await supabase.from('orders').delete().eq('id', newOrder.id);
      const message = approvalError.code === '23514' || /insufficient/i.test(approvalError.message) ? approvalError.message : 'Insufficient Inventory To Approve Manual Order.';
      return NextResponse.json({ error: message }, { status: 422 });
    }

    // Notify Admins that the manual order is approved and ready
    try {
      const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'admin');
      if (admins && admins.length > 0) {
        const short = newOrder.id.slice(0, 8).toUpperCase();
        const totalStr = Number(computedTotal).toFixed(2);
        const fulfillmentMsg = approvedStatus === 'approved_pickup' ? 'Ready for Agent Pickup' : 'Ready for Shipping';
        const notifications = admins.map((admin) => ({
          user_id: admin.id,
          title: 'Manual Order Ready',
          body: `Order #${short} ($${totalStr}) — Agent Created & Approved. ${fulfillmentMsg}.`,
          type: 'system',
          url: `/admin/orders?status=${approvedStatus}`,
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
