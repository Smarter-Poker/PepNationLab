import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgentOrAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { computeAgentCostsForAgent } from '@/lib/pricing';
import type { AgentTier } from '@/lib/pricing';

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  try {
    const gate = await requireAgentOrAdmin();
    if (!gate.ok) return gate.response;

    const supabase = await createServiceClient();
    const agentId = gate.user.id;
    const { marginPercent } = await req.json();

    if (
      marginPercent === undefined ||
      typeof marginPercent !== 'number' ||
      !Number.isFinite(marginPercent) ||
      marginPercent <= 0
    ) {
      return NextResponse.json(
        { error: 'Margin Percentage Must Be Greater Than Zero.' },
        { status: 400 }
      );
    }

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
        const netMarginPct = marginPercent - maxExisting;
        
        // Hard Rule: 10% Net Profit Margin
        if (netMarginPct < 10) {
          const minRequiredGross = maxExisting + 10;
          return NextResponse.json(
            { error: `Cannot set margin to ${marginPercent}%. You have sub-agents earning up to ${maxExisting}% commission, which requires a minimum gross margin of ${minRequiredGross}% to maintain a 10% Net Profit.` },
            { status: 422 }
          );
        }

        // Soft Rule: Warning if sub-agent out-earns agent
        if (maxExisting > netMarginPct) {
          Promise.all([
            import('@/lib/notify'),
            import('@/lib/supabase/server'),
          ]).then(([{ notifyMarginWarning }, { createAdminClient }]) => {
            const admin = createAdminClient();
            notifyMarginWarning(admin, gate.user.id).catch(err => {
              console.error('[bulk-margin] Failed to fire margin warning:', err);
            });
          });
        }
      }
    }

    const { data: agentProducts } = await supabase
      .from('agent_products')
      .select('id, product_id, products!inner(base_cost, min_retail_price, max_margin_percent)')
      .eq('agent_id', agentId)
      .not('product_id', 'is', null);

    if (!agentProducts || agentProducts.length === 0) {
      return NextResponse.json({ success: true, updated: 0 });
    }

    const { data: profData } = await supabase.from('profiles').select('tier').eq('id', agentId).maybeSingle();
    const tier = (profData?.tier as AgentTier | null) ?? 'tier_3';
    // Isolated, fail-safe read of the margin-cap exemption (top sellers, e.g. Savage Brands).
    const { data: exemptRow } = await supabase.from('profiles').select('margin_cap_exempt').eq('id', agentId).maybeSingle();
    const marginCapExempt = Boolean((exemptRow as { margin_cap_exempt?: boolean } | null)?.margin_cap_exempt);

    // Resolve the agent's pricing context once and price the whole catalog in
    // memory - previously this issued 2-3 queries per product.
    const pricedProducts = agentProducts
      .filter(ap => {
        const rawCost = (ap.products as any)?.base_cost;
        const baseCost = rawCost != null ? Number(rawCost) : NaN;
        return !!ap.product_id && Number.isFinite(baseCost) && baseCost > 0;
      })
      .map(ap => ({ id: ap.product_id as string, base_cost: Number((ap.products as any).base_cost) }));
    const costMap = gate.isAdmin
      ? new Map<string, number>()
      : await computeAgentCostsForAgent(supabase, agentId, tier, pricedProducts);

    const updates: Array<{ agent_id: string; product_id: string; margin_percent: number; retail_price: number }> = [];
    for (const ap of agentProducts) {
      const productId = ap.product_id as string;
      const rawCost = (ap.products as any)?.base_cost;
      const baseCost = rawCost != null ? Number(rawCost) : NaN;
      // Skip products with missing or zero cost - writing $0 retail would
      // make the product free. Agent must set price manually for these.
      if (!Number.isFinite(baseCost) || baseCost <= 0) continue;

      // Admin cost basis on the house store is base_cost (COGS); agents
      // get their tier-derived cost.
      const agentCostPer10 = gate.isAdmin ? baseCost : (costMap.get(productId) ?? 0);
      const maxMargin = Number((ap.products as any)?.max_margin_percent || 300);
      const minRetailPrice = Number((ap.products as any)?.min_retail_price || agentCostPer10);

      // Margin ceiling applies to agents only; the admin's cost basis is
      // raw COGS so the ceiling would wrongly block normal retail pricing.
      if (!gate.isAdmin && !marginCapExempt && marginPercent > maxMargin) {
        continue; // Skip if it exceeds ceiling (or we could reject, but skipping allows the rest to update)
      }

      const retailPrice = agentCostPer10 * (1 + marginPercent / 100);
      if (retailPrice < minRetailPrice) {
        continue; // Skip if it falls below MAP
      }

      updates.push({
        agent_id: agentId,
        product_id: productId,
        margin_percent: marginPercent,
        retail_price: retailPrice,
      });
    }

    // Single batched write instead of one update per row. agent_products has
    // a UNIQUE constraint on (agent_id, product_id)
    // (agent_products_agent_id_product_id_key), so every row hits the
    // conflict-update path and writes exactly the same two columns the
    // previous per-row updates wrote (margin_percent, retail_price).
    let updatedCount = 0;
    if (updates.length > 0) {
      const { error: upsertErr } = await supabase
        .from('agent_products')
        .upsert(updates, { onConflict: 'agent_id,product_id' });

      if (upsertErr) {
        console.error('[bulk-margin] batched update failed:', upsertErr.message);
      } else {
        updatedCount = updates.length;
      }
    }

    return NextResponse.json({ success: true, updated: updatedCount });
  } catch (error) {
    console.error('Bulk Margin API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
