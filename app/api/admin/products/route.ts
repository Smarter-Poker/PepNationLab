
import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { AdminProductCreateSchema, AdminProductPatchSchema } from '@/lib/schemas/product';
import { parseJsonBody } from '@/lib/schemas/http';

export async function GET(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (id && !UUID_REGEX.test(id)) {
      return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 });
    }

    if (!id) {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, slug, category, base_cost, is_active, is_banned')
        .eq('is_banned', false)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) {
        return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
      }

      return NextResponse.json({ data });
    }

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Product Not Found' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('[admin/products] GET error:', err);
    return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  try {
    const supabase = createAdminClient();

    // Schema-locked body: every money and inventory field
    // (base_cost, admin_bulk_price, admin_bulk_threshold, inventory_count,
    // low_stock_threshold, backorder_days) is type- and range-validated.
    // These feed ALL downstream tier pricing, so no raw client value may
    // reach the products table.
    const parsed = await parseJsonBody(req, AdminProductCreateSchema, 'Invalid Product Data.');
    if (!parsed.ok) return parsed.response;
    const {
      name, sku, category, description, image_url, base_cost,
      unit_size, unit_measure, is_active,
      inventory_count, low_stock_threshold, backorder_days,
      admin_bulk_price, admin_bulk_threshold,
    } = parsed.data;
    const parsedBaseCost = base_cost;

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const { data, error } = await supabase
      .from('products')
      //  Database schema mismatch from generated types
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
        inventory_count: inventory_count ?? 0,
        low_stock_threshold: low_stock_threshold ?? 5,
        backorder_days: backorder_days ?? 14,
        is_active: is_active ?? true,
        admin_bulk_price: admin_bulk_price ?? null,
        admin_bulk_threshold: admin_bulk_threshold ?? 100,
      })
      .select('id')
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Product Was Created But ID Could Not Be Retrieved' }, { status: 500 });
    }

    // New master product - purge every storefront catalog so any auto-created
    // agent_products rows (and the house store) surface it immediately.
    try {
      revalidateTag('storefront-catalog', { expire: 0 });
    } catch { /* best-effort cache refresh */ }

    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (err) {
    console.error('[admin/products] POST error:', err);
    return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  try {
    const supabase = createAdminClient();

    // Schema-locked partial update: previously only base_cost had a numeric
    // check and every other field (admin_bulk_price, inventory_count,
    // low_stock_threshold, backorder_days...) was copied raw into the
    // products table. Now every present field is type- and range-validated.
    const parsed = await parseJsonBody(req, AdminProductPatchSchema, 'Invalid Product Data.');
    if (!parsed.ok) return parsed.response;
    const { id, ...raw } = parsed.data;

    const ALLOWED_FIELDS = [
      'name', 'sku', 'category', 'description', 'image_url',
      'base_cost', 'unit_size', 'unit_measure',
      'inventory_count', 'low_stock_threshold', 'backorder_days',
      'is_active', 'admin_bulk_price', 'admin_bulk_threshold'
    ] as const;

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const field of ALLOWED_FIELDS) {
      if (field in raw && raw[field] !== undefined) {
        updates[field] = raw[field];
      }
    }

    if (Object.keys(updates).length === 1) {
      return NextResponse.json({ success: true });
    }

    const { error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
    }

    if ('base_cost' in raw) {
      try {
        await supabase.rpc('recalculate_agent_product_prices', { p_product_id: id });
      } catch { /* non-critical: triggers handle recomputation */ }
    }

    // Master product fields (name, image, category, base_cost-driven retail
    // recompute, is_active, backorder_days) all feed the public storefront
    // catalog - purge every store's cached copy.
    try {
      revalidateTag('storefront-catalog', { expire: 0 });
    } catch { /* best-effort cache refresh */ }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[admin/products] PATCH error:', err);
    return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
  }
}
