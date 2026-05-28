import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { pickOne } from '@/lib/relations';
import { Shippo } from 'shippo';

export async function POST(req: NextRequest) {
  try {
    const gate = await requireAgent();
    if (!gate.ok) return gate.response;

    const supabase = await createServiceClient();
    const agentId = gate.user.id;
    const body = await req.json().catch(() => ({}));
    const { orderId, preferredServiceLevel } = body || {};

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID required' }, { status: 400 });
    }

    // 1. Fetch Order and Agent Profile
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, profiles!orders_agent_id_fkey(parent_agent_id)')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const orderAgentProfile = pickOne<{ parent_agent_id: string | null }>(order.profiles);
    if (order.agent_id !== agentId && orderAgentProfile?.parent_agent_id !== agentId) {
      return NextResponse.json({ error: 'Unauthorized to ship this order' }, { status: 403 });
    }

    const { data: agentProfile, error: profileError } = await supabase
      .from('agent_profiles')
      .select('display_name, shippo_api_key, warehouse_address')
      .eq('id', agentId)
      .single();

    if (profileError || !agentProfile) {
      return NextResponse.json({ error: 'Agent profile not found' }, { status: 404 });
    }

    if (!agentProfile.shippo_api_key) {
      return NextResponse.json({
        error: 'Shippo API Key Missing. Please Add Your Shippo API Token In The Storefront Config Tab To Generate Shipping Labels.'
      }, { status: 400 });
    }

    // Warehouse address required — no fallbacks allowed (audit 2.2).
    const wh = (agentProfile.warehouse_address || {}) as Record<string, any>;
    if (!wh.street1 || !wh.city || !wh.state || !wh.zip) {
      return NextResponse.json(
        { error: 'Warehouse Address Not Configured. Please Set It In Storefront Config.' },
        { status: 422 }
      );
    }

    // 2. Initialize Shippo
    const shippo = new Shippo({ apiKeyHeader: agentProfile.shippo_api_key });

    // Ensure valid shipping address fields
    const addr = order.shipping_address || {};
    const street = addr.street || addr.street1 || '';
    const city = addr.city || '';
    const state = addr.state || '';
    const zip = addr.zipCode || addr.zip || '';
    const country = addr.country || 'US';

    if (!street || !city || !state || !zip) {
      return NextResponse.json(
        { error: 'Customer Shipping Address Is Incomplete.' },
        { status: 422 }
      );
    }

    // Compute parcel weight from order line items.
    const { data: items } = await supabase
      .from('order_items')
      .select('quantity, product_id, products(weight_oz)')
      .eq('order_id', orderId);

    let totalWeightOz = 0;
    let totalQty = 0;
    for (const it of (items || []) as any[]) {
      const qty = Number(it.quantity) || 0;
      const prod = Array.isArray(it.products) ? it.products[0] : it.products;
      const w = Number(prod?.weight_oz) || 0.5;
      totalWeightOz += qty * w;
      totalQty += qty;
    }
    // Floor parcel weight at 1 oz so Shippo always accepts it.
    const parcelWeight = Math.max(1, Math.ceil(totalWeightOz)).toString();

    // Parcel preset based on item count.
    let parcelDims: { length: string; width: string; height: string };
    if (totalQty <= 3) {
      parcelDims = { length: '6', width: '4', height: '4' };
    } else if (totalQty <= 10) {
      parcelDims = { length: '9', width: '6', height: '3' };
    } else {
      parcelDims = { length: '12', width: '9', height: '4' };
    }

    // 3. Create Shipment
    const shipmentRequest: any = {
      addressFrom: {
        name: wh.name || agentProfile.display_name || 'Agent Warehouse',
        street1: wh.street1,
        street2: wh.street2 || undefined,
        city: wh.city,
        state: wh.state,
        zip: wh.zip,
        country: 'US',
        email: 'noreply@pepnationlab.com'
      },
      addressTo: {
        name: order.buyer_name || 'Valued Customer',
        street1: street,
        city: city,
        state: state,
        zip: zip,
        country: country,
        email: order.buyer_email || 'noreply@pepnationlab.com'
      },
      parcels: [{
        length: parcelDims.length,
        width: parcelDims.width,
        height: parcelDims.height,
        distanceUnit: 'in',
        weight: parcelWeight,
        massUnit: 'oz'
      }],
      async: false
    };

    let shipment;
    try {
      shipment = await shippo.shipments.create(shipmentRequest);
    } catch (err: any) {
      console.error("Shippo Shipment Error:", err);
      return NextResponse.json({ error: `Shippo Error: Failed to generate shipment. ${err.message || ''}` }, { status: 400 });
    }

    if (!shipment.rates || shipment.rates.length === 0) {
      return NextResponse.json({ error: 'No shipping rates returned from Shippo. Verify the customer address.' }, { status: 400 });
    }

    // Pick the cheapest rate. If a preferred service level was sent, filter
    // first and fall back to cheapest if no match.
    const ratesSorted = [...shipment.rates].sort(
      (a: any, b: any) => parseFloat(a.amount) - parseFloat(b.amount)
    );
    let rate: any = ratesSorted[0];
    if (preferredServiceLevel) {
      const preferred = ratesSorted.find(
        (r: any) => r?.servicelevel?.token === preferredServiceLevel
      );
      if (preferred) rate = preferred;
    }

    // 4. Purchase Label (Transaction)
    let transaction;
    try {
      transaction = await shippo.transactions.create({
        rate: rate.objectId,
        labelFileType: 'PDF',
        async: false
      });
    } catch (err: any) {
      console.error("Shippo Transaction Error:", err);
      return NextResponse.json({ error: `Shippo Error: Failed to purchase label. ${err.message || ''}` }, { status: 400 });
    }

    if (transaction.status === 'ERROR' || !transaction.labelUrl) {
      const msgs = transaction.messages?.map((m: any) => m.text).join('; ') || 'Unknown Error';
      return NextResponse.json({ error: `Shippo Transaction Failed: ${msgs}` }, { status: 400 });
    }

    const trackingNumber = transaction.trackingNumber;
    const labelUrl = transaction.labelUrl;

    // 5. Update Order with Tracking Number & Label URL
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        tracking_number: trackingNumber,
        label_url: labelUrl,
        status: 'shipped', // Auto-shift to shipped
        agent_approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (updateError) {
      console.error("Order Update Error:", updateError);
      return NextResponse.json({ error: 'Failed to save tracking information to order' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      trackingNumber, 
      labelUrl 
    });

  } catch (error) {
    console.error('Agent Shipping Purchase API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
