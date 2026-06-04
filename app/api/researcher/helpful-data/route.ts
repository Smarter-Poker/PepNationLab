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
    // Fetch user's past orders to determine what they've purchased and when
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, items, created_at')
      .eq('buyer_id', session.user.id)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false });

    if (ordersError) throw ordersError;

    // Collect all unique product IDs from orders and their most recent purchase date
    const purchasedProducts = new Map<string, string>();
    for (const order of (orders || [])) {
      const items = (order.items as any[]) || [];
      for (const item of items) {
        if (item.product_id && !purchasedProducts.has(item.product_id)) {
          purchasedProducts.set(item.product_id, order.created_at);
        }
      }
    }

    if (purchasedProducts.size === 0) {
      return NextResponse.json({ 
        helpfulData: {
          message: "You haven't made any purchases yet. Start exploring compounds to unlock personalized research data!",
          insights: []
        }
      });
    }

    // Fetch product details for these products
    const { data: products, error: pError } = await supabase
      .from('products')
      .select('id, name, slug, unit_size, unit_measure, category')
      .in('id', Array.from(purchasedProducts.keys()));

    if (pError) throw pError;

    const slugs = Array.from(new Set((products || []).map(p => p.slug).filter(Boolean)));
    let compoundsBySlug: Record<string, any> = {};
    if (slugs.length > 0) {
      const { data: compounds } = await supabase
        .from('compounds')
        .select('slug, half_life, mechanism, best_stacked_with')
        .in('slug', slugs);
      for (const c of compounds || []) {
        compoundsBySlug[c.slug] = c;
      }
    }

    // Generate insights based on purchased compounds
    const insights = (products || []).map(p => {
      const compound = p.slug ? compoundsBySlug[p.slug] : null;
      let insight = ``;
      
      const purchasedAt = purchasedProducts.get(p.id);
      if (purchasedAt) {
        const daysAgo = Math.floor((Date.now() - new Date(purchasedAt).getTime()) / (1000 * 60 * 60 * 24));
        if (daysAgo > 35) {
          insight += `Restock Alert: You ordered this ${daysAgo} days ago. Based on typical 6-week research cycles, you may need to restock soon. `;
        }
      }

      if (compound?.half_life) {
        insight += `Note that it has a half-life of roughly ${compound.half_life}. `;
      }
      
      if (p.unit_size && p.unit_measure?.toLowerCase() === 'mg') {
        const mg = parseFloat(p.unit_size);
        if (!isNaN(mg) && mg > 0) {
          insight += `Reconstitution Guide: Adding 2ml of bacteriostatic water to this ${mg}mg vial yields a concentration of ${mg/2}mg per ml (or ${mg/20}mg per 10 units). `;
        }
      }

      if (compound?.best_stacked_with && compound.best_stacked_with.length > 0) {
        insight += `Synergy: Known to stack well with ${compound.best_stacked_with.join(', ')}.`;
      }

      if (!insight) {
         insight = `Review past orders or compare history for further research tracking.`;
      }

      return {
        compoundId: p.id,
        compoundName: p.name,
        slug: p.slug,
        insightText: insight.trim(),
        category: p.category
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
