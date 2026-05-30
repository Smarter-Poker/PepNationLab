import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import type { AgentTier } from '@/lib/pricing';

export async function GET(req: NextRequest) {
  const gate = await requireAgent();
  if (!gate.ok) return gate.response;

  const supabase = await createServiceClient();
  const agentId = gate.user.id;

  // ── Resolve agent tier ─────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('tier')
    .eq('id', agentId)
    .single();

  const tier = ((profile?.tier as AgentTier | null) ?? 'tier_3') as AgentTier;

  // ── Fetch global tier multiplier ───────────────────────────────────────────
  const { data: tierRow } = await supabase
    .from('pricing_tiers')
    .select('multiplier')
    .eq('tier_name', tier)
    .maybeSingle();
  const globalMultiplier = tierRow?.multiplier != null ? Number(tierRow.multiplier) : 1.7;

  // ── Fetch agent products (with base_cost from products table) ─────────────
  const { data, error } = await supabase
    .from('agent_products')
    .select(`
      id, agent_id, product_id, custom_name, custom_description,
      custom_image_url, retail_price, is_visible, is_on_sale, sale_price, sort_order,
      products (name, description, image_url, category, in_stock, inventory_count,
               unit_size, unit_measure, base_cost)
    `)
    .eq('agent_id', agentId)
    .order('sort_order', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // ── Batch fetch per-product tier overrides (single query) ──────────────────
  const productIds = (data ?? []).map(ap => ap.product_id).filter(Boolean) as string[];
  const overrideMap: Record<string, number> = {};
  if (productIds.length > 0) {
    const { data: overrides } = await supabase
      .from('product_tier_overrides')
      .select('product_id, custom_multiplier')
      .in('product_id', productIds)
      .eq('tier_name', tier);
    overrides?.forEach(o => {
      overrideMap[o.product_id as string] = Number(o.custom_multiplier);
    });
  }

  // ── Augment each product with agent_cost ────────────────────────────────────────────────────
  // agent_cost = base_cost × effective_multiplier (per-product override wins
  // over global tier multiplier). This is what the agent pays PNL per 10 vials.
  const augmented = (data ?? []).map(ap => {
    const baseCost = (ap.products as any)?.base_cost != null
      ? Number((ap.products as any).base_cost)
      : 0;
    const effectiveMultiplier = overrideMap[ap.product_id as string] ?? globalMultiplier;
    const agentCost = Math.round(baseCost * effectiveMultiplier * 100) / 100;
    return {
      ...ap,
      agent_cost: baseCost > 0 ? agentCost : null,
      agent_tier: tier,
      // Diagnostic fields — surfaced in catalog UI to help spot wrong base_cost or overrides
      base_cost_raw: baseCost > 0 ? baseCost : null,
      effective_multiplier: effectiveMultiplier,
    };
  });

  return NextResponse.json({ data: augmented });
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
