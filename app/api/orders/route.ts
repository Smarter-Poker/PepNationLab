import { after, NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getEffectiveUser } from '@/lib/impersonation';
import { CheckoutSchema } from '@/lib/schemas/order';
import { applyBulkPrice, isTierLadderV2, computeAgentCostsForAgent, computeAgentTopOfChainCostsForAgent, resolveAgentPricingContext } from '@/lib/pricing';
import { assertSameOrigin } from '@/lib/csrf';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { calculateShippingCost, getCarrierName } from '@/lib/shipping-cost';
import { DEFAULT_STORE_SLUG } from '@/lib/default-store';
import { getEffectiveBundlesForStore } from '@/lib/bundles';
import { quoteCheapestForCheckout, normalizeShippingAddress } from '@/lib/shipping';
import { resolveCartIdsToProductIds } from '@/lib/cart-ids';
import { computeLineSplit, type ItemFulfillmentSplit } from '@/lib/order-line-splits';
import { quantityDiscountPct, isVolumeDiscountExcluded } from '@/lib/quantity-discount';
import { resolveCheckoutCoupon, getHouseAgentId } from '@/lib/coupons';
import { enqueuePush, shortOrderId } from '@/lib/push-enqueue';
import { notifyOrderPlaced, notify, notifyCouponRedeemed, notifyAdmins, notifyDownlineOrderPlaced, notifyCommissionEarned } from '@/lib/notify';
import { sendOrderConfirmationEmail, sendAgentSaleEmail } from '@/lib/email';
import { logOrderEvent } from '@/lib/order-events';
import { PAYMENT_METHOD_LABELS } from '@/lib/payment-method-labels';
import { captureError } from '@/lib/sentry';
import { logError } from '@/lib/log';
// CheckoutSchema lives in lib/schemas/order.ts -- the shared client/server
// single source of truth for the checkout contract. The client
// (app/checkout/CheckoutForm.tsx) parses the response against
// OrderCreateResponseSchema from the same module, so request AND response
// shapes are locked on both sides.

export async function POST(request: NextRequest) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;
  // Compensation state hoisted above the try so the outer catch can undo
  // reserved inventory / coupon redemption / prepaid deduction when the route
  // throws unexpectedly between STEP A and the order insert. Before this, a
  // transient throw in that window permanently leaked stock, coupon uses,
  // and prepaid money with only a console line as evidence.
  let compensateOnThrow: (() => Promise<void>) | null = null;
  let orderCommitted = false;
  try {
    const supabase = await createClient();
    const serviceSupabase = createAdminClient();

    // Authenticate the user session
    const { data: { user }, error: authError } = await getEffectiveUser(supabase);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized. Please Sign In.' }, { status: 401 });
    }

    // Per-user rate limit: 10 orders / minute.
    const limited = await rateLimit({
      key: 'orders_create',
      limit: 10,
      windowSeconds: 60,
      identifier: user.id,
    });
    if (!limited.allowed) {
      return NextResponse.json(
        { error: 'Too Many Requests. Please Wait And Try Again.' },
        { status: 429 }
      );
    }

    let rawBody: any;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const validation = CheckoutSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid Checkout Data.', details: validation.error.issues }, { status: 400 });
    }

    const {
      items: rawItems,
      shippingAddress,
      fulfillmentMethod,
      shippingOption,
      paymentMethod,
      couponCode,
      idempotencyKey,
      wholesale: explicitWholesale,

      agentSlug,
    } = validation.data;

    if (fulfillmentMethod === 'ship' && !shippingAddress) {
      return NextResponse.json({ error: 'Shipping Address Is Required For Deliveries.' }, { status: 400 });
    }

    // Idempotency replay: early exit if this key was already committed
    if (idempotencyKey) {
      const { data: existing } = await serviceSupabase
        .from('orders')
        .select('id, total, status')
        .eq('idempotency_key', idempotencyKey)
        .eq('buyer_id', user.id)
        .maybeSingle();
      if (existing) {
        // If the prior order under this key was cancelled (e.g. swept by
        // cancel_stale_pending_orders) before the client retried, do NOT report
        // success -- that would leave the buyer believing a cancelled order is
        // live. Treat the key as spent and ask them to start a new order.
        if (existing.status === 'cancelled') {
          return NextResponse.json(
            { error: 'Your Previous Order Was Cancelled. Please Start A New Order.' },
            { status: 409 }
          );
        }
        return NextResponse.json({
          success: true,
          orderId: existing.id,
          total: Number(existing.total) || 0,
          replayed: true,
        });
      }
    }

    // Get researcher profile (full_name added for buyer_name on order insert)
    const { data: profile, error: profileError } = await serviceSupabase
      .from('profiles')
      .select('id, full_name, contact_email, email_verified, referring_agent_id, role, tier, parent_agent_id, account_type, prepaid_balance, credit_limit, max_auto_approve_limit, auto_approve_orders, is_sub_agent, referring_sub_agent_id, is_manufacturer, manufacturer_commission_pct')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Researcher Profile Not Found.' }, { status: 404 });
    }

    const isSubAgent = (profile as { is_sub_agent?: boolean | null }).is_sub_agent === true;

    // --- DETERMINE AGENT OF RECORD ---
    let agentProfile = null;
    let superAgentProfile = null;
    let isAgentSelfBuy = false;

    if ((profile.role === 'agent' || profile.role === 'super_agent') && !isSubAgent) {
      agentProfile = profile;
      isAgentSelfBuy = true;
      if (profile.parent_agent_id) {
        const { data: sap } = await serviceSupabase.from('profiles').select('id, tier, account_type, prepaid_balance, credit_limit, max_auto_approve_limit, auto_approve_orders').eq('id', profile.parent_agent_id).maybeSingle();
        superAgentProfile = sap;
      }
    } else if (profile.referring_agent_id) {
      const { data: ap } = await serviceSupabase.from('profiles').select('id, role, tier, parent_agent_id, auto_approve_orders, account_type, max_auto_approve_limit, is_sub_agent, referring_sub_agent_id, is_manufacturer, manufacturer_commission_pct').eq('id', profile.referring_agent_id).maybeSingle();
      agentProfile = ap;
      if (ap && ap.parent_agent_id) {
        const { data: sap } = await serviceSupabase.from('profiles').select('id, tier, account_type, prepaid_balance, credit_limit, max_auto_approve_limit, auto_approve_orders').eq('id', ap.parent_agent_id).maybeSingle();
        superAgentProfile = sap;
      }
    }

    // Guard: sub-agents MUST resolve to their parent agent, otherwise pricing
    // collapses to $0 and the order has no billing chain.
    if (isSubAgent && !agentProfile) {
      return NextResponse.json(
        { error: 'Sub-Agent Account Configuration Error. Please Contact Your Parent Agent.' },
        { status: 403 }
      );
    }

    // MANUFACTURER STORES (2026-07-15): the agent of record is the factory
    // itself. Their store trades on its own rules -- every line in multiples
    // of 10, no coupons/promos/automatic discounts, pricing unrestricted, and
    // the platform keeps manufacturer_commission_pct of the product subtotal
    // (recorded in manufacturer_ledger after the order commits).
    const isManufacturerStore = Boolean(
      (agentProfile as { is_manufacturer?: boolean | null } | null)?.is_manufacturer
    );
    const manufacturerCommissionPct = isManufacturerStore
      ? Math.min(Math.max(Number((agentProfile as { manufacturer_commission_pct?: unknown } | null)?.manufacturer_commission_pct ?? 10) || 10, 0), 100)
      : 0;

    // Manufacturers supply the inventory -- they never buy through the platform.
    if (isManufacturerStore && (isAgentSelfBuy || explicitWholesale === true)) {
      return NextResponse.json(
        { error: 'Manufacturer Accounts Supply Inventory And Do Not Purchase Through The Platform.' },
        { status: 403 }
      );
    }

    // Consolidated agent_profiles config for the agent of record. One query
    // covers everything this route needs from that table: slug + min-qty rules
    // (storefront checks below), bundles_config (stack discount),
    // volume_pricing_enabled (quantity discounts), and payment_handles (so the
    // buyer's confirmation email can carry the actual pay-to handle) --
    // previously fetched in up to three separate round trips.
    let agentConfig: {
      id: string;
      slug: string | null;
      min_overall_qty: number | null;
      min_order_qty: number | null;
      bundles_config: unknown;
      volume_pricing_enabled: boolean | null;
      payment_handles?: Record<string, string> | null;
    } | null = null;
    if (agentProfile) {
      const { data: acRow } = await serviceSupabase
        .from('agent_profiles')
        .select('id, slug, min_overall_qty, min_order_qty, bundles_config, volume_pricing_enabled, payment_handles')
        .eq('id', agentProfile.id)
        .maybeSingle();
      agentConfig = acRow ?? null;
    }

    // Cart item ids may be agent_product ids (mobile by-name / quick-add path via
    // CartContext, where the storefront grid is not mounted) or master product ids
    // (storefront / reorder paths). Every downstream lookup here resolves against
    // products.id / agent_inventory.product_id / agent_products.product_id, so
    // translate any agent_product ids to their underlying product_id up front.
    // Without this, a cart built through the mobile by-name path hard-fails checkout
    // with "Product ID ... Is No Longer Available".
    let items = rawItems;
    {
      const { inputToProduct } = await resolveCartIdsToProductIds(
        serviceSupabase,
        rawItems.map(i => i.id),
      );
      items = rawItems.map(i => {
        const mapped = inputToProduct.get(i.id);
        return mapped && mapped !== i.id ? { ...i, id: mapped } : i;
      });
    }

    // Retrieve active product definitions matching requested cart item IDs
    const { data: dbProducts, error: dbProductsError } = await serviceSupabase
      .from('products')
      .select('id, name, base_cost, weight_oz, is_active, is_banned, sku, inventory_count, admin_bulk_price, admin_bulk_threshold')
      .in('id', items.map(i => i.id));

    if (dbProductsError || !dbProducts || dbProducts.length === 0) {
      return NextResponse.json({ error: 'Failed To Retrieve Product Data.' }, { status: 400 });
    }

    // O(1) product lookups inside the per-item loops below (replaces repeated
    // Array.find scans; same rows, same misses).
    const productById = new Map(dbProducts.map(p => [p.id as string, p]));

    // Fetch Agent Inventory if a researcher is buying
    let agentStockMap: Record<string, number> = {};
    if (agentProfile && !isAgentSelfBuy) {
      const { data: localStock } = await serviceSupabase
        .from('agent_inventory')
        .select('product_id, stock_count')
        .eq('agent_id', agentProfile.id)
        .in('product_id', items.map(i => i.id));
      localStock?.forEach(s => { agentStockMap[s.product_id] = Number(s.stock_count); });
    }

    // Keyed by cart-line INDEX, never by product id: the same product can
    // appear on two lines (e.g. standalone + as a bundle component), and keying
    // by product id collapsed them onto one split and mis-charged the duplicate.
    const itemSplits: ItemFulfillmentSplit[] = [];

    // Check for banned or deactivated products and inventory limits
    for (let idx = 0; idx < items.length; idx++) {
      const cartItem = items[idx];
      const dbProduct = productById.get(cartItem.id);
      if (!dbProduct) {
        return NextResponse.json(
          { error: `Product ID "${cartItem.id}" Is No Longer Available. Please Return To The Store And Refresh Your Cart.` },
          { status: 400 }
        );
      }

      if (dbProduct.is_banned || !dbProduct.is_active) {
        return NextResponse.json({ error: `Product "${dbProduct.name}" Is Unavailable For Sale.` }, { status: 400 });
      }

      const qty = Number(cartItem.quantity) || 1;

      if (qty > 10_000) {
        return NextResponse.json(
          { error: `Quantity For "${dbProduct.name}" Exceeds The Maximum Allowed (10,000 Per Item).` },
          { status: 400 }
        );
      }

      // Manufacturer stores trade in 10-vial multiples only -- no singles.
      if (isManufacturerStore && (qty < 10 || qty % 10 !== 0)) {
        return NextResponse.json(
          { error: `"${dbProduct.name}" Is Sold In Multiples Of 10 On This Store. Please Set The Quantity To 10, 20, 30, And So On.` },
          { status: 400 }
        );
      }

      // China/global ships infinitely, so a checkout never blocks on stock
      // availability. Agent LOCAL stock is the only finite inventory and is
      // still enforced precisely by reserve_inventory() below (it caps localQty
      // at the agent's on-hand and backfills the remainder from China).
      const useLocal = Boolean(agentProfile && !isAgentSelfBuy && fulfillmentMethod === 'ship');
      const localAgentStock = useLocal ? (agentStockMap[cartItem.id] || 0) : 0;
      const { localQty, chinaQty } = computeLineSplit(qty, localAgentStock, useLocal);

      itemSplits[idx] = { localQty, chinaQty };
    }

    // CLOSED-LOOP RESEARCHER OWNERSHIP + CATALOG GUARD
    // Applied whether or not agentSlug is present -- the slug just provides
    // the storefront-level min-qty and domain checks on top. The core
    // visibility gate is always enforced via the DB-stored referring_agent_id.
    if (!isAgentSelfBuy && !isSubAgent && agentProfile) {
      const { data: visibleRows } = await serviceSupabase
        .from('agent_products')
        .select('product_id')
        .eq('agent_id', agentProfile.id)
        .eq('is_visible', true)
        .in('product_id', items.map(i => i.id));

      const visibleSet = new Set((visibleRows ?? []).map((r: any) => r.product_id as string));
      const blocked = items.find(i => !visibleSet.has(i.id));
      if (blocked) {
        const blockedName = productById.get(blocked.id)?.name ?? blocked.id;
        return NextResponse.json({ error: `Product "${blockedName}" Is Not Available Through This Agent's Store.` }, { status: 403 });
      }
    }

    if (agentSlug) {
      // Reuse the consolidated agent-of-record row when its slug is an exact
      // match for the requested storefront (agent_profiles.slug is UNIQUE, so
      // the by-slug query would return the same row). Otherwise fall back to
      // the by-slug lookup -- e.g. an agent self-buy on a different agent's
      // storefront, or a buyer with no agent of record.
      // Use .eq() not .ilike() -- slug is a user-supplied value; underscore in
      // .ilike() is a LIKE wildcard that could match wrong storefronts.
      let storefrontAgent: { id: string; min_overall_qty: number | null; min_order_qty: number | null } | null =
        agentConfig && agentConfig.slug === agentSlug ? agentConfig : null;
      if (!storefrontAgent) {
        const { data: slugAgent } = await serviceSupabase
          .from('agent_profiles')
          .select('id, min_overall_qty, min_order_qty')
          .eq('slug', agentSlug)
          .maybeSingle();
        storefrontAgent = slugAgent ?? null;
      }

      if (!storefrontAgent) {
        return NextResponse.json({ error: 'Agent Storefront Not Found.' }, { status: 404 });
      }

      if (!isAgentSelfBuy) {
        const researcherBelongsToAgent = profile.referring_agent_id === storefrontAgent.id;
        if (!researcherBelongsToAgent) {
          return NextResponse.json({ error: 'Your Account Does Not Have Access To This Store.' }, { status: 403 });
        }
      }

      const totalRequestedQty = items.reduce((acc, item) => acc + (Number(item.quantity) || 0), 0);
      const minQty = Number(storefrontAgent.min_overall_qty) || 1;
      if (totalRequestedQty < minQty) {
        return NextResponse.json({ error: `This Storefront Requires A Minimum Overall Order Of ${minQty} Items.` }, { status: 400 });
      }

      const minPerItem = Number(storefrontAgent.min_order_qty) || 1;
      for (const item of items) {
        if ((Number(item.quantity) || 0) < minPerItem) {
          return NextResponse.json({ error: `This Storefront Requires A Minimum Of ${minPerItem} Per Peptide.` }, { status: 400 });
        }
      }
      // Note: product visibility already checked above -- skip the redundant
      // per-slug visible-products query since the universal guard ran first.
    }

    // Wholesale / flash-sale eligibility flags (decide which pricing reads to
    // issue below).
    // fix-57 #2: flash sale applies to researcher retail pricing only - agent
    // self-buys and wholesale restocks are exempt (already at wholesale tier).
    const wholesaleExplicit = explicitWholesale === true &&
      (profile.role === 'agent' || profile.role === 'super_agent') &&
      !isSubAgent;
    const flashSaleEligible = !isAgentSelfBuy && !isSubAgent && !wholesaleExplicit && !isManufacturerStore;

    const agentTier = agentProfile?.tier || 'tier_3';
    const superAgentTier = superAgentProfile ? (superAgentProfile.tier || 'tier_3') : null;
    const cartProductIds = items.map(i => i.id);
    const nowIso = new Date().toISOString();

    // 1-5. Pricing inputs. Every read below is independent of the others once
    // the agent of record and the cart are known, so issue them as one
    // parallel batch instead of sequential round trips: pricing_tiers, active
    // flash sale (single row max), product_tier_overrides (agent + super tiers
    // in ONE query, cart products only), agent_products custom retail (cart
    // products only), super_agent_pricing baselines, and the effective-markup
    // RPC (agent ID is constant for the entire checkout, so one call).
    const [
      { data: tiers },
      { data: activeSale },
      { data: overrideRows },
      { data: acr },
      { data: sab },
      { data: markupData },
    ] = await Promise.all([
      serviceSupabase.from('pricing_tiers').select('tier_name, multiplier'),
      flashSaleEligible
        ? serviceSupabase
            .from('flash_sales')
            .select('discount_pct')
            .eq('is_active', true)
            .lte('starts_at', nowIso)
            .gte('ends_at', nowIso)
            .order('ends_at', { ascending: true })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      serviceSupabase
        .from('product_tier_overrides')
        .select('tier_name, product_id, custom_multiplier')
        .in('tier_name', superAgentTier && superAgentTier !== agentTier ? [agentTier, superAgentTier] : [agentTier])
        .in('product_id', cartProductIds),
      agentProfile
        ? serviceSupabase
            .from('agent_products')
            .select('product_id, retail_price, is_on_sale, sale_price')
            .eq('agent_id', agentProfile.id)
            .in('product_id', cartProductIds)
        : Promise.resolve({ data: null }),
      superAgentProfile
        ? serviceSupabase
            .from('super_agent_pricing')
            .select('product_id, baseline_cost, bulk_baseline_cost, bulk_threshold')
            .eq('super_agent_id', superAgentProfile.id)
        : Promise.resolve({ data: null }),
      agentProfile && !agentProfile.is_sub_agent
        ? serviceSupabase.rpc('fn_agent_effective_markup', { p_agent: agentProfile.id })
        : Promise.resolve({ data: null }),
    ]);

    // 1. Admin default multipliers
    const tierMultipliers: Record<string, number> = {};
    tiers?.forEach((t: { tier_name: string; multiplier: unknown }) => { tierMultipliers[t.tier_name] = Number(t.multiplier); });

    // 1a. Precompute Agent Cost Maps
    const productListForPricing = (dbProducts || []).map(p => ({ id: p.id, base_cost: Number(p.base_cost) }));
    let agentCosts = new Map<string, number>();
    if (agentProfile && !isManufacturerStore) {
      agentCosts = await computeAgentCostsForAgent(serviceSupabase, agentProfile.id, agentTier, productListForPricing);
    }
    let superAgentCosts = new Map<string, number>();
    if (superAgentProfile && !isManufacturerStore) {
      superAgentCosts = await computeAgentCostsForAgent(serviceSupabase, superAgentProfile.id, superAgentTier || 'tier_3', productListForPricing);
    }
    // Fix 3 (2026-07-21): top-of-chain cost basis for order_items.unit_house_cost.
    // For a chain sale (agentProfile has a parent -- superAgentProfile is set),
    // the immediate parent's cost (superAgentCosts above) is NOT the house's true
    // cost basis under 3+ level chains -- it's just the next hop up. Resolving
    // agentProfile's own chain to its top ancestor gives the actual house cost,
    // regardless of how many Super Agent hops sit in between.
    let topOfChainCosts = new Map<string, number>();
    if (superAgentProfile && agentProfile && !isManufacturerStore) {
      topOfChainCosts = await computeAgentTopOfChainCostsForAgent(serviceSupabase, agentProfile.id, agentTier, productListForPricing);
    }

    let flashSaleDiscountPct = 0;
    if (flashSaleEligible && activeSale) {
      const d = Number(activeSale.discount_pct);
      if (Number.isFinite(d) && d > 0 && d <= 90) {
        flashSaleDiscountPct = d;
      }
    }
    const flashMultiplier = 1 - (flashSaleDiscountPct / 100);

    // 2. Agent profiles already resolved above.

    // 3. Override rule sets: both tiers came back in the single query above;
    // split them into the same two per-tier maps as before. Precedence is
    // unchanged -- agent and super-agent overrides are consulted independently
    // in the per-item loop below.
    const agentOverrides: Record<string, number> = {};
    const superAgentOverrides: Record<string, number> = {};
    overrideRows?.forEach((o: { tier_name: string; product_id: string; custom_multiplier: unknown }) => {
      if (o.tier_name === agentTier) agentOverrides[o.product_id] = Number(o.custom_multiplier);
      if (superAgentTier !== null && o.tier_name === superAgentTier) superAgentOverrides[o.product_id] = Number(o.custom_multiplier);
    });

    // 4. Custom retail prices (cart products only; fetched above)
    const agentCustomRetail: Record<string, number> = {};
    acr?.forEach((a: { product_id: string; retail_price: unknown; is_on_sale: boolean | null; sale_price: number | null }) => {
      const rawPrice = a.is_on_sale && a.sale_price != null
        ? Number(a.sale_price)
        : Number(a.retail_price);
      agentCustomRetail[a.product_id] = rawPrice / 10;
    });

    // 4a. Legitimate stack/bundle membership. The 10% bundle discount is applied
    // per line only when the client-supplied bundleName matches an ACTIVE bundle
    // owned by the agent of record AND the line's product is a member of that
    // bundle. Without this check, any client could attach an arbitrary bundleName
    // string to every cart line and skim 10% off the whole order.
    // Map: normalized bundle name -> Set of member product_ids.
    const validBundleMembers = new Map<string, Set<string>>();
    const bundleDiscountByName = new Map<string, number>();
    /** Per-bundle flat custom price. When set, overrides the discount_percent factor. */
    const bundleCustomPriceByName = new Map<string, number>();
    /** Total individual retail price for all members of a bundle (to compute per-item shares). */
    const bundleFullPriceByName = new Map<string, number>();
    if (agentProfile && !isManufacturerStore) {
      // Effective bundles for the agent of record: the store's own bundles plus
      // any cascaded from a parent super-agent ('downline') or the house store
      // ('global'). The shared resolver keeps the authoritative checkout discount
      // in lockstep with what renders on the storefront. A resolution failure
      // must never break checkout -- the order just proceeds with no bundle
      // discount.
      let effectiveBundles: Awaited<ReturnType<typeof getEffectiveBundlesForStore>> = [];
      try {
        effectiveBundles = await getEffectiveBundlesForStore(serviceSupabase, agentProfile.id);
      } catch {
        effectiveBundles = [];
      }
      for (const b of effectiveBundles) {
        if (b.is_active === false || typeof b.name !== 'string' || !Array.isArray(b.product_ids)) continue;
        const key = b.name.trim().toLowerCase();
        const set = validBundleMembers.get(key) ?? new Set<string>();
        b.product_ids.forEach(pid => { if (typeof pid === 'string') set.add(pid); });
        validBundleMembers.set(key, set);
        if (b.custom_price != null && Number(b.custom_price) > 0) {
          bundleCustomPriceByName.set(key, Number(b.custom_price));
        } else {
          // If two bundles normalize to the same name, keep the larger discount.
          const disc = Math.min(Math.max(Number(b.discount_percent) || 0, 0), 90);
          bundleDiscountByName.set(key, Math.max(bundleDiscountByName.get(key) ?? 0, disc));
        }
      }
    }
    const isValidBundleLine = (bundleName: string | undefined, productId: string): boolean => {
      if (!bundleName) return false;
      const members = validBundleMembers.get(bundleName.trim().toLowerCase());
      return !!members && members.has(productId);
    };
    // Per-bundle discount factor (1 = no discount). For custom-priced bundles,
    // the factor is computed per-line by callers using bundleCustomPriceByName.
    // Defaults to the legacy 10% only for a validated bundle line whose bundle
    // somehow carries no percent.
    const bundleDiscountFactor = (bundleName: string | undefined): number => {
      if (!bundleName) return 1;
      // Custom price bundles: handled separately, return 1 here so the caller
      // can apply the per-item custom price proportionally.
      const key = bundleName.trim().toLowerCase();
      if (bundleCustomPriceByName.has(key)) return 1;
      const pct = bundleDiscountByName.get(key);
      const eff = pct === undefined ? 10 : pct;
      return Math.max(0, 1 - eff / 100);
    };

    // 4b. Quantity Discount Eligibility -- Honors The Storefront's
    // volume_pricing_enabled Toggle (Default On). Researcher Retail Only.
    let volumeDiscountsEnabled = true;
    if (agentProfile && !isAgentSelfBuy && !isSubAgent) {
      volumeDiscountsEnabled = agentConfig?.volume_pricing_enabled !== false;
    }
    if (isManufacturerStore) {
      volumeDiscountsEnabled = false;
    }

    // 4c. Pre-calculate unit retail sums for custom-priced bundles in the cart
    const cartBundleUnitRetailSum = new Map<string, number>();
    const seenBundleProducts = new Set<string>();
    
    for (const cartItem of items) {
      const dbProduct = productById.get(cartItem.id);
      if (!dbProduct || !isValidBundleLine(cartItem.bundleName, dbProduct.id)) continue;
      const key = cartItem.bundleName!.trim().toLowerCase();
      if (!bundleCustomPriceByName.has(key)) continue;
      
      const uniqueKey = `${key}:${dbProduct.id}`;
      if (seenBundleProducts.has(uniqueKey)) continue;
      seenBundleProducts.add(uniqueKey);

      let unitRetail = 0;
      if (Object.prototype.hasOwnProperty.call(agentCustomRetail, dbProduct.id)) {
        unitRetail = agentCustomRetail[dbProduct.id];
      } else {
        const retailMultiplier = tierMultipliers['tier_3'] ?? 10;
        unitRetail = Number(dbProduct.base_cost) * retailMultiplier / 10;
      }
      cartBundleUnitRetailSum.set(key, (cartBundleUnitRetailSum.get(key) || 0) + unitRetail);
    }

    // 5. Super agent baseline costs (fetched above)
    const superAgentBaselines: Record<string, { baseline_cost: number, bulk_baseline_cost: number | null, bulk_threshold: number }> = {};
    sab?.forEach((b: { product_id: string; baseline_cost: unknown; bulk_baseline_cost: number | null; bulk_threshold: number | null }) => {
      superAgentBaselines[b.product_id] = {
        baseline_cost: Number(b.baseline_cost),
        bulk_baseline_cost: b.bulk_baseline_cost !== null ? Number(b.bulk_baseline_cost) : null,
        bulk_threshold: b.bulk_threshold ?? 100
      };
    });

    // 6. Compute Costs per Item
    let subtotal = 0;
    // "One offer at a time" (2026-07-12 audit): tally each automatic discount at the ORDER
    // level; flash / quantity / coupon never stack -- only the single largest applies below.
    let flashDiscTotal = 0;
    let qtyDiscTotal = 0;
    let totalWeightOz = 0;
    const computedItems = [];

    // Effective markup was fetched once in the parallel batch above (the agent
    // ID is constant for the entire checkout); consume the result here.
    let agentEffectiveMarkupPct = 0;
    if (agentProfile && !agentProfile.is_sub_agent) {
      agentEffectiveMarkupPct = Number(markupData) || 0;
    }

    for (let idx = 0; idx < items.length; idx++) {
      const cartItem = items[idx];
      const dbProduct = productById.get(cartItem.id);
      if (!dbProduct) {
        return NextResponse.json(
          { error: `Product ID "${cartItem.id}" Is No Longer Available. Please Return To The Store And Refresh Your Cart.` },
          { status: 400 }
        );
      }

      const baseCost = Number(dbProduct.base_cost);

      // Only honor a client-supplied bundleName when it maps to a real active
      // bundle owned by the agent of record that actually contains this product.
      const isBundleLine = isValidBundleLine(cartItem.bundleName, dbProduct.id);

      let retailPrice = 0;

      if (isAgentSelfBuy || isSubAgent) {
        // costPrice path; retail collapses to cost for wholesale buyers below.
      } else if (Object.prototype.hasOwnProperty.call(agentCustomRetail, dbProduct.id)) {
        // Presence check, not truthiness: an agent may legitimately set retail_price
        // to 0 (giveaway/sample). A `0 is falsy` check previously skipped this and
        // charged full tier-3 retail instead of the intended free price.
        retailPrice = agentCustomRetail[dbProduct.id];
      } else {
        // Fix 7: return 500 if tier multipliers cannot be loaded instead of using hardcoded fallback
        const retailMultiplier = tierMultipliers['tier_3'];
        if (retailMultiplier === undefined || retailMultiplier === null) {
          return NextResponse.json({ error: 'Pricing Configuration Unavailable. Please Try Again.' }, { status: 500 });
        }
        retailPrice = baseCost * retailMultiplier / 10;
      }

      const itemQty = Number(cartItem.quantity) || 1;

      if (itemQty > 10_000) {
        return NextResponse.json(
          { error: `Quantity For A Cart Item Exceeds The Maximum Allowed (10,000 Per Item).` },
          { status: 400 }
        );
      }

      let costPrice = retailPrice;
      let superAgentCost = null;
      let houseCost: number | null = null;
      // Wholesale buyers (agent self-buy + sub-agents) always pay flat tier
      // cost - no volume/bulk discount and no retail markup. Dynamic pricing
      // applies to researchers only.
      const isWholesalePurchase = isAgentSelfBuy || isSubAgent;

      if (agentProfile) {
        if (isManufacturerStore) {
          // The platform's take per vial is the commission slice of the
          // manufacturer's own retail price. Recorded as unit_cost_price so
          // order snapshots carry the split; the authoritative per-order split
          // lives in manufacturer_ledger (written after the insert below).
          costPrice = Math.round(retailPrice * (manufacturerCommissionPct / 100) * 100) / 100;
        } else if (superAgentProfile) {
          const saCostRaw = superAgentCosts.get(dbProduct.id);
          if (saCostRaw === undefined || saCostRaw === null) {
            return NextResponse.json({ error: 'Pricing Configuration Unavailable. Please Try Again.' }, { status: 500 });
          }
          superAgentCost = isWholesalePurchase
            ? (saCostRaw / 10)
            : applyBulkPrice(
                saCostRaw / 10,
                itemQty,
                dbProduct.admin_bulk_price != null ? dbProduct.admin_bulk_price / 10 : null,
                dbProduct.admin_bulk_threshold
              );

          // Fix 2 (2026-07-21): track whether an explicit admin/super-configured
          // baseline_cost override applies to this product. That override is
          // authoritative and must survive the Gamification Markup step below --
          // previously the markup step unconditionally overwrote costPrice with
          // the dynamic chain cost for every non-sub-agent, silently discarding
          // any baseline_cost the super agent had explicitly set.
          let baselineApplied = false;
          const saConfig = superAgentBaselines[dbProduct.id];
          if (saConfig) {
             baselineApplied = true;
             // Sub-agents do not get the bulk_baseline_cost break; they always
             // pay the baseline tier their parent has set.
             // baseline_cost / bulk_baseline_cost are stored PER-10-VIAL PACK, so
             // divide by 10 to get the per-vial cost (matches every other price in
             // this file and the manual invoice path). Without this the buyer is
             // billed 10x the intended baseline.
             if (!isWholesalePurchase && saConfig.bulk_baseline_cost !== null && itemQty >= saConfig.bulk_threshold) {
                 costPrice = saConfig.bulk_baseline_cost / 10;
             } else {
                 costPrice = saConfig.baseline_cost / 10;
             }
          } else {
             costPrice = superAgentCost;
          }

          // Gamification Markup (Super Agent -> Agent)
          // The Agent pays the Super Agent's cost + Markup.
          // Sub-agent wholesale orders are exempt -- they pay baseline_cost.
          // Skipped entirely when a super_agent_pricing baseline_cost override
          // was applied above -- an explicit baseline is authoritative and must
          // never be clobbered by the dynamic chain/ladder cost.
          if (!baselineApplied && agentProfile && !agentProfile.is_sub_agent && !isSubAgent) {
             if (isTierLadderV2()) {
               const aCostRaw = agentCosts.get(dbProduct.id);
               if (aCostRaw !== undefined && aCostRaw !== null) {
                 costPrice = aCostRaw / 10;
               } else {
                 costPrice = (superAgentCost ?? 0) * (1 + (agentEffectiveMarkupPct / 100));
               }
             } else {
               costPrice = (superAgentCost ?? 0) * (1 + (agentEffectiveMarkupPct / 100));
             }
          }

        } else {
          const aCostRaw = agentCosts.get(dbProduct.id);
          if (aCostRaw === undefined || aCostRaw === null) {
            return NextResponse.json({ error: 'Pricing Configuration Unavailable. Please Try Again.' }, { status: 500 });
          }
          // Agent self-buy at a regular agent's storefront: skip bulk pricing.
          // Researcher buying through the agent: keep bulk pricing.
          costPrice = isWholesalePurchase
            ? (aCostRaw / 10)
            : applyBulkPrice(
                aCostRaw / 10,
                itemQty,
                dbProduct.admin_bulk_price != null ? dbProduct.admin_bulk_price / 10 : null,
                dbProduct.admin_bulk_threshold
              );
        }
      }

      // Minimum-margin fail-safe (platform rule): a researcher-facing sale
      // may never price below cost + 10%. Wholesale restocks are an agent
      // buying stock (margin 0 by design) and manufacturer stores compute
      // cost FROM retail, so both are exempt. The same floor exists in the
      // price editor and as a DB clamp trigger; this is the authoritative
      // last line because only checkout knows the agent's true chain cost.
      if (!isWholesalePurchase && !isManufacturerStore) {
        const minMarginRetail = Math.round(costPrice * 1.10 * 100) / 100;
        if (retailPrice < minMarginRetail) {
          retailPrice = minMarginRetail;
        }
      }

      // Wholesale buyers always pay tier cost flat. retailPrice collapses to
      // costPrice so the order line records what they actually paid. Spread on
      // a sub-agent's sale to a researcher flows via accrue_sub_agent_commission.
      if (isWholesalePurchase) {
        retailPrice = costPrice;
      }

      // Stack discount: each bundle's own discount_percent for stack/bundle line
      // items (or a flat custom price if set). This is intrinsic to how a stack
      // product is sold, NOT a stackable promotional offer, so it always applies.
      // Floors prevent an upstream bug from driving prices negative.
      if (isBundleLine) {
        const key = (cartItem.bundleName ?? '').trim().toLowerCase();
        const customBundlePrice = bundleCustomPriceByName.get(key);
        if (customBundlePrice != null && customBundlePrice > 0) {
          const totalUnitRetail = cartBundleUnitRetailSum.get(key) || 1;
          const bundleFactor = customBundlePrice / Math.max(totalUnitRetail, 0.01);
          
          // Apply the exact proportional factor derived from server-computed retail sums.
          // Because retailPrice collapses to costPrice for wholesale buyers above,
          // this correctly applies the equivalent % discount to their wholesale cost.
          retailPrice = Math.max(0, retailPrice * bundleFactor);
          costPrice = Math.max(0, costPrice * bundleFactor);
          
          // If the frontend supplied a bundleCustomPrice, we can trust it if it is 
          // essentially equal to what we just computed (avoiding tiny penny rounding mismatches).
          const clientCustomPrice = typeof (cartItem as any).bundleCustomPrice === 'number'
            ? Number((cartItem as any).bundleCustomPrice)
            : null;
          if (clientCustomPrice != null && Math.abs(clientCustomPrice - retailPrice) <= 0.02) {
            retailPrice = Math.max(0, clientCustomPrice);
          }
        } else {
          const bundleFactor = bundleDiscountFactor(cartItem.bundleName);
          retailPrice = Math.max(0, retailPrice * bundleFactor);
          costPrice = Math.max(0, costPrice * bundleFactor);
        }
      }

      // "One offer at a time" (2026-07-12 audit): flash sale, quantity discount, and coupon
      // NEVER stack. Keep unit_retail_price at the BASE (stack) price and tally each candidate
      // discount at the order level; only the single largest ("best deal for the customer") is
      // applied as the order discount below -- and every discount type becomes attributable via
      // orders.discount_amount + discount_source (not just coupons).
      if (!isWholesalePurchase) {
        if (flashSaleDiscountPct > 0 && !isAgentSelfBuy && !isSubAgent) {
          flashDiscTotal = Math.round((flashDiscTotal + retailPrice * itemQty * (flashSaleDiscountPct / 100)) * 100) / 100;
        }
        if (volumeDiscountsEnabled && !isBundleLine && !isVolumeDiscountExcluded(dbProduct.name)) {
          const qtyPct = quantityDiscountPct(itemQty, dbProduct.name);
          if (qtyPct > 0) {
            qtyDiscTotal = Math.round((qtyDiscTotal + retailPrice * itemQty * (qtyPct / 100)) * 100) / 100;
          }
        }
      }

      // Round unit prices to exact cents
      retailPrice = isFinite(retailPrice) ? Math.round(retailPrice * 100) / 100 : 0;
      costPrice = isFinite(costPrice) ? Math.round(costPrice * 100) / 100 : 0;
      if (superAgentCost !== null) {
        superAgentCost = isFinite(superAgentCost) ? Math.round(superAgentCost * 100) / 100 : null;
      }

      // Fix 3 (2026-07-21): capture the TOP-of-chain house cost per unit at
      // sale time. Chain sale (agent has a parent) -> the top ancestor's own
      // ladder cost, ignoring every downstream hop's markup. Top-level agent
      // sale (no parent) -> the agent's own (already fully adjusted & rounded)
      // cost IS the house edge. Manufacturer branch and no-agent (direct/house)
      // orders leave this NULL.
      if (agentProfile && !isManufacturerStore) {
        if (superAgentProfile) {
          const topRaw = topOfChainCosts.get(dbProduct.id);
          houseCost = topRaw !== undefined && topRaw !== null
            ? Math.round((topRaw / 10) * 100) / 100
            : null;
        } else {
          houseCost = costPrice;
        }
      }

      const finalProductName = isBundleLine ? `${dbProduct.name} [Part of: ${cartItem.bundleName}]` : dbProduct.name;

      const split = itemSplits[idx];

      if (split && split.localQty > 0) {
        // Keep subtotal at exact cents so FP dust cannot flow into coupon math
        // or the stored order total.
        subtotal = Math.round((subtotal + retailPrice * split.localQty) * 100) / 100;
        totalWeightOz += (Number(dbProduct.weight_oz) || 0.5) * split.localQty;
        computedItems.push({
          product_id: dbProduct.id,
          product_name: finalProductName,
          quantity: split.localQty,
          unit_retail_price: retailPrice,
          unit_cost_price: costPrice,                                           // use real cost, not 0 -- zero corrupts COGS reporting
          unit_super_agent_cost: superAgentCost,                               // use real super-agent cost, not 0
          unit_house_cost: houseCost,                                          // top-of-chain house cost basis (Fix 3)
          isLocalFulfillment: true
        } as any);
      }

      if (split && split.chinaQty > 0) {
        subtotal = Math.round((subtotal + retailPrice * split.chinaQty) * 100) / 100;
        totalWeightOz += (Number(dbProduct.weight_oz) || 0.5) * split.chinaQty;
        computedItems.push({
          product_id: dbProduct.id,
          product_name: finalProductName,
          quantity: split.chinaQty,
          unit_retail_price: retailPrice,
          unit_cost_price: costPrice,
          unit_super_agent_cost: superAgentCost,
          unit_house_cost: houseCost,
          isLocalFulfillment: false
        } as any);
      }

      if (!split || (split.localQty === 0 && split.chinaQty === 0)) {
        subtotal = Math.round((subtotal + retailPrice * itemQty) * 100) / 100;
        totalWeightOz += (Number(dbProduct.weight_oz) || 0.5) * itemQty;
        computedItems.push({
          product_id: dbProduct.id,
          product_name: finalProductName,
          quantity: itemQty,
          unit_retail_price: retailPrice,
          unit_cost_price: costPrice,
          unit_super_agent_cost: superAgentCost,
          unit_house_cost: houseCost,
          isLocalFulfillment: false
        } as any);
      }
    }

    // STEP A: ATOMIC INVENTORY RESERVATION
    const localItems = computedItems.filter((i: any) => i.isLocalFulfillment).map(i => ({ product_id: i.product_id, quantity: i.quantity }));
    const chinaItems = computedItems.filter((i: any) => !i.isLocalFulfillment).map(i => ({ product_id: i.product_id, quantity: i.quantity }));

    let localReserved = false;
    let chinaReserved = false;

    const releaseReservedInventory = async () => {
      // A failed release is silent stock corruption (reserved units never
      // return to the pool) -- it must be loud even though the caller is on
      // an error path already.
      if (localReserved && localItems.length > 0) {
        const { error: relErr } = await serviceSupabase.rpc('release_inventory', { p_items: localItems, p_agent_id: agentProfile?.id, p_is_agent_ship: true });
        if (relErr) {
          logError('orders.POST.compensation.release_inventory_local', { userId: user.id }, relErr);
          captureError(relErr, { context: 'orders.POST.compensation.release_inventory_local', userId: user.id, items: localItems });
        } else {
          localReserved = false;
        }
      }
      if (chinaReserved && chinaItems.length > 0) {
        const { error: relErr } = await serviceSupabase.rpc('release_inventory', { p_items: chinaItems, p_agent_id: null, p_is_agent_ship: false });
        if (relErr) {
          logError('orders.POST.compensation.release_inventory_china', { userId: user.id }, relErr);
          captureError(relErr, { context: 'orders.POST.compensation.release_inventory_china', userId: user.id, items: chinaItems });
        } else {
          chinaReserved = false;
        }
      }
    };
    compensateOnThrow = releaseReservedInventory;

    if (fulfillmentMethod !== 'agent_pickup') {
      if (localItems.length > 0) {
        const { error: reserveErr } = await serviceSupabase.rpc('reserve_inventory', { p_items: localItems, p_agent_id: agentProfile?.id, p_is_agent_ship: true });
        if (reserveErr) {
          // Log every failure (an unexpected RPC regression previously
          // produced zero server-side evidence), and NEVER echo raw Postgres
          // RAISE text to the buyer -- it can carry product UUIDs and stock
          // internals.
          const isStock = /Insufficient inventory/i.test(reserveErr.message);
          logError('orders.POST.reserve_inventory_local', { userId: user.id, isStock, code: (reserveErr as { code?: string }).code }, reserveErr);
          if (!isStock) captureError(reserveErr, { context: 'orders.POST.reserve_inventory_local', userId: user.id });
          return NextResponse.json({ error: isStock ? 'Insufficient Local Inventory For One Or More Items. Please Reduce Quantities And Try Again.' : 'Failed To Reserve Local Inventory. Please Try Again.' }, { status: 422 });
        }
        localReserved = true;
      }
      if (chinaItems.length > 0) {
        const { error: reserveErr } = await serviceSupabase.rpc('reserve_inventory', { p_items: chinaItems, p_agent_id: null, p_is_agent_ship: false });
        if (reserveErr) {
          await releaseReservedInventory();
          const isStock = /Insufficient inventory/i.test(reserveErr.message);
          logError('orders.POST.reserve_inventory_china', { userId: user.id, isStock, code: (reserveErr as { code?: string }).code }, reserveErr);
          if (!isStock) captureError(reserveErr, { context: 'orders.POST.reserve_inventory_china', userId: user.id });
          return NextResponse.json({ error: isStock ? 'Insufficient Inventory For One Or More Items. Please Reduce Quantities And Try Again.' : 'Failed To Reserve Global Inventory. Please Try Again.' }, { status: 422 });
        }
        chinaReserved = true;
      }
    }

    // STEP B: BEST-DEAL DISCOUNT SELECTION ("one offer at a time")
    // flash / quantity / coupon never stack -- the single largest discount applies. An entered
    // coupon is validated (and, if it wins, redeemed atomically); a valid-but-smaller coupon is
    // left unburned so the customer keeps their code and still gets the better automatic deal.
    let discountAmount = 0;
    let discountSource: 'coupon' | 'flash' | 'quantity' | null = null;
    let appliedCouponCode: string | null = null;
    let appliedCouponId: string | null = null;
    const trimmedCouponCode = couponCode ? String(couponCode).trim().toUpperCase() : '';

    if ((isAgentSelfBuy || isSubAgent) && trimmedCouponCode) {
      await releaseReservedInventory();
      return NextResponse.json(
        { error: 'Coupon Codes Cannot Be Applied To Agent Or Sub-Agent Self-Buy Orders.' },
        { status: 403 }
      );
    }

    // Manufacturer stores: prices are the manufacturer's own -- no coupons or
    // promo codes ever apply (a discount would come out of their split).
    if (isManufacturerStore && trimmedCouponCode) {
      await releaseReservedInventory();
      return NextResponse.json(
        { error: 'Coupons And Promo Codes Are Not Available On This Store.' },
        { status: 403 }
      );
    }

    const autoDisc = Math.max(flashDiscTotal, qtyDiscTotal);
    const autoSource: 'flash' | 'quantity' | null =
      autoDisc <= 0 ? null : (flashDiscTotal >= qtyDiscTotal ? 'flash' : 'quantity');

    if (trimmedCouponCode) {
      // Buyers with no referring agent (the admin's own account, legacy
      // accounts) fall back to the house storefront so house coupons work.
      const couponAgentId = profile.referring_agent_id ?? agentProfile?.id
        ?? (await getHouseAgentId(serviceSupabase));
      if (!couponAgentId) {
        await releaseReservedInventory();
        return NextResponse.json(
          { error: 'Coupon Codes Are Only Valid For Orders Placed Through A Referring Agent.' },
          { status: 400 }
        );
      }
      // Validate WITHOUT burning a coupon use, so the coupon can compete with the
      // automatic discounts. Also translates platform signup promo codes (e.g.
      // FIRST20) into the buyer's personal first-order coupon; `check.code` is
      // the coupon actually applied and MUST be used for redeem + order rows.
      // An invalid / expired / limit-reached code still fails loudly (unchanged behavior).
      const check = await resolveCheckoutCoupon(serviceSupabase, {
        code: trimmedCouponCode, agentId: couponAgentId, subtotal, userId: user.id,
      });
      if (!check.valid) {
        await releaseReservedInventory();
        return NextResponse.json({ error: check.error || 'Coupon Invalid Or Limit Reached' }, { status: 422 });
      }
      const resolvedCouponCode = check.code || trimmedCouponCode;
      const couponDisc = Number(check.discount) || 0;

      // Coupon applies only if it is the best deal. Redeem atomically (full server-side
      // re-validation incl. starts_at / new_customers_only + per-user cap) to burn the use.
      if (couponDisc > 0 && couponDisc >= autoDisc) {
        const { data: redeem, error: redeemError } = await serviceSupabase
          .rpc('redeem_coupon', {
            p_code: resolvedCouponCode,
            p_agent_id: couponAgentId,
            p_order_subtotal: subtotal,
            p_user_id: user.id,
          });
        const row = Array.isArray(redeem) ? redeem[0] : redeem;
        if (redeemError || !row?.coupon_id) {
          await releaseReservedInventory();
          return NextResponse.json({ error: 'Coupon Invalid Or Limit Reached' }, { status: 422 });
        }
        appliedCouponId = row.coupon_id;
        appliedCouponCode = resolvedCouponCode;
        discountAmount = Number(row.discount_amount) || 0;
        discountSource = 'coupon';
      }
    }

    // If no coupon won, apply the single best automatic discount (flash or quantity), if any.
    if (discountSource === null && autoDisc > 0) {
      discountAmount = autoDisc;
      discountSource = autoSource;
    }

    // Minimum-margin fail-safe, discount leg: promotional discounts (coupon /
    // flash sale / quantity) are order-level and invisible to the per-unit
    // floor above. Cap the applied discount so the blended order margin can
    // never drop below 10% over the agent's cost.
    if (!(isAgentSelfBuy || isSubAgent) && !isManufacturerStore && discountAmount > 0) {
      const orderCostBasis = computedItems.reduce(
        (sum, i: any) => sum + (Number(i.unit_cost_price) || 0) * (Number(i.quantity) || 0),
        0
      );
      const maxDiscount = Math.max(0, Math.round((subtotal - orderCostBasis * 1.10) * 100) / 100);
      if (discountAmount > maxDiscount) {
        discountAmount = maxDiscount;
      }
    }

    // Roll back everything committed before the order row exists - reserved
    // inventory and a redeemed coupon. Every rejection path between here and the
    // order insert calls this so a refused checkout never leaks stock or a coupon
    // use (no order row exists for the stale-order cron to reconcile).
    const rollbackPreOrder = async () => {
      await releaseReservedInventory();
      if (appliedCouponId) {
        const { error: unredeemErr } = await serviceSupabase.rpc('unredeem_coupon', { p_coupon_id: appliedCouponId });
        if (unredeemErr) {
          logError('orders.POST.compensation.unredeem_coupon', { userId: user.id, couponId: appliedCouponId }, unredeemErr);
          captureError(unredeemErr, { context: 'orders.POST.compensation.unredeem_coupon', userId: user.id, couponId: appliedCouponId });
        }
        appliedCouponId = null;
      }
    };
    compensateOnThrow = rollbackPreOrder;

    // Calculate shipping costs. Shipping option is derived STRICTLY from
    // fulfillmentMethod, never trusted from the client's shippingOption field:
    //   - agent_pickup fulfillment  -> always 'agent_pickup' (free), even if the
    //     client sent a carrier (prevents a bogus shipping charge on pickup).
    //   - ship fulfillment          -> a real carrier only. A client sending
    //     shippingOption='agent_pickup' (or anything non-carrier) with a shipped
    //     order previously collapsed shipping to $0 -- free shipping exploit.
    //     Coerce any non-carrier value to the default paid carrier.
    const CARRIERS = ['fedex', 'usps'] as const;
    const actualShippingOption: import('@/lib/shipping-cost').ShippingOption = fulfillmentMethod === 'agent_pickup'
      ? 'agent_pickup'
      : (CARRIERS.includes(shippingOption as (typeof CARRIERS)[number]) ? (shippingOption as (typeof CARRIERS)[number]) : 'usps');
    // Shipping charge: prefer the LIVE cheapest carrier rate (EasyPost) from the
    // agent's warehouse to the buyer's address, so the buyer pays what the
    // platform actually pays for the label instead of a decoupled flat estimate.
    // The flat weight table remains the fallback (EasyPost slow/unavailable, no
    // rate for the destination, or address incomplete). quoteCheapestForCheckout
    // is non-throwing and hard-bounded by an internal timeout, so it can never
    // hang or fail the order; on any miss we keep the flat estimate.
    let shippingCost = calculateShippingCost(actualShippingOption, totalWeightOz);
    if (actualShippingOption !== 'agent_pickup' && shippingAddress) {
      try {
        const to = normalizeShippingAddress(shippingAddress, {
          full_name: (profile as { full_name?: string | null })?.full_name ?? null,
        });
        if (to) {
          const totalQty = computedItems.reduce((s: number, i: any) => s + (Number(i.quantity) || 0), 0);
          const live = await quoteCheapestForCheckout({
            agentId: agentProfile?.id ?? null,
            to,
            weightOz: totalWeightOz,
            totalQty,
          });
          if (live && live.amountCents > 0) {
            shippingCost = Math.round(live.amountCents) / 100;
          }
        }
      } catch {
        /* keep the flat estimate computed above */
      }
    }

    // Round the final money total to exact cents so accumulated FP dust never
    // reaches the stored order total or credit/velocity comparisons.
    // House-store free shipping: $100+ orders on the admin/house storefront
    // (researchstore) ship free. Placed before grossTotal so total, stored
    // shipping_cost, and downstream COGS agree. Pickup is already $0.
    if (agentSlug === DEFAULT_STORE_SLUG && actualShippingOption !== 'agent_pickup' && subtotal >= 100) {
      shippingCost = 0;
    }

    const grossTotal = Math.round((Math.max(0, subtotal - discountAmount) + shippingCost) * 100) / 100;
    const total = Math.max(0, grossTotal);

    // Velocity caps (flag-gated, additive). A researcher order placed through a
    // sub-agent's storefront is held against that sub-agent's virtual velocity
    // cap - a ceiling on unsettled (pre-shipment) order value. This does NOT
    // touch the super-agent's House credit; that is decremented later by the
    // existing billing path when the order is Approved for Shipment. The check
    // only ever ADDS a rejection, so flag-off behavior is byte-identical and the
    // existing credit/prepaid protections are unaffected.
    if (isTierLadderV2() && !isAgentSelfBuy && agentProfile?.parent_agent_id) {
      const { data: subCapRow } = await serviceSupabase
        .from('profiles').select('velocity_cap').eq('id', agentProfile.id).maybeSingle();
      const cap = subCapRow?.velocity_cap == null ? null : Number(subCapRow.velocity_cap);
      if (cap != null && cap > 0) {
        const { data: consumed } = await serviceSupabase
          .rpc('fn_sub_agent_consumed_velocity', { p_sub: agentProfile.id });
        const used = Number(consumed) || 0;
        if (used + total > cap + 0.001) {
          await rollbackPreOrder();
          const remaining = Math.max(0, cap - used);
          return NextResponse.json(
            { error: `Velocity Cap Reached. This Order Of $${total.toFixed(2)} Would Exceed Your Available Limit ($${remaining.toFixed(2)} Remaining). Contact Your Agent To Raise It.` },
            { status: 403 },
          );
        }
      }
    }

    // Disclaimer audit check: verify Layer 3 (add_to_cart) acceptance exists before
    // inserting Layer 4 (checkout). A missing add_to_cart row means the researcher
    // bypassed the cart disclaimer gate -- refuse the order.
    const { data: addToCartRow } = await serviceSupabase
      .from('disclaimer_acceptances')
      .select('id')
      .eq('user_id', user.id)
      .eq('layer', 'add_to_cart')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!addToCartRow) {
      await rollbackPreOrder();
      return NextResponse.json(
        { error: 'Disclaimer Acceptance Required. Please Add Items To Your Cart Again And Accept The Disclaimer.' },
        { status: 403 }
      );
    }

    // Record the Layer 4 (checkout) disclaimer audit row.
    // Use getClientIp() which reads Vercel's trusted x-vercel-forwarded-for header
    // rather than the attacker-controllable X-Forwarded-For header.
    const disclaimerVersion = process.env.NEXT_PUBLIC_DISCLAIMER_VERSION || 'v1.0';
    const checkoutIp = getClientIp(request);
    const checkoutUserAgent = request.headers.get('user-agent') || null;

    const { data: disclaimerRow, error: disclaimerError } = await serviceSupabase
      .from('disclaimer_acceptances')
      .insert({
        user_id: user.id,
        disclaimer_version: disclaimerVersion,
        layer: 'checkout',
        user_agent: checkoutUserAgent,
        ip_address: checkoutIp,
      })
      .select('id')
      .maybeSingle();

    if (disclaimerError || !disclaimerRow) {
      console.error('Checkout Disclaimer Audit Insert Failed:', disclaimerError);
      await rollbackPreOrder();
      return NextResponse.json(
        { error: 'Disclaimer Audit Failed; Order Not Placed.' },
        { status: 500 }
      );
    }

    const isWholesaleRestock =
      explicitWholesale === true &&
      (profile.role === 'agent' || profile.role === 'super_agent') &&
      !isSubAgent;

    let initialStatus = 'pending_customer_payment';
    let prepaidDeducted = false;
    let prepaidDeductedAmount = 0;
    let prepaidDeductedAgentId: string | null = null;

    // A failed prepaid refund is silent money loss for the agent -- report it
    // as loudly as anything in this file. Sets prepaidDeducted=false on
    // success so a later compensation pass never double-refunds.
    const refundPrepaidIfNeeded = async () => {
      if (!(prepaidDeducted && prepaidDeductedAmount > 0 && prepaidDeductedAgentId)) return;
      const { error: refundErr } = await serviceSupabase.rpc('refund_prepaid_balance', { p_agent_id: prepaidDeductedAgentId, p_amount: prepaidDeductedAmount });
      if (refundErr) {
        logError('orders.POST.compensation.refund_prepaid_balance', { userId: user.id, agentId: prepaidDeductedAgentId, amount: prepaidDeductedAmount }, refundErr);
        captureError(refundErr, { context: 'orders.POST.compensation.refund_prepaid_balance', severity: 'critical', userId: user.id, agentId: prepaidDeductedAgentId, amount: prepaidDeductedAmount, idempotencyKey: idempotencyKey ?? null });
      } else {
        prepaidDeducted = false;
      }
    };

    // Full compensation for a failed attempt: inventory, coupon, prepaid.
    const compensateFailedAttempt = async () => {
      await rollbackPreOrder();
      await refundPrepaidIfNeeded();
    };
    compensateOnThrow = compensateFailedAttempt;

    const checkSuperAgentCredit = async (saProfile: any, amount: number) => {
      if (saProfile.account_type === 'prepaid') {
        const bal = Number(saProfile.prepaid_balance) || 0;
        if (bal < amount) {
          return { error: `Insufficient Prepaid Balance. Requires $${amount.toFixed(2)}, But Balance Is $${bal.toFixed(2)}. Please Recharge Your Account.`, status: 402 };
        }
        const { data: deductSuccess } = await serviceSupabase.rpc('deduct_prepaid_balance', {
          agent_id: saProfile.id,
          amount: amount,
          p_order_id: null,
          p_description: 'Order Payment',
        });
        if (!deductSuccess) return { error: 'Failed To Deduct Prepaid Balance.', status: 500 };
        return { success: true, prepaidDeducted: true, amount, agentId: saProfile.id };
      } else if (saProfile.account_type === 'credit') {
        const { data: statements } = await serviceSupabase.from('weekly_statements').select('total_owed').eq('agent_id', saProfile.id).eq('status', 'pending_payment');
        let currentUnbilled = 0;
        statements?.forEach((s) => (currentUnbilled += Number(s.total_owed) || 0));

        const { data: subAgents } = await serviceSupabase.from('profiles').select('id').eq('parent_agent_id', saProfile.id);
        const agentIds = [saProfile.id, ...(subAgents?.map((s: { id: string }) => s.id) || [])];

        // Unbilled = no statement_orders link. statement_orders.statement_id is
        // NOT NULL, so "embedded resource is empty" is exactly the set the old
        // in-memory filter kept; push it server-side via .is(..., null) and
        // select only the columns the in-flight sum reads (id dropped).
        const { data: approvedOrders } = await serviceSupabase
          .from('orders')
          .select('shipping_cost, statement_orders(statement_id), order_items(quantity, unit_cost_price, unit_super_agent_cost), agent_id')
          .in('agent_id', agentIds)
          .eq('is_wholesale_restock', false)
          .in('status', ['approved_ship', 'approved_pickup', 'in_fulfillment', 'shipped', 'delivered'])
          .is('statement_orders', null);

        let inFlight = 0;
        for (const o of approvedOrders ?? []) {
          // Belt-and-braces: the server-side .is() filter above already excludes
          // billed orders; this guard keeps the computed sum exact regardless.
          const links = (o.statement_orders as unknown) as Array<{ statement_id: string | null }> | null;
          if (Array.isArray(links) && links.some((l) => l?.statement_id)) continue;
          const ship = Number((o as { shipping_cost?: unknown }).shipping_cost) || 0;
          const its = ((o as { order_items?: unknown }).order_items ?? []) as Array<{ quantity: number; unit_cost_price: number | null; unit_super_agent_cost: number | null; }>;
          let orderCogs = 0;
          for (const it of its) {
            const qty = Number(it.quantity) || 0;
            const superCost = Number(it.unit_super_agent_cost);
            const agentCost = Number(it.unit_cost_price);
            const isSubOrder = (o as { agent_id?: string | null }).agent_id !== saProfile.id;
            const cost = isSubOrder ? (Number.isFinite(superCost) && superCost > 0 ? superCost : agentCost) : agentCost;
            orderCogs += (Number.isFinite(cost) && cost > 0 ? cost : 0) * qty;
          }
          inFlight += orderCogs + ship;
        }

        const creditLimit = Number(saProfile.credit_limit) || 0;
        const projected = currentUnbilled + inFlight + amount;
        if (projected > creditLimit) {
          return { error: `Credit Limit Exceeded. Your Order Of $${amount.toFixed(2)} Pushes Your Balance To $${projected.toFixed(2)} (Limit: $${creditLimit.toFixed(2)}). Please Pay Your Pending Weekly Statements.`, status: 403 };
        }
        return { success: true, prepaidDeducted: false };
      } else {
        return { error: 'Your Account Is Not Configured For Wholesale Credit Or Prepaid. Please Contact Admin.', status: 403 };
      }
    };



    // A NULL max_auto_approve_limit must NOT mean "auto-approve any amount".
    // Fall back to a conservative cap so unbounded totals are never silently
    // auto-approved; anything above it drops to manual approval.
    const DEFAULT_AUTO_APPROVE_LIMIT = 1000;
    const limit = profile.max_auto_approve_limit !== undefined && profile.max_auto_approve_limit !== null ? Number(profile.max_auto_approve_limit) : DEFAULT_AUTO_APPROVE_LIMIT;
    const isUserCredit = (profile.account_type === 'credit' || profile.auto_approve_orders === true) && (total <= limit);
    const autoApproveStatus = fulfillmentMethod === 'agent_pickup' ? 'approved_pickup' : 'approved_ship';

    // Manufacturer stores: the factory fulfils every order by hand (China-shipped
    // with its own carrier tracking) and is NEVER billed COGS, so its orders always
    // wait for the manufacturer's explicit approval. Never auto-approve and never
    // route through the super-agent credit/prepaid billing below -- that path would
    // wrongly bill the manufacturer their own commission and skip their review.
    // Mirrors the manufacturer bypass in /api/agent/orders/approve.
    if (isManufacturerStore) {
      initialStatus = 'agent_approval_pending';
    } else if (isWholesaleRestock) {
      if (profile.role === 'super_agent') {
        if (isUserCredit) {
          const res = await checkSuperAgentCredit(profile, total);
          if (res.error) { await rollbackPreOrder(); return NextResponse.json({ error: res.error }, { status: res.status }); }
          prepaidDeducted = res.prepaidDeducted || false;
          if (prepaidDeducted) {
            prepaidDeductedAmount = res.amount || 0;
            prepaidDeductedAgentId = res.agentId || null;
          }
          initialStatus = autoApproveStatus;
        } else {
          initialStatus = 'pending_customer_payment';
        }
      } else if (profile.role === 'agent') {
        if (isUserCredit && superAgentProfile) {
          let wholesaleCogs = 0;
          for (const item of computedItems) {
            wholesaleCogs += (item.unit_super_agent_cost !== null ? item.unit_super_agent_cost : item.unit_cost_price) * item.quantity;
          }
          wholesaleCogs += shippingCost;

          const res = await checkSuperAgentCredit(superAgentProfile, wholesaleCogs);
          if (res.error) { await rollbackPreOrder(); return NextResponse.json({ error: res.error }, { status: res.status }); }
          prepaidDeducted = res.prepaidDeducted || false;
          if (prepaidDeducted) {
            prepaidDeductedAmount = res.amount || 0;
            prepaidDeductedAgentId = res.agentId || null;
          }
          initialStatus = autoApproveStatus;
        } else {
          initialStatus = 'agent_approval_pending';
        }
      }
    } else {
      if (isUserCredit) {
        if (agentProfile && agentProfile.role === 'agent') {
          if (superAgentProfile) {
            let retailCogs = 0;
            for (const item of computedItems) {
              const cost = item.unit_super_agent_cost !== null ? item.unit_super_agent_cost : item.unit_cost_price;
              retailCogs += cost * item.quantity;
            }
            retailCogs += shippingCost;

            const res = await checkSuperAgentCredit(superAgentProfile, retailCogs);
            if (res.error) { await rollbackPreOrder(); return NextResponse.json({ error: res.error }, { status: res.status }); }
            prepaidDeducted = res.prepaidDeducted || false;
            if (prepaidDeducted) {
              prepaidDeductedAmount = res.amount || 0;
              prepaidDeductedAgentId = res.agentId || null;
            }
            initialStatus = autoApproveStatus;
          } else {
            initialStatus = 'agent_approval_pending';
          }
        } else if (agentProfile && agentProfile.role === 'super_agent') {
          let retailCogs = 0;
          for (const item of computedItems) {
             retailCogs += item.unit_cost_price * item.quantity;
          }
          retailCogs += shippingCost;

          const res = await checkSuperAgentCredit(agentProfile, retailCogs);
          if (res.error) { await rollbackPreOrder(); return NextResponse.json({ error: res.error }, { status: res.status }); }
          prepaidDeducted = res.prepaidDeducted || false;
          if (prepaidDeducted) {
            prepaidDeductedAmount = res.amount || 0;
            prepaidDeductedAgentId = res.agentId || null;
          }
          initialStatus = autoApproveStatus;
        } else {
          initialStatus = autoApproveStatus;
        }
      } else {
        initialStatus = 'agent_approval_pending';
      }
    }
    // GUARD: Ensure we actually have items to insert before creating the order row.
    // This check MUST run before the INSERT -- after the INSERT, a delete is lossy:
    // it does NOT release reserved inventory, does NOT unredeem the coupon, and does
    // NOT refund prepaid balance. Checking here lets rollbackPreOrder() clean up cleanly.
    if (computedItems.length === 0) {
      await rollbackPreOrder();
      return NextResponse.json({ error: 'Cart Items Could Not Be Processed. Please Try Again.' }, { status: 400 });
    }

    // Create checkout order
    const { data: order, error: orderError } = await serviceSupabase
      .from('orders')
      .insert({
        buyer_id: user.id,
        buyer_name: (profile as any).full_name || null,
        buyer_email: user.email || null,
        // agent_id = the storefront owner whose sales this order credits.
        // For an agent self-buy, that IS the buyer (agentProfile.id == profile.id).
        // Previously this was incorrectly set to superAgentProfile.id, making the
        // order invisible in the agent's own sales dashboard. superAgentProfile is
        // used only for pricing/billing-chain — it does NOT own the sale.
        agent_id: agentProfile?.id || null,
        is_wholesale_restock: isWholesaleRestock,
        status: initialStatus,
        fulfillment_method: fulfillmentMethod,
        payment_method: paymentMethod,
        shipping_address: shippingAddress ?? null,
        shipping_cost: shippingCost,
        carrier: getCarrierName(actualShippingOption),
        subtotal: subtotal,
        discount_amount: discountAmount,
        discount_source: discountSource,
        coupon_code: appliedCouponCode,
        total: total,
        // Route owns this order's inventory (reserve_inventory ran above with a
        // precise local/China split). The approval trigger skips reserved orders
        // so stock is never deducted a second time on approval.
        inventory_reserved: localReserved || chinaReserved,
        idempotency_key: idempotencyKey ?? null,
      })
      .select('id, total')
      .maybeSingle();

    if (orderError || !order) {
      // Handle unique constraint violation on idempotency_key (race between two
      // concurrent requests with the same key -- the loser returns the winner's order)
      if (orderError && (orderError as any).code === '23505' && idempotencyKey) {
        const { data: existing } = await serviceSupabase
          .from('orders')
          .select('id, total')
          .eq('idempotency_key', idempotencyKey)
          .eq('buyer_id', user.id)
          .maybeSingle();
        if (existing) {
          // This duplicate (same idempotency_key) request lost the INSERT race
          // but already re-ran reserve / redeem / prepaid-deduct above. Undo ALL
          // of THIS attempt's side effects before returning the original order.
          await compensateFailedAttempt();
          return NextResponse.json({
            success: true,
            orderId: existing.id,
            total: Number(existing.total) || 0,
            replayed: true,
          });
        }
      }
      await compensateFailedAttempt();
      logError('orders.POST.order_insert', { userId: user.id, idempotencyKey: idempotencyKey ?? null }, orderError);
      captureError(orderError, { context: 'orders.POST.order_insert', userId: user.id, idempotencyKey: idempotencyKey ?? null });
      return NextResponse.json({ error: 'Failed To Save Order Transaction.' }, { status: 500 });
    }

    // Back-fill order_id on the disclaimer acceptance row for compliance audit joins.
    // Must not block the response -- wrap in non-throwing promise chain.
    Promise.resolve(
      serviceSupabase
        .from('disclaimer_acceptances')
        .update({ order_id: order.id })
        .eq('id', disclaimerRow.id)
    ).then(({ error: dErr }) => {
      if (dErr) console.error('[orders] disclaimer order_id backfill failed:', dErr.message);
    }).catch((e: unknown) => {
      // Transport-level rejection has no resolved error object; must not surface
      // as an unhandled rejection in the serverless runtime.
      console.error('[orders] disclaimer order_id backfill threw:', e instanceof Error ? e.message : String(e));
    });

    const itemsToInsert = computedItems.map(item => ({
      order_id: order.id,
      product_id: item.product_id,
      product_name: item.product_name ?? 'Unknown Product',
      quantity: item.quantity,
      unit_retail_price: item.unit_retail_price,
      unit_cost_price: item.unit_cost_price,
      unit_super_agent_cost: item.unit_super_agent_cost,
      unit_house_cost: (item as any).unit_house_cost ?? null,
      // Tag agent-local lines so a later cancel restores exactly what
      // reserve_inventory took from agent_inventory (China is never tracked).
      fulfilled_locally: (item as any).isLocalFulfillment === true,
    }));

    const { error: itemsError } = await serviceSupabase
      .from('order_items')
      .insert(itemsToInsert);

    if (itemsError) {
      logError('orders.POST.order_items_insert', { userId: user.id, orderId: order.id }, itemsError);
      captureError(itemsError, { context: 'orders.POST.order_items_insert', userId: user.id, orderId: order.id });
      const { error: deleteErr } = await serviceSupabase.from('orders').delete().eq('id', order.id);
      if (deleteErr) {
        // Orphan order row (no items). The stale-order cron will cancel it,
        // but report it so the pattern is visible.
        captureError(deleteErr, { context: 'orders.POST.compensation.orphan_order_delete', orderId: order.id });
      }
      await compensateFailedAttempt();

      return NextResponse.json({ error: 'An Unexpected Error Occurred While Saving Order Items.' }, { status: 500 });
    }
    // The order + items now exist: the outer catch must no longer roll back
    // inventory/coupon/prepaid -- those belong to this order.
    orderCommitted = true;
    compensateOnThrow = null;

    // MANUFACTURER LEDGER: one row per order on a manufacturer store. The
    // commission base is the PRODUCT subtotal minus discounts -- shipping is
    // excluded and passes through to the manufacturer in full.
    if (isManufacturerStore && agentProfile) {
      try {
        const commissionBase = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);
        const platformCommission = Math.round(commissionBase * (manufacturerCommissionPct / 100) * 100) / 100;
        const manufacturerNet = Math.round((commissionBase - platformCommission) * 100) / 100;
        const { error: ledgerErr } = await serviceSupabase
          .from('manufacturer_ledger')
          .insert({
            order_id: order.id,
            manufacturer_id: agentProfile.id,
            product_subtotal: subtotal,
            discount_amount: discountAmount,
            commission_base: commissionBase,
            commission_pct: manufacturerCommissionPct,
            platform_commission: platformCommission,
            manufacturer_net: manufacturerNet,
            shipping_collected: shippingCost,
          });
        if (ledgerErr) {
          logError('orders.POST.manufacturer_ledger_insert', { orderId: order.id, agentId: agentProfile.id }, ledgerErr);
          captureError(ledgerErr, { context: 'orders.POST.manufacturer_ledger_insert', severity: 'critical', orderId: order.id, agentId: agentProfile.id });
        }
      } catch (ledgerCatch) {
        captureError(ledgerCatch, { context: 'orders.POST.manufacturer_ledger_insert_threw', severity: 'critical', orderId: order.id });
      }
    }

    if (initialStatus === 'approved_ship' || initialStatus === 'approved_pickup') {
      const { error: creditErr } = await serviceSupabase.rpc('charge_order_credit_line', { p_order_id: order.id, p_created_by: user.id });
      if (creditErr) {
        // The credit charge failed. Do NOT leave the order in an approved /
        // shippable state -- that would ship goods that were never billed.
        // Demote it to the manual-approval status used elsewhere in this file
        // and skip the shipping-label enqueue so nothing goes out the door until
        // a human reconciles the billing.
        logError('orders.POST.charge_order_credit_line', { orderId: order.id, userId: user.id }, creditErr);
        captureError(creditErr, { context: 'orders.POST.charge_order_credit_line', severity: 'critical', orderId: order.id, userId: user.id });
        const { error: demoteErr } = await serviceSupabase
          .from('orders')
          .update({ status: 'agent_approval_pending' })
          .eq('id', order.id);
        if (demoteErr) {
          // Double failure: the order is still approved_ship with no billing
          // row -- unbilled goods will ship unless a human intervenes. Retry
          // once, then escalate via Sentry + admin notification.
          const { error: demoteRetryErr } = await serviceSupabase
            .from('orders')
            .update({ status: 'agent_approval_pending' })
            .eq('id', order.id);
          if (demoteRetryErr) {
            captureError(demoteRetryErr, { context: 'orders.POST.charge_credit_demotion_failed', severity: 'critical', orderId: order.id });
            try {
              const { data: admins } = await serviceSupabase.from('profiles').select('id').eq('role', 'admin');
              for (const a of admins ?? []) {
                await notify(serviceSupabase, {
                  userId: a.id,
                  type: 'system',
                  title: 'Billing Reconciliation Required',
                  body: `Order ${shortOrderId(order.id)} Is Approved But Its Credit Charge Failed And Demotion Also Failed. Manual Review Required.`,
                  url: `/admin/orders?highlight=${order.id}`,
                });
              }
            } catch (notifyErr) {
              captureError(notifyErr, { context: 'orders.POST.charge_credit_admin_notify', orderId: order.id });
            }
          }
        }
      }
      // NOTE: no label job is enqueued here. Shipping labels are purchased
      // MANUALLY (on-demand) via the admin/agent label flows; the label-jobs
      // cron is retired, so enqueuing rows here only filled a queue nothing
      // drains (removed 2026-07-19).
    }

    // SACA Phase 4: Sub-Agent Commission Accrual
    try {
      let effectiveReferringSubAgentId: string | null = null;
      if (isSubAgent) {
        effectiveReferringSubAgentId = user.id;
      } else {
        const referringSub = (profile as { referring_sub_agent_id?: string | null }).referring_sub_agent_id;
        if (referringSub && typeof referringSub === 'string') {
          effectiveReferringSubAgentId = referringSub;
        }
      }

      if (effectiveReferringSubAgentId) {
        await serviceSupabase
          .from('orders')
          .update({ referring_sub_agent_id: effectiveReferringSubAgentId })
          .eq('id', order.id);

        const { error: accrueErr } = await serviceSupabase
          .rpc('accrue_sub_agent_commission', { p_order_id: order.id });
        if (accrueErr) {
          console.error('[orders] accrue_sub_agent_commission failed:', accrueErr.message);
        } else {
          // Commission accrued silently before - tell the earning sub-agent.
          // Amount is read back from the order row the RPC just stamped.
          const subAgentToNotify = effectiveReferringSubAgentId;
          after(async () => {
            try {
              const { data: commRow } = await serviceSupabase
                .from('orders')
                .select('sub_agent_commission_amount')
                .eq('id', order.id)
                .maybeSingle();
              const amt = Number(commRow?.sub_agent_commission_amount) || 0;
              if (amt > 0 && subAgentToNotify && subAgentToNotify !== user.id) {
                await notifyCommissionEarned(
                  serviceSupabase,
                  subAgentToNotify,
                  `$${amt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                  order.id,
                );
              }
            } catch { /* commission notify is best-effort */ }
          });
        }
      }
    } catch (e) {
      console.error('[orders] SACA accrual block threw:', e);
    }

    // Abandoned-cart recovery attribution
    try {
      const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const { data: openReminder } = await serviceSupabase
        .from('abandoned_cart_reminders')
        .select('id')
        .eq('user_id', user.id)
        .is('recovered_order_id', null)
        .gt('sent_at', fourteenDaysAgo)
        .order('sent_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (openReminder?.id) {
        await serviceSupabase
          .from('abandoned_cart_reminders')
          .update({ recovered_order_id: order.id })
          .eq('id', openReminder.id);
      }
    } catch {
      // Best-effort attribution
    }

    // ── Post-commit fan-out (after the response flushes) ────────────────────
    // Everything below is a best-effort side effect of an already-committed
    // order: timeline events, in-app + push notifications for every party
    // (buyer, agent, super-agent upline, admins), the agent's sale email, and
    // the buyer's confirmation email. Deferring the whole block with after()
    // keeps checkout latency flat while Vercel guarantees the work completes.
    {
      const short = shortOrderId(order.id);
      const buyerName = (profile as { full_name?: string | null }).full_name || 'A Researcher';
      const orderTotal = Number(order.total) || 0;
      const totalFmt = `$${orderTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const storeSlug = agentConfig?.slug ? `/${agentConfig.slug}` : 'A Storefront';
      const autoApproved = initialStatus === 'approved_ship' || initialStatus === 'approved_pickup';
      // Aggregate quantities by product name: computedItems carries a separate
      // row per local/China warehouse split, which would otherwise render the
      // same product twice in emailed summaries.
      const qtyByName = new Map<string, number>();
      for (const i of computedItems as Array<{ product_name: string; quantity: number }>) {
        qtyByName.set(i.product_name, (qtyByName.get(i.product_name) ?? 0) + (Number(i.quantity) || 0));
      }
      const itemsSummary = [...qtyByName.entries()].map(([n, q]) => `${q}x ${n}`).join(', ');
      const paymentHandle = initialStatus === 'pending_customer_payment'
        ? ((agentConfig?.payment_handles as Record<string, string> | null | undefined)?.[paymentMethod] ?? null)
        : null;

      after(async () => {
        try {
          const tasks: Promise<unknown>[] = [];

          // Order timeline events.
          tasks.push(logOrderEvent(serviceSupabase, {
            orderId: order.id,
            event: 'placed',
            actorId: user.id,
            actorRole: profile.role ?? null,
            payload: { status: initialStatus, total: orderTotal, agent_id: agentProfile?.id ?? null, payment_method: paymentMethod },
          }));
          if (autoApproved) {
            tasks.push(logOrderEvent(serviceSupabase, {
              orderId: order.id,
              event: 'auto_approved',
              payload: { status: initialStatus },
            }));
          }

          // Agent of record: sale alert (in-app + push + email).
          if (agentProfile && !isAgentSelfBuy) {
            tasks.push(notifyOrderPlaced(serviceSupabase, agentProfile.id, order.id, short, buyerName));
            if (appliedCouponCode && discountAmount > 0) {
              tasks.push(notifyCouponRedeemed(
                serviceSupabase,
                agentProfile.id,
                appliedCouponCode,
                discountAmount,
                orderTotal,
                order.id,
                short,
              ));
            }
            tasks.push(enqueuePush(serviceSupabase, {
              userId: agentProfile.id,
              title: `New Order #${short}`,
              body: `${buyerName} Placed A ${totalFmt} Order. Tap To Review.`,
              url: '/dashboard?tab=Orders',
              event: 'order_new',
              relatedOrderId: order.id,
              tag: `new-order-${order.id}`,
            }));
            // Sale email: verified contact email first, auth email as the
            // fallback (auth emails are verified by the login flow itself).
            tasks.push((async () => {
              try {
                const { data: agentContact } = await serviceSupabase
                  .from('profiles')
                  .select('contact_email, email_verified, full_name')
                  .eq('id', agentProfile.id)
                  .maybeSingle();
                let to: string | null = (agentContact?.contact_email && agentContact.email_verified)
                  ? agentContact.contact_email
                  : null;
                if (!to) {
                  const { data: authUser } = await serviceSupabase.auth.admin.getUserById(agentProfile.id);
                  to = authUser?.user?.email ?? null;
                }
                if (to) {
                  await sendAgentSaleEmail({
                    to,
                    agentName: agentContact?.full_name,
                    orderId: order.id,
                    buyerName,
                    total: orderTotal,
                    itemsSummary,
                    awaitingPayment: initialStatus === 'pending_customer_payment',
                  });
                }
              } catch { /* sale email is best-effort */ }
            })());
          }

          // Super-agent upline: downline sale visibility.
          if (superAgentProfile && superAgentProfile.id !== user.id && (!agentProfile || superAgentProfile.id !== agentProfile.id)) {
            tasks.push(notifyDownlineOrderPlaced(
              serviceSupabase,
              superAgentProfile.id,
              order.id,
              short,
              totalFmt,
              storeSlug,
            ));
          }

          // Admins: platform-wide new-order visibility (skip when the store
          // owner IS an admin - they already got the store-owner alert).
          tasks.push(notifyAdmins(serviceSupabase, {
            type: 'order_placed',
            title: `New Order #${short} (${totalFmt})`,
            body: `${buyerName} Placed A ${totalFmt} Order On ${storeSlug}. Status: ${initialStatus.replace(/_/g, ' ')}.`,
            url: `/admin/orders?highlight=${order.id}`,
            skipUserIds: agentProfile ? [agentProfile.id] : [],
          }));

          // Buyer: placement confirmation (in-app + push).
          tasks.push(notify(serviceSupabase, {
            userId: user.id,
            type: 'order_placed',
            title: `Order #${short} Placed`,
            body: initialStatus === 'pending_customer_payment'
              ? 'Your Order Has Been Placed. Send Your Payment To Keep It Moving - Instructions Are On Your Order Page.'
              : 'Your Order Has Been Placed. You Will Be Notified When It Is Approved.',
            url: `/orders/${order.id}`,
          }));

          await Promise.allSettled(tasks);
        } catch (notifErr) {
          // Never propagate - notifications are best-effort. But a silent
          // swallow here previously meant a broken notify()/enqueuePush()
          // migration could stop ALL new-order alerts with zero evidence.
          logError('orders.POST.notifications', { orderId: order.id }, notifErr);
          captureError(notifErr, { context: 'orders.POST.notifications', orderId: order.id });
        }

        // Buyer order-confirmation email. Only to a VERIFIED contact email, to
        // protect sender reputation / deliverability. Now carries the seller's
        // actual payment handle so the buyer can pay straight from the inbox.
        if (profile?.contact_email && (profile as { email_verified?: boolean }).email_verified) {
          try {
            await sendOrderConfirmationEmail({
              to: profile.contact_email,
              fullName: profile.full_name,
              orderId: order.id,
              total: orderTotal,
              itemsSummary,
              subtotal: Number(subtotal) || null,
              discount: Number(discountAmount) || null,
              shippingCost: Number(shippingCost) || null,
              paymentMethod: initialStatus === 'pending_customer_payment'
                ? ((PAYMENT_METHOD_LABELS as Record<string, string>)[paymentMethod] ?? paymentMethod)
                : null,
              paymentHandle,
            });
          } catch { /* ignore */ }
        }
      });
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
      total: Number(order.total) || 0,
    });

  } catch (error) {
    logError('orders.POST.unhandled', { orderCommitted }, error);
    captureError(error, { context: 'orders.POST.unhandled', orderCommitted });
    // Best-effort compensation: if the throw happened after inventory was
    // reserved / a coupon redeemed / prepaid deducted but BEFORE the order
    // committed, undo those side effects instead of leaking them.
    if (!orderCommitted && compensateOnThrow) {
      try {
        await compensateOnThrow();
      } catch (compErr) {
        captureError(compErr, { context: 'orders.POST.unhandled.compensation_failed', severity: 'critical' });
      }
    }
    return NextResponse.json({ error: 'Internal Server Error Occurred.' }, { status: 500 });
  }
}
