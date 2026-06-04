import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Fetch user's past orders to determine what they've purchased
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, items')
      .eq('customer_id', session.user.id)
      .eq('status', 'paid');

    if (ordersError) throw ordersError;

    // Collect all unique product IDs from orders
    const purchasedProductIds = new Set<string>();
    for (const order of (orders || [])) {
      const items = (order.items as any[]) || [];
      for (const item of items) {
        if (item.id) purchasedProductIds.add(item.id);
      }
    }

    if (purchasedProductIds.size === 0) {
      return NextResponse.json({ 
        helpfulData: {
          message: "You haven't made any purchases yet. Start exploring compounds to unlock personalized research data!",
          insights: []
        }
      });
    }

    // Fetch compound details for these products
    const { data: compounds, error: compError } = await supabase
      .from('compounds')
      .select('id, name, slug, half_life, mechanism, category')
      .in('id', Array.from(purchasedProductIds));

    if (compError) throw compError;

    // Generate insights based on purchased compounds
    const insights = (compounds || []).map(c => {
      let insight = `Based on your research with ${c.name}, `;
      if (c.half_life) {
        insight += `note that it has a half-life of roughly ${c.half_life}. `;
      }
      if (c.mechanism) {
        insight += `Its primary mechanism involves ${c.mechanism}. `;
      }
      return {
        compoundId: c.id,
        compoundName: c.name,
        slug: c.slug,
        insightText: insight.trim(),
        category: c.category
      };
    });

    return NextResponse.json({ 
      helpfulData: {
        message: "Here is your personalized research data based on your past orders.",
        insights
      } 
    });

  } catch (error) {
    console.error('Error fetching helpful data:', error);
    return NextResponse.json({ error: 'Failed to fetch helpful data' }, { status: 500 });
  }
}
