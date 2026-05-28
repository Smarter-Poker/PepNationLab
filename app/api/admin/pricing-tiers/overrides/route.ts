import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';

// GET all overrides
export async function GET(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const supabase = await createServiceClient();

  const { data, error } = await supabase
    .from('product_tier_overrides')
    .select('id, product_id, tier_name, custom_multiplier, products(name)');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Flatten the products mapping for easier UI consumption
  const formattedData = data.map(o => ({
    id: o.id,
    product_id: o.product_id,
    product_name: (o.products as any)?.name || (Array.isArray(o.products) ? (o.products[0] as any)?.name : 'Unknown'),
    tier_name: o.tier_name,
    custom_multiplier: o.custom_multiplier
  }));

  return NextResponse.json(formattedData);
}

// POST: Create or Update an override
export async function POST(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const supabase = await createServiceClient();
  const body = await req.json();

  const { product_id, tier_name, custom_multiplier } = body;

  if (!product_id || !tier_name || typeof custom_multiplier !== 'number') {
    return NextResponse.json({ error: 'Missing Required Fields' }, { status: 400 });
  }

  // Upsert the override
  const { error } = await supabase
    .from('product_tier_overrides')
    .upsert(
      {
        product_id,
        tier_name,
        custom_multiplier
      },
      { onConflict: 'product_id,tier_name' }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// DELETE an override
export async function DELETE(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const supabase = await createServiceClient();
  const body = await req.json();
  const { product_id, tier_name } = body;

  if (!product_id || !tier_name) {
    return NextResponse.json({ error: 'Missing Required Fields' }, { status: 400 });
  }

  const { error } = await supabase
    .from('product_tier_overrides')
    .delete()
    .eq('product_id', product_id)
    .eq('tier_name', tier_name);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
