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
    const { orderId } = await req.json();

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
      .select('display_name, shippo_api_key')
      .eq('id', agentId)
      .single();

    if (profileError || !agentProfile) {
      return NextResponse.json({ error: 'Agent profile not found' }, { status: 404 });
    }

    if (!agentProfile.shippo_api_key) {
      return NextResponse.json({ 
        error: 'Shippo API Key missing. Please add your Shippo API Token in the Storefront Config tab to generate shipping labels.' 
      }, { status: 400 });
    }

    // 2. Initialize Shippo
    const shippo = new Shippo({ apiKeyHeader: agentProfile.shippo_api_key });

    // Ensure valid shipping address fields
    const addr = order.shipping_address || {};
    const street = addr.street || addr.street1 || '123 Main St';
    const city = addr.city || 'Austin';
    const state = addr.state || 'TX';
    const zip = addr.zipCode || addr.zip || '78701';
    const country = addr.country || 'US';

    // 3. Create Shipment
    const shipmentRequest: any = {
      addressFrom: {
        name: agentProfile.display_name || 'Agent Warehouse',
        street1: '123 Agent Logistics Way', // Fallback origin address
        city: 'Austin',
        state: 'TX',
        zip: '78701',
        country: 'US',
        phone: '5555555555',
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
        length: '6',
        width: '4',
        height: '4',
        distanceUnit: 'in',
        weight: '4',
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

    // Pick the first available rate (Usually USPS Ground Advantage is cheapest/first)
    const rate = shipment.rates[0];

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
