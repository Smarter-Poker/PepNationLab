import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';

// Backs components/ProductTierOverrides.tsx (rendered on /admin/pricing).
// Manages per-product custom tier multipliers in product_tier_overrides
// (id, product_id, tier_name enum tier_1|tier_2|tier_3, custom_multiplier).
// Unique (product_id, tier_name) lets POST upsert cleanly.

const VALID_TIERS = new Set(['tier_1', 'tier_2', 'tier_3']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET: list overrides joined with product name. Returns a flat array (the
// client maps directly over the response).
export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from('product_tier_overrides')
    .select('id, product_id, tier_name, custom_multiplier, products(name)')
    .order('tier_name', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }

  const rows = (data ?? []).map((r: any) => ({
    id: r.id,
    product_id: r.product_id,
    product_name: r.products?.name ?? 'Unknown Product',
    tier_name: r.tier_name,
    custom_multiplier: r.custom_multiplier,
  }));

  return NextResponse.json(rows);
}

// POST: create or update a product/tier override.
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const supabase = await createServiceClient();
  const body = await req.json().catch(() => ({}));
  const { product_id, tier_name, custom_multiplier } = body;

  if (!product_id || !UUID_RE.test(product_id)) {
    return NextResponse.json({ error: 'Valid Product Is Required' }, { status: 400 });
  }
  if (!tier_name || !VALID_TIERS.has(tier_name)) {
    return NextResponse.json({ error: 'Tier Must Be Tier 1, Tier 2, Or Tier 3' }, { status: 400 });
  }
  const mult = Number(custom_multiplier);
  if (!Number.isFinite(mult) || mult < 1.0 || mult > 99.99) {
    return NextResponse.json({ error: 'Multiplier Must Be A Number Between 1.0 And 99.99' }, { status: 400 });
  }

  // Confirm the product exists before writing the override.
  const { data: product } = await supabase
    .from('products')
    .select('id')
    .eq('id', product_id)
    .maybeSingle();
  if (!product) {
    return NextResponse.json({ error: 'Product Not Found' }, { status: 404 });
  }

  const { data: saved, error } = await supabase
    .from('product_tier_overrides')
    .upsert(
      { product_id, tier_name, custom_multiplier: mult },
      { onConflict: 'product_id,tier_name' },
    )
    .select('id')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }

  if (!saved) {
    return NextResponse.json({ error: 'Override Was Saved But ID Could Not Be Retrieved' }, { status: 500 });
  }

  await supabase.from('admin_audit_log').insert({
    actor_id: gate.userId,
    action: 'product_tier_override_set',
    entity_type: 'product_tier_override',
    entity_id: saved.id,
    changes: { product_id, tier_name, custom_multiplier: mult },
  });

  return NextResponse.json({ success: true, id: saved.id });
}

// DELETE: remove a product/tier override.
export async function DELETE(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const supabase = await createServiceClient();
  const body = await req.json().catch(() => ({}));
  const { product_id, tier_name } = body;

  if (!product_id || !UUID_RE.test(product_id)) {
    return NextResponse.json({ error: 'Valid Product Is Required' }, { status: 400 });
  }
  if (!tier_name || !VALID_TIERS.has(tier_name)) {
    return NextResponse.json({ error: 'Valid Tier Is Required' }, { status: 400 });
  }

  const { error } = await supabase
    .from('product_tier_overrides')
    .delete()
    .eq('product_id', product_id)
    .eq('tier_name', tier_name);

  if (error) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }

  await supabase.from('admin_audit_log').insert({
    actor_id: gate.userId,
    action: 'product_tier_override_removed',
    entity_type: 'product_tier_override',
    entity_id: product_id,
    changes: { product_id, tier_name },
  });

  return NextResponse.json({ success: true });
}
