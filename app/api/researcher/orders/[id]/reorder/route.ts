import { NextResponse, type NextRequest } from 'next/server';
import crypto from 'node:crypto';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { rateLimit } from '@/lib/rate-limit';

/**
 * Researcher Reorder.
 *
 * Clones a prior order into a new pending order for the same buyer + agent.
 * Prices are re-resolved from the current `agent_products` row - we do NOT
 * trust the previous unit price because the agent may have repriced since.
 * Items whose product has been banned, removed from the catalog, or hidden
 * from the agent's storefront are dropped and returned in `skipped[]`.
 *
 * The new order lands in `pending_customer_payment` state with the same
 * shipping address and payment method copied across; the buyer can then
 * adjust before sending payment.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Invalid Order Id.' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  // Rate-limit reorders the same way checkout is limited: 10/min/user.
  const rl = await rateLimit({
    key: 'reorder_create',
    limit: 10,
    windowSeconds: 60,
    identifier: user.id,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too Many Requests. Please Wait And Try Again.' },
      { status: 429 }
    );
  }

  const service = await createServiceClient();

  // Ownership check.
  const { data: source, error: sourceErr } = await service
    .from('orders')
    .select('id, buyer_id, agent_id, fulfillment_method, payment_method, shipping_address, order_items(id, product_id, quantity)')
    .eq('id', id)
    .maybeSingle();

  if (sourceErr || !source) {
    return NextResponse.json({ error: 'Order Not Found.' }, { status: 404 });
  }
  if (source.buyer_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const sourceItems = (source.order_items ?? []) as Array<{ product_id: string; quantity: number }>;
  if (sourceItems.length === 0) {
    return NextResponse.json({ error: 'Original Order Has No Items.' }, { status: 400 });
  }

  // Fetch all involved products in one round-trip so we can flag banned ones.
  const productIds = Array.from(new Set(sourceItems.map((it) => it.product_id).filter(Boolean)));
  const { data: products } = await service
    .from('products')
    .select('id, name, base_cost, is_active, is_banned, inventory_count')
    .in('id', productIds);
  const productById = new Map((products ?? []).map((p) => [p.id, p]));

  // Pull the current agent_products pricing rows for this agent.
  let agentPriceMap = new Map<string, { agent_product_id: string; price: number; is_visible: boolean }>();
  if (source.agent_id) {
    const { data: agentProducts } = await service
      .from('agent_products')
      .select('id, product_id, retail_price, is_on_sale, sale_price, is_visible')
      .eq('agent_id', source.agent_id)
      .in('product_id', productIds);
    agentPriceMap = new Map(
      (agentProducts ?? []).map((row) => [
        row.product_id,
        {
          agent_product_id: row.id,
          price:
            row.is_on_sale && row.sale_price != null
              ? Number(row.sale_price)
              : Number(row.retail_price),
          is_visible: row.is_visible !== false,
        },
      ])
    );
  }

  const skipped: Array<{ product_name: string; reason: string }> = [];
  const computed: Array<{
    agent_product_id: string | null;
    product_id: string;
    product_name: string;
    quantity: number;
    unit_retail_price: number;
    unit_cost_price: number;
  }> = [];

  for (const it of sourceItems) {
    const product = productById.get(it.product_id);
    if (!product) {
      skipped.push({ product_name: 'Unknown Product', reason: 'No Longer In Catalog' });
      continue;
    }
    if (product.is_banned) {
      skipped.push({ product_name: product.name, reason: 'Product Banned' });
      continue;
    }
    if (!product.is_active) {
      skipped.push({ product_name: product.name, reason: 'Product Inactive' });
      continue;
    }

    const baseCost = Number(product.base_cost) || 0;
    const apMatch = source.agent_id ? agentPriceMap.get(it.product_id) : null;

    if (source.agent_id && !apMatch) {
      skipped.push({ product_name: product.name, reason: 'Not Sold By Agent' });
      continue;
    }
    if (apMatch && !apMatch.is_visible) {
      skipped.push({ product_name: product.name, reason: 'Hidden From Storefront' });
      continue;
    }

    // NOTE: retail_price / base_cost in DB are per-10-vial-pack, but order
    // quantity is number of individual vials. Divide by 10 → per-vial unit.
    const retailPrice = apMatch ? apMatch.price / 10 : baseCost / 10;
    computed.push({
      agent_product_id: apMatch ? apMatch.agent_product_id : null,
      product_id: it.product_id,
      product_name: product.name,
      quantity: it.quantity,
      unit_retail_price: retailPrice,
      unit_cost_price: baseCost / 10,
    });
  }

  if (computed.length === 0) {
    return NextResponse.json(
      { error: 'No Items From This Order Are Available For Reorder.', skipped },
      { status: 400 }
    );
  }

  const subtotal = computed.reduce((acc, it) => acc + it.unit_retail_price * it.quantity, 0);

  const idempotencyKey = crypto.randomUUID();

  const { data: newOrder, error: insertErr } = await service
    .from('orders')
    .insert({
      buyer_id: user.id,
      agent_id: source.agent_id,
      status: 'pending_customer_payment',
      fulfillment_method: source.fulfillment_method,
      payment_method: source.payment_method,
      shipping_address: source.shipping_address,
      shipping_cost: 0,
      subtotal,
      discount_amount: 0,
      coupon_code: null,
      total: subtotal,
      idempotency_key: idempotencyKey,
    })
    .select('id, total')
    .single();

  if (insertErr || !newOrder) {
    // eslint-disable-next-line no-console
    console.error('[reorder] order insert failed', insertErr);
    return NextResponse.json({ error: 'Failed To Create Reorder.' }, { status: 500 });
  }

  const itemsToInsert = computed.map((c) => ({
    order_id: newOrder.id,
    agent_product_id: c.agent_product_id,
    product_id: c.product_id,
    product_name: c.product_name,
    quantity: c.quantity,
    unit_retail_price: c.unit_retail_price,
    unit_cost_price: c.unit_cost_price,
  }));

  const { error: itemErr } = await service
    .from('order_items')
    .insert(itemsToInsert);

  if (itemErr) {
    // eslint-disable-next-line no-console
    console.error('[reorder] order_items insert failed', itemErr);
    await service.from('orders').delete().eq('id', newOrder.id);
    return NextResponse.json({ error: 'Failed To Create Reorder.' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    orderId: newOrder.id,
    skipped,
  });
}
