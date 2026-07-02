import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

/**
 * GET /api/storefront/recommendations
 *   ?product_id=<uuid>   required - the "seed" product the researcher is viewing
 *   ?agent_slug=<slug>   optional - when present, only recommend products the
 *                        agent actually sells; pull retail_price from agent_products
 *   ?limit=<int>         optional, default 6, capped at 24
 *
 * Strategy:
 *   1. Try the co-purchase matrix (get_copurchase_recommendations RPC).
 *   2. Fallback to product_popular_60d when there is no co-purchase data yet.
 *   3. Always filter out: seed product, inactive products, banned products.
 *   4. When agent_slug resolves, intersect with that agent's visible catalog.
 *
 * Public route (no auth required) - recommendations are shown on public
 * agent storefronts and to anonymous researchers. Rate limited 60 req / IP / min.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ProductRow {
  id: string;
  name: string;
  slug: string | null;
  category: string | null;
  image_url: string | null;
  is_active: boolean | null;
  is_banned: boolean | null;
  unit_size: string | null;
  unit_measure: string | null;
}

interface AgentProductRow {
  product_id: string;
  retail_price: number | string | null;
  is_visible: boolean | null;
  is_on_sale?: boolean | null;
  sale_price?: number | string | null;
}

export async function GET(req: NextRequest) {
  // Rate limit by IP - public endpoint, 60/min.
  const ip = getClientIp(req);
  const rl = await rateLimit({
    key: 'storefront_recommendations',
    limit: 60,
    windowSeconds: 60,
    identifier: ip,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too Many Requests' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  const url = new URL(req.url);
  const productId = (url.searchParams.get('product_id') || '').trim();
  const agentSlug = (url.searchParams.get('agent_slug') || '').trim() || null;
  const limitParam = Number(url.searchParams.get('limit') || 6);
  const limit = Math.max(1, Math.min(24, Number.isFinite(limitParam) ? limitParam : 6));

  if (!productId || !UUID_RE.test(productId)) {
    return NextResponse.json({ error: 'Invalid product_id' }, { status: 400 });
  }

  try {
    const supabase = await createServiceClient();

    // Resolve agent_id when slug is provided.
    let agentId: string | null = null;
    if (agentSlug) {
      const { data: agentRow } = await supabase
        .from('agent_profiles')
        .select('id')
        .eq('slug', agentSlug.toLowerCase())
        .maybeSingle();
      agentId = (agentRow?.id as string | undefined) ?? null;
    }

    // 1) Get seed product details (to find category and name for deduplication)
    const { data: seedProduct } = await supabase
      .from('products')
      .select('id, name, category')
      .eq('id', productId)
      .maybeSingle();

    const seedCategory = seedProduct?.category;
    const seedName = seedProduct?.name;

    const candidateIds = new Set<string>();

    // 2) Always try to find BAC Water and put it FIRST
    try {
      const { data: bacWater } = await supabase
        .from('products')
        .select('id')
        .ilike('name', '%Bacteriostatic Water%')
        .limit(1)
        .maybeSingle();
      if (bacWater?.id && bacWater.id !== productId) {
        candidateIds.add(bacWater.id);
      }
    } catch {}

    // 3) Try co-purchase matrix (what people standardly research together)
    const fetchN = limit + 20; // Fetch extra to account for deduplication
    try {
      const { data: pairs, error: rpcErr } = await supabase.rpc(
        'get_copurchase_recommendations',
        { p_product_id: productId, p_limit: fetchN }
      );
      if (!rpcErr && Array.isArray(pairs)) {
        for (const row of pairs as Array<{ related_product_id: string }>) {
          if (row?.related_product_id && row.related_product_id !== productId) {
            candidateIds.add(row.related_product_id);
          }
        }
      }
    } catch {}

    // 4) Fallback to same category
    if (candidateIds.size < limit * 2 && seedCategory) {
      try {
        const { data: sameCat } = await supabase
          .from('products')
          .select('id')
          .eq('category', seedCategory)
          .neq('id', productId)
          .limit(fetchN);
        for (const row of sameCat ?? []) {
          if (row.id) candidateIds.add(row.id);
        }
      } catch {}
    }

    // 5) If we STILL don't have enough, fill from product_popular_60d.
    if (candidateIds.size < limit * 2) {
      try {
        const { data: pop } = await supabase
          .from('product_popular_60d')
          .select('product_id, units')
          .order('units', { ascending: false })
          .limit(fetchN + candidateIds.size);
        for (const row of (pop ?? []) as Array<{ product_id: string }>) {
          if (row.product_id && row.product_id !== productId) {
            candidateIds.add(row.product_id);
          }
        }
      } catch {}
    }

    const candidateArray = Array.from(candidateIds);

    if (candidateArray.length === 0) {
      return NextResponse.json({ recommendations: [] });
    }

    // 6) Get the names of the candidate products
    const { data: candidatesProducts } = await supabase
      .from('products')
      .select('name')
      .in('id', candidateArray);

    let candidateNames = Array.from(new Set(candidatesProducts?.map(p => p.name) || []));

    // Guarantee BAC water is at the very front
    const bacIdx = candidateNames.findIndex(n => {
      const lower = n.toLowerCase();
      // Match "bac water", "bac. water", "bacteriostatic water"
      return lower.includes('bacteriostatic water') || lower.replace(/\./g, '').includes('bac water');
    });
    if (bacIdx > -1) {
      const [bac] = candidateNames.splice(bacIdx, 1);
      candidateNames.unshift(bac);
    } else {
      // If it's completely missing from candidates, fetch its exact DB name to guarantee match
      try {
        const { data: bacQuery } = await supabase
          .from('products')
          .select('name')
          .or('name.ilike.%bacteriostatic water%,name.ilike.%bac%water%')
          .limit(1);
        
        if (bacQuery && bacQuery.length > 0 && bacQuery[0].name) {
          candidateNames.unshift(bacQuery[0].name);
        } else {
          // Absolute fallback just in case the DB is completely missing it
          candidateNames.unshift('Bac. Water');
        }
      } catch {
        candidateNames.unshift('Bac. Water');
      }
    }

    // 7) Fetch ALL variants for these candidate names
    const { data: allVariants } = await supabase
      .from('products')
      .select('id, name, slug, category, image_url, is_active, is_banned, unit_size, unit_measure')
      .in('name', candidateNames);

    // 8) If an agent is in play, intersect with their visible catalog
    const agentPriceMap = new Map<string, number>();
    const agentVisible = new Set<string>();
    if (agentId && allVariants?.length) {
      const { data: aps } = await supabase
        .from('agent_products')
        .select('product_id, retail_price, is_visible, is_on_sale, sale_price')
        .eq('agent_id', agentId)
        .in('product_id', allVariants.map(v => v.id));
      for (const ap of (aps ?? []) as AgentProductRow[]) {
        if (!ap?.product_id) continue;
        if (ap.is_visible === false) continue;
        agentVisible.add(ap.product_id);
        
        const raw = ap.is_on_sale && ap.sale_price != null
          ? Number(ap.sale_price)
          : Number(ap.retail_price);
        const perVial = Number.isFinite(raw) && raw > 0 ? raw / 10 : 0;
        if (perVial > 0) agentPriceMap.set(ap.product_id, perVial);
      }
    }

    // 9) Pick the best variant for each name (prefer 10mg, else smallest unit_size)
    const bestVariants = new Map<string, ProductRow>();
    for (const v of (allVariants || []) as ProductRow[]) {
      if (v.is_active === false || v.is_banned === true || v.id === productId) continue;
      if (agentId && !agentVisible.has(v.id)) continue;

      const existing = bestVariants.get(v.name);
      if (!existing) {
        bestVariants.set(v.name, v);
      } else {
        const sizeV = parseFloat(v.unit_size || '999');
        const sizeE = parseFloat(existing.unit_size || '999');
        
        // If the new one is 10mg and the existing is not, we immediately prefer the new one
        if (sizeV === 10 && sizeE !== 10) {
          bestVariants.set(v.name, v);
        } 
        // Otherwise, if the existing is NOT 10mg, we prefer the smallest size
        else if (sizeE !== 10 && sizeV < sizeE) {
          bestVariants.set(v.name, v);
        }
      }
    }

    // 10) Assemble final output preserving order
    const out: Array<{
      id: string;
      name: string;
      slug: string | null;
      category: string | null;
      image_url: string | null;
      retail_price?: number;
      unit_size: string | null;
      unit_measure: string | null;
    }> = [];

    for (const n of candidateNames) {
      if (out.length >= limit) break;
      // Never recommend the seed product itself
      if (seedName && n.toLowerCase() === seedName.toLowerCase()) continue;

      const best = bestVariants.get(n);
      if (!best) continue;

      out.push({
        id: best.id,
        name: best.name,
        slug: best.slug,
        category: best.category,
        image_url: best.image_url,
        unit_size: best.unit_size,
        unit_measure: best.unit_measure,
        ...(agentPriceMap.has(best.id) ? { retail_price: agentPriceMap.get(best.id)! } : {}),
      });
    }

    return NextResponse.json({ recommendations: out });
  } catch (err) {
    console.error('[storefront/recommendations] GET error:', err);
    return NextResponse.json({ recommendations: [] });
  }
}
