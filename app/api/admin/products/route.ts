import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';

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
    if (typeof name !== 'string' || name.length > 200) return NextResponse.json({ error: 'Product Name Too Long (Max 200)' }, { status: 400 });
    if (sku && (typeof sku !== 'string' || sku.length > 100)) return NextResponse.json({ error: 'SKU Too Long (Max 100)' }, { status: 400 });
    if (description && (typeof description !== 'string' || description.length > 5000)) return NextResponse.json({ error: 'Description Too Long (Max 5,000)' }, { status: 400 });
    if (image_url && (typeof image_url !== 'string' || image_url.length > 500)) return NextResponse.json({ error: 'Image URL Too Long (Max 500)' }, { status: 400 });
    if (category && (typeof category !== 'string' || category.length > 80)) return NextResponse.json({ error: 'Category Too Long (Max 80)' }, { status: 400 });
    if (unit_size && (typeof unit_size !== 'string' || unit_size.length > 50)) return NextResponse.json({ error: 'Unit Size Too Long (Max 50)' }, { status: 400 });

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
    const body = await req.json();
    const { id, ...raw } = body;

    if (!id) {
      return NextResponse.json({ error: 'Product ID Required' }, { status: 400 });
    }

    const ALLOWED_FIELDS = [
      'name', 'sku', 'category', 'description', 'image_url',
      'base_cost', 'unit_size', 'unit_measure',
      'inventory_count', 'low_stock_threshold', 'backorder_days',
      'is_active', 'admin_bulk_price', 'admin_bulk_threshold'
    ] as const;

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const field of ALLOWED_FIELDS) {
      if (field in raw) {
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

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[admin/products] PATCH error:', err);
    return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
  }
}
