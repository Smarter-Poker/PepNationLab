import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { applyBulkPrice } from '@/lib/pricing';
import { assertSameOrigin } from '@/lib/csrf';
import { rateLimit } from '@/lib/rate-limit';

const CheckoutSchema = z.object({
  items: z.array(z.object({
    id: z.string().uuid(),
    quantity: z.number().int().min(1)
  })).min(1, 'Cart cannot be empty.'),
  fulfillmentMethod: z.enum(['ship', 'agent_pickup']),
  paymentMethod: z.enum(['zelle', 'cashapp', 'venmo', 'apple_pay']),
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
  creditRedeemed: z.number().min(0).optional(),
});

export async function POST(request: NextRequest) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;
  try {
    const supabase = await createClient();
    const serviceSupabase = await createServiceClient();

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
      creditRedeemed: requestedCredit,
    } = validation.data;

    if (fulfillmentMethod === 'ship' && !shippingAddress) {
      return NextResponse.json({ error: 'Shipping Address Is Required For Deliveries.' }, { status: 400 });
    }

    // Idempotency replay: if a request with this key already produced an
    // order, return that order rather than creating a duplicate.
    if (idempotencyKey) {
      const { data: existing } = await serviceSupabase
        .from('orders')
        .select('id, total, status')
        .eq('idempotency_key', idempotencyKey)
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
      .select('id, referring_agent_id, role, tier, parent_agent_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Researcher Profile Not Found.' }, { status: 404 });
    }

    // --- DETERMINE AGENT OF RECORD ---
    let agentProfile = null;
    let superAgentProfile = null;
    let isAgentSelfBuy = false;
    
    if (profile.role === 'agent' || profile.role === 'super_agent' || profile.role === 'admin') {
      agentProfile = profile;
      isAgentSelfBuy = true;
      if (profile.parent_agent_id) {
        const { data: sap } = await serviceSupabase.from('profiles').select('id, tier').eq('id', profile.parent_agent_id).single();
        superAgentProfile = sap;
      }
    } else if (profile.referring_agent_id) {
      const { data: ap } = await serviceSupabase.from('profiles').select('id, tier, parent_agent_id').eq('id', profile.referring_agent_id).single();
      agentProfile = ap;
      if (ap?.parent_agent_id) {
        const { data: sap } = await serviceSupabase.from('profiles').select('id, tier').eq('id', ap.parent_agent_id).single();
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
      if (!dbProduct) continue;
      
      if (dbProduct.is_banned || !dbProduct.is_active) {
        return NextResponse.json({ error: `Product "${dbProduct.name}" Is Unavailable For Sale.` }, { status: 400 });
      }

      const qty = Number(cartItem.quantity) || 1;
      let availableStock = Number(dbProduct.inventory_count);
      
      if (agentProfile && !isAgentSelfBuy) {
         availableStock = agentStockMap[cartItem.id] || 0;
      }

      if (availableStock < qty) {
        return NextResponse.json(
          { error: `Insufficient inventory for "${dbProduct.name}". Only ${availableStock} remaining.` },
          { status: 400 }
        );
      }
    }

    // --- PRICING ENGINE ---

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
        // Use sale_price if the product is currently on sale
        const price = a.is_on_sale && a.sale_price != null ? Number(a.sale_price) : Number(a.retail_price);
        agentCustomRetail[a.product_id] = price;
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
      if (!dbProduct) continue;

      const baseCost = Number(dbProduct.base_cost);
      
      // Calculate Retail Price (What the buyer pays)
      let retailPrice = 0;
      
      if (isAgentSelfBuy) {
        // If the agent is buying for themselves, they pay their wholesale cost.
        // We will calculate costPrice first, then set retailPrice = costPrice.
      } else if (agentCustomRetail[dbProduct.id]) {
        retailPrice = agentCustomRetail[dbProduct.id];
      } else {
        const retailMultiplier = tierMultipliers['tier_3'] ?? 7.0;
        retailPrice = baseCost * retailMultiplier;
      }

      const itemQty = Number(cartItem.quantity) || 1;

      // Calculate Agent Cost (What the agent of record owes Admin or Super Agent)
      let costPrice = retailPrice; // Default to retail if no agent
      let superAgentCost = null;

      if (agentProfile) {
        if (superAgentProfile) {
          // This is a Sub-Agent.
          // Super Agent Cost (What Super Agent owes Admin):
          const saMultiplier = superAgentOverrides[dbProduct.id] ?? tierMultipliers[superAgentProfile.tier || 'tier_3'] ?? 7.0;
          superAgentCost = applyBulkPrice(
            baseCost * saMultiplier,
            itemQty,
            dbProduct.admin_bulk_price,
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
          const agentMultiplier = agentOverrides[dbProduct.id] ?? tierMultipliers[agentTier] ?? 7.0;
          costPrice = applyBulkPrice(
            baseCost * agentMultiplier,
            itemQty,
            dbProduct.admin_bulk_price,
            dbProduct.admin_bulk_threshold
          );
        }
      }
      
      // If agent self buy, they pay exactly what they owe.
      if (isAgentSelfBuy) {
        retailPrice = costPrice;
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

    // Validate and atomically redeem a coupon code via SECURITY DEFINER RPC.
    // The RPC increments uses_count + checks expiry, limits, and min subtotal
    // in a single transaction so two concurrent uses of the last redemption
    // cannot both succeed.
    let discountAmount = 0;
    let appliedCouponCode: string | null = null;
    let appliedCouponId: string | null = null;
    const trimmedCouponCode = couponCode ? String(couponCode).trim().toUpperCase() : '';
    if (trimmedCouponCode) {
      const couponAgentId = profile.referring_agent_id ?? agentProfile?.id ?? null;
      if (!couponAgentId) {
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
        return NextResponse.json(
          { error: 'Coupon Invalid Or Limit Reached' },
          { status: 422 }
        );
      }

      const row = Array.isArray(redeem) ? redeem[0] : redeem;
      if (!row?.coupon_id) {
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

    const grossTotal = Math.max(0, subtotal - discountAmount) + shippingCost;

    // Validate requested store credit against the server-side balance view.
    // Cap at the order gross so a researcher can never go negative via credit.
    let creditRedeemed = 0;
    if (requestedCredit && requestedCredit > 0) {
      const { data: balanceRow, error: balanceErr } = await serviceSupabase
        .from('store_credit_balances')
        .select('balance')
        .eq('user_id', user.id)
        .maybeSingle();
      if (balanceErr) {
        return NextResponse.json({ error: 'Failed To Verify Store Credit Balance.' }, { status: 500 });
      }
      const available = Number(balanceRow?.balance ?? 0);
      if (available < requestedCredit) {
        return NextResponse.json(
          { error: `Insufficient Store Credit (Have $${available.toFixed(2)}, Need $${requestedCredit.toFixed(2)}).` },
          { status: 422 }
        );
      }
      creditRedeemed = Math.min(requestedCredit, grossTotal);
      // Round to two decimals to avoid float-vs-numeric drift on the DB row.
      creditRedeemed = Math.round(creditRedeemed * 100) / 100;
    }

    const total = Math.max(0, grossTotal - creditRedeemed);

    // Record the Layer 4 (checkout) disclaimer audit row BEFORE the order
    // insert. If the audit fails we refuse to place the order — research-only
    // compliance requires the four-layer trail to be intact for every sale.
    const disclaimerVersion = process.env.NEXT_PUBLIC_DISCLAIMER_VERSION || 'v1.0';
    const checkoutIp =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      null;
    const checkoutUserAgent = request.headers.get('user-agent') || null;

    const { error: disclaimerError } = await serviceSupabase
      .from('disclaimer_acceptances')
      .insert({
        user_id: user.id,
        disclaimer_version: disclaimerVersion,
        layer: 'checkout',
        user_agent: checkoutUserAgent,
        ip_address: checkoutIp,
      });

    if (disclaimerError) {
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

    // Create checkout order
    const { data: order, error: orderError } = await serviceSupabase
      .from('orders')
      .insert({
        buyer_id: user.id,
        agent_id: agentProfile && !isAgentSelfBuy ? agentProfile.id : null,
        is_wholesale_restock: isWholesaleRestock,
        status: 'pending_customer_payment',
        fulfillment_method: fulfillmentMethod,
        payment_method: paymentMethod,
        shipping_address: shippingAddress ?? null,
        shipping_cost: shippingCost,
        subtotal: subtotal,
        discount_amount: discountAmount,
        coupon_code: appliedCouponCode,
        total: total,
        credits_redeemed: creditRedeemed,
        idempotency_key: idempotencyKey ?? null,
      })
      .select('id, total')
      .single();

    if (orderError || !order) {
      // 23505 = unique_violation. With the unique partial index on
      // orders.idempotency_key this means a parallel request already
      // committed; return the prior order as a replay.
      if (orderError && (orderError as any).code === '23505' && idempotencyKey) {
        const { data: existing } = await serviceSupabase
          .from('orders')
          .select('id, total')
          .eq('idempotency_key', idempotencyKey)
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
      console.error('Database Order Write Error:', orderError);
      return NextResponse.json({ error: 'Failed To Save Order Transaction.' }, { status: 500 });
    }

    // Create order items
    const itemsToInsert = computedItems.map(item => ({
      order_id: order.id,
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_retail_price: item.unit_retail_price,
      unit_cost_price: item.unit_cost_price,
      unit_super_agent_cost: item.unit_super_agent_cost
    }));

    const { error: itemsError } = await serviceSupabase
      .from('order_items')
      .insert(itemsToInsert);

    if (itemsError) {
      console.error('Database Order Items Write Error:', itemsError);
      await serviceSupabase.from('orders').delete().eq('id', order.id);
      return NextResponse.json({ error: 'Failed To Save Checkout Order Line Items.' }, { status: 500 });
    }

    // Coupon usage was incremented atomically by the redeem_coupon RPC before
    // the order insert; no JS-side increment needed.
    void appliedCouponId;

    // Atomically debit the buyer's store credit if any was applied. If this
    // fails we roll back the order so the ledger and the credit balance never
    // disagree.
    if (creditRedeemed > 0) {
      const { error: redeemErr } = await serviceSupabase.rpc('redeem_store_credit', {
        p_user_id: user.id,
        p_amount: creditRedeemed,
        p_order_id: order.id,
        p_description: `Order Credit Redemption (${order.id.slice(0, 8)})`,
      });
      if (redeemErr) {
        await serviceSupabase.from('order_items').delete().eq('order_id', order.id);
        await serviceSupabase.from('orders').delete().eq('id', order.id);
        console.error('Store Credit Redemption Failed:', redeemErr);
        return NextResponse.json(
          { error: 'Store Credit Redemption Failed. No Charge Has Been Made.' },
          { status: 422 }
        );
      }
    }

    // Checkout disclaimer audit row was recorded above, prior to the order
    // insert, so a successful order implies a complete four-layer trail.

    return NextResponse.json({
      success: true,
      orderId: order.id,
      total: Number(order.total) || 0,
      creditRedeemed,
    });

  } catch (error) {
    console.error('Order API Route Caught Exception:', error);
    return NextResponse.json({ error: 'Internal Server Error Occurred.' }, { status: 500 });
  }
}
