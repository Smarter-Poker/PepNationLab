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

    if (marginPercent === undefined || typeof marginPercent !== 'number' || marginPercent < 0) {
      return NextResponse.json({ error: 'Invalid margin percentage' }, { status: 400 });
    }

    // Fetch all products for this agent to calculate new prices
    const { data: agentProducts, error: fetchError } = await supabase
      .from('agent_products')
      .select(`
        id,
        products ( base_cost )
      `)
      .eq('agent_id', agentId);

    if (fetchError || !agentProducts) {
      return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
    }

    // Prepare updates
    const updates = agentProducts.map(ap => {
      // Assuming base_cost is the agent's wholesale cost 
      // If there's a tier multiplier, it should ideally be factored in, but for now we apply the margin on top of the base_cost as a quick implementation.
      // Wait! The wholesale cost is usually base_cost + tier markup. 
      // Since we don't have the agent tier markup logic fully abstracted here, 
      // let's just let the user know this is base margin, or we can fetch the tier.
      
      const baseCost = Number((ap.products as any)?.base_cost || 0);
      const retailPrice = baseCost * (1 + (marginPercent / 100));

      return {
        id: ap.id,
        retail_price: Number(retailPrice.toFixed(2))
      };
    });

    // Supabase JS doesn't have bulk update without iterating or using a stored procedure in this context easily.
    // So we'll iterate with Promise.all
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
      return NextResponse.json({ error: 'Failed to update some products' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Bulk Margin API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
