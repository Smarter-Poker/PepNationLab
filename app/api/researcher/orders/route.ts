import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

/** GET: Researcher's own orders */
export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = await createServiceClient();
  const { data, error } = await service
    .from('orders')
    .select(`
      id, status, total, subtotal, shipping_cost, discount_amount, coupon_code,
      fulfillment_method, payment_method, tracking_number, shipping_address,
      created_at,
      order_items(id, product_name, quantity, unit_retail_price)
    `)
    .eq('buyer_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ orders: data });
}
