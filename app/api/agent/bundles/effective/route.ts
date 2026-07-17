import { NextResponse } from 'next/server';
import { requireAgentOrAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { getEffectiveBundlesForStore } from '@/lib/bundles';
import { computeAgentCostsForAgent } from '@/lib/pricing';
import type { AgentTier } from '@/lib/pricing';

export async function GET() {
  try {
    const gate = await requireAgentOrAdmin();
    if (!gate.ok) return gate.response;
    const svc = await createServiceClient();

    // Get effective bundles (own + upline + global)
    const effectiveBundles = await getEffectiveBundlesForStore(svc, gate.user.id);

    // Collect all unique product IDs across all bundles
    const allProductIds = [...new Set(effectiveBundles.flatMap((b) => b.product_ids))];
    let priceMap = new Map<string, { agent_cost: number; retail_price: number }>();
    
    if (allProductIds.length > 0) {
      const { data: apRows } = await svc
        .from('agent_products')
        .select('product_id, retail_price, products ( base_cost )')
        .eq('agent_id', gate.user.id)
        .in('product_id', allProductIds);
      if (apRows) {
        // Resolve the agent's tier for accurate tier-multiplied cost display.
        const { data: profData } = await svc
          .from('profiles')
          .select('tier')
          .eq('id', gate.user.id)
          .maybeSingle();
        const tier = ((profData?.tier as AgentTier | null) ?? 'tier_3') as AgentTier;

        // Build the product list needed by computeAgentCostsForAgent.
        const pricedProducts = (apRows as Array<Record<string, any>>)
          .filter((row) => row.product_id && row.products?.base_cost != null && Number(row.products.base_cost) > 0)
          .map((row) => ({ id: row.product_id as string, base_cost: Number(row.products.base_cost) }));

        // Admin's cost basis is raw COGS; agents get their tier-multiplied cost
        // (same logic as /api/agent/products GET).
        const costMap = gate.isAdmin
          ? new Map<string, number>(
              (apRows as Array<Record<string, any>>).map((row) => [
                row.product_id as string,
                Number(row.products?.base_cost ?? 0),
              ]),
            )
          : await computeAgentCostsForAgent(svc, gate.user.id, tier, pricedProducts);

        for (const row of apRows as Array<Record<string, any>>) {
          const pid = row.product_id as string;
          if (!pid) continue;
          // DB prices are per-10-vial pack; bundles show per-vial totals.
          const agentCost = (costMap.get(pid) ?? 0) / 10;
          const retail = Number(row.retail_price ?? 0) / 10;
          priceMap.set(pid, { agent_cost: agentCost, retail_price: retail });
        }
      }
    }

    // Annotate each bundle with computed pricing totals (per-vial sums).
    const bundlesWithPricing = effectiveBundles.map((b) => {
      let base_cost_total = 0;
      let retail_value_total = 0;
      for (const pid of b.product_ids) {
        const p = priceMap.get(pid);
        if (p) {
          base_cost_total += p.agent_cost;
          retail_value_total += p.retail_price;
        }
      }
      return {
        ...b,
        base_cost_total: Math.round(base_cost_total * 100) / 100,
        retail_value_total: Math.round(retail_value_total * 100) / 100,
      };
    });

    return NextResponse.json({ data: bundlesWithPricing });
  } catch (error) {
    console.error('Error fetching effective bundles:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
