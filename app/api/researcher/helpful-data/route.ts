import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, created_at')
      .eq('buyer_id', user!.id)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false });

    if (ordersError) throw ordersError;

    const purchasedProducts = new Map<string, string>();
    const orderList = (orders || []) as Array<{ id: string; created_at: string }>;
    if (orderList.length > 0) {
      const orderDate = new Map(orderList.map((o) => [o.id, o.created_at]));
      const { data: lineItems, error: liError } = await supabase
        .from('order_items')
        .select('order_id, product_id')
        .in('order_id', orderList.map((o) => o.id));

      if (liError) throw liError;

      for (const li of (lineItems || []) as Array<{ order_id: string; product_id: string | null }>) {
        if (!li.product_id) continue;
        const d = orderDate.get(li.order_id);
        if (!d) continue;
        const existing = purchasedProducts.get(li.product_id);
        if (!existing || new Date(d) > new Date(existing)) {
          purchasedProducts.set(li.product_id, d);
        }
      }
    }

    if (purchasedProducts.size === 0) {
      return NextResponse.json({ helpfulData: { message: "You Haven't Made Any Purchases Yet. Start Exploring Compounds To Unlock Personalized Research Data!", insights: [] } });
    }

    const { data: products, error: pError } = await supabase
      .from('products')
      .select('id, name, slug, unit_size, unit_measure, category')
      .in('id', Array.from(purchasedProducts.keys()));

    if (pError) throw pError;

    const slugs = Array.from(new Set((products || []).map(p => p.slug).filter(Boolean)));
    const compoundsBySlug: Record<string, { slug: string; half_life: string | null; mechanism: string | null; best_stacked_with: string[] | null }> = {};
    if (slugs.length > 0) {
      const { data: compounds } = await supabase.from('compounds').select('slug, half_life, mechanism, best_stacked_with').in('slug', slugs);
      for (const c of compounds || []) compoundsBySlug[c.slug] = c;
    }

    const insights = (products || []).map(p => {
      const compound = p.slug ? compoundsBySlug[p.slug] : null;
      let insight = ``;
      const purchasedAt = purchasedProducts.get(p.id);
      if (purchasedAt) {
        const daysAgo = Math.floor((Date.now() - new Date(purchasedAt).getTime()) / (1000 * 60 * 60 * 24));
        if (daysAgo > 35) insight += `Restock Alert: You Ordered This ${daysAgo} Days Ago. Based On Typical 6-Week Research Cycles, You May Need To Restock Soon. `;
      }
      if (compound?.half_life) insight += `Note That It Has A Half-Life Of Roughly ${compound.half_life}. `;
      if (p.unit_size && p.unit_measure?.toLowerCase() === 'mg') {
        const mg = parseFloat(p.unit_size);
        if (!isNaN(mg) && mg > 0) insight += `Reconstitution Guide: Adding 2ml Of Bacteriostatic Water To This ${mg}mg Vial Yields A Concentration Of ${mg/2}mg Per Ml (Or ${mg/20}mg Per 10 Units). `;
      }
      if (compound?.best_stacked_with && compound.best_stacked_with.length > 0) insight += `Synergy: Known To Stack Well With ${compound.best_stacked_with.join(', ')}.`;
      if (!insight) insight = `Review Past Orders Or Compare History For Further Research Tracking.`;
      return { compoundId: p.id, compoundName: p.name, slug: p.slug, insightText: insight.trim(), category: p.category };
    });

    return NextResponse.json({ helpfulData: { message: "Here Is Your Personalized Research Data Based On Your Past Orders.", insights } });

  } catch (error) {
    console.error('Error fetching helpful data:', error);
    return NextResponse.json({ error: 'Failed To Fetch Helpful Data' }, { status: 500 });
  }
}
