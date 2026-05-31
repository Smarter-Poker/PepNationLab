import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { applyBulkPrice } from '@/lib/pricing';
import { assertSameOrigin } from '@/lib/csrf';
import { rateLimit } from '@/lib/rate-limit';


import { enqueuePush, shortOrderId } from '@/lib/push-enqueue';
import { notifyOrderPlaced, notify } from '@/lib/notify';


const CheckoutSchema = z.object({
  items: z.array(z.object({
    id: z.string().uuid(),
    quantity: z.number().int().min(1)
  })).min(1, 'Cart cannot be empty.'),
  fulfillmentMethod: z.enum(['ship', 'agent_pickup']),
  paymentMethod: z.enum(['zelle', 'cashapp', 'venmo', 'apple_pay', 'apple_cash', 'paypal', 'google_wallet', 'wise', 'chime']),
  shippingAddress: z.object({
    fullName: z.string().min(1),
    street: z.string().min(1),
    suite: z.string().optional().default(''),
    city: z.string().min(1),
    state: z.string().min(2),
    zip: z.string().min(5),
    phone: z.string().optional().default(''),
  }).optional().nullable(),
  couponCode: z.string().optional().nullable(),
  idempotencyKey: z.string().uuid().optional().nullable(),
  wholesale: z.boolean().optional(),

  /** Which agent storefront initiated this checkout — used for closed-loop catalog validation */
  agentSlug: z.string().regex(/^[a-zA-Z0-9_-]+$/).optional().nullable(),
});

export async function POST(request: NextRequest) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;
  try {
    const supabase = await createClient();
    const serviceSupabase = createAdminClient();

    // Authenticate the user session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized. Please Sign In.' }, { status: 401 });
    }

    // Per-user rate limit: 10 orders / minute. Keyed on user.id so the
    // limiter survives IP changes mid-session (mobile networks, VPNs).
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

    const rawBody = await request.json();
    const validation = CheckoutSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid checkout data.', details: validation.error.issues }, { status: 400 });
    }

    const {
      items,
      shippingAddress,
      fulfillmentMethod,
      paymentMethod,
      couponCode,
      idempotencyKey,
      wholesale: explicitWholesale,

      agentSlug,
    } = validation.data;

    if (fulfillmentMethod === 'ship' && !shippingAddress) {
      return NextResponse.json({ error: 'Shipping Address Is Required For Deliveries.' }, { status: 400 });
    }

    // Idempotency replay: if a request with this key already produced an
    // order for THIS user, return that order rather than creating a duplicate.
    // Scoped to buyer_id so a user cannot replay another user's order.
    if (idempotencyKey) {
      const { data: existing } = await serviceSupabase
        .from('orders')
        .select('id, total, status')
        .eq('idempotency_key', idempotencyKey)
        .eq('buyer_id', user.id)
        .maybeSingle();
      if (existing) {
        return NextResponse.json({
          success: true,
          orderId: existing.id,
          total: Number(existing.total) || 0,
          replayed: true,
        });
      }
    }

    // Get researcher profile
    const { data: profile, error: profileError } = await serviceSupabase
      .from('profiles')
      .select('id, referring_agent_id, role, tier, parent_agent_id, account_type, prepaid_balance, credit_limit, auto_approve_orders')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Researcher Profile Not Found.' }, { status: 404 });
    }

    // --- DETERMINE AGENT OF RECORD ---
    let agentProfile = null;
    let superAgentProfile = null;
    let isAgentSelfBuy = false;

    // NOTE: Admins are intentionally excluded from isAgentSelfBuy.
    // Admins don't have agent_profiles rows, so the tier-pricing path would
    // fail or fall back to tier_3 (retail). Admins buy at standard pricing.
    if (profile.role === 'agent' || profile.role === 'super_agent') {
      agentProfile = profile;
      isAgentSelfBuy = true;
      if (profile.parent_agent_id) {
        const { data: sap } = await serviceSupabase.from('profiles').select('id, tier, account_type, prepaid_balance, credit_limit, auto_approve_orders').eq('id', profile.parent_agent_id).single();
        superAgentProfile = sap;
      }
    } else if (profile.referring_agent_id) {
      const { data: ap } = await serviceSupabase.from('profiles').select('id, role, tier, parent_agent_id, auto_approve_orders').eq('id', profile.referring_agent_id).single();
      agentProfile = ap;
      if (ap?.parent_agent_id) {
        const { data: sap } = await serviceSupabase.from('profiles').select('id, tier, account_type, prepaid_balance, credit_limit, auto_approve_orders').eq('id', ap.parent_agent_id).single();
        superAgentProfile = sap;
      }
    }

    // Retrieve active product definitions matching requested cart item IDs
    const { data: dbProducts, error: dbProductsError } = await serviceSupabase
      .from('products')
      .select('id, name, base_cost, weight_oz, is_active, is_banned, sku, inventory_count, admin_bulk_price, admin_bulk_threshold')
      .in('id', items.map(i => i.id));

    if (dbProductsError || !dbProducts || dbProducts.length === 0) {
      return NextResponse.json({ error: 'Failed To Retrieve Product Data.' }, { status: 400 });
    }

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

    // Check for banned or deactivated products and inventory limits
    for (const cartItem of items) {
      const dbProduct = dbProducts.find(p => p.id === cartItem.id);
      if (!dbProduct) {
        // Hard fail — consistent with the pricing loop below. A missing product
        // at this stage means the cart is stale; reject cleanly.
        return NextResponse.json(
          { error: `Product ID "${cartItem.id}" Is No Longer Available. Please Return To The Store And Refresh Your Cart.` },
          { status: 400 }
        );
      }
      
      if (dbProduct.is_banned || !dbProduct.is_active) {
        return NextResponse.json({ error: `Product "${dbProduct.name}" Is Unavailable For Sale.` }, { status: 400 });
      }

      const qty = Number(cartItem.quantity) || 1;

      // Server-side per-item quantity safety cap. 10,000 vials is enough for
      // any legitimate research order; anything above is likely a data error.
      if (qty > 10_000) {
        return NextResponse.json(
          { error: `Quantity for "${dbProduct.name}" exceeds the maximum allowed (10,000 per item).` },
          { status: 400 }
        );
      }

      let availableStock = Number(dbProduct.inventory_count);
      let bypassInventoryCheck = false;
      
      // If it's a researcher buying from an agent's store, and they want it shipped,
      // it ships from the agent's local on-hand inventory.
      // If they choose 'agent_pickup', it is fulfilled via a stacked bulk shipment
      // from main China inventory directly to the agent.
      if (agentProfile && !isAgentSelfBuy && fulfillmentMethod === 'ship') {
         availableStock = agentStockMap[cartItem.id] || 0;
      } else if (fulfillmentMethod === 'agent_pickup') {
         // Agent pickup orders are pre-ordered in bulk from China, so we don't
         // want to block checkout if the global system says '0' stock.
         bypassInventoryCheck = true;
      }

      if (!bypassInventoryCheck && availableStock < qty) {
        return NextResponse.json(
          { error: `Insufficient inventory for "${dbProduct.name}". Only ${availableStock} remaining.` },
          { status: 400 }
        );
      }
    }

    // ── CLOSED-LOOP RESEARCHER OWNERSHIP + CATALOG GUARD ──────────────────────
    // HARD RULE: A researcher can ONLY place orders through the agent who
    // created their account. No cross-agent access. Ever.
    if (agentSlug) {
      // Resolve the storefront agent from the slug (same table the storefront page uses)
      const { data: storefrontAgent } = await serviceSupabase
        .from('agent_profiles')
        .select('id, min_overall_qty, min_order_qty')
        .ilike('slug', agentSlug)
        .single();

      if (!storefrontAgent) {
        return NextResponse.json(
          { error: 'Agent Storefront Not Found.' },
          { status: 404 }
        );
      }

      // For researchers: their referring_agent_id MUST match the storefront agent.
      // Agents/admins placing self-buy orders are exempt from this check.
      if (!isAgentSelfBuy) {
        const researcherBelongsToAgent = profile.referring_agent_id === storefrontAgent.id;
        if (!researcherBelongsToAgent) {
          return NextResponse.json(
            { error: 'Your Account Does Not Have Access To This Store.' },
            { status: 403 }
          );
        }
      }

      // Enforce storefront overall minimum quantity for EVERYONE checking out from this storefront
      const totalRequestedQty = items.reduce((acc, item) => acc + (Number(item.quantity) || 0), 0);
      const minQty = Number(storefrontAgent.min_overall_qty) || 1;
      if (totalRequestedQty < minQty) {
        return NextResponse.json(
          { error: `This storefront requires a minimum overall order of ${minQty} items.` },
          { status: 400 }
        );
      }

      // Enforce per-peptide minimum quantity
      const minPerItem = Number(storefrontAgent.min_order_qty) || 1;
      for (const item of items) {
        if ((Number(item.quantity) || 0) < minPerItem) {
          return NextResponse.json(
            { error: `This storefront requires a minimum of ${minPerItem} per peptide.` },
            { status: 400 }
          );
        }
      }

      // Every product must also be visible in this agent's catalog.
      const { data: visibleRows } = await serviceSupabase
        .from('agent_products')
        .select('product_id')
        .eq('agent_id', storefrontAgent.id)
        .eq('is_visible', true)
        .in('product_id', items.map(i => i.id));

      const visibleSet = new Set((visibleRows ?? []).map((r: any) => r.product_id as string));
      const blocked = items.find(i => !visibleSet.has(i.id));
      if (blocked) {
        const blockedName = dbProducts.find(p => p.id === blocked.id)?.name ?? blocked.id;
        return NextResponse.json(
          { error: `Product "${blockedName}" Is Not Available Through This Agent's Store.` },
          { status: 403 }
        );
      }
    }
    // ──────────────────────────────────────────────────────────────────────────

    // 1. Fetch Admin Default Multipliers (Tier 3 is standard retail)
    const { data: tiers } = await serviceSupabase.from('pricing_tiers').select('tier_name, multiplier');
    const tierMultipliers: Record<string, number> = {};
    tiers?.forEach(t => { tierMultipliers[t.tier_name] = Number(t.multiplier); });

    // 2. Agent profiles already resolved above.

    // 3. Fetch Override Rule Sets
    const getOverrides = async (tier: string) => {
      const { data } = await serviceSupabase.from('product_tier_overrides').select('product_id, custom_multiplier').eq('tier_name', tier);
      const map: Record<string, number> = {};
      data?.forEach(o => { map[o.product_id] = Number(o.custom_multiplier); });
      return map;
    };

    const agentTier = agentProfile?.tier || 'tier_3';
    const agentOverrides = await getOverrides(agentTier);
    
    let superAgentOverrides: Record<string, number> = {};
    if (superAgentProfile) {
      superAgentOverrides = await getOverrides(superAgentProfile.tier || 'tier_3');
    }

    // 4. Fetch Custom Retail Prices (if agent manually set them)
    let agentCustomRetail: Record<string, number> = {};
    if (agentProfile) {
      const { data: acr } = await serviceSupabase
        .from('agent_products')
        .select('product_id, retail_price, is_on_sale, sale_price')
        .eq('agent_id', agentProfile.id);
      acr?.forEach(a => {
        // IMPORTANT: retail_price and sale_price are stored as 10-pack prices
        // (seeded as base_cost * 10 by the DB trigger). The storefront grid
        // divides by 10 for per-vial display. We must do the same here so
        // the server charges exactly what the customer saw on the storefront.
        const rawPrice = a.is_on_sale && a.sale_price != null
          ? Number(a.sale_price)
          : Number(a.retail_price);
        agentCustomRetail[a.product_id] = rawPrice / 10;
      });
    }

    // 5. Fetch Super Agent Baseline Costs (if Sub-Agent)
    let superAgentBaselines: Record<string, { baseline_cost: number, bulk_baseline_cost: number | null, bulk_threshold: number }> = {};
    if (superAgentProfile) {
      const { data: sab } = await serviceSupabase
        .from('super_agent_pricing')
        .select('product_id, baseline_cost, bulk_baseline_cost, bulk_threshold')
        .eq('super_agent_id', superAgentProfile.id);
      sab?.forEach(b => { 
        superAgentBaselines[b.product_id] = {
          baseline_cost: Number(b.baseline_cost),
          bulk_baseline_cost: b.bulk_baseline_cost !== null ? Number(b.bulk_baseline_cost) : null,
          bulk_threshold: b.bulk_threshold ?? 100
        };
      });
    }

    // 6. Compute Costs per Item
    let subtotal = 0;
    let totalWeightOz = 0;
    const computedItems = [];

    for (const cartItem of items) {
      const dbProduct = dbProducts.find(p => p.id === cartItem.id);
      if (!dbProduct) {
        // Hard fail: never silently drop a line item. If the product doesn't
        // exist in the catalog, the cart is stale — reject and let the user
        // refresh their storefront.
        return NextResponse.json(
          { error: `Product ID "${cartItem.id}" Is No Longer Available. Please Return To The Store And Refresh Your Cart.` },
          { status: 400 }
        );
      }

      const baseCost = Number(dbProduct.base_cost);
      
      // Calculate Retail Price (What the buyer pays)
      let retailPrice = 0;
      
      if (isAgentSelfBuy) {
        // If the agent is buying for themselves, they pay their wholesale cost.
        // We will calculate costPrice first, then set retailPrice = costPrice.
      } else if (agentCustomRetail[dbProduct.id]) {
        retailPrice = agentCustomRetail[dbProduct.id];
      } else {
        // NOTE: base_cost in `products` is the per-10-vial pack cost.
        // All prices stored in order_items are PER-VIAL (quantity = # of vials).
        // We divide by 10 here to convert pack cost → per-vial.
        const retailMultiplier = tierMultipliers['tier_3'] ?? 1.7;
        retailPrice = baseCost * retailMultiplier / 10;
      }

      const itemQty = Number(cartItem.quantity) || 1;

      // Consistent quantity cap in the pricing loop — mirrors the inventory loop.
      if (itemQty > 10_000) {
        return NextResponse.json(
          { error: `Quantity for a cart item exceeds the maximum allowed (10,000 per item).` },
          { status: 400 }
        );
      }

      // Calculate Agent Cost (What the agent of record owes Admin or Super Agent)
      let costPrice = retailPrice; // Default to retail if no agent
      let superAgentCost = null;

      if (agentProfile) {
        if (superAgentProfile) {
          // This is a Sub-Agent.
          // Super Agent Cost (What Super Agent owes Admin):
          // NOTE: base_cost is per-10-vial pack. Divide by 10 → per-vial cost.
          const saMultiplier = superAgentOverrides[dbProduct.id] ?? tierMultipliers[superAgentProfile.tier || 'tier_3'] ?? 1.7;
          superAgentCost = applyBulkPrice(
            baseCost * saMultiplier / 10,
            itemQty,
            dbProduct.admin_bulk_price != null ? dbProduct.admin_bulk_price / 10 : null,
            dbProduct.admin_bulk_threshold
          );

          // Cost Price (What Sub-Agent owes Super Agent):
          const saConfig = superAgentBaselines[dbProduct.id];
          if (saConfig) {
             if (saConfig.bulk_baseline_cost !== null && itemQty >= saConfig.bulk_threshold) {
                 costPrice = saConfig.bulk_baseline_cost;
             } else {
                 costPrice = saConfig.baseline_cost;
             }
          } else {
             costPrice = superAgentCost;
          }

        } else {
          // Standard Agent (or Super Agent buying directly).
          // Agent Cost = Admin Base Cost * Agent Tier Multiplier
          // NOTE: base_cost is per-10-vial pack. Divide by 10 → per-vial cost.
          const agentMultiplier = agentOverrides[dbProduct.id] ?? tierMultipliers[agentTier] ?? 1.7;
          costPrice = applyBulkPrice(
            baseCost * agentMultiplier / 10,
            itemQty,
            dbProduct.admin_bulk_price != null ? dbProduct.admin_bulk_price / 10 : null,
            dbProduct.admin_bulk_threshold
          );
        }
      }
      
      // If agent self buy, they pay exactly what they owe — UNLESS the item
      // quantity is below the 10-vial minimum, in which case standard retail
      // dynamic pricing applies (same rule enforced in the storefront UI).
      if (isAgentSelfBuy) {
        if (itemQty >= 10) {
          // Qualifies for agent direct pricing — pay their tier cost.
          retailPrice = costPrice;
        } else {
          // Below minimum: charge standard retail (tier_3 markup) per-vial.
          const retailMultiplier = tierMultipliers['tier_3'] ?? 1.7;
          retailPrice = baseCost * retailMultiplier / 10;
          // costPrice remains the tier cost for accounting (commission calcs),
          // but the buyer pays retail.
          costPrice = retailPrice;
        }
      }

      // Round unit prices to exact cents (2 decimals) to match DB storage
      // This prevents fractional cent drift in subtotal math vs order_items sums.
      retailPrice = isFinite(retailPrice) ? Math.round(retailPrice * 100) / 100 : 0;
      costPrice = isFinite(costPrice) ? Math.round(costPrice * 100) / 100 : 0;
      if (superAgentCost !== null) {
        superAgentCost = isFinite(superAgentCost) ? Math.round(superAgentCost * 100) / 100 : null;
      }

      subtotal += retailPrice * itemQty;
      totalWeightOz += (Number(dbProduct.weight_oz) || 0.5) * itemQty;

      computedItems.push({
        product_id: dbProduct.id,
        product_name: dbProduct.name,
        quantity: itemQty,
        unit_retail_price: retailPrice,
        unit_cost_price: costPrice,
        unit_super_agent_cost: superAgentCost
      });
    }

    // ── STEP A: ATOMIC INVENTORY RESERVATION ─────────────────────────────────
    // The advisory stock check above gives user-friendly error messages.
    // This call atomically reserves the stock using SELECT FOR UPDATE inside
    // a SECURITY DEFINER RPC, eliminating the TOCTOU race where two concurrent
    // requests both read the same inventory_count and both pass the check.
    // If reservation fails (stock was depleted by a concurrent request), we
    // get a DB exception and return a 422 — no order row is ever written.
    const inventoryItems = computedItems.map(item => ({
      product_id: item.product_id,
      quantity: item.quantity,
    }));
    const isAgentShip = agentProfile && !isAgentSelfBuy && fulfillmentMethod === 'ship';
    const inventoryReserveParams = {
      p_items: inventoryItems,
      p_agent_id: isAgentShip ? agentProfile?.id : null,
      p_is_agent_ship: !!isAgentShip
    };
    let inventoryReserved = false;
    if (fulfillmentMethod !== 'agent_pickup') {
      const { error: reserveErr } = await serviceSupabase
        .rpc('reserve_inventory', inventoryReserveParams);
      if (reserveErr) {
        const isStock = /Insufficient inventory/i.test(reserveErr.message);
        return NextResponse.json(
          { error: isStock ? reserveErr.message : 'Failed To Reserve Inventory. Please Try Again.' },
          { status: 422 }
        );
      }
      inventoryReserved = true;
    }

    // ── STEP B: COUPON REDEMPTION ─────────────────────────────────────────────
    // redeem_coupon increments uses_count atomically. IMPORTANT: any rollback
    // path after this point must call unreedeem_coupon(appliedCouponId) to
    // prevent a permanent count leak if the order never commits.
    let discountAmount = 0;
    let appliedCouponCode: string | null = null;
    let appliedCouponId: string | null = null;
    const trimmedCouponCode = couponCode ? String(couponCode).trim().toUpperCase() : '';

    // HARD RULE: Agents CANNOT use coupons on their own self-buy orders.
    if (isAgentSelfBuy && trimmedCouponCode) {
      // Rollback: release the inventory reservation.
      if (inventoryReserved) await serviceSupabase.rpc('release_inventory', inventoryReserveParams);
      return NextResponse.json(
        { error: 'Coupon Codes Cannot Be Applied To Agent Self-Buy Orders.' },
        { status: 403 }
      );
    }

    if (trimmedCouponCode) {
      const couponAgentId = profile.referring_agent_id ?? agentProfile?.id ?? null;
      if (!couponAgentId) {
        if (inventoryReserved) await serviceSupabase.rpc('release_inventory', inventoryReserveParams);
        return NextResponse.json(
          { error: 'Coupon Codes Are Only Valid For Orders Placed Through A Referring Agent.' },
          { status: 400 }
        );
      }
      const { data: redeem, error: redeemError } = await serviceSupabase
        .rpc('redeem_coupon', {
          p_code: trimmedCouponCode,
          p_agent_id: couponAgentId,
          p_order_subtotal: subtotal,
        });

      if (redeemError) {
        console.error('Coupon RPC Failed:', redeemError);
        if (inventoryReserved) await serviceSupabase.rpc('release_inventory', inventoryReserveParams);
        return NextResponse.json(
          { error: 'Coupon Invalid Or Limit Reached' },
          { status: 422 }
        );
      }

      const row = Array.isArray(redeem) ? redeem[0] : redeem;
      if (!row?.coupon_id) {
        if (inventoryReserved) await serviceSupabase.rpc('release_inventory', inventoryReserveParams);
        return NextResponse.json(
          { error: 'Coupon Invalid Or Limit Reached' },
          { status: 422 }
        );
      }

      appliedCouponId = row.coupon_id;
      appliedCouponCode = trimmedCouponCode;
      discountAmount = Number(row.discount_amount) || 0;
    }

    // Calculate shipping costs — pick the tier with the highest min_weight_oz
    // that still covers totalWeightOz. Falls back to a $12 default and logs
    // a warning so we can audit gaps in the shipping_rates table.
    let shippingCost = 0;
    if (fulfillmentMethod === 'ship') {
      const { data: shippingRates } = await serviceSupabase
        .from('shipping_rates')
        .select('rate, min_weight_oz, max_weight_oz')
        .lte('min_weight_oz', totalWeightOz)
        .gt('max_weight_oz', totalWeightOz)
        .order('min_weight_oz', { ascending: false })
        .limit(1);

      if (shippingRates && shippingRates.length > 0) {
        shippingCost = Number(shippingRates[0].rate);
      } else {
        console.warn(
          '[orders] No shipping_rates row matched weight=%s oz; falling back to $12.00',
          totalWeightOz
        );
        shippingCost = 12.00;
      }
    }

    // Tax calculation has been permanently disabled globally.
    const grossTotal = Math.max(0, subtotal - discountAmount) + shippingCost;

    const total = Math.max(0, grossTotal);

    // Record the Layer 4 (checkout) disclaimer audit row BEFORE the order
    // insert. If the audit fails we refuse to place the order — research-only
    // compliance requires the four-layer trail to be intact for every sale.
    const disclaimerVersion = process.env.NEXT_PUBLIC_DISCLAIMER_VERSION || 'v1.0';
    const checkoutIp =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      null;
    const checkoutUserAgent = request.headers.get('user-agent') || null;

    // disclaimer_id is captured so we can back-fill order_id after the order insert.
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
      .single();

    if (disclaimerError || !disclaimerRow) {
      console.error('Checkout Disclaimer Audit Insert Failed:', disclaimerError);
      return NextResponse.json(
        { error: 'Disclaimer audit failed; order not placed.' },
        { status: 500 }
      );
    }

    // Wholesale restock flag must be set explicitly by the caller — we never
    // imply it from buyer role. A plain agent buying through their own
    // storefront is a retail self-buy, not a wholesale replenishment.
    const isWholesaleRestock =
      explicitWholesale === true &&
      (profile.role === 'agent' || profile.role === 'super_agent');

    let initialStatus = 'pending_customer_payment';
    let prepaidDeducted = false;
    let prepaidDeductedAmount = 0;
    let prepaidDeductedAgentId: string | null = null;
    let oldBalance = 0;

    // --- Helper for Super Agent Credit Check ---
    const checkSuperAgentCredit = async (saProfile: any, amount: number) => {
      if (saProfile.account_type === 'prepaid') {
        const bal = Number(saProfile.prepaid_balance) || 0;
        if (bal < amount) {
          return { error: `Insufficient Prepaid Balance. Requires $${amount.toFixed(2)}, but balance is $${bal.toFixed(2)}. Please recharge your account.`, status: 402 };
        }
        const { data: deductSuccess } = await serviceSupabase.rpc('deduct_prepaid_balance', { agent_id: saProfile.id, amount });
        if (!deductSuccess) return { error: 'Failed to deduct prepaid balance.', status: 500 };
        return { success: true, prepaidDeducted: true, amount, agentId: saProfile.id };
      } else if (saProfile.account_type === 'credit') {
        const { data: statements } = await serviceSupabase.from('weekly_statements').select('total_owed').eq('agent_id', saProfile.id).eq('status', 'pending_payment');
        let currentUnbilled = 0;
        statements?.forEach((s) => (currentUnbilled += Number(s.total_owed) || 0));

        const { data: subAgents } = await serviceSupabase.from('profiles').select('id').eq('parent_agent_id', saProfile.id);
        const agentIds = [saProfile.id, ...(subAgents?.map((s: { id: string }) => s.id) || [])];

        const { data: approvedOrders } = await serviceSupabase
          .from('orders')
          .select('id, shipping_cost, statement_orders(statement_id), order_items(quantity, unit_cost_price, unit_super_agent_cost), agent_id')
          .in('agent_id', agentIds)
          .eq('is_wholesale_restock', false)
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
          return { error: `Credit Limit Exceeded. Your order of $${amount.toFixed(2)} pushes your balance to $${projected.toFixed(2)} (Limit: $${creditLimit.toFixed(2)}). Please pay your pending weekly statements.`, status: 403 };
        }
        return { success: true, prepaidDeducted: false };
      } else {
        return { error: 'Your account is not configured for wholesale credit or prepaid. Please contact admin.', status: 403 };
      }
    };

    // --- Two-Step Approval & Cascading Auto-Approve Logic ---
    if (isWholesaleRestock) {
      if (profile.role === 'super_agent') {
        if (profile.auto_approve_orders) {
          // Admin Trusts Super Agent -> Auto-Approve & Check Credit
          const res = await checkSuperAgentCredit(profile, total);
          if (res.error) return NextResponse.json({ error: res.error }, { status: res.status });
          prepaidDeducted = res.prepaidDeducted || false;
          if (prepaidDeducted) {
            prepaidDeductedAmount = res.amount || 0;
            prepaidDeductedAgentId = res.agentId || null;
          }
          initialStatus = 'approved_ship';
        } else {
          // No Admin Trust -> Wait for manual admin approval
          initialStatus = 'pending_customer_payment';
        }
      } else if (profile.role === 'agent') {
        if (profile.auto_approve_orders && superAgentProfile) {
          // Super Agent Trusts Sub-Agent -> Auto-Approve & Check Super Agent's Credit
          let wholesaleCogs = 0;
          for (const item of computedItems) {
            wholesaleCogs += (item.unit_super_agent_cost !== null ? item.unit_super_agent_cost : item.unit_cost_price) * item.quantity;
          }
          wholesaleCogs += shippingCost;

          const res = await checkSuperAgentCredit(superAgentProfile, wholesaleCogs);
          if (res.error) return NextResponse.json({ error: res.error }, { status: res.status });
          prepaidDeducted = res.prepaidDeducted || false;
          if (prepaidDeducted) {
            prepaidDeductedAmount = res.amount || 0;
            prepaidDeductedAgentId = res.agentId || null;
          }
          initialStatus = 'approved_ship';
        } else {
          // No Super Agent Trust -> Wait for manual super agent approval
          initialStatus = 'agent_approval_pending';
        }
      }
    } else {
      // Retail Orders (Researchers)
      if (profile.auto_approve_orders) {
        // Agent Trusts Researcher -> Auto-Approve Researcher payment
        if (agentProfile && agentProfile.role === 'agent') {
          // It's a Sub-Agent. Does the Super Agent trust the Sub-Agent?
          if (agentProfile.auto_approve_orders && superAgentProfile) {
            // Cascade -> Auto-Approve Sub-Agent too! Check Super Agent's Credit.
            let retailCogs = 0;
            for (const item of computedItems) {
              const cost = item.unit_super_agent_cost !== null ? item.unit_super_agent_cost : item.unit_cost_price;
              retailCogs += cost * item.quantity;
            }
            retailCogs += shippingCost;
            
            const res = await checkSuperAgentCredit(superAgentProfile, retailCogs);
            if (res.error) return NextResponse.json({ error: res.error }, { status: res.status });
            prepaidDeducted = res.prepaidDeducted || false;
            if (prepaidDeducted) {
              prepaidDeductedAmount = res.amount || 0;
              prepaidDeductedAgentId = res.agentId || null;
            }
            initialStatus = 'approved_ship';
          } else {
            // Super Agent does NOT trust Sub-Agent. Park it at agent_approval_pending
            initialStatus = 'agent_approval_pending';
          }
        } else if (agentProfile && agentProfile.role === 'super_agent') {
          // It's a Super Agent.
          // Wait, if it's a Super Agent's researcher, the Super Agent trusts them!
          // We must check Super Agent's credit for the COGS.
          let retailCogs = 0;
          for (const item of computedItems) {
             retailCogs += item.unit_cost_price * item.quantity;
          }
          retailCogs += shippingCost;
          
          const res = await checkSuperAgentCredit(agentProfile, retailCogs);
          if (res.error) return NextResponse.json({ error: res.error }, { status: res.status });
          prepaidDeducted = res.prepaidDeducted || false;
          if (prepaidDeducted) {
            prepaidDeductedAmount = res.amount || 0;
            prepaidDeductedAgentId = res.agentId || null;
          }
          initialStatus = 'approved_ship';
        }
      }
    }

    // Create checkout order
    const { data: order, error: orderError } = await serviceSupabase
      .from('orders')
      .insert({
        buyer_id: user.id,
        agent_id: isAgentSelfBuy ? (superAgentProfile ? superAgentProfile.id : null) : (agentProfile ? agentProfile.id : null),
        is_wholesale_restock: isWholesaleRestock,
        status: initialStatus,
        fulfillment_method: fulfillmentMethod,
        payment_method: paymentMethod,
        shipping_address: shippingAddress ?? null,
        shipping_cost: shippingCost,
        subtotal: subtotal,
        discount_amount: discountAmount,
        coupon_code: appliedCouponCode,
        total: total,


        idempotency_key: idempotencyKey ?? null,
      })
      .select('id, total')
      .single();

    if (orderError || !order) {
      // 23505 = unique_violation — idempotency key replay.
      if (orderError && (orderError as any).code === '23505' && idempotencyKey) {
        const { data: existing } = await serviceSupabase
          .from('orders')
          .select('id, total')
          .eq('idempotency_key', idempotencyKey)
          .eq('buyer_id', user.id)
          .maybeSingle();
        if (existing) {
          // Replay: release the pre-reserved resources since the replayed order
          // already owns them from the original request.
          if (inventoryReserved) await serviceSupabase.rpc('release_inventory', inventoryReserveParams);

          if (appliedCouponId) await serviceSupabase.rpc('unreedeem_coupon', { p_coupon_id: appliedCouponId });
          return NextResponse.json({
            success: true,
            orderId: existing.id,
            total: Number(existing.total) || 0,
            replayed: true,
          });
        }
      }
      // Order insert failed: roll back all pre-committed resources.
      if (inventoryReserved) await serviceSupabase.rpc('release_inventory', inventoryReserveParams);
      if (appliedCouponId) await serviceSupabase.rpc('unreedeem_coupon', { p_coupon_id: appliedCouponId });
      if (prepaidDeducted && prepaidDeductedAmount > 0 && prepaidDeductedAgentId) {
        await serviceSupabase.rpc('refund_prepaid_balance', { p_agent_id: prepaidDeductedAgentId, p_amount: prepaidDeductedAmount });
      }
      console.error('Database Order Write Error:', orderError);
      return NextResponse.json({ error: 'Failed To Save Order Transaction.' }, { status: 500 });
    }

    // Back-fill the disclaimer row with this order_id so the compliance audit
    // trail is complete and no checkout disclaimer is ever orphaned.
    void serviceSupabase
      .from('disclaimer_acceptances')
      .update({ order_id: order.id })
      .eq('id', disclaimerRow.id);

    // Create order items
    if (computedItems.length === 0) {
      await serviceSupabase.from('orders').delete().eq('id', order.id);
      return NextResponse.json({ error: 'Cart Items Could Not Be Processed. Please Try Again.' }, { status: 400 });
    }

    const itemsToInsert = computedItems.map(item => ({
      order_id: order.id,
      product_id: item.product_id,
      product_name: item.product_name ?? 'Unknown Product',
      quantity: item.quantity,
      unit_retail_price: item.unit_retail_price,
      unit_cost_price: item.unit_cost_price,
      unit_super_agent_cost: item.unit_super_agent_cost,
    }));

    const { error: itemsError } = await serviceSupabase
      .from('order_items')
      .insert(itemsToInsert);

    if (itemsError) {
      // Items insert failed: roll back order + all pre-committed resources.
      // Inventory was pre-reserved — release it so stock is not permanently lost.
      // Coupon was pre-incremented — unreedeem so the count is not permanently burned.
      // Store credit was pre-deducted — release so balance is restored.
      console.error('Database Order Items Write Error:', JSON.stringify(itemsError));
      await serviceSupabase.from('orders').delete().eq('id', order.id);
      if (inventoryReserved) await serviceSupabase.rpc('release_inventory', inventoryReserveParams);
      if (appliedCouponId) await serviceSupabase.rpc('unreedeem_coupon', { p_coupon_id: appliedCouponId });
      if (prepaidDeducted && prepaidDeductedAmount > 0 && prepaidDeductedAgentId) {
        await serviceSupabase.rpc('refund_prepaid_balance', { p_agent_id: prepaidDeductedAgentId, p_amount: prepaidDeductedAmount });
      }

      return NextResponse.json({ error: `An unexpected error occurred: ${itemsError.message || JSON.stringify(itemsError)}` }, { status: 500 });
    }



    // Checkout disclaimer audit row was recorded above, prior to the order
    // insert, so a successful order implies a complete four-layer trail.

    // Awaited abandoned-cart recovery attribution. We never fail the
    // order if this lookup misses or errors — it is purely an analytics signal.
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
      // Best-effort attribution; never bubble up.
    }

    // Awaited in-app + push notifications for new order.
    try {
      const short = shortOrderId(order.id);
      // 1. Notify agent when a researcher places an order
      if (agentProfile && !isAgentSelfBuy) {
        const { data: buyerProfile } = await serviceSupabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .maybeSingle();
        const buyerName = buyerProfile?.full_name || 'A Researcher';
        // In-app notification for agent
        await notifyOrderPlaced(serviceSupabase, agentProfile.id, order.id, short, buyerName);
        // Web push for agent
        await enqueuePush(serviceSupabase, {
          userId: agentProfile.id,
          title: `New Order #${short}`,
          body: `${buyerName} Placed A New Order. Tap To Review.`,
          url: '/dashboard?tab=Orders',
          event: 'order_new',
          relatedOrderId: order.id,
          tag: `new-order-${order.id}`,
        });
      }
      // 2. In-app + push confirm to researcher
      await notify(serviceSupabase, {
        userId: user.id,
        type: 'order_placed',
        title: `Order #${short} Placed`,
        body: 'Your order has been placed. You will be notified when it is approved.',
        url: `/orders/${order.id}`,
      });
      await enqueuePush(serviceSupabase, {
        userId: user.id,
        title: `Order #${short} Placed`,
        body: 'Your Order Has Been Placed. You Will Be Notified When It Is Approved.',
        url: `/orders/${order.id}`,
        event: 'order_placed',
        relatedOrderId: order.id,
        tag: `order-placed-${order.id}`,
      });
    } catch {
      // Never propagate — notifications are best-effort
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
      total: Number(order.total) || 0,

    });

  } catch (error) {
    console.error('Order API Route Caught Exception:', error);
    return NextResponse.json({ error: 'Internal Server Error Occurred.' }, { status: 500 });
  }
}
