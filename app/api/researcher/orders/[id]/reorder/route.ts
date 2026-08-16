import { NextResponse, type NextRequest } from 'next/server';
import crypto from 'node:crypto';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getEffectiveUser } from '@/lib/impersonation';
import { assertSameOrigin } from '@/lib/csrf';
import { rateLimit } from '@/lib/rate-limit';
import { computeAgentCostsForAgent, computeAgentTopOfChainCostsForAgent, type AgentTier } from '@/lib/pricing';
import { calculateShippingCost } from '@/lib/shipping-cost';
import { DEFAULT_STORE_SLUG } from '@/lib/default-store';

/**
 * Researcher Reorder.
 *
 * Clones a prior order into a new pending order for the same buyer + agent.
 * Prices are re-resolved from the current `agent_products` row - we do NOT
 * trust the previous unit price because the agent may have repriced since.
 * Items whose product has been banned, removed from the catalog, or hidden
 * from the agent's storefront are dropped and returned in `skipped[]`.
 *
 * Cost basis (unit_cost_price / unit_super_agent_cost / unit_house_cost) is
 * re-resolved through the same chain-aware pricing engine checkout uses
 * (lib/pricing.ts computeAgentCostsForAgent) - NOT products.base_cost - so a
 * reorder bills the full agent (and, when parented, super-agent) chain cost
 * instead of the platform's raw wholesale cost.
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
  const { data: { user } } = await getEffectiveUser(supabase);
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

  // Resolve the storefront agent's chain-aware cost basis (mirrors checkout's
  // manufacturer / super-agent / plain-agent branches in app/api/orders/route.ts).
  // Previously this route priced every line off raw products.base_cost / 10,
  // recording it as unit_cost_price with no unit_super_agent_cost at all -
  // bypassing every markup hop in the chain.
  let agentRow: {
    id: string;
    tier: AgentTier | null;
    parent_agent_id: string | null;
    is_sub_agent: boolean | null;
    is_manufacturer: boolean | null;
    manufacturer_commission_pct: number | null;
  } | null = null;
  let isManufacturerStore = false;
  let manufacturerCommissionPct = 0;
  let agentCosts = new Map<string, number>();
  let superAgentCosts = new Map<string, number>();
  let topOfChainCosts = new Map<string, number>();
  let superAgentHasParent = false;

  if (source.agent_id) {
    const { data: ap } = await service
      .from('profiles')
      .select('id, tier, parent_agent_id, is_sub_agent, is_manufacturer, manufacturer_commission_pct')
      .eq('id', source.agent_id)
      .maybeSingle();
    agentRow = ap as any;

    if (agentRow) {
      isManufacturerStore = agentRow.is_manufacturer === true;
      manufacturerCommissionPct = isManufacturerStore
        ? Math.min(Math.max(Number(agentRow.manufacturer_commission_pct ?? 10) || 10, 0), 100)
        : 0;

      if (!isManufacturerStore) {
        const productListForPricing = (products ?? [])
          .filter((p) => p.base_cost != null)
          .map((p) => ({ id: p.id, base_cost: Number(p.base_cost) }));

        const agentTier: AgentTier = (agentRow.tier as AgentTier | null) ?? 'tier_3';
        agentCosts = await computeAgentCostsForAgent(service, agentRow.id, agentTier, productListForPricing);
        topOfChainCosts = await computeAgentTopOfChainCostsForAgent(service, agentRow.id, agentTier, productListForPricing);

        // Non-sub-agent with an upline: also resolve the direct parent's
        // chain cost for unit_super_agent_cost, same as checkout.
        superAgentHasParent = Boolean(agentRow.parent_agent_id) && agentRow.is_sub_agent !== true;
        if (superAgentHasParent && agentRow.parent_agent_id) {
          const { data: parentProfile } = await service
            .from('profiles')
            .select('id, tier')
            .eq('id', agentRow.parent_agent_id)
            .maybeSingle();
          if (parentProfile) {
            const parentTier: AgentTier = (parentProfile.tier as AgentTier | null) ?? 'tier_3';
            superAgentCosts = await computeAgentCostsForAgent(service, parentProfile.id, parentTier, productListForPricing);
          }
        }
      }
    }
  }

  const skipped: Array<{ product_name: string; reason: string }> = [];
  const computed: Array<{
    agent_product_id: string | null;
    product_id: string;
    product_name: string;
    quantity: number;
    unit_retail_price: number;
    unit_cost_price: number;
    unit_super_agent_cost: number | null;
    unit_house_cost: number | null;
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
    let retailPrice = apMatch ? apMatch.price / 10 : Number(product.base_cost) / 10;

    let costPrice: number;
    let superAgentCost: number | null = null;
    let houseCost: number | null = null;

    if (!source.agent_id) {
      // Direct/house order (no storefront agent) - mirrors checkout: cost
      // collapses to retail, there is no chain to price against.
      costPrice = retailPrice;
    } else if (isManufacturerStore) {
      // Manufacturer stores: mirror checkout - the platform's take is the
      // commission slice of the manufacturer's own retail price, not a
      // markup on top of it. No min-margin floor below (cost is derived
      // FROM retail here, so a floor would be circular). unit_house_cost
      // stays null, same as checkout.
      costPrice = Math.round(retailPrice * (manufacturerCommissionPct / 100) * 100) / 100;
    } else {
      const raw = agentCosts.get(it.product_id);
      costPrice = raw !== undefined && raw !== null ? raw / 10 : Number(product.base_cost) / 10;
      costPrice = isFinite(costPrice) ? Math.round(costPrice * 100) / 100 : 0;

      if (superAgentHasParent) {
        const superRaw = superAgentCosts.get(it.product_id);
        superAgentCost = superRaw !== undefined && superRaw !== null
          ? Math.round((superRaw / 10) * 100) / 100
          : null;

        const topRaw = topOfChainCosts.get(it.product_id);
        houseCost = topRaw !== undefined && topRaw !== null
          ? Math.round((topRaw / 10) * 100) / 100
          : null;
      } else {
        // Top-of-chain (or unparented) agent: their own cost IS the house edge.
        houseCost = costPrice;
      }

      // Platform rule: researcher-facing lines floored at cost x 1.10 - same
      // fail-safe checkout applies as the authoritative last step.
      const minMarginRetail = Math.round(costPrice * 1.10 * 100) / 100;
      if (retailPrice < minMarginRetail) {
        retailPrice = minMarginRetail;
      }
    }

    retailPrice = isFinite(retailPrice) ? Math.round(retailPrice * 100) / 100 : 0;

    computed.push({
      agent_product_id: apMatch ? apMatch.agent_product_id : null,
      product_id: it.product_id,
      product_name: product.name,
      quantity: it.quantity,
      unit_retail_price: retailPrice,
      unit_cost_price: costPrice,
      unit_super_agent_cost: superAgentCost,
      unit_house_cost: houseCost,
    });
  }

  if (computed.length === 0) {
    return NextResponse.json(
      { error: 'No Items From This Order Are Available For Reorder.', skipped },
      { status: 400 }
    );
  }

  const subtotal = computed.reduce((acc, it) => acc + it.unit_retail_price * it.quantity, 0);

  // Shipping. Reorders previously hardcoded shipping_cost: 0, so a buyer could
  // place one order and then reorder indefinitely with free delivery. Pep
  // Nation ships every order, so a reorder is charged the same flat regional
  // rate as a fresh checkout -- including the house-store $100+ waiver, so the
  // two paths cannot disagree for the same cart.
  const reorderState =
    (source.shipping_address as { state?: string | null } | null)?.state ?? null;
  let shippingCost = calculateShippingCost(
    source.fulfillment_method === 'agent_pickup' ? 'agent_pickup' : 'standard',
    reorderState,
  );
  if (shippingCost > 0 && subtotal >= 100) {
    const { data: sourceStore } = await service
      .from('agent_profiles')
      .select('slug')
      .eq('id', source.agent_id)
      .maybeSingle();
    if ((sourceStore as { slug?: string | null } | null)?.slug === DEFAULT_STORE_SLUG) {
      shippingCost = 0;
    }
  }
  const reorderTotal = Math.round((subtotal + shippingCost) * 100) / 100;

  const idempotencyKey = crypto.randomUUID();

  // Denormalized buyer fields for the new order, same as checkout populates
  // them (buyer_name from the profile, buyer_email from the auth user). The
  // buyer is the verified owner of the source order (checked above), so this
  // is the reordering researcher. Without these, reorders showed a blank buyer
  // name/email in admin + agent order views.
  const { data: buyerProfile } = await service
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle();

  // Create the reorder header AND its line items atomically in one transaction
  // (create_order_with_items_atomic) - previously two separate inserts, where a
  // crash between them could leave a headerless order that the stale-order cron
  // would later have to clean up.
  const { data: atomicResult, error: atomicError } = await service
    .rpc('create_order_with_items_atomic', {
      p_order: {
        buyer_id: user.id,
        buyer_name: buyerProfile?.full_name ?? null,
        buyer_email: user.email ?? null,
        agent_id: source.agent_id,
        status: 'pending_customer_payment',
        fulfillment_method: source.fulfillment_method,
        payment_method: source.payment_method,
        shipping_address: source.shipping_address,
        shipping_cost: shippingCost,
        subtotal,
        discount_amount: 0,
        coupon_code: null,
        total: reorderTotal,
        idempotency_key: idempotencyKey,
      },
      p_items: computed.map((c) => ({
        agent_product_id: c.agent_product_id,
        product_id: c.product_id,
        product_name: c.product_name,
        quantity: c.quantity,
        unit_retail_price: c.unit_retail_price,
        unit_cost_price: c.unit_cost_price,
        unit_super_agent_cost: c.unit_super_agent_cost,
        unit_house_cost: c.unit_house_cost,
      })),
    });

  if (atomicError || !atomicResult) {
    // The whole transaction rolled back - nothing partial persisted.
    // eslint-disable-next-line no-console
    console.error('[reorder] atomic order create failed', atomicError);
    return NextResponse.json({ error: 'Failed To Create Reorder.' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    orderId: (atomicResult as any).order_id,
    skipped,
  });
}
