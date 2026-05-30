import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';

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

    // Store margin_percent on every agent_product for this agent.
    // The DB trigger (trg_recalc_on_margin) will automatically recompute
    // retail_price = base_cost × tier_multiplier × (1 + margin_percent/100)
    // for each row when margin_percent changes.
    // We also call the RPC directly as belt-and-suspenders.
    const { error: updateError } = await supabase
      .from('agent_products')
      .update({ margin_percent: marginPercent })
      .eq('agent_id', agentId);

    if (updateError) {
      return NextResponse.json({ error: 'Failed To Update Margin.' }, { status: 500 });
    }

    // Belt-and-suspenders: call the RPC in case triggers aren't active
    try {
      await supabase.rpc('recalculate_agent_product_prices', { p_agent_id: agentId });
    } catch { /* non-critical: triggers handle recomputation */ }

    // Return updated product count for the toast message
    const { count } = await supabase
      .from('agent_products')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agentId);

    return NextResponse.json({ success: true, updated: count ?? 0 });
  } catch (error) {
    console.error('Bulk Margin API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
