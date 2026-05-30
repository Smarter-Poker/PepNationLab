import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';

// GET: Most recent wholesale-restock orders (last 100)
export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from('orders')
    .select(
      '*, profiles!orders_buyer_id_fkey(full_name, username), order_items(id, quantity, product_name, unit_retail_price)'
    )
    .eq('is_wholesale_restock', true)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }

  return NextResponse.json({ data });
}
