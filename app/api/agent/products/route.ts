import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { computeAgentCostForAgent } from '@/lib/pricing';
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

  const augmentedPromises = (data ?? []).map(async ap => {
    const productId = ap.product_id as string;
    const baseCost = (ap.products as any)?.base_cost != null
      ? Number((ap.products as any).base_cost)
      : 0;

    let agentCost = 0;
    if (baseCost > 0) {
       agentCost = await computeAgentCostForAgent(supabase, productId, agentId, tier);
    }

    // Strip base_cost from the nested products object before sending to client.
    const { base_cost: _stripped, ...safeProducts } = (ap.products as any) ?? {};
    void _stripped; // suppress unused-var lint

    return {
      ...ap,
      products: safeProducts,
      agent_cost: baseCost > 0 ? agentCost : null,
      agent_tier: tier,
      // base_cost_raw and effective_multiplier intentionally omitted - cost leak.
    };
  });

  const augmented = await Promise.all(augmentedPromises);

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
  // We compute it here even though the client enforces it too - a bypassed
  // client-side check must not allow below-cost listings to reach the DB.
  // Per-product tier overrides take priority over the global tier multiplier,
  // matching the same effective-multiplier logic used in the GET handler.
  let agentCostPer10 = 0;
  {
    const { data: profData } = await supabase
      .from('profiles')
      .select('tier')
      .eq('id', gate.user.id)
      .single();
    if (profData?.tier) {
      agentCostPer10 = await computeAgentCostForAgent(supabase, check.product_id, gate.user.id, profData.tier as AgentTier);
    }
  }

  // ── Resolve the price to store ────────────────────────────────────────────
  // Priority: explicit retail_price (direct $ entry) takes precedence over
  // margin_percent. When the agent types a dollar amount, that IS the price -
  // we save retail_price directly and back-compute margin_percent so the DB
  // trigger column stays consistent. When only margin_percent arrives (e.g.
  // from the bulk-margin flow), let the DB trigger recalculate retail_price.
  let resolvedRetailPrice: number | undefined;
  let resolvedMarginPercent: number | undefined;

  if (retail_price !== undefined && Number.isFinite(Number(retail_price))) {
    resolvedRetailPrice = Number(retail_price);
  } else if (margin_percent !== undefined && Number.isFinite(Number(margin_percent))) {
    // Markup-% only path - DB trigger will recalculate retail_price.
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

  if (activeIsOnSale) {
    if (activeSalePrice < agentCostPer10) {
      return NextResponse.json(
        {
          error: `Sale price ($${(activeSalePrice / 10).toFixed(2)}/vial) cannot be below your cost ($${(agentCostPer10 / 10).toFixed(2)}/vial).`,
        },
        { status: 422 }
      );
    }
  }

  // ── Server-side Sub-Agent Margin Safeguard ───────────────────────────────
  // Ensure that the new price does not drop the margin below what is required
  // by existing Sub-Agents.
  const checkRetailPrice = activeIsOnSale ? activeSalePrice : (resolvedRetailPrice !== undefined ? resolvedRetailPrice : Number(check.retail_price));
  if (checkRetailPrice > 0 && agentCostPer10 > 0) {
    const newMarginPct = ((checkRetailPrice - agentCostPer10) / checkRetailPrice) * 100;

    const { data: subAgents } = await supabase
      .from('profiles')
      .select('commission_pct, commission_max_pct')
      .eq('parent_agent_id', gate.user.id)
      .eq('is_sub_agent', true);

    if (subAgents && subAgents.length > 0) {
      let maxExisting = 0;
      for (const sa of subAgents) {
        const val = Math.max(Number(sa.commission_pct || 0), Number(sa.commission_max_pct || 0));
        if (val > maxExisting) maxExisting = val;
      }

      if (maxExisting > 0) {
        const netMarginPct = newMarginPct - maxExisting;

        // Hard Rule: 10% Net Profit Margin
        if (netMarginPct < 10) {
          const minRequiredGross = maxExisting + 10;
          return NextResponse.json(
            { error: `Cannot lower price to $${(checkRetailPrice / 10).toFixed(2)}/vial. You have sub-agents earning up to ${maxExisting}% commission, which requires this product's margin to be at least ${minRequiredGross}% to maintain a 10% Net Profit.` },
            { status: 422 }
          );
        }

        // Soft Rule: Warning if sub-agent out-earns agent
        if (maxExisting > netMarginPct) {
          import('@/lib/notify').then(({ notifyMarginWarning }) => {
            const admin = require('@/lib/supabase/server').createAdminClient();
            notifyMarginWarning(admin, gate.user.id).catch(err => {
              console.error('[products/route] Failed to fire margin warning:', err);
            });
          });
        }
      }
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
