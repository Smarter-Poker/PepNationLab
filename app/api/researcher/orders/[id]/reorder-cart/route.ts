import { NextResponse, type NextRequest } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { rateLimit } from '@/lib/rate-limit';

/**
 * Reorder → Cart.
 *
 * Resolves a prior order's items against the CURRENT catalog + the agent's
 * current storefront pricing, but does NOT create an order. Returns the items
 * in the storefront-cart shape the checkout page reads, plus the agent's
 * storefront slug and an agent_product_id→qty map (so the storefront grid can
 * hydrate the same cart if the buyer goes back to "add more").
 *
 * Items whose product is banned/inactive/removed, or no longer sold/visible on
 * the agent's storefront, are dropped and returned in `skipped[]`. The client
 * merges these into localStorage and redirects to /checkout?agent=<slug>.
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

  const rl = await rateLimit({
    key: 'reorder_cart',
    limit: 20,
    windowSeconds: 60,
    identifier: user.id,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too Many Requests. Please Wait And Try Again.' },
      { status: 429 }
    );
  }

  let bodyBundleName: string | null = null;
  try {
    const json = await req.json();
    bodyBundleName = json?.bundleName ?? null;
  } catch {
    /* ignore */
  }

  const service = await createServiceClient();

  const { data: source, error: sourceErr } = await service
    .from('orders')
    .select('id, buyer_id, agent_id, order_items(product_id, quantity, product_name)')
    .eq('id', id)
    .maybeSingle();

  if (sourceErr || !source) {
    return NextResponse.json({ error: 'Order Not Found.' }, { status: 404 });
  }
  if (source.buyer_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  let sourceItems = (source.order_items ?? []) as Array<{ product_id: string; quantity: number; product_name: string }>;
  if (sourceItems.length === 0) {
    return NextResponse.json({ error: 'Original Order Has No Items.' }, { status: 400 });
  }

  if (bodyBundleName) {
    sourceItems = sourceItems.filter(it => {
      const m = it.product_name && typeof it.product_name === 'string' ? it.product_name.match(/^(.*?)\s+\[Part of:\s+(.*?)\]$/) : null;
      return m && m[2] === bodyBundleName;
    });
    if (sourceItems.length === 0) {
      return NextResponse.json({ error: 'Stack Not Found In Order.' }, { status: 400 });
    }
  }

  const productIds = Array.from(new Set(sourceItems.map((it) => it.product_id).filter(Boolean)));
  const { data: products } = await service
    .from('products')
    .select('id, name, base_cost, is_active, is_banned, weight_oz, unit_size, unit_measure')
    .in('id', productIds);
  const productById = new Map((products ?? []).map((p) => [p.id, p]));

  // Current agent storefront pricing.
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
          price: row.is_on_sale && row.sale_price != null ? Number(row.sale_price) : Number(row.retail_price),
          is_visible: row.is_visible !== false,
        },
      ])
    );
  }

  // Resolve the agent's storefront slug for the checkout redirect + cart key.
  let agentSlug: string | null = null;
  if (source.agent_id) {
    const { data: ap } = await service
      .from('agent_profiles')
      .select('slug')
      .eq('id', source.agent_id)
      .maybeSingle();
    agentSlug = ap?.slug ?? null;
  }

  const skipped: Array<{ product_name: string; reason: string }> = [];
  // Storefront-cart shape consumed by app/checkout/CheckoutForm.tsx.
  const items: Array<{
    id: string; name: string; sku: string; quantity: number;
    retailPrice: number; costPrice: number; weightOz: number; agentSelfBuy: boolean; bundleName?: string;
  }> = [];
  // agent_product_id -> qty, so the storefront grid (cart_<slug>) hydrates too.
  const cartMap: Record<string, number> = {};

  for (const it of sourceItems) {
    const product = productById.get(it.product_id) as
      | { id: string; name: string; base_cost: number | null; is_active: boolean; is_banned: boolean; weight_oz: number | null; unit_size: string | null; unit_measure: string | null }
      | undefined;
    if (!product) { skipped.push({ product_name: 'Unknown Product', reason: 'No Longer In Catalog' }); continue; }
    if (product.is_banned) { skipped.push({ product_name: product.name, reason: 'Product Banned' }); continue; }
    if (!product.is_active) { skipped.push({ product_name: product.name, reason: 'Product Inactive' }); continue; }

    const apMatch = source.agent_id ? agentPriceMap.get(it.product_id) : null;
    if (source.agent_id && !apMatch) { skipped.push({ product_name: product.name, reason: 'Not Sold By Agent' }); continue; }
    if (apMatch && !apMatch.is_visible) { skipped.push({ product_name: product.name, reason: 'Hidden From Storefront' }); continue; }

    const baseCost = Number(product.base_cost) || 0;
    // retail_price / base_cost are per-10-vial packs; order quantity is per vial.
    const perVial = apMatch ? apMatch.price / 10 : baseCost / 10;
    const sizeLabel = product.unit_size ? ` (${product.unit_size}${product.unit_measure || ''})` : '';

    const bundleMatch = it.product_name && typeof it.product_name === 'string' ? it.product_name.match(/^(.*?)\s+\[Part of:\s+(.*?)\]$/) : null;

    items.push({
      id: it.product_id,
      name: `${product.name}${sizeLabel}`.trim(),
      sku: it.product_id,
      quantity: it.quantity,
      // Researcher (non-self-buy): retail == cost == the per-vial retail price.
      retailPrice: Math.round(perVial * 100) / 100,
      costPrice: Math.round(perVial * 100) / 100,
      weightOz: Number(product.weight_oz) || 0.5,
      agentSelfBuy: false,
      ...(bundleMatch ? { bundleName: bundleMatch[2] } : {}),
    });

    if (apMatch?.agent_product_id) {
      cartMap[apMatch.agent_product_id] = (cartMap[apMatch.agent_product_id] || 0) + it.quantity;
    }
  }

  if (items.length === 0) {
    return NextResponse.json(
      { error: 'No Items From This Order Are Available For Reorder.', skipped },
      { status: 400 }
    );
  }

  return NextResponse.json({ agentSlug, items, cartMap, skipped });
}
