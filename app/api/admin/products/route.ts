import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';

export async function GET(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const supabase = await createServiceClient();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  // List mode: no `id` supplied — return the catalog summary used by the
  // tier-override editor and admin dashboards. Preserves the historical
  // detail-by-id behavior below when `id` IS present.
  if (!id) {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, slug, category, base_cost, is_active, is_banned')
      .eq('is_banned', false)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
    }

    return NextResponse.json({ data });
  }

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const supabase = await createServiceClient();
  const body = await req.json();

  const {
    name, sku, category, description, image_url, base_cost,
    unit_size, unit_measure, is_active,
    inventory_count, low_stock_threshold, backorder_days,
    admin_bulk_price, admin_bulk_threshold,
  } = body;

  const parsedBaseCost = Number(base_cost);
  if (!name || isNaN(parsedBaseCost) || parsedBaseCost <= 0) {
    return NextResponse.json({ error: 'Name And A Positive Base Cost Are Required' }, { status: 400 });
  }

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const { data, error } = await supabase
    .from('products')
    .insert({
      name,
      slug,
      sku: sku || null,
      category: category || 'Other',
      description: description || null,
      image_url: image_url || null,
      base_cost: parsedBaseCost,
      unit_size: unit_size || null,
      unit_measure: unit_measure || 'mg',
      // in_stock is managed by DB trigger (sync_product_stock_status) — derived from inventory_count
      inventory_count: inventory_count ?? 0,
      low_stock_threshold: low_stock_threshold ?? 5,
      backorder_days: backorder_days ?? 14,
      is_active: is_active ?? true,
      admin_bulk_price: admin_bulk_price ?? null,
      admin_bulk_threshold: admin_bulk_threshold ?? 100,
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const supabase = await createServiceClient();
  const body = await req.json();
  const { id, ...raw } = body;

  if (!id) {
    return NextResponse.json({ error: 'Product ID Required' }, { status: 400 });
  }

  // Whitelist only the fields admins are permitted to update.
  // Deliberately EXCLUDES slug (derived from name on create; editing it breaks
  // storefront URLs and can collide with the unique index) and is_banned
  // (banning is a separate deliberate action, never a generic field patch).
  const ALLOWED_FIELDS = [
    'name', 'sku', 'category', 'description', 'image_url',
    'base_cost', 'unit_size', 'unit_measure',
    'inventory_count', 'low_stock_threshold', 'backorder_days',
    'is_active', 'admin_bulk_price', 'admin_bulk_threshold'
  ] as const;

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const field of ALLOWED_FIELDS) {
    if (field in raw) {
      // Guard base_cost against zero or negative values — these would cascade
      // corrupt pricing to all agent_products via recalculate_agent_product_prices.
      if (field === 'base_cost') {
        const cost = Number(raw[field]);
        if (isNaN(cost) || cost <= 0) {
          return NextResponse.json({ error: 'base_cost Must Be A Positive Number' }, { status: 400 });
        }
      }
      updates[field] = raw[field];
    }
  }

  if (Object.keys(updates).length === 1) {
    // Only updated_at — nothing actually changed
    return NextResponse.json({ success: true });
  }

  const { error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }

  // If base_cost changed, cascade the new price to all agent_products for this product.
  // DB triggers handle this automatically, but we also call the RPC here as belt-and-suspenders
  // (e.g. if triggers are temporarily disabled during a bulk import).
  if ('base_cost' in raw) {
    try {
      await supabase.rpc('recalculate_agent_product_prices', { p_product_id: id });
    } catch { /* non-critical: triggers handle recomputation */ }
  }

  return NextResponse.json({ success: true });
}
