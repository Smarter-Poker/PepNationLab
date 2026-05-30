import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

/**
 * GET /api/storefront/recommendations
 *   ?product_id=<uuid>   required — the "seed" product the researcher is viewing
 *   ?agent_slug=<slug>   optional — when present, only recommend products the
 *                        agent actually sells; pull retail_price from agent_products
 *   ?limit=<int>         optional, default 6, capped at 24
 *
 * Strategy:
 *   1. Try the co-purchase matrix (get_copurchase_recommendations RPC).
 *   2. Fallback to product_popular_60d when there is no co-purchase data yet.
 *   3. Always filter out: seed product, inactive products, banned products.
 *   4. When agent_slug resolves, intersect with that agent's visible catalog.
 *
 * Public route (no auth required) — recommendations are shown on public
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
}

interface AgentProductRow {
  product_id: string;
  retail_price: number | string | null;
  is_visible: boolean | null;
  is_on_sale?: boolean | null;
  sale_price?: number | string | null;
}

export async function GET(req: NextRequest) {
  // Rate limit by IP — public endpoint, 60/min.
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

  // 1) Try co-purchase matrix. Fetch a few extras so post-filtering still
  //    leaves us at or above the requested limit.
  const fetchN = limit + 10;
  const candidateIds: string[] = [];
  try {
    const { data: pairs, error: rpcErr } = await supabase.rpc(
      'get_copurchase_recommendations',
      { p_product_id: productId, p_limit: fetchN }
    );
    if (!rpcErr && Array.isArray(pairs)) {
      for (const row of pairs as Array<{ related_product_id: string }>) {
        if (row?.related_product_id && row.related_product_id !== productId) {
          candidateIds.push(row.related_product_id);
        }
      }
    }
  } catch {
    // Best-effort — fall through to popular fallback.
  }

  // 2) If we don't have enough, fill from product_popular_60d.
  if (candidateIds.length < limit) {
    try {
      const { data: pop } = await supabase
        .from('product_popular_60d')
        .select('product_id, units')
        .order('units', { ascending: false })
        .limit(fetchN + candidateIds.length);
      for (const row of (pop ?? []) as Array<{ product_id: string }>) {
        if (
          row.product_id &&
          row.product_id !== productId &&
          !candidateIds.includes(row.product_id)
        ) {
          candidateIds.push(row.product_id);
        }
      }
    } catch {
      // Empty fallback is acceptable — we'll just return [].
    }
  }

  if (candidateIds.length === 0) {
    return NextResponse.json({ recommendations: [] });
  }

  // 3) Resolve product rows — filter active, non-banned, not the seed.
  const { data: productsRaw } = await supabase
    .from('products')
    .select('id, name, slug, category, image_url, is_active, is_banned')
    .in('id', candidateIds);
  const productMap = new Map<string, ProductRow>();
  for (const p of (productsRaw ?? []) as ProductRow[]) {
    if (!p) continue;
    if (p.is_active === false) continue;
    if (p.is_banned === true) continue;
    if (p.id === productId) continue;
    productMap.set(p.id, p);
  }

  // 4) If an agent is in play, intersect with their visible catalog and use
  //    their retail_price. Otherwise just use the master product info.
  const agentPriceMap = new Map<string, number>();
  const agentVisible = new Set<string>();
  if (agentId) {
    const { data: aps } = await supabase
      .from('agent_products')
      .select('product_id, retail_price, is_visible, is_on_sale, sale_price')
      .eq('agent_id', agentId)
      .in('product_id', Array.from(productMap.keys()));
    for (const ap of (aps ?? []) as AgentProductRow[]) {
      if (!ap?.product_id) continue;
      if (ap.is_visible === false) continue;
      agentVisible.add(ap.product_id);
      // retail_price is stored as a 10-pack price — divide by 10 for per-vial.
      const raw = ap.is_on_sale && ap.sale_price != null
        ? Number(ap.sale_price)
        : Number(ap.retail_price);
      const perVial = Number.isFinite(raw) && raw > 0 ? raw / 10 : 0;
      if (perVial > 0) agentPriceMap.set(ap.product_id, perVial);
    }
  }

  // 5) Preserve the candidate ordering (co-purchase first, then popular).
  const out: Array<{
    id: string;
    name: string;
    slug: string | null;
    category: string | null;
    image_url: string | null;
    retail_price?: number;
  }> = [];
  for (const cid of candidateIds) {
    if (out.length >= limit) break;
    const p = productMap.get(cid);
    if (!p) continue;
    if (agentId && !agentVisible.has(cid)) continue;
    out.push({
      id: p.id,
      name: p.name,
      slug: p.slug,
      category: p.category,
      image_url: p.image_url,
      ...(agentPriceMap.has(cid) ? { retail_price: agentPriceMap.get(cid)! } : {}),
    });
  }

  return NextResponse.json({ recommendations: out });
}
