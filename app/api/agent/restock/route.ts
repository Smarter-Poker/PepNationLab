import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { z } from 'zod';
import { assertSameOrigin } from '@/lib/csrf';

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
  }).optional(),
});

export async function POST(request: NextRequest) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  try {
    const supabase = await createClient();
    const serviceSupabase = await createServiceClient();

    const gate = await requireAgent();
    if (!gate.ok) return gate.response;
    const user = gate.user;

    const rawBody = await request.json();
    const validation = CheckoutSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid restock payload', details: validation.error.issues }, { status: 400 });
    }

    const { items, shippingAddress, fulfillmentMethod, paymentMethod } = validation.data;

    if (fulfillmentMethod === 'ship' && !shippingAddress) {
      return NextResponse.json({ error: 'Shipping Address Is Required For Deliveries.' }, { status: 400 });
    }

    // Get researcher profile
    const { data: profile, error: profileError } = await serviceSupabase
      .from('profiles')
      .select('id, role, tier, parent_agent_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile Not Found.' }, { status: 404 });
    }

    if (!['agent', 'super_agent', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Only Agents can perform a wholesale restock.' }, { status: 403 });
    }

    // Retrieve active product definitions
    const { data: dbProducts, error: dbProductsError } = await serviceSupabase
      .from('products')
      .select('id, name, base_cost, weight_oz, is_active, is_banned, inventory_count, admin_bulk_price, admin_bulk_threshold')
      .in('id', items.map(i => i.id));

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

      if (Number(dbProduct.inventory_count) < cartItem.quantity) {
        return NextResponse.json(
          { error: `Insufficient global inventory for "${dbProduct.name}". Only ${dbProduct.inventory_count} remaining.` },
          { status: 400 }
        );
      }
    }

    // --- PRICING ENGINE ---

    // Fetch Admin Default Multipliers
    const { data: tiers } = await serviceSupabase.from('pricing_tiers').select('tier_name, multiplier');
    const tierMultipliers: Record<string, number> = {};
    tiers?.forEach(t => { tierMultipliers[t.tier_name] = Number(t.multiplier); });

    // Fetch Override Rule Sets
    const getOverrides = async (tier: string) => {
      const { data } = await serviceSupabase.from('product_tier_overrides').select('product_id, custom_multiplier').eq('tier_name', tier);
      const map: Record<string, number> = {};
      data?.forEach(o => { map[o.product_id] = Number(o.custom_multiplier); });
      return map;
    };

    const agentTier = profile.tier || 'tier_3';
    const agentOverrides = await getOverrides(agentTier);
    
    // Fetch Super Agent Profile if applicable
    let superAgentProfile = null;
    let superAgentOverrides: Record<string, number> = {};
    let superAgentBaselines: Record<string, { baseline_cost: number, bulk_baseline_cost: number | null, bulk_threshold: number }> = {};
    
    if (profile.parent_agent_id) {
      const { data: sap } = await serviceSupabase
        .from('profiles')
        .select('id, tier')
        .eq('id', profile.parent_agent_id)
        .single();
      superAgentProfile = sap;
      
      if (sap) {
        superAgentOverrides = await getOverrides(sap.tier || 'tier_3');
        const { data: sab } = await serviceSupabase
          .from('super_agent_pricing')
          .select('product_id, baseline_cost, bulk_baseline_cost, bulk_threshold')
          .eq('super_agent_id', sap.id);
        sab?.forEach(b => { 
          superAgentBaselines[b.product_id] = {
            baseline_cost: Number(b.baseline_cost),
            bulk_baseline_cost: b.bulk_baseline_cost !== null ? Number(b.bulk_baseline_cost) : null,
            bulk_threshold: b.bulk_threshold ?? 100
          };
        });
      }
    }

    let subtotal = 0;
    let totalWeightOz = 0;
    const computedItems = [];

    for (const cartItem of items) {
      const dbProduct = dbProducts.find(p => p.id === cartItem.id);
      if (!dbProduct) continue;

      // NOTE: base_cost and admin_bulk_price in the DB are per-10-vial-pack prices.
      // cartItem.quantity is individual VIALS (sourced from agent_inventory.stock_count
      // and order_items.quantity, both of which count vials). Divide all pack prices
      // by 10 to convert to per-vial before multiplying by vial quantity.
      const baseCost = Number(dbProduct.base_cost);
      let costPrice = 0;
      let superAgentCost = null;

      if (superAgentProfile) {
        // Sub-Agent — super agent owes admin their tier cost per vial
        const saMultiplier = superAgentOverrides[dbProduct.id] ?? tierMultipliers[superAgentProfile.tier || 'tier_3'] ?? 1.7;
        superAgentCost = baseCost * saMultiplier / 10; // per-vial

        if (dbProduct.admin_bulk_price !== null && cartItem.quantity >= (dbProduct.admin_bulk_threshold ?? 100)) {
          // admin_bulk_price is a per-pack price; divide by 10 for per-vial
          superAgentCost = Number(dbProduct.admin_bulk_price) / 10;
        }

        const saConfig = superAgentBaselines[dbProduct.id];
        if (saConfig) {
           if (saConfig.bulk_baseline_cost !== null && cartItem.quantity >= saConfig.bulk_threshold) {
               costPrice = saConfig.bulk_baseline_cost / 10; // super_agent_pricing stores pack cost
           } else {
               costPrice = saConfig.baseline_cost / 10; // same
           }
        } else {
           costPrice = superAgentCost;
        }
      } else {
        // Standard Agent — pay base_cost * tier_mult per vial
        const agentMultiplier = agentOverrides[dbProduct.id] ?? tierMultipliers[agentTier] ?? 1.7;
        costPrice = baseCost * agentMultiplier / 10; // per-vial

        if (dbProduct.admin_bulk_price !== null && cartItem.quantity >= (dbProduct.admin_bulk_threshold ?? 100)) {
          // admin_bulk_price is per-pack; divide by 10 for per-vial bulk cost
          costPrice = Number(dbProduct.admin_bulk_price) / 10;
        }
      }

      subtotal += costPrice * cartItem.quantity; // per-vial cost × vials
      totalWeightOz += (Number(dbProduct.weight_oz) || 0.5) * cartItem.quantity;

      computedItems.push({
        product_id: dbProduct.id,
        product_name: dbProduct.name,
        quantity: cartItem.quantity,         // # of individual vials
        unit_retail_price: costPrice,        // per-vial (agents pay cost price)
        unit_cost_price: costPrice,          // per-vial cost to PNL/super-agent
        unit_super_agent_cost: superAgentCost // per-vial cost the super-agent owes admin
      });
    }

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

    const total = subtotal + shippingCost;

    // Attribute the restock order to the agent making it so admin ledger /
    // statement queries that key off agent_id can identify and exclude these
    // rows via is_wholesale_restock instead of treating them as orphaned.
    const { data: order, error: orderError } = await serviceSupabase
      .from('orders')
      .insert({
        buyer_id: user.id,
        agent_id: user.id,
        is_wholesale_restock: true,
        status: 'pending_customer_payment',
        fulfillment_method: fulfillmentMethod,
        payment_method: paymentMethod,
        shipping_address: shippingAddress ?? null,
        shipping_cost: shippingCost,
        subtotal: subtotal,
        discount_amount: 0,
        coupon_code: null,
        total: total
      })
      .select('id')
      .single();

    if (orderError || !order) {
      console.error('Database Order Write Error:', orderError);
      return NextResponse.json({ error: 'Failed To Save Order Transaction.' }, { status: 500 });
    }

    // Insert order items
    const orderItemsToInsert = computedItems.map(item => ({
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
      .insert(orderItemsToInsert);

    if (itemsError) {
      console.error('Database Order Items Write Error:', itemsError);
      return NextResponse.json({ error: 'Failed To Save Order Items.' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      orderId: order.id,
      message: 'Wholesale restock order placed successfully.' 
    });

  } catch (error: any) {
    console.error('Checkout Error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred during checkout.' }, { status: 500 });
  }
}
