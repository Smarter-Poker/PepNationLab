export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('products')
    .select('id, name, slug, category, base_cost, weight_oz, inventory_count, sku')
    .eq('is_active', true)
    .eq('is_banned', false)
    .order('category')
    .order('name');

  if (error) {
    return NextResponse.json({ error: 'Failed To Load Products' }, { status: 500 });
  }

  const products = (data ?? []).map(p => ({
    ...p,
    admin_price: Math.round(Number(p.base_cost) * 5 * 100) / 100,
  }));

  return NextResponse.json({ products });
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const supabase = createAdminClient();
  const body = await req.json().catch(() => ({}));
  const { items, payment_method = 'zelle', shipping_address } = body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'No Items In Order' }, { status: 400 });
  }

  const validPaymentMethods = ['zelle', 'cashapp', 'venmo', 'apple_pay'];
  if (!validPaymentMethods.includes(payment_method)) {
    return NextResponse.json({ error: 'Invalid Payment Method' }, { status: 400 });
  }

  const productIds = items.map((i: any) => String(i.product_id)).filter(Boolean);

  const { data: products, error: prodError } = await supabase
    .from('products')
    .select('id, name, base_cost')
    .in('id', productIds)
    .eq('is_active', true)
    .eq('is_banned', false);

  if (prodError || !products) {
    return NextResponse.json({ error: 'Failed To Load Products' }, { status: 500 });
  }

  const prodMap = new Map(products.map(p => [p.id, p]));
  const orderLines: any[] = [];
  let subtotal = 0;

  for (const item of items) {
    const prod = prodMap.get(String(item.product_id));
    if (!prod) {
      return NextResponse.json({ error: `Product Not Found: ${item.product_id}` }, { status: 400 });
    }
    const qty = Math.max(1, parseInt(String(item.quantity)) || 1);
    const unitPrice = Math.round(Number(prod.base_cost) * 5 * 100) / 100;
    subtotal += unitPrice * qty;
    orderLines.push({ product_id: prod.id, product_name: prod.name, quantity: qty, unit_retail_price: unitPrice, unit_cost_price: Number(prod.base_cost), unit_super_agent_cost: Number(prod.base_cost) });
  }

  subtotal = Math.round(subtotal * 100) / 100;

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({ buyer_id: gate.userId, agent_id: gate.userId, status: 'approved_ship', payment_method, fulfillment_method: shipping_address ? 'ship' : 'pickup', shipping_address: shipping_address || null, shipping_cost: 0, subtotal, discount_amount: 0, total: subtotal, is_wholesale_restock: true, buyer_name: 'Admin Direct Purchase', buyer_email: null, idempotency_key: crypto.randomUUID() })
    .select('id')
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: 'Failed To Create Order' }, { status: 500 });
  }

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(orderLines.map(l => ({ ...l, order_id: order.id })));

  if (itemsError) {
    await supabase.from('orders').delete().eq('id', order.id);
    return NextResponse.json({ error: 'Failed To Save Order Items' }, { status: 500 });
  }

  return NextResponse.json({ success: true, orderId: order.id });
}
