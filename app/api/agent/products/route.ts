import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

import { requireAgent } from '@/lib/admin-auth';

export async function GET(req: NextRequest) {
  const gate = await requireAgent();
  if (!gate.ok) return gate.response;

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from('agent_products')
    .select(`
      id, agent_id, product_id, custom_name, custom_description, custom_image_url, retail_price, is_visible, is_on_sale, sale_price, sort_order,
      products (name, description, image_url, category, in_stock, inventory_count, unit_size, unit_measure)
    `)
    .eq('agent_id', gate.user.id)
    .order('sort_order', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

export async function PATCH(req: NextRequest) {
  const gate = await requireAgent();
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => ({}));
  const { id, custom_name, custom_description, custom_image_url, retail_price, is_visible, is_on_sale, sale_price } = body;

  if (!id) {
    return NextResponse.json({ error: 'Missing agent_product id' }, { status: 400 });
  }

  const supabase = await createServiceClient();

  // Ensure this agent_product belongs to this user
  const { data: check } = await supabase
    .from('agent_products')
    .select('id, retail_price')
    .eq('id', id)
    .eq('agent_id', gate.user.id)
    .single();

  if (!check) {
    return NextResponse.json({ error: 'Unauthorized or not found' }, { status: 403 });
  }

  const newRetailPrice = retail_price !== undefined ? Number(retail_price) : check.retail_price;

  const { error } = await supabase
    .from('agent_products')
    .update({
      custom_name: custom_name || null,
      custom_description: custom_description || null,
      custom_image_url: custom_image_url || null,
      retail_price: newRetailPrice,
      is_visible: is_visible ?? true,
      is_on_sale: is_on_sale ?? false,
      sale_price: sale_price ?? null,
      updated_at: new Date().toISOString()
    })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
