import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireOrdersAccess } from '@/lib/admin-auth';

export async function GET(req: NextRequest) {
  const gate = await requireOrdersAccess();
  if (!gate.ok) return gate.response;

  const supabase = await createServiceClient();
  const orderId = req.nextUrl.searchParams.get('orderId');

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!orderId || !UUID_RE.test(orderId)) {
    return NextResponse.json({ error: 'Missing Or Invalid Order ID Parameter' }, { status: 400 });
  }

  // The shipping role is fulfillment-only and must never see internal cost
  // basis. order_items carries unit_cost_price and unit_super_agent_cost (COGS
  // and super-agent margin); select an explicit column set that excludes those
  // for non-admins, and only widen to include cost cols for a true admin.
  const isAdmin = gate.isAdmin === true;
  const FULFILLMENT_COLUMNS = 'id, order_id, product_id, product_name, quantity, unit_retail_price';
  const ADMIN_COLUMNS = 'id, order_id, product_id, product_name, quantity, unit_retail_price, unit_cost_price, unit_super_agent_cost, unit_house_cost, lot_number, coa_url, created_at';

  const { data: items, error } = await supabase
    .from('order_items')
    .select(isAdmin ? ADMIN_COLUMNS : FULFILLMENT_COLUMNS)
    .eq('order_id', orderId);

  if (error) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }

  if (!items || items.length === 0) {
    return NextResponse.json({ data: [] });
  }

  // Collect unique product_ids so we can fetch unit_size + unit_measure
  const productIds = [...new Set(items.map((i: any) => i.product_id).filter(Boolean))];

  let sizeMap: Record<string, { unit_size: string | null; unit_measure: string | null; true_house_cost: number | null }> = {};

  if (productIds.length > 0) {
    const { data: products } = await supabase
      .from('products')
      .select('id, unit_size, unit_measure, house_cost')
      .in('id', productIds);

    if (products) {
      for (const p of products) {
        sizeMap[p.id] = { unit_size: p.unit_size ?? null, unit_measure: p.unit_measure ?? null, true_house_cost: p.house_cost ?? null };
      }
    }
  }

  // Merge size and cost info onto each item
  const data = items.map((item: any) => ({
    ...item,
    unit_size: sizeMap[item.product_id]?.unit_size ?? null,
    unit_measure: sizeMap[item.product_id]?.unit_measure ?? null,
    true_house_cost: sizeMap[item.product_id]?.true_house_cost ?? null,
  }));

  return NextResponse.json({ data });
}
