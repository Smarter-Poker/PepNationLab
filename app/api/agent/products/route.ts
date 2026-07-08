import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgentOrAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { computeAgentCostForAgent } from '@/lib/pricing';
import type { AgentTier } from '@/lib/pricing';

// requireAgentOrAdmin is ownership-safe here: every query below is scoped to
// agent_id = caller id, so an admin passing through only ever touches the
// house store's own rows. The admin's cost basis is base_cost (COGS), not a
// tier-multiplied agent cost.

export async function GET(req: NextRequest) {
  const gate = await requireAgentOrAdmin();
  if (!gate.ok) return gate.response;

  try {
    const supabase = await createServiceClient();
    const agentId = gate.user.id;

    const { data: profile } = await supabase
      .from('profiles')
      .select('tier')
      .eq('id', agentId)
      .maybeSingle();

    const tier = ((profile?.tier as AgentTier | null) ?? 'tier_3') as AgentTier;

    const { data, error } = await supabase
      .from('agent_products')
      .select(`
        id, agent_id, product_id, custom_name, custom_description,
        custom_image_url, retail_price, margin_percent, is_visible, is_on_sale, sale_price, sort_order,
        products (name, description, image_url, category, in_stock, inventory_count,
                 unit_size, unit_measure, base_cost,
                 market_avg_price, market_low_price, market_high_price)
      `)
      .eq('agent_id', agentId)
      .order('sort_order', { ascending: true });

    if (error) {
      return NextResponse.json({ error: 'An Unexpected Error Occurred.' }, { status: 500 });
    }

    const augmentedPromises = (data ?? []).map(async ap => {
      const productId = ap.product_id as string;
      const baseCost = (ap.products as any)?.base_cost != null
        ? Number((ap.products as any).base_cost)
        : 0;

      // Admin cost basis is base_cost (true COGS on the house store); agents
      // get their tier-multiplied / custom-scaled cost.
      let agentCost = 0;
      if (baseCost > 0) {
         agentCost = gate.isAdmin
           ? baseCost
           : await computeAgentCostForAgent(supabase, productId, agentId, tier);
      }

      const { base_cost: _stripped, ...safeProducts } = (ap.products as any) ?? {};
      void _stripped;

      return {
        ...ap,
        products: safeProducts,
        agent_cost: baseCost > 0 ? agentCost : null,
        agent_tier: tier,
      };
    });

    const augmented = await Promise.all(augmentedPromises);

    return NextResponse.json({ data: augmented });
  } catch (err) {
    console.error('[agent/products] GET error:', err);
    return NextResponse.json({ error: 'An Unexpected Error Occurred.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAgentOrAdmin();
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
    return NextResponse.json({ error: 'Missing Agent Product ID' }, { status: 400 });
  }

  try {
    const supabase = await createServiceClient();

    const { data: check } = await supabase
      .from('agent_products')
      .select(`
        id, retail_price, margin_percent, product_id, agent_id, sale_price, is_on_sale,
        products ( min_retail_price, max_margin_percent, base_cost )
      `)
      .eq('id', id)
      .eq('agent_id', gate.user.id)
      .maybeSingle();

    if (!check) {
      return NextResponse.json({ error: 'Unauthorized Or Not Found' }, { status: 403 });
    }

    // Cost floor: base_cost (COGS) for the admin house store, tier-derived
    // cost for agents. All price/margin guardrails below key off this value.
    let agentCostPer10 = 0;
    if (gate.isAdmin) {
      const rawBase = (check.products as any)?.base_cost;
      agentCostPer10 = rawBase != null ? Number(rawBase) : 0;
    } else {
      const { data: profData } = await supabase
        .from('profiles')
        .select('tier')
        .eq('id', gate.user.id)
        .maybeSingle();
      if (profData?.tier) {
        agentCostPer10 = await computeAgentCostForAgent(supabase, check.product_id, gate.user.id, profData.tier as AgentTier);
      }
    }

    let resolvedRetailPrice: number | undefined;
    let resolvedMarginPercent: number | undefined;

    if (retail_price !== undefined && Number.isFinite(Number(retail_price))) {
      resolvedRetailPrice = Number(retail_price);
    } else if (margin_percent !== undefined && Number.isFinite(Number(margin_percent))) {
      resolvedMarginPercent = Number(margin_percent);
      if (agentCostPer10 > 0) {
        resolvedRetailPrice = agentCostPer10 * (1 + resolvedMarginPercent / 100);
      }
    }

    const minRetailPrice = Number((check.products as any)?.min_retail_price || agentCostPer10);
    const maxMargin = Number((check.products as any)?.max_margin_percent || 300);

    if (resolvedRetailPrice !== undefined && resolvedRetailPrice < minRetailPrice) {
      return NextResponse.json(
        {
          error: `Listed price ($${(resolvedRetailPrice / 10).toFixed(2)}/vial) cannot be below the Minimum Advertised Price ($${(minRetailPrice / 10).toFixed(2)}/vial).`,
        },
        { status: 422 }
      );
    }

    if (resolvedRetailPrice !== undefined && resolvedRetailPrice < agentCostPer10) {
      return NextResponse.json(
        {
          error: `Listed price ($${(resolvedRetailPrice / 10).toFixed(2)}/vial) cannot be below your cost ($${(agentCostPer10 / 10).toFixed(2)}/vial).`,
        },
        { status: 422 }
      );
    }

    // The margin ceiling protects the marketplace from agent price gouging.
    // It does NOT apply to the admin house store: the admin's cost basis is
    // raw COGS (base_cost), so healthy retail prices are naturally far above
    // 300% of cost.
    if (!gate.isAdmin && resolvedMarginPercent !== undefined && resolvedMarginPercent > maxMargin) {
      return NextResponse.json(
        {
          error: `Requested margin (${resolvedMarginPercent}%) exceeds the platform maximum of ${maxMargin}%.`,
        },
        { status: 422 }
      );
    }

    if (retail_price !== undefined && Number.isFinite(Number(retail_price)) && agentCostPer10 > 0) {
      resolvedMarginPercent = Math.round((resolvedRetailPrice! / agentCostPer10 - 1) * 100 * 100) / 100;
    }

    const activeSalePrice = sale_price !== undefined && sale_price !== null ? Number(sale_price) : Number(check.sale_price);
    const activeIsOnSale = is_on_sale !== undefined ? Boolean(is_on_sale) : Boolean(check.is_on_sale);

    if (activeIsOnSale) {
      if (activeSalePrice < minRetailPrice) {
        return NextResponse.json(
          {
            error: `Sale price ($${(activeSalePrice / 10).toFixed(2)}/vial) cannot be below the Minimum Advertised Price ($${(minRetailPrice / 10).toFixed(2)}/vial).`,
          },
          { status: 422 }
        );
      }

      if (activeSalePrice < agentCostPer10) {
        return NextResponse.json(
          {
            error: `Sale price ($${(activeSalePrice / 10).toFixed(2)}/vial) cannot be below your cost ($${(agentCostPer10 / 10).toFixed(2)}/vial).`,
          },
          { status: 422 }
        );
      }
    }

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

          if (netMarginPct < 10) {
            const minRequiredGross = maxExisting + 10;
            return NextResponse.json(
              { error: `Cannot lower price to $${((checkRetailPrice / 10).toFixed(2))}/vial. You have sub-agents earning up to ${maxExisting}% commission, which requires this product's margin to be at least ${minRequiredGross}% to maintain a 10% Net Profit.` },
              { status: 422 }
            );
          }

          if (maxExisting > netMarginPct) {
            import('@/lib/notify').then(async ({ notifyMarginWarning }) => {
              const { createAdminClient } = await import('@/lib/supabase/server');
              const admin = createAdminClient();
              notifyMarginWarning(admin, gate.user.id).catch((err: Error) => {
                console.error('[products/route] Failed to fire margin warning:', err);
              });
            });
          }
        }
      }
    }

    if (custom_name !== undefined && typeof custom_name === 'string' && custom_name.length > 200) {
      return NextResponse.json({ error: 'Custom Name Too Long (Max 200)' }, { status: 400 });
    }
    if (custom_description !== undefined && typeof custom_description === 'string' && custom_description.length > 5000) {
      return NextResponse.json({ error: 'Custom Description Too Long (Max 5,000)' }, { status: 400 });
    }
    if (custom_image_url !== undefined && typeof custom_image_url === 'string' && custom_image_url.length > 500) {
      return NextResponse.json({ error: 'Custom Image URL Too Long (Max 500)' }, { status: 400 });
    }

    const updatePayload: Record<string, unknown> = {
      custom_name: custom_name !== undefined ? (custom_name || null) : undefined,
      custom_description: custom_description !== undefined ? (custom_description || null) : undefined,
      custom_image_url: custom_image_url !== undefined ? (custom_image_url || null) : undefined,
      is_visible: is_visible !== undefined ? Boolean(is_visible) : undefined,
      is_on_sale: is_on_sale !== undefined ? Boolean(is_on_sale) : undefined,
      sale_price: sale_price !== undefined ? (sale_price ?? null) : undefined,
      updated_at: new Date().toISOString(),
    };

    Object.keys(updatePayload).forEach(k => updatePayload[k] === undefined && delete updatePayload[k]);

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
      .eq('agent_id', gate.user.id);

    if (error) {
      return NextResponse.json({ error: 'An Unexpected Error Occurred.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[agent/products] PATCH error:', err);
    return NextResponse.json({ error: 'An Unexpected Error Occurred.' }, { status: 500 });
  }
}
