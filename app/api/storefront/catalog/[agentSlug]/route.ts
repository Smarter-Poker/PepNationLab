import { NextRequest, NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/server';
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
 *   - compound research data (compounds table, cached 1h via unstable_cache
 *     in lib/compounds-server.ts under the 'compounds' tag)
 *
 * What is NOT included (remains SSR-only, user-specific):
 *   - wishlist IDs  (researcher_favorites)
 *   - agent-owner cost pricing  (computeAgentCostForAgent)
 *   - auth state / access gating
 *
 * Cache strategy:
 *   - Origin: the whole payload assembly runs inside unstable_cache (Next.js
 *     Data Cache), keyed by slug, revalidate 120s, tagged with
 *     'storefront-catalog' + 'catalog:<slug>'. Every catalog-affecting
 *     mutation route calls revalidateTag on these tags, so the 120s window
 *     is a safety net, not the freshness mechanism.
 *   - Edge/CDN: s-maxage=60 + stale-while-revalidate=300 response headers
 *     (kept short so tag purges become visible quickly).
 *   - Client: localStorage via lib/storefront-cache.ts (10 min TTL) plus
 *     Supabase Realtime for interactive freshness.
 *
 * This route uses the SERVICE-ROLE client on purpose: it never reads cookies
 * or auth state, so the response is structurally incapable of containing
 * per-user data - required for the `public` Cache-Control header, and it
 * saves a per-request auth round-trip.
 *
 * Public route - no auth required. Rate limited 120/min/IP.
 */

export const dynamic = 'force-dynamic'; // prevents static generation, allows edge caching
export const runtime = 'nodejs';

const SLUG_RE = /^[a-z0-9-]{1,80}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Discriminated result so the cached function can distinguish "definitively
// absent / paused" (cacheable states) from transient DB failures (which are
// THROWN so unstable_cache never stores them).
type CatalogResult =
  | { kind: 'not_found' }
  | { kind: 'paused' }
  | { kind: 'ok'; payload: StorefrontCatalogPayload };

/**
 * Assembles the full catalog payload for one agent slug.
 *
 * unstable_cache constraints honored here:
 *   - never touches cookies()/headers() (service client only)
 *   - every dynamic input arrives as the `agentSlug` argument
 *   - the Supabase client is constructed INSIDE the function, so nothing
 *     request-scoped leaks into the cached closure
 * The rate limiter stays in the route handler, outside the cached section.
 */
async function buildCatalogPayload(agentSlug: string): Promise<CatalogResult> {
  const supabase = await createServiceClient();

  // ── 1. Resolve agent ────────────────────────────────────────────────────────
  // Use .eq() not .ilike() - slugs are lowercase; .ilike() on a user-supplied
  // URL param allows underscore-wildcard matching to wrong storefronts.
  const { data: agent, error: agentError } = await supabase
    .from('agent_profiles')
    .select('id, slug, primary_color, is_active')
    .eq('slug', agentSlug)
    .maybeSingle();

  // A transient DB failure must not be cached as a 404 for the revalidate
  // window - throw so unstable_cache discards this run.
  if (agentError) {
    throw new Error(`[catalog api] Error resolving agent: ${agentError.message}`);
  }

  if (!agent) {
    return { kind: 'not_found' };
  }

  if (agent.is_active === false) {
    return { kind: 'paused' };
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
          inventory_count,
          backorder_days,
          unit_size,
          unit_measure,
          weight_oz,
          compound_slug
        )
      `)
      .eq('agent_id', agent.id)
      .eq('is_visible', true)
      .order('sort_order', { nullsFirst: false })
      .limit(250),

    supabase
      .rpc('agent_inventory_for_storefront', { p_slug: agentSlug }),
  ]);

  if (productsResult.error) {
    throw new Error(`[catalog api] Error fetching products: ${productsResult.error.message}`);
  }

  if (inventoryResult.error) {
    throw new Error(`[catalog api] Error fetching inventory: ${inventoryResult.error.message}`);
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
      .select('product_id, lot_number, coa_storage_key, received_at')
      .in('product_id', productIds)
      .eq('is_active', true)
      .not('coa_verified_at', 'is', null)
      .is('coa_retracted_at', null)
      .is('superseded_by', null)
      .order('received_at', { ascending: false });

    for (const row of lots ?? []) {
      if (coaByProductId[row.product_id]) continue; // keep newest
      if (row.coa_storage_key) {
        const { data: pub } = supabase.storage
          .from('product-coas')
          .getPublicUrl(row.coa_storage_key);
        if (pub?.publicUrl) { coaByProductId[row.product_id] = pub.publicUrl; continue; }
      }
      // No storage file — link to the COA detail page by lot number
      if (row.lot_number) {
        coaByProductId[row.product_id] = `/coa?lot=${encodeURIComponent(row.lot_number)}`;
      }
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

  return { kind: 'ok', payload };
}

/**
 * Data-Cache wrapper around buildCatalogPayload. The wrapper is constructed
 * per-request so each slug gets its own cache entry AND its own tag
 * ('catalog:<slug>') alongside the global 'storefront-catalog' tag - tags
 * must be known at registration time, and the slug is a request value.
 * The slug is included in the key parts, so the closure capture is safe.
 */
function getCachedCatalog(agentSlug: string): Promise<CatalogResult> {
  return unstable_cache(
    () => buildCatalogPayload(agentSlug),
    ['storefront-catalog', agentSlug],
    {
      revalidate: 120,
      tags: ['storefront-catalog', 'catalog:' + agentSlug],
    }
  )();
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ agentSlug: string }> }
) {
  const { agentSlug } = await params;

  // Validate slug
  if (!agentSlug || !SLUG_RE.test(agentSlug)) {
    return NextResponse.json({ error: 'Invalid agent slug' }, { status: 400 });
  }

  // Rate limit - catalog is called on every storefront visit.
  // Deliberately OUTSIDE the cached section: it reads the request IP.
  const ip = getClientIp(req);
  const rl = await rateLimit({ key: 'storefront_catalog', limit: 120, windowSeconds: 60, identifier: ip });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  }

  let result: CatalogResult;
  try {
    result = await getCachedCatalog(agentSlug);
  } catch (err) {
    // Transient DB failure - thrown (not cached) by buildCatalogPayload.
    console.error('[catalog api] Catalog assembly failed:', err);
    return NextResponse.json({ error: 'Failed to fetch catalog' }, { status: 500 });
  }

  if (result.kind === 'not_found') {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  if (result.kind === 'paused') {
    return NextResponse.json({ error: 'Storefront is paused' }, { status: 403 });
  }

  return NextResponse.json(result.payload, {
    headers: {
      // Origin data cache is tag-purged on mutations (see the
      // 'storefront-catalog' / 'catalog:<slug>' revalidateTag calls in the
      // product/pricing/inventory/storefront-config routes). The edge layer
      // is kept short (60s) so purges become visible quickly; client
      // localStorage + Supabase Realtime handle interactive freshness.
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      // CORS: restrict to our own origin - the wildcard (*) combined with a service-role
      // client is a security liability if this SELECT is ever expanded to include sensitive fields.
      'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_APP_URL ?? 'https://pepnationlab.com',
      'Vary': 'Accept-Encoding',
    },
  });
}
