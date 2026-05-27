import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { validateCoupon } from '@/lib/coupons';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const serviceSupabase = await createServiceClient();

    // Authenticate the user session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized. Please Sign In.' }, { status: 401 });
    }

    const body = await request.json();
    const { items, shippingAddress, fulfillmentMethod, paymentMethod, couponCode } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Invalid Cart Items.' }, { status: 400 });
    }
    if (!paymentMethod) {
      return NextResponse.json({ error: 'Payment Method Is Required.' }, { status: 400 });
    }
    if (fulfillmentMethod === 'ship' && !shippingAddress) {
      return NextResponse.json({ error: 'Shipping Address Is Required For Deliveries.' }, { status: 400 });
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

    // Retrieve active product definitions matching requested cart item IDs
    const productIds = items.map((item: any) => item.id);
    const { data: dbProducts, error: dbProductsError } = await serviceSupabase
      .from('products')
      .select('id, name, base_cost, weight_oz, is_active, is_banned, sku, inventory_count')
      .in('id', productIds);

    if (dbProductsError || !dbProducts || dbProducts.length === 0) {
      return NextResponse.json({ error: 'Failed To Retrieve Product Data.' }, { status: 400 });
    }

    // Check for banned or deactivated products and inventory limits
    for (const cartItem of items) {
      const dbProduct = dbProducts.find(p => p.id === cartItem.id);
      if (!dbProduct) continue;
      
      if (dbProduct.is_banned || !dbProduct.is_active) {
        return NextResponse.json({ error: `Product "${dbProduct.name}" Is Unavailable For Sale.` }, { status: 400 });
      }

      const qty = Number(cartItem.quantity) || 1;
      if (Number(dbProduct.inventory_count) < qty) {
        return NextResponse.json(
          { error: `Insufficient inventory for "${dbProduct.name}". Only ${dbProduct.inventory_count} remaining.` },
          { status: 400 }
        );
      }
    }

    // --- PRICING ENGINE ---

    // 1. Fetch Admin Default Multipliers (Tier 3 is standard retail)
    const { data: tiers } = await serviceSupabase.from('pricing_tiers').select('tier_name, multiplier');
    const tierMultipliers: Record<string, number> = {};
    tiers?.forEach(t => { tierMultipliers[t.tier_name] = Number(t.multiplier); });

    // 2. Fetch Agent Profile & Super Agent Profile (if applicable)
    let agentProfile = null;
    let superAgentProfile = null;
    let isAgentSelfBuy = false;
    
    // Determine the Agent of Record for this order
    if (profile.role === 'agent' || profile.role === 'admin') {
      // The buyer IS an agent. They get their own wholesale pricing.
      agentProfile = profile;
      isAgentSelfBuy = true;
      
      if (profile.parent_agent_id) {
        const { data: sap } = await serviceSupabase
          .from('profiles')
          .select('id, tier')
          .eq('id', profile.parent_agent_id)
          .single();
        superAgentProfile = sap;
      }
    } else if (profile.referring_agent_id) {
      // The buyer is a researcher referred by an agent.
      const { data: ap } = await serviceSupabase
        .from('profiles')
        .select('id, tier, parent_agent_id')
        .eq('id', profile.referring_agent_id)
        .single();
      agentProfile = ap;

      if (ap?.parent_agent_id) {
        const { data: sap } = await serviceSupabase
          .from('profiles')
          .select('id, tier')
          .eq('id', ap.parent_agent_id)
          .single();
        superAgentProfile = sap;
      }
    }

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
        .select('product_id, retail_price')
        .eq('agent_id', agentProfile.id);
      acr?.forEach(a => { agentCustomRetail[a.product_id] = Number(a.retail_price); });
    }

    // 5. Fetch Super Agent Baseline Costs (if Sub-Agent)
    let superAgentBaselines: Record<string, number> = {};
    if (superAgentProfile) {
      const { data: sab } = await serviceSupabase
        .from('super_agent_pricing')
        .select('product_id, baseline_cost')
        .eq('super_agent_id', superAgentProfile.id);
      sab?.forEach(b => { superAgentBaselines[b.product_id] = Number(b.baseline_cost); });
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

      // Calculate Agent Cost (What the agent of record owes Admin or Super Agent)
      let costPrice = retailPrice; // Default to retail if no agent
      let superAgentCost = null;

      if (agentProfile) {
        if (superAgentProfile) {
          // This is a Sub-Agent. 
          // Sub-Agent Cost = Super Agent Baseline (fallback to Super Agent's cost if no baseline set)
          const saMultiplier = superAgentOverrides[dbProduct.id] ?? tierMultipliers[superAgentProfile.tier || 'tier_3'] ?? 7.0;
          superAgentCost = baseCost * saMultiplier;
          
          costPrice = superAgentBaselines[dbProduct.id] ?? superAgentCost;
        } else {
          // Standard Agent.
          // Agent Cost = Admin Base Cost * Agent Tier Multiplier
          const agentMultiplier = agentOverrides[dbProduct.id] ?? tierMultipliers[agentTier] ?? 7.0;
          costPrice = baseCost * agentMultiplier;
        }
      }
      
      // If agent self buy, they pay exactly what they owe.
      if (isAgentSelfBuy) {
        retailPrice = costPrice;
      }

      const itemQty = Number(cartItem.quantity) || 1;

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

    // Validate and apply a coupon code
    let discountAmount = 0;
    let appliedCouponCode: string | null = null;
    if (couponCode && String(couponCode).trim()) {
      const couponResult = await validateCoupon(serviceSupabase, {
        code: String(couponCode),
        agentId: profile.referring_agent_id ?? null,
        subtotal,
      });
      if (!couponResult.valid) {
        return NextResponse.json(
          { error: couponResult.error ?? 'Coupon Is Not Valid.' },
          { status: 400 }
        );
      }
      discountAmount = couponResult.discount ?? 0;
      appliedCouponCode = couponResult.code ?? null;
    }

    // Calculate shipping costs
    let shippingCost = 0;
    if (fulfillmentMethod === 'ship') {
      const { data: shippingRates } = await serviceSupabase
        .from('shipping_rates')
        .select('rate')
        .lte('min_weight_oz', totalWeightOz)
        .gt('max_weight_oz', totalWeightOz);

      if (shippingRates && shippingRates.length > 0) {
        shippingCost = Number(shippingRates[0].rate);
      } else {
        shippingCost = 12.00;
      }
    }

    const total = Math.max(0, subtotal - discountAmount) + shippingCost;

    // Create checkout order
    const { data: order, error: orderError } = await serviceSupabase
      .from('orders')
      .insert({
        buyer_id: user.id,
        agent_id: agentProfile ? agentProfile.id : null,
        status: 'pending_customer_payment',
        fulfillment_method: fulfillmentMethod,
        payment_method: paymentMethod,
        shipping_address: shippingAddress ?? null,
        shipping_cost: shippingCost,
        subtotal: subtotal,
        discount_amount: discountAmount,
        coupon_code: appliedCouponCode,
        total: total
      })
      .select('id')
      .single();

    if (orderError || !order) {
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

    if (appliedCouponCode && agentProfile?.id) {
      try {
        const { data: couponRow } = await serviceSupabase
          .from('coupons')
          .select('id, uses_count')
          .eq('agent_id', agentProfile.id)
          .eq('code', appliedCouponCode)
          .maybeSingle();
        if (couponRow) {
          await serviceSupabase
            .from('coupons')
            .update({ uses_count: (Number(couponRow.uses_count) || 0) + 1 })
            .eq('id', couponRow.id);
        }
      } catch (couponError) {
        console.error('Coupon Usage Increment Failed:', couponError);
      }
    }

    await serviceSupabase.from('disclaimer_acceptances').insert({
      user_id: user.id,
      disclaimer_version: process.env.NEXT_PUBLIC_DISCLAIMER_VERSION ?? 'v1.0',
      layer: 'checkout',
      user_agent: request.headers.get('user-agent') || 'Unknown',
      ip_address: request.headers.get('x-forwarded-for') || '127.0.0.1'
    });

    return NextResponse.json({ success: true, orderId: order.id });

  } catch (error) {
    console.error('Order API Route Caught Exception:', error);
    return NextResponse.json({ error: 'Internal Server Error Occurred.' }, { status: 500 });
  }
}
