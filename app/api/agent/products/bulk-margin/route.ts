import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { computeAgentCostForAgent } from '@/lib/pricing';
import type { AgentTier } from '@/lib/pricing';

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

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
          import('@/lib/notify').then(({ notifyMarginWarning }) => {
            const admin = require('@/lib/supabase/server').createAdminClient();
            notifyMarginWarning(admin, gate.user.id).catch(err => {
              console.error('[bulk-margin] Failed to fire margin warning:', err);
            });
          });
        }
      }
    }

    const { data: agentProducts } = await supabase
      .from('agent_products')
      .select('id, product_id, products!inner(base_cost)')
      .eq('agent_id', agentId)
      .not('product_id', 'is', null);

    if (!agentProducts || agentProducts.length === 0) {
      return NextResponse.json({ success: true, updated: 0 });
    }

    const { data: profData } = await supabase.from('profiles').select('tier').eq('id', agentId).single();
    const tier = (profData?.tier as AgentTier | null) ?? 'tier_3';

    let updatedCount = 0;
    const updates = agentProducts.map(async ap => {
       const productId = ap.product_id as string;
       const baseCost = Number((ap.products as any).base_cost);
       
       let agentCostPer10 = 0;
       if (baseCost > 0) {
         agentCostPer10 = await computeAgentCostForAgent(supabase, productId, agentId, tier);
       }
       const retailPrice = agentCostPer10 * (1 + marginPercent / 100);

       return supabase
         .from('agent_products')
         .update({ margin_percent: marginPercent, retail_price: retailPrice })
         .eq('id', ap.id)
         .eq('agent_id', agentId);
    });

    await Promise.all(updates);
    updatedCount = updates.length;

    return NextResponse.json({ success: true, updated: updatedCount });
  } catch (error) {
    console.error('Bulk Margin API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
