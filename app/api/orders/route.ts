import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { applyBulkPrice, isTierLadderV2 } from '@/lib/pricing';
import { assertSameOrigin } from '@/lib/csrf';
import { rateLimit } from '@/lib/rate-limit';


import { enqueuePush, shortOrderId } from '@/lib/push-enqueue';
import { notifyOrderPlaced, notify, notifyCouponRedeemed } from '@/lib/notify';


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

    // Idempotency replay
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
      .select('id, referring_agent_id, role, tier, parent_agent_id, account_type, prepaid_balance, credit_limit, auto_approve_orders, is_sub_agent, referring_sub_agent_id')
      .eq('id', user.id)
      .single();

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

    interface ItemFulfillmentSplit { localQty: number; chinaQty: number; }
    const itemSplits: Record<string, ItemFulfillmentSplit> = {};

    // Check for banned or deactivated products and inventory limits
    for (const cartItem of items) {
      const dbProduct = dbProducts.find(p => p.id === cartItem.id);
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
          { error: `Quantity for "${dbProduct.name}" exceeds the maximum allowed (10,000 per item).` },
          { status: 400 }
        );
      }

      let availableStock = Number(dbProduct.inventory_count);
      let bypassInventoryCheck = false;
      let localQty = 0;
      let chinaQty = qty;

      if (agentProfile && !isAgentSelfBuy && fulfillmentMethod === 'ship') {
         const localAgentStock = agentStockMap[cartItem.id] || 0;
         if (localAgentStock >= qty) {
           localQty = qty;
           chinaQty = 0;
           availableStock = localAgentStock;
         } else if (localAgentStock > 0) {
           localQty = localAgentStock;
           chinaQty = qty - localAgentStock;
           availableStock = localAgentStock + Number(dbProduct.inventory_count);
         } else {
           localQty = 0;
           chinaQty = qty;
           availableStock = Number(dbProduct.inventory_count);
         }
      } else if (fulfillmentMethod === 'agent_pickup') {
         bypassInventoryCheck = true;
      }

      itemSplits[cartItem.id] = { localQty, chinaQty };

      if (!bypassInventoryCheck && availableStock < qty) {
        return NextResponse.json(
          { error: `Insufficient inventory for "${dbProduct.name}". Available: ${availableStock}.` },
          { status: 400 }
        );
      }
    }

    // CLOSED-LOOP RESEARCHER OWNERSHIP + CATALOG GUARD
    if (agentSlug) {
      const { data: storefrontAgent } = await serviceSupabase
        .from('agent_profiles')
        .select('id, min_overall_qty, min_order_qty')
        .ilike('slug', agentSlug)
        .single();

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
        return NextResponse.json({ error: `This storefront requires a minimum overall order of ${minQty} items.` }, { status: 400 });
      }

      const minPerItem = Number(storefrontAgent.min_order_qty) || 1;
      for (const item of items) {
        if ((Number(item.quantity) || 0) < minPerItem) {
          return NextResponse.json({ error: `This storefront requires a minimum of ${minPerItem} per peptide.` }, { status: 400 });
        }
      }

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
        return NextResponse.json({ error: `Product "${blockedName}" Is Not Available Through This Agent's Store.` }, { status: 403 });
      }
    }

    // 1. Fetch Admin Default Multipliers
    const { data: tiers } = await serviceSupabase.from('pricing_tiers').select('tier_name, multiplier');
    const tierMultipliers: Record<string, number> = {};
    tiers?.forEach(t => { tierMultipliers[t.tier_name] = Number(t.multiplier); });

    // fix-57 #2: fetch active flash sale (if any). Single row max.
    // Applied to researcher retail pricing only — agent self-buys and
    // wholesale restocks are exempt (already at wholesale tier).
    const wholesaleExplicit = explicitWholesale === true &&
      (profile.role === 'agent' || profile.role === 'super_agent') &&
      !isSubAgent;
    const flashSaleEligible = !isAgentSelfBuy && !isSubAgent && !wholesaleExplicit;
    let flashSaleDiscountPct = 0;
    if (flashSaleEligible) {
      const nowIso = new Date().toISOString();
      const { data: activeSale } = await serviceSupabase
        .from('flash_sales')
        .select('discount_pct')
        .eq('is_active', true)
        .lte('starts_at', nowIso)
        .gte('ends_at', nowIso)
        .order('ends_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (activeSale) {
        const d = Number(activeSale.discount_pct);
        if (Number.isFinite(d) && d > 0 && d <= 90) {
          flashSaleDiscountPct = d;
        }
      }
    }
    const flashMultiplier = 1 - (flashSaleDiscountPct / 100);

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

    // 4. Fetch Custom Retail Prices
    let agentCustomRetail: Record<string, number> = {};
    if (agentProfile) {
      const { data: acr } = await serviceSupabase
        .from('agent_products')
        .select('product_id, retail_price, is_on_sale, sale_price')
        .eq('agent_id', agentProfile.id);
      acr?.forEach(a => {
        const rawPrice = a.is_on_sale && a.sale_price != null
          ? Number(a.sale_price)
          : Number(a.retail_price);
        agentCustomRetail[a.product_id] = rawPrice / 10;
      });
    }

    // 5. Fetch Super Agent Baseline Costs
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
        return NextResponse.json(
          { error: `Product ID "${cartItem.id}" Is No Longer Available. Please Return To The Store And Refresh Your Cart.` },
          { status: 400 }
        );
      }

      const baseCost = Number(dbProduct.base_cost);

      let retailPrice = 0;

      if (isAgentSelfBuy || isSubAgent) {
        // costPrice path; retail collapses to cost for wholesale buyers below.
      } else if (agentCustomRetail[dbProduct.id]) {
        retailPrice = agentCustomRetail[dbProduct.id];
      } else {
        const retailMultiplier = tierMultipliers['tier_3'] ?? 1.7;
        retailPrice = baseCost * retailMultiplier / 10;
      }

      const itemQty = Number(cartItem.quantity) || 1;

      if (itemQty > 10_000) {
        return NextResponse.json(
          { error: `Quantity for a cart item exceeds the maximum allowed (10,000 per item).` },
          { status: 400 }
        );
      }

      let costPrice = retailPrice;
      let superAgentCost = null;
      // Wholesale buyers (agent self-buy + sub-agents) always pay flat tier
      // cost — no volume/bulk discount and no retail markup. Dynamic pricing
      // applies to researchers only.
      const isWholesalePurchase = isAgentSelfBuy || isSubAgent;

      if (agentProfile) {
        if (superAgentProfile) {
          const saMultiplier = superAgentOverrides[dbProduct.id] ?? tierMultipliers[superAgentProfile.tier || 'tier_3'] ?? 1.7;
          superAgentCost = isWholesalePurchase
            ? (baseCost * saMultiplier / 10)
            : applyBulkPrice(
                baseCost * saMultiplier / 10,
                itemQty,
                dbProduct.admin_bulk_price != null ? dbProduct.admin_bulk_price / 10 : null,
                dbProduct.admin_bulk_threshold
              );

          const saConfig = superAgentBaselines[dbProduct.id];
          if (saConfig) {
             // Sub-agents do not get the bulk_baseline_cost break; they always
             // pay the baseline tier their parent has set.
             if (!isWholesalePurchase && saConfig.bulk_baseline_cost !== null && itemQty >= saConfig.bulk_threshold) {
                 costPrice = saConfig.bulk_baseline_cost;
             } else {
                 costPrice = saConfig.baseline_cost;
             }
          } else {
             costPrice = superAgentCost;
          }

          // Gamification Markup (Super Agent -> Agent)
          // The Agent pays the Super Agent's cost + Markup
          if (agentProfile && !agentProfile.is_sub_agent) {
             const { data: markupData } = await serviceSupabase.rpc('fn_agent_effective_markup', { p_agent: agentProfile.id });
             const markupPct = Number(markupData) || 0;
             costPrice = superAgentCost * (1 + (markupPct / 100));
          }

        } else {
          const agentMultiplier = agentOverrides[dbProduct.id] ?? tierMultipliers[agentTier] ?? 1.7;
          // Agent self-buy at a regular agent's storefront: skip bulk pricing.
          // Researcher buying through the agent: keep bulk pricing.
          costPrice = isWholesalePurchase
            ? (baseCost * agentMultiplier / 10)
            : applyBulkPrice(
                baseCost * agentMultiplier / 10,
                itemQty,
                dbProduct.admin_bulk_price != null ? dbProduct.admin_bulk_price / 10 : null,
                dbProduct.admin_bulk_threshold
              );
        }
      }

      // Wholesale buyers always pay tier cost flat. retailPrice collapses to
      // costPrice so the order line records what they actually paid. Spread on
      // a sub-agent's sale to a researcher flows via accrue_sub_agent_commission.
      if (isWholesalePurchase) {
        retailPrice = costPrice;
      }

      // fix-57 #2: Flash sale discount applies to retail buyers, not wholesale.
      if (flashSaleDiscountPct > 0 && !isAgentSelfBuy) {
        retailPrice = retailPrice * flashMultiplier;
      }

      // Round unit prices to exact cents
      retailPrice = isFinite(retailPrice) ? Math.round(retailPrice * 100) / 100 : 0;
      costPrice = isFinite(costPrice) ? Math.round(costPrice * 100) / 100 : 0;
      if (superAgentCost !== null) {
        superAgentCost = isFinite(superAgentCost) ? Math.round(superAgentCost * 100) / 100 : null;
      }

      const split = itemSplits[dbProduct.id];

      if (split && split.localQty > 0) {
        subtotal += retailPrice * split.localQty;
        totalWeightOz += (Number(dbProduct.weight_oz) || 0.5) * split.localQty;
        computedItems.push({
          product_id: dbProduct.id,
          product_name: dbProduct.name,
          quantity: split.localQty,
          unit_retail_price: retailPrice,
          unit_cost_price: 0,
          unit_super_agent_cost: superAgentCost !== null ? 0 : null,
          isLocalFulfillment: true
        } as any);
      }

      if (split && split.chinaQty > 0) {
        subtotal += retailPrice * split.chinaQty;
        totalWeightOz += (Number(dbProduct.weight_oz) || 0.5) * split.chinaQty;
        computedItems.push({
          product_id: dbProduct.id,
          product_name: dbProduct.name,
          quantity: split.chinaQty,
          unit_retail_price: retailPrice,
          unit_cost_price: costPrice,
          unit_super_agent_cost: superAgentCost,
          isLocalFulfillment: false
        } as any);
      }

      if (!split || (split.localQty === 0 && split.chinaQty === 0)) {
        subtotal += retailPrice * itemQty;
        totalWeightOz += (Number(dbProduct.weight_oz) || 0.5) * itemQty;
        computedItems.push({
          product_id: dbProduct.id,
          product_name: dbProduct.name,
          quantity: itemQty,
          unit_retail_price: retailPrice,
          unit_cost_price: costPrice,
          unit_super_agent_cost: superAgentCost,
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
      if (localReserved && localItems.length > 0) {
        await serviceSupabase.rpc('release_inventory', { p_items: localItems, p_agent_id: agentProfile?.id, p_is_agent_ship: true });
      }
      if (chinaReserved && chinaItems.length > 0) {
        await serviceSupabase.rpc('release_inventory', { p_items: chinaItems, p_agent_id: null, p_is_agent_ship: false });
      }
    };

    if (fulfillmentMethod !== 'agent_pickup') {
      if (localItems.length > 0) {
        const { error: reserveErr } = await serviceSupabase.rpc('reserve_inventory', { p_items: localItems, p_agent_id: agentProfile?.id, p_is_agent_ship: true });
        if (reserveErr) {
          return NextResponse.json({ error: /Insufficient inventory/i.test(reserveErr.message) ? reserveErr.message : 'Failed To Reserve Local Inventory. Please Try Again.' }, { status: 422 });
        }
        localReserved = true;
      }
      if (chinaItems.length > 0) {
        const { error: reserveErr } = await serviceSupabase.rpc('reserve_inventory', { p_items: chinaItems, p_agent_id: null, p_is_agent_ship: false });
        if (reserveErr) {
          await releaseReservedInventory();
          return NextResponse.json({ error: /Insufficient inventory/i.test(reserveErr.message) ? reserveErr.message : 'Failed To Reserve Global Inventory. Please Try Again.' }, { status: 422 });
        }
        chinaReserved = true;
      }
    }

    // STEP B: COUPON REDEMPTION
    let discountAmount = 0;
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

    if (trimmedCouponCode) {
      const couponAgentId = profile.referring_agent_id ?? agentProfile?.id ?? null;
      if (!couponAgentId) {
        await releaseReservedInventory();
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
          p_buyer_id: user.id,
        });

      if (redeemError) {
        console.error('Coupon RPC Failed:', redeemError);
        await releaseReservedInventory();
        return NextResponse.json(
          { error: 'Coupon Invalid Or Limit Reached' },
          { status: 422 }
        );
      }

      const row = Array.isArray(redeem) ? redeem[0] : redeem;
      if (!row?.coupon_id) {
        await releaseReservedInventory();
        return NextResponse.json(
          { error: 'Coupon Invalid Or Limit Reached' },
          { status: 422 }
        );
      }

      appliedCouponId = row.coupon_id;
      appliedCouponCode = trimmedCouponCode;
      discountAmount = Number(row.discount_amount) || 0;
    }

    // Calculate shipping costs
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

    const grossTotal = Math.max(0, subtotal - discountAmount) + shippingCost;
    const total = Math.max(0, grossTotal);

    // Velocity caps (flag-gated, additive). A researcher order placed through a
    // sub-agent's storefront is held against that sub-agent's virtual velocity
    // cap — a ceiling on unsettled (pre-shipment) order value. This does NOT
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
          await releaseReservedInventory();
          const remaining = Math.max(0, cap - used);
          return NextResponse.json(
            { error: `Velocity Cap Reached. This Order Of $${total.toFixed(2)} Would Exceed Your Available Limit ($${remaining.toFixed(2)} Remaining). Contact Your Agent To Raise It.` },
            { status: 403 },
          );
        }
      }
    }

    // Record the Layer 4 (checkout) disclaimer audit row
    const disclaimerVersion = process.env.NEXT_PUBLIC_DISCLAIMER_VERSION || 'v1.0';
    const checkoutIp =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      null;
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
      .single();

    if (disclaimerError || !disclaimerRow) {
      console.error('Checkout Disclaimer Audit Insert Failed:', disclaimerError);
      return NextResponse.json(
        { error: 'Disclaimer audit failed; order not placed.' },
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

    const isSACAOrder =
      isSubAgent ||
      ((profile as { referring_sub_agent_id?: string | null }).referring_sub_agent_id != null);

    if (isWholesaleRestock) {
      if (profile.role === 'super_agent') {
        if (profile.auto_approve_orders) {
          const res = await checkSuperAgentCredit(profile, total);
          if (res.error) return NextResponse.json({ error: res.error }, { status: res.status });
          prepaidDeducted = res.prepaidDeducted || false;
          if (prepaidDeducted) {
            prepaidDeductedAmount = res.amount || 0;
            prepaidDeductedAgentId = res.agentId || null;
          }
          initialStatus = 'admin_approval_pending';
        } else {
          initialStatus = 'pending_customer_payment';
        }
      } else if (profile.role === 'agent') {
        if (profile.auto_approve_orders && superAgentProfile) {
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
          initialStatus = 'admin_approval_pending';
        } else {
          initialStatus = 'agent_approval_pending';
        }
      }
    } else {
      if (isSACAOrder) {
        initialStatus = 'agent_approval_pending';
      } else if (profile.auto_approve_orders) {
        if (agentProfile && agentProfile.role === 'agent') {
          if (agentProfile.auto_approve_orders && superAgentProfile) {
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
            initialStatus = 'admin_approval_pending';
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
          if (res.error) return NextResponse.json({ error: res.error }, { status: res.status });
          prepaidDeducted = res.prepaidDeducted || false;
          if (prepaidDeducted) {
            prepaidDeductedAmount = res.amount || 0;
            prepaidDeductedAgentId = res.agentId || null;
          }
          initialStatus = 'admin_approval_pending';
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
      if (orderError && (orderError as any).code === '23505' && idempotencyKey) {
        const { data: existing } = await serviceSupabase
          .from('orders')
          .select('id, total')
          .eq('idempotency_key', idempotencyKey)
          .eq('buyer_id', user.id)
          .maybeSingle();
        if (existing) {
          await releaseReservedInventory();

          if (appliedCouponId) await serviceSupabase.rpc('unreedeem_coupon', { p_coupon_id: appliedCouponId });
          return NextResponse.json({
            success: true,
            orderId: existing.id,
            total: Number(existing.total) || 0,
            replayed: true,
          });
        }
      }
      await releaseReservedInventory();
      if (appliedCouponId) await serviceSupabase.rpc('unreedeem_coupon', { p_coupon_id: appliedCouponId });
      if (prepaidDeducted && prepaidDeductedAmount > 0 && prepaidDeductedAgentId) {
        await serviceSupabase.rpc('refund_prepaid_balance', { p_agent_id: prepaidDeductedAgentId, p_amount: prepaidDeductedAmount });
      }
      console.error('Database Order Write Error:', orderError);
      return NextResponse.json({ error: 'Failed To Save Order Transaction.' }, { status: 500 });
    }

    void serviceSupabase
      .from('disclaimer_acceptances')
      .update({ order_id: order.id })
      .eq('id', disclaimerRow.id);

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
      console.error('Database Order Items Write Error:', JSON.stringify(itemsError));
      await serviceSupabase.from('orders').delete().eq('id', order.id);
      await releaseReservedInventory();
      if (appliedCouponId) await serviceSupabase.rpc('unreedeem_coupon', { p_coupon_id: appliedCouponId });
      if (prepaidDeducted && prepaidDeductedAmount > 0 && prepaidDeductedAgentId) {
        await serviceSupabase.rpc('refund_prepaid_balance', { p_agent_id: prepaidDeductedAgentId, p_amount: prepaidDeductedAmount });
      }

      return NextResponse.json({ error: `An unexpected error occurred: ${itemsError.message || JSON.stringify(itemsError)}` }, { status: 500 });
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

    // In-app + push notifications for new order
    try {
      const short = shortOrderId(order.id);
      if (agentProfile && !isAgentSelfBuy) {
        const { data: buyerProfile } = await serviceSupabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .maybeSingle();
        const buyerName = buyerProfile?.full_name || 'A Researcher';
        await notifyOrderPlaced(serviceSupabase, agentProfile.id, order.id, short, buyerName);
        if (appliedCouponCode && discountAmount > 0) {
          await notifyCouponRedeemed(
            serviceSupabase,
            agentProfile.id,
            appliedCouponCode,
            discountAmount,
            Number(order.total) || 0,
            order.id,
            short,
          );
        }
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
