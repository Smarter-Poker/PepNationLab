import { NextResponse } from 'next/server';
import { requireAgentOrAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { getEffectiveBundlesForStore } from '@/lib/bundles';

export async function GET() {
  try {
    const gate = await requireAgentOrAdmin();
    if (!gate.ok) return gate.response;
    const svc = await createServiceClient();

    // Get effective bundles (own + upline + global)
    const effectiveBundles = await getEffectiveBundlesForStore(svc, gate.user.id);

    // Collect all unique product IDs across all bundles
    const allProductIds = [...new Set(effectiveBundles.flatMap((b) => b.product_ids))];
    let priceMap = new Map<string, { base_cost: number; retail_price: number }>();
    
    if (allProductIds.length > 0) {
      const { data: apRows } = await svc
        .from('agent_products')
        .select('product_id, retail_price, products ( base_cost )')
        .eq('agent_id', gate.user.id)
        .in('product_id', allProductIds);
      if (apRows) {
        for (const row of apRows as Array<Record<string, any>>) {
          const pid = row.product_id as string;
          const baseCost = Number(row.products?.base_cost ?? 0);
          const retail = Number(row.retail_price ?? 0);
          if (pid) priceMap.set(pid, { base_cost: baseCost, retail_price: retail });
        }
      }
    }

    // Annotate each bundle with computed pricing totals
    const bundlesWithPricing = effectiveBundles.map((b) => {
      let base_cost_total = 0;
      let retail_value_total = 0;
      for (const pid of b.product_ids) {
        const p = priceMap.get(pid);
        if (p) {
          // DB prices are per-10-vial pack; a bundle holds ONE vial of each member,
          // so divide by 10 for the true per-vial cost/retail (same /10 convention
          // used throughout the catalog). NOTE: assumes non-BAC members (bundles are
          // peptide stacks). If a bundle ever includes BAC water, treat it as /1.
          base_cost_total += p.base_cost / 10;
          retail_value_total += p.retail_price / 10;
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
