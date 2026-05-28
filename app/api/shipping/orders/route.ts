import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || (profile.role !== 'shipping' && profile.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Use service client to bypass RLS since we have manually verified the user's role
  const serviceClient = await createServiceClient();

  // Fetch orders that need shipping + recently shipped
  const { data: orders, error } = await serviceClient
    .from('orders')
    .select(`
      id,
      buyer_id,
      agent_id,
      status,
      total,
      fulfillment_method,
      shipping_address,
      tracking_number,
      created_at,
      updated_at,
      buyer:profiles!orders_buyer_id_fkey(email, full_name, phone),
      agent:profiles!orders_agent_id_fkey(email, full_name),
      items:order_items(id, product_name, quantity, unit_retail_price)
    `)
    .in('status', ['approved_ship', 'in_fulfillment', 'shipped'])
    .eq('fulfillment_method', 'ship')
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: orders });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || (profile.role !== 'shipping' && profile.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { order_id, tracking_number, action } = await request.json();

  if (!order_id || !action) {
    return NextResponse.json({ error: 'Missing order_id or action' }, { status: 400 });
  }

  let updateData: any = {};
  
  if (action === 'mark_shipped') {
    if (!tracking_number) {
      return NextResponse.json({ error: 'Tracking number is required to mark as shipped' }, { status: 400 });
    }
    updateData = {
      status: 'shipped',
      tracking_number: tracking_number
    };
  } else if (action === 'save_tracking') {
    updateData = {
      tracking_number: tracking_number || null,
      status: 'in_fulfillment' // Move from approved_ship to in_fulfillment once tracking is assigned
    };
  } else {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  // Use service client to bypass RLS since we have manually verified the user's role
  const serviceClient = await createServiceClient();

  const { data, error } = await serviceClient
    .from('orders')
    .update(updateData)
    .eq('id', order_id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data, message: 'Order updated successfully' });
}
