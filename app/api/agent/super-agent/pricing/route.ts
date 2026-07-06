import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { computeAgentCostForAgent } from '@/lib/pricing';
import type { AgentTier } from '@/lib/pricing';

export async function GET(req: NextRequest) {
  try {
    const gate = await requireAgent();
    if (!gate.ok) return gate.response;

    const supabase = createAdminClient();
    const superAgentId = gate.user.id;

    // Only super-agents may view or configure sub-agent pricing.
    // Regular agents calling this endpoint would receive admin_cost
    // (base_cost x multiplier) for all products - a wholesale cost leak.
    const { data: superAgentCheck } = await supabase
      .from('profiles')
      .select('is_super_agent')
      .eq('id', superAgentId)
      .maybeSingle();

    if (!superAgentCheck?.is_super_agent) {
      return NextResponse.json({ error: 'Only Super Agents Can Access Pricing Configuration' }, { status: 403 });
    }

    const { data: pricing, error: pricingError } = await supabase
      .from('super_agent_pricing')
      .select('product_id, baseline_cost, bulk_baseline_cost, bulk_threshold')
      .eq('super_agent_id', superAgentId);

    if (pricingError) {
      return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
    }

    // Fetch all active products
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, base_cost, is_active')
      .eq('is_active', true)
      .order('name');
      
    if (productsError) {
      return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
    }

    const { data: superAgent } = await supabase
      .from('profiles')
      .select('tier')
      .eq('id', superAgentId)
      .maybeSingle();
      
    const tier = (superAgent?.tier as AgentTier | null) ?? 'tier_3';

    // Merge pricing with products, calculating EXACT super agent cost
    const pricingMap = new Map(pricing?.map(p => [p.product_id, p]) || []);
    
    const mergedDataPromises = products?.map(async prod => {
      const base = Number(prod.base_cost);
      let exactCost = 0;
      if (base > 0) {
        exactCost = await computeAgentCostForAgent(supabase, prod.id, superAgentId, tier);
      }
      
      const priceRow = pricingMap.get(prod.id);
      return {
        id: prod.id,
        name: prod.name,
        admin_cost: exactCost,
        baseline_cost: priceRow?.baseline_cost ?? null,
        bulk_baseline_cost: priceRow?.bulk_baseline_cost ?? null,
        bulk_threshold: priceRow?.bulk_threshold ?? 100,
      };
    });

    const mergedData = mergedDataPromises ? await Promise.all(mergedDataPromises) : [];

    return NextResponse.json({ data: mergedData });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  try {
    const gate = await requireAgent();
    if (!gate.ok) return gate.response;

    const supabase = createAdminClient();
    const superAgentId = gate.user.id;

    const body = await req.json();
    const { product_id, baseline_cost, bulk_baseline_cost, bulk_threshold } = body;

    if (!product_id || typeof baseline_cost !== 'number' || baseline_cost < 0) {
      return NextResponse.json(
        { error: 'product_id is required and baseline_cost must be a positive number or zero.' },
        { status: 400 }
      );
    }

    // Verify caller is a Super Agent
    const { data: superAgentProfile } = await supabase
      .from('profiles')
      .select('is_super_agent, tier')
      .eq('id', superAgentId)
      .maybeSingle();

    if (!superAgentProfile?.is_super_agent) {
      return NextResponse.json({ error: 'Only Super Agents Can Configure Baseline Pricing.' }, { status: 403 });
    }

    // Server-side baseline_cost floor
    // A super-agent cannot price sub-agents below their own wholesale cost
    // (which would mean selling at a loss). computeAgentCost returns the
    // per-10-vial-pack cost; baseline_cost is also per-10-vial-pack.
    const ownCostPer10 = await computeAgentCostForAgent(supabase as any, product_id, superAgentId, (superAgentProfile.tier as 'tier_1' | 'tier_2' | 'tier_3') ?? 'tier_3');
    // Allow zero-cost items as explicitly requested.
    // Ensure that if ownCostPer10 is exactly 0, they can set baseline_cost >= 0.
    if (ownCostPer10 === undefined || ownCostPer10 === null) {
      return NextResponse.json(
        { error: 'Product wholesale cost could not be determined. Contact admin.' },
        { status: 422 }
      );
    }
    if (baseline_cost < ownCostPer10) {
      return NextResponse.json(
        {
          error: `Baseline cost ($${(baseline_cost / 10).toFixed(2)}/vial) cannot be below your own wholesale cost ($${(ownCostPer10 / 10).toFixed(2)}/vial).`,
        },
        { status: 422 }
      );
    }

    // B-04: Validate bulk_baseline_cost with same cost floor
    if (typeof bulk_baseline_cost === 'number') {
      if (bulk_baseline_cost < 0) {
        return NextResponse.json({ error: 'bulk_baseline_cost must be greater than or equal to zero.' }, { status: 400 });
      }
      if (bulk_baseline_cost < ownCostPer10) {
        return NextResponse.json(
          {
            error: `Bulk baseline cost ($${(bulk_baseline_cost / 10).toFixed(2)}/vial) cannot be below your own wholesale cost ($${(ownCostPer10 / 10).toFixed(2)}/vial).`,
          },
          { status: 422 }
        );
      }
    }

    // B-05: bulk_threshold must be a positive integer
    if (bulk_threshold !== undefined && bulk_threshold !== null) {
      if (!Number.isInteger(bulk_threshold) || bulk_threshold < 1) {
        return NextResponse.json({ error: 'bulk_threshold must be a positive integer >= 1.' }, { status: 400 });
      }
    }

    const { error } = await supabase
      .from('super_agent_pricing')
      .upsert(
        {
          super_agent_id: superAgentId,
          product_id,
          baseline_cost,
          bulk_baseline_cost: typeof bulk_baseline_cost === 'number' ? bulk_baseline_cost : null,
          bulk_threshold: typeof bulk_threshold === 'number' && Number.isInteger(bulk_threshold) ? bulk_threshold : 100,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'super_agent_id,product_id' }
      );

    if (error) {
      return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
