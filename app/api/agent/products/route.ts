import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
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
      custom_image_url, retail_price, margin_percent, is_visible, is_on_sale, sale_price, sort_order,
      products (name, description, image_url, category, in_stock, inventory_count,
               unit_size, unit_measure, base_cost)
    `)
    .eq('agent_id', agentId)
    .order('sort_order', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
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
  // IMPORTANT: base_cost_raw and effective_multiplier are computed internally but
  // must NOT be returned to the agent — they expose the wholesale cost. Only
  // the computed agent_cost (what they pay) is returned.
  const augmented = (data ?? []).map(ap => {
    const baseCost = (ap.products as any)?.base_cost != null
      ? Number((ap.products as any).base_cost)
      : 0;
    const effectiveMultiplier = overrideMap[ap.product_id as string] ?? globalMultiplier;
    const agentCost = Math.round(baseCost * effectiveMultiplier * 100) / 100;

    // Strip base_cost from the nested products object before sending to client.
    const { base_cost: _stripped, ...safeProducts } = (ap.products as any) ?? {};
    void _stripped; // suppress unused-var lint

    return {
      ...ap,
      products: safeProducts,
      agent_cost: baseCost > 0 ? agentCost : null,
      agent_tier: tier,
      // base_cost_raw and effective_multiplier intentionally omitted — cost leak.
    };
  });

  return NextResponse.json({ data: augmented });
}

export async function PATCH(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAgent();
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => ({}));
  const {
    id,
    custom_name,
    custom_description,
    custom_image_url,
    retail_price,
    margin_percent,
    is_visible,
    is_on_sale,
    sale_price,
  } = body;

  if (!id) {
    return NextResponse.json({ error: 'Missing agent_product id' }, { status: 400 });
  }

  const supabase = await createServiceClient();

  // Ensure this agent_product belongs to this user
  const { data: check } = await supabase
    .from('agent_products')
    .select('id, retail_price, margin_percent, product_id, agent_id, sale_price, is_on_sale')
    .eq('id', id)
    .eq('agent_id', gate.user.id)
    .single();

  if (!check) {
    return NextResponse.json({ error: 'Unauthorized or not found' }, { status: 403 });
  }

  // ── Compute agent cost for server-side floor enforcement ──────────────────
  // Hard rule: agents can NEVER list for less than their wholesale cost.
  // We compute it here even though the client enforces it too — a bypassed
  // client-side check must not allow below-cost listings to reach the DB.
  // Per-product tier overrides take priority over the global tier multiplier,
  // matching the same effective-multiplier logic used in the GET handler.
  let agentCostPer10 = 0;
  {
    const { data: prodData } = await supabase
      .from('products')
      .select('base_cost')
      .eq('id', check.product_id)
      .single();
    const { data: profData } = await supabase
      .from('profiles')
      .select('tier')
      .eq('id', gate.user.id)
      .single();
    if (prodData?.base_cost != null && profData?.tier) {
      // Check for per-product override first (mirrors GET handler logic).
      const { data: overrideData } = await supabase
        .from('product_tier_overrides')
        .select('custom_multiplier')
        .eq('product_id', check.product_id)
        .eq('tier_name', profData.tier)
        .maybeSingle();
      if (overrideData?.custom_multiplier != null) {
        agentCostPer10 = Number(prodData.base_cost) * Number(overrideData.custom_multiplier);
      } else {
        const { data: multData } = await supabase
          .from('pricing_tiers')
          .select('multiplier')
          .eq('tier_name', profData.tier)
          .single();
        agentCostPer10 = Number(prodData.base_cost) * (Number(multData?.multiplier) || 1.7);
      }
    }
  }

  // ── Resolve the price to store ────────────────────────────────────────────
  // Priority: explicit retail_price (direct $ entry) takes precedence over
  // margin_percent. When the agent types a dollar amount, that IS the price —
  // we save retail_price directly and back-compute margin_percent so the DB
  // trigger column stays consistent. When only margin_percent arrives (e.g.
  // from the bulk-margin flow), let the DB trigger recalculate retail_price.
  let resolvedRetailPrice: number | undefined;
  let resolvedMarginPercent: number | undefined;

  if (retail_price !== undefined && Number.isFinite(Number(retail_price))) {
    resolvedRetailPrice = Number(retail_price);
  } else if (margin_percent !== undefined && Number.isFinite(Number(margin_percent))) {
    // Markup-% only path — DB trigger will recalculate retail_price.
    resolvedMarginPercent = Number(margin_percent);
    if (agentCostPer10 > 0) {
      resolvedRetailPrice = agentCostPer10 * (1 + resolvedMarginPercent / 100);
    }
  }

  // ── Server-side retail price floor ───────────────────────────────────
  // Enforced whether they submitted a flat dollar amount or a margin percent
  if (resolvedRetailPrice !== undefined && resolvedRetailPrice < agentCostPer10) {
    return NextResponse.json(
      {
        error: `Listed price ($${(resolvedRetailPrice / 10).toFixed(2)}/vial) cannot be below your cost ($${(agentCostPer10 / 10).toFixed(2)}/vial).`,
      },
      { status: 422 }
    );
  }

  // Back-compute margin_percent if they sent a hard retail_price
  if (retail_price !== undefined && Number.isFinite(Number(retail_price)) && agentCostPer10 > 0) {
    resolvedMarginPercent = Math.round((resolvedRetailPrice! / agentCostPer10 - 1) * 100 * 100) / 100;
  }

  // ── Server-side sale price floor ─────────────────────────────────────────
  const activeSalePrice = sale_price !== undefined && sale_price !== null ? Number(sale_price) : Number(check.sale_price);
  const activeIsOnSale = is_on_sale !== undefined ? Boolean(is_on_sale) : Boolean(check.is_on_sale);

  if (activeIsOnSale && activeSalePrice > 0) {
    if (activeSalePrice < agentCostPer10) {
      return NextResponse.json(
        {
          error: `Sale price ($${(activeSalePrice / 10).toFixed(2)}/vial) cannot be below your cost ($${(agentCostPer10 / 10).toFixed(2)}/vial).`,
        },
        { status: 422 }
      );
    }
  }

  const updatePayload: Record<string, unknown> = {
    custom_name: custom_name !== undefined ? (custom_name || null) : undefined,
    custom_description: custom_description !== undefined ? (custom_description || null) : undefined,
    custom_image_url: custom_image_url !== undefined ? (custom_image_url || null) : undefined,
    // Only write is_visible/is_on_sale/sale_price when the client explicitly sent them.
    // Using `?? default` would overwrite existing DB values when the key is absent from the body.
    is_visible: is_visible !== undefined ? Boolean(is_visible) : undefined,
    is_on_sale: is_on_sale !== undefined ? Boolean(is_on_sale) : undefined,
    sale_price: sale_price !== undefined ? (sale_price ?? null) : undefined,
    updated_at: new Date().toISOString(),
  };

  // Remove undefined entries so we don't accidentally null out fields we didn't touch
  Object.keys(updatePayload).forEach(k => updatePayload[k] === undefined && delete updatePayload[k]);

  // When retail_price is the source of truth, save it directly plus the
  // back-computed margin_percent. When only margin_percent, let the DB
  // trigger handle retail_price recalculation automatically.
  if (resolvedRetailPrice !== undefined) {
    updatePayload.retail_price = resolvedRetailPrice;
    if (resolvedMarginPercent !== undefined) {
      updatePayload.margin_percent = resolvedMarginPercent;
    }
  } else if (resolvedMarginPercent !== undefined) {
    updatePayload.margin_percent = resolvedMarginPercent;
  }

  const { error } = await supabase
    .from('agent_products')
    .update(updatePayload)
    .eq('id', id)
    .eq('agent_id', gate.user.id); // enforce ownership on the write, not just the pre-check

  if (error) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
