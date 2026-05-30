import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';

export async function GET(req: NextRequest) {
  try {
    const gate = await requireAgent();
    if (!gate.ok) return gate.response;

    const supabase = await createServiceClient();
    const superAgentId = gate.user.id;

    // Only super-agents may view or configure sub-agent pricing.
    // Regular agents calling this endpoint would receive admin_cost
    // (base_cost × multiplier) for all products — a wholesale cost leak.
    const { data: superAgentCheck } = await supabase
      .from('profiles')
      .select('is_super_agent')
      .eq('id', superAgentId)
      .single();

    if (!superAgentCheck?.is_super_agent) {
      return NextResponse.json({ error: 'Only Super Agents Can Access Pricing Configuration' }, { status: 403 });
    }

    const { data: pricing, error: pricingError } = await supabase
      .from('super_agent_pricing')
      .select('product_id, baseline_cost, bulk_baseline_cost, bulk_threshold')
      .eq('super_agent_id', superAgentId);

    if (pricingError) {
      return NextResponse.json({ error: pricingError.message }, { status: 500 });
    }

    // Fetch all active products
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, base_cost, is_active')
      .eq('is_active', true)
      .order('name');
      
    if (productsError) {
      return NextResponse.json({ error: productsError.message }, { status: 500 });
    }

    const { data: superAgent } = await supabase
      .from('profiles')
      .select('tier')
      .eq('id', superAgentId)
      .single();
      
    const tier = superAgent?.tier || 'tier_3';

    // Fetch Tier Multipliers
    const { data: tiers } = await supabase.from('pricing_tiers').select('tier_name, multiplier');
    const tierMultipliers: Record<string, number> = {};
    tiers?.forEach(t => { tierMultipliers[t.tier_name] = Number(t.multiplier); });

    // Fetch Overrides
    const { data: overrides } = await supabase.from('product_tier_overrides').select('product_id, custom_multiplier').eq('tier_name', tier);
    const overrideMap: Record<string, number> = {};
    overrides?.forEach(o => { overrideMap[o.product_id] = Number(o.custom_multiplier); });

    // Merge pricing with products, calculating EXACT super agent cost
    const pricingMap = new Map(pricing?.map(p => [p.product_id, p]) || []);
    
    const mergedData = products?.map(prod => {
      const base = Number(prod.base_cost);
      const mult = overrideMap[prod.id] ?? tierMultipliers[tier] ?? 7.0;
      const exactCost = base * mult;
      
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

    const supabase = await createServiceClient();
    const superAgentId = gate.user.id;

    const body = await req.json();
    const { product_id, baseline_cost, bulk_baseline_cost, bulk_threshold } = body;

    if (!product_id || typeof baseline_cost !== 'number') {
      return NextResponse.json({ error: 'product_id and baseline_cost are required' }, { status: 400 });
    }

    // Verify caller is a Super Agent
    const { data: superAgentProfile } = await supabase
      .from('profiles')
      .select('is_super_agent')
      .eq('id', superAgentId)
      .single();

    if (!superAgentProfile?.is_super_agent) {
      return NextResponse.json({ error: 'Only Super Agents can configure baseline pricing' }, { status: 403 });
    }

    const { error } = await supabase
      .from('super_agent_pricing')
      .upsert(
        {
          super_agent_id: superAgentId,
          product_id,
          baseline_cost,
          bulk_baseline_cost: typeof bulk_baseline_cost === 'number' ? bulk_baseline_cost : null,
          bulk_threshold: typeof bulk_threshold === 'number' ? bulk_threshold : 100,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'super_agent_id,product_id' }
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
