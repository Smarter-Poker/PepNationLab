import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = await createServiceClient();
  const body = await req.json();

  const { name, sku, category, description, base_cost, unit_size, unit_measure, in_stock, is_active } = body;

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
      in_stock: in_stock ?? true,
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
