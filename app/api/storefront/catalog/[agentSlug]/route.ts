import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { getCompoundsBySlugs } from '@/lib/compounds-server';
import type { StorefrontCatalogPayload } from '@/lib/storefront-cache';

/**
 * GET /api/storefront/catalog/[agentSlug]
 *
 * Returns all non-sensitive storefront data in a single, server-cached response:
 *   - product list (agent_products + joined products fields)
 *   - inventory map (approximate, from agent_inventory_for_storefront RPC)
 *   - COA URLs (product_lots)
 *   - compound research data (compounds table, already cached 1h via unstable_cache)
 *
 * What is NOT included (remains SSR-only, user-specific):
 *   - wishlist IDs  (researcher_favorites)
 *   - agent-owner cost pricing  (computeAgentCostForAgent)
 *   - auth state / access gating
 *
 * Cache strategy:
 *   - Server: next.js Data Cache revalidation 300s (5 min) via `next: { revalidate: 300 }`
 *     on the Supabase fetch calls (not applicable here since we use service client).
 *     The route itself sets s-maxage=300 + stale-while-revalidate=600 headers so
 *     Vercel's edge cache and the service worker can both cache it.
 *   - Client: localStorage via lib/storefront-cache.ts (10 min TTL).
 *   - Service Worker: intercepts this URL and applies cache-first strategy.
 *
 * Public route - no auth required. Rate limited 120/min/IP.
 */

export const dynamic = 'force-dynamic'; // prevents static generation, allows edge caching
export const runtime = 'nodejs';

const SLUG_RE = /^[a-z0-9-]{1,80}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ agentSlug: string }> }
) {
  const { agentSlug } = await params;

  // Validate slug
  if (!agentSlug || !SLUG_RE.test(agentSlug)) {
    return NextResponse.json({ error: 'Invalid agent slug' }, { status: 400 });
  }

  // Rate limit - catalog is called on every storefront visit
  const ip = getClientIp(req);
  const rl = await rateLimit({ key: 'storefront_catalog', limit: 120, windowSeconds: 60, identifier: ip });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  }

  const supabase = await createClient();

  // ── 1. Resolve agent ────────────────────────────────────────────────────────
  // Use .eq() not .ilike() - slugs are lowercase; .ilike() on a user-supplied
  // URL param allows underscore-wildcard matching to wrong storefronts.
  const { data: agent } = await supabase
    .from('agent_profiles')
    .select('id, slug, primary_color, is_active')
    .eq('slug', agentSlug)
    .maybeSingle();

  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  if (agent.is_active === false) {
    return NextResponse.json({ error: 'Storefront is paused' }, { status: 403 });
  }

  // ── 2. Fetch products, inventory, COAs in parallel ──────────────────────────
  const [productsResult, inventoryResult] = await Promise.all([
    supabase
      .from('agent_products')
      .select(`
        id,
        product_id,
        custom_name,
        custom_description,
        custom_image_url,
        retail_price,
        is_on_sale,
        sale_price,
        products (
          name,
          description,
          image_url,
          category,
          backorder_days,
          unit_size,
          unit_measure,
          weight_oz,
          compound_slug
        )
      `)
      .eq('agent_id', agent.id)
      .eq('is_visible', true)
      .order('sort_order', { nullsFirst: false }),

    supabase
      .rpc('agent_inventory_for_storefront', { p_slug: agentSlug }),
  ]);

  if (productsResult.error) {
    console.error('[catalog api] Error fetching products:', productsResult.error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }

  if (inventoryResult.error) {
    console.error('[catalog api] Error fetching inventory:', inventoryResult.error);
    return NextResponse.json({ error: 'Failed to fetch inventory' }, { status: 500 });
  }

  const products = productsResult.data ?? [];
  const inventory = inventoryResult.data as Array<{ product_id: string; stock_count: number }> | null;

  // ── 3. COA URLs - only if we have product IDs ───────────────────────────────
  const productIds = products
    .map((p) => p.product_id)
    .filter((v): v is string => !!v && UUID_RE.test(v));

  const coaByProductId: Record<string, string> = {};
  if (productIds.length > 0) {
    const { data: lots } = await supabase
      .from('product_lots')
      .select('product_id, coa_storage_key, received_at')
      .in('product_id', productIds)
      .eq('is_active', true)
      .not('coa_storage_key', 'is', null)
      .order('received_at', { ascending: false });

    for (const row of lots ?? []) {
      if (!row.coa_storage_key) continue;
      if (coaByProductId[row.product_id]) continue; // keep newest
      const { data: pub } = supabase.storage
        .from('product-coas')
        .getPublicUrl(row.coa_storage_key);
      if (pub?.publicUrl) coaByProductId[row.product_id] = pub.publicUrl;
    }
  }

  // ── 4. Compound data (already cached 1h by getCompoundsBySlugs) ─────────────
  const compoundSlugs = products
    .map((p) => (p.products as { compound_slug?: string | null })?.compound_slug)
    .filter((s): s is string => typeof s === 'string' && s.length > 0);

  const compoundsBySlug = await getCompoundsBySlugs(compoundSlugs);

  // ── 5. Build inventory map ───────────────────────────────────────────────────
  const inventoryMap: Record<string, number> = {};
  for (const row of inventory ?? []) {
    inventoryMap[row.product_id] = row.stock_count;
  }

  // ── 6. Assemble payload ──────────────────────────────────────────────────────
  const payload: StorefrontCatalogPayload = {
    agentSlug: agent.slug,
    primaryColor: agent.primary_color ?? '#00E5FF',
    products: products as unknown as StorefrontCatalogPayload['products'],
    inventoryMap,
    coaByProductId,
    compoundsBySlug,
    fetchedAt: Date.now(),
  };

  return NextResponse.json(payload, {
    headers: {
      // Vercel edge + CDN: serve stale for 5 min, allow SWR for 10 min
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      // CORS: restrict to our own origin - the wildcard (*) combined with a service-role
      // client is a security liability if this SELECT is ever expanded to include sensitive fields.
      'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_APP_URL ?? 'https://pepnationlab.com',
      'Vary': 'Accept-Encoding',
    },
  });
}
