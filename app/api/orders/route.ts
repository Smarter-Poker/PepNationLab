import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { sendEmail, orderConfirmationEmail } from '@/lib/email';
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

    // Basic validation
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Invalid Cart Items.' }, { status: 400 });
    }
    if (!paymentMethod) {
      return NextResponse.json({ error: 'Payment Method Is Required.' }, { status: 400 });
    }
    if (fulfillmentMethod === 'ship' && !shippingAddress) {
      return NextResponse.json({ error: 'Shipping Address Is Required For Deliveries.' }, { status: 400 });
    }

    // Get user profile details
    const { data: profile, error: profileError } = await serviceSupabase
      .from('profiles')
      .select('id, tier, referring_agent_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Researcher Profile Not Found.' }, { status: 404 });
    }

    const userTier = profile.tier ?? 'tier_3';

    // Retrieve active product definitions matching requested cart item IDs
    const productIds = items.map((item: any) => item.id);
    const { data: dbProducts, error: dbProductsError } = await serviceSupabase
      .from('products')
      .select('id, name, base_cost, weight_oz, is_active, is_banned, sku')
      .in('id', productIds);

    if (dbProductsError || !dbProducts || dbProducts.length === 0) {
      return NextResponse.json({ error: 'Failed To Retrieve Product Data.' }, { status: 400 });
    }

    // Check for banned or deactivated products
    const bannedProduct = dbProducts.find(p => p.is_banned || !p.is_active);
    if (bannedProduct) {
      return NextResponse.json({ error: `Product "${bannedProduct.name}" Is Unavailable For Sale.` }, { status: 400 });
    }

    // Fetch pricing tier multipliers
    const { data: tiers, error: tiersError } = await serviceSupabase
      .from('pricing_tiers')
      .select('tier_name, multiplier');

    if (tiersError || !tiers) {
      return NextResponse.json({ error: 'Failed To Retrieve Pricing Configuration.' }, { status: 500 });
    }

    const tierMultipliers: Record<string, number> = {};
    tiers.forEach(t => {
      tierMultipliers[t.tier_name] = Number(t.multiplier);
    });

    // Fetch user product overrides
    const { data: overrides } = await serviceSupabase
      .from('product_tier_overrides')
      .select('product_id, custom_multiplier')
      .eq('tier_name', userTier);

    const overrideMultipliers: Record<string, number> = {};
    overrides?.forEach(o => {
      overrideMultipliers[o.product_id] = Number(o.custom_multiplier);
    });

    // Cost calculations
    let subtotal = 0;
    let totalWeightOz = 0;
    const computedItems = [];

    for (const cartItem of items) {
      const dbProduct = dbProducts.find(p => p.id === cartItem.id);
      if (!dbProduct) {
        return NextResponse.json({ error: 'A Product In Your Cart Was Not Found.' }, { status: 400 });
      }

      const cost = Number(dbProduct.base_cost);
      
      // Calculate unit cost paid by user
      const multiplier = overrideMultipliers[dbProduct.id] ?? tierMultipliers[userTier] ?? 7.0;
      const costPrice = cost * multiplier;

      // Calculate standard retail price (Tier 3)
      const retailMultiplier = tierMultipliers['tier_3'] ?? 7.0;
      const retailPrice = cost * retailMultiplier;

      const itemQty = Number(cartItem.quantity) || 1;

      subtotal += costPrice * itemQty;
      totalWeightOz += (Number(dbProduct.weight_oz) || 0.5) * itemQty;

      computedItems.push({
        product_id: dbProduct.id,
        product_name: dbProduct.name,
        quantity: itemQty,
        unit_retail_price: retailPrice,
        unit_cost_price: costPrice
      });
    }

    // Validate and apply a coupon code, if one was supplied. Order
    // creation re-validates so a stale or invalid code is rejected here.
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

    // Calculate shipping costs based on weights
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
        // Fallback standard rate
        shippingCost = 12.00;
      }
    }

    const total = Math.max(0, subtotal - discountAmount) + shippingCost;

    // Create checkout order record in orders
    const { data: order, error: orderError } = await serviceSupabase
      .from('orders')
      .insert({
        buyer_id: user.id,
        agent_id: profile.referring_agent_id ?? null,
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
      unit_cost_price: item.unit_cost_price
    }));

    const { error: itemsError } = await serviceSupabase
      .from('order_items')
      .insert(itemsToInsert);

    if (itemsError) {
      console.error('Database Order Items Write Error:', itemsError);
      // Clean up orphaned main order row
      await serviceSupabase.from('orders').delete().eq('id', order.id);
      return NextResponse.json({ error: 'Failed To Save Checkout Order Line Items.' }, { status: 500 });
    }

    // Increment coupon usage now that the order is committed.
    if (appliedCouponCode && profile.referring_agent_id) {
      try {
        const { data: couponRow } = await serviceSupabase
          .from('coupons')
          .select('id, uses_count')
          .eq('agent_id', profile.referring_agent_id)
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

    // Log disclaimer acceptance for final checkout compliance logs
    await serviceSupabase.from('disclaimer_acceptances').insert({
      user_id: user.id,
      disclaimer_version: process.env.NEXT_PUBLIC_DISCLAIMER_VERSION ?? 'v1.0',
      layer: 'checkout',
      user_agent: request.headers.get('user-agent') || 'Unknown',
      ip_address: request.headers.get('x-forwarded-for') || '127.0.0.1'
    });

    // Send order confirmation email. Failure must not break the order,
    // which is already committed at this point.
    if (user.email) {
      try {
        const tpl = orderConfirmationEmail({
          orderId: order.id,
          items: computedItems.map(i => ({
            product_name: i.product_name,
            quantity: i.quantity,
            unit_cost_price: i.unit_cost_price,
          })),
          subtotal,
          discount: discountAmount,
          shippingCost,
          total,
          paymentMethod,
        });
        await sendEmail({ to: user.email, subject: tpl.subject, html: tpl.html });
      } catch (emailError) {
        console.error('Order Confirmation Email Failed:', emailError);
      }
    }

    return NextResponse.json({ success: true, orderId: order.id });

  } catch (error) {
    console.error('Order API Route Caught Exception:', error);
    return NextResponse.json({ error: 'Internal Server Error Occurred.' }, { status: 500 });
  }
}
