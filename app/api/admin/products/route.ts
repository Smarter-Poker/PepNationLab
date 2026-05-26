import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = await createServiceClient();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Product ID Required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const supabase = await createServiceClient();
  const body = await req.json();

  const {
    name, sku, category, description, base_cost,
    unit_size, unit_measure, is_active,
    inventory_count, low_stock_threshold, backorder_days,
  } = body;

  if (!name || !base_cost) {
    return NextResponse.json({ error: 'Name And Base Cost Are Required' }, { status: 400 });
  }

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const { data, error } = await supabase
    .from('products')
    .insert({
      name,
      slug,
      sku: sku || null,
      category: category || 'Peptides',
      description: description || null,
      base_cost,
      unit_size: unit_size || null,
      unit_measure: unit_measure || 'mg',
      // in_stock is managed by DB trigger (sync_product_stock_status) — derived from inventory_count
      inventory_count: inventory_count ?? 0,
      low_stock_threshold: low_stock_threshold ?? 5,
      backorder_days: backorder_days ?? 14,
      is_active: is_active ?? true,
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createServiceClient();
  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: 'Product ID Required' }, { status: 400 });
  }

  const { error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
