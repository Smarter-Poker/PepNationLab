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
  const FULFILLMENT_COLUMNS =
    'id, order_id, product_id, product_name, quantity, unit_retail_price, products(unit_size, unit_measure)';

  const { data: rawData, error } = await supabase
    .from('order_items')
    .select(isAdmin
      ? 'id, order_id, product_id, product_name, quantity, unit_retail_price, unit_cost_price, unit_super_agent_cost, lot_number, coa_url, created_at, products(unit_size, unit_measure)'
      : FULFILLMENT_COLUMNS
    )
    .eq('order_id', orderId);

  if (error) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }

  // Flatten the nested products join so unit_size/unit_measure appear at top level
  const data = (rawData ?? []).map((item: any) => {
    const { products, ...rest } = item;
    return {
      ...rest,
      unit_size: products?.unit_size ?? null,
      unit_measure: products?.unit_measure ?? null,
    };
  });

  return NextResponse.json({ data });
}
