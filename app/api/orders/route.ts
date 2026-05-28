import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { validateCoupon } from '@/lib/coupons';
import { z } from 'zod';

const CheckoutSchema = z.object({
  items: z.array(z.object({
    id: z.string().uuid(),
    quantity: z.number().int().min(1)
  })).min(1, 'Cart cannot be empty.'),
  fulfillmentMethod: z.enum(['ship', 'agent_pickup']),
  paymentMethod: z.enum(['zelle', 'cashapp', 'venmo', 'apple_pay']),
  shippingAddress: z.object({
    street: z.string().min(1),
    city: z.string().min(1),
    state: z.string().min(2),
    zipCode: z.string().min(5),
    country: z.string().min(2),
  }).optional().nullable(),
  couponCode: z.string().optional().nullable(),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const serviceSupabase = await createServiceClient();

    // Authenticate the user session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized. Please Sign In.' }, { status: 401 });
    }

    const rawBody = await request.json();
    const validation = CheckoutSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid checkout data.', details: validation.error.issues }, { status: 400 });
    }

    const { items, shippingAddress, fulfillmentMethod, paymentMethod, couponCode } = validation.data;

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
        .select('product_id, retail_price')
        .eq('agent_id', agentProfile.id);
      acr?.forEach(a => { agentCustomRetail[a.product_id] = Number(a.retail_price); });
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
          superAgentCost = baseCost * saMultiplier;

          // Apply Admin Bulk Pricing to Super Agent if applicable
          if (dbProduct.admin_bulk_price !== null && itemQty >= (dbProduct.admin_bulk_threshold ?? 100)) {
            superAgentCost = Number(dbProduct.admin_bulk_price);
          }
          
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
          costPrice = baseCost * agentMultiplier;

          // Apply Admin Bulk Pricing to Agent if applicable
          if (dbProduct.admin_bulk_price !== null && itemQty >= (dbProduct.admin_bulk_threshold ?? 100)) {
            costPrice = Number(dbProduct.admin_bulk_price);
          }
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
        agent_id: agentProfile && !isAgentSelfBuy ? agentProfile.id : null,
        is_wholesale_restock: isAgentSelfBuy,
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
