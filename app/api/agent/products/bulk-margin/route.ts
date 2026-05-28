import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { computeAgentCost, type AgentTier } from '@/lib/pricing';

export async function POST(req: NextRequest) {
  try {
    const gate = await requireAgent();
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

    // Resolve the agent's tier so we can compute their wholesale cost per SKU.
    const { data: agentProfile, error: profileError } = await supabase
      .from('profiles')
      .select('tier')
      .eq('id', agentId)
      .single();

    if (profileError || !agentProfile) {
      return NextResponse.json({ error: 'Agent Profile Not Found.' }, { status: 404 });
    }

    const tier = (agentProfile.tier as AgentTier | null) ?? 'tier_3';

    const { data: agentProducts, error: fetchError } = await supabase
      .from('agent_products')
      .select('id, product_id')
      .eq('agent_id', agentId);

    if (fetchError || !agentProducts) {
      return NextResponse.json({ error: 'Failed To Fetch Products.' }, { status: 500 });
    }

    // Compute each agent's wholesale cost (base_cost * tier multiplier or
    // per-product override) and apply the requested margin on top.
    const updates = await Promise.all(
      agentProducts
        .filter(ap => ap.product_id)
        .map(async ap => {
          const agentCost = await computeAgentCost(supabase, ap.product_id as string, tier);
          const retailPrice = parseFloat((agentCost * (1 + marginPercent / 100)).toFixed(2));
          return { id: ap.id, retail_price: retailPrice };
        })
    );

    const results = await Promise.all(
      updates.map(update =>
        supabase
          .from('agent_products')
          .update({ retail_price: update.retail_price })
          .eq('id', update.id)
      )
    );

    const hasError = results.some(res => res.error);
    if (hasError) {
      return NextResponse.json({ error: 'Failed To Update Some Products.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, updated: updates.length });
  } catch (error) {
    console.error('Bulk Margin API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
