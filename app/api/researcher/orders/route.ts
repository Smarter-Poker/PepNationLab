import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

// Authed money/PII route: order history includes shipping addresses and
// payment details. Must never be cached by the browser, CDN, or any shared
// proxy - on success or error alike.
export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'private, no-store' } as const;

/** GET: Researcher's own orders */
export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });

  const service = await createServiceClient();
  const { data, error } = await service
    .from('orders')
    .select(`
      id, status, total, subtotal, shipping_cost, discount_amount, coupon_code,
      fulfillment_method, payment_method, tracking_number, shipping_address,
      created_at,
      order_items(id, product_id, product_name, quantity, unit_retail_price)
    `)
    .eq('buyer_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500, headers: NO_STORE });
  return NextResponse.json({ orders: data }, { headers: NO_STORE });
}
