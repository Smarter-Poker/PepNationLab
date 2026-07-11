import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { assertSameOrigin } from '@/lib/csrf';


/**
 * POST /api/storefront/search
 *
 * Public, server-side faceted search over a single agent's visible storefront
 * catalog. The client component (AgentStorefrontGrid) does facet filtering on
 * the SSR payload by default - this route is the same shape so the client can
 * fall through to the API once a catalog exceeds the SSR-friendly size.
 *
 * Body: {
 *   slug,              // required - agent_profiles.slug (case-insensitive)
 *   q?,                // free-text product name match
 *   category?,         // single category string
 *   minPrice?,         // numeric, retail_price >= minPrice
 *   maxPrice?,         // numeric, retail_price <= maxPrice
 *   inStock?,          // boolean - only products with positive agent stock
 *   bulk?,             // boolean - only products with admin_bulk_price NOT NULL
 *   minWeight?,        // numeric (oz)
 *   maxWeight?,        // numeric (oz)
 *   sort?,             // 'popular' | 'name_asc' | 'name_desc' | 'price_low' | 'price_high' | 'newest'
 *   limit?,            // 1..500, default 50
 * }
 *
 * Rate limited to 60 requests / IP / minute. Public - no auth required.
 * Returns 200 with { products: [] } when the slug does not resolve, so the
 * client never has to special-case 404 vs empty-catalog.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type SortKey =
  | 'popular'
  | 'name_asc'
  | 'name_desc'
  | 'price_low'
  | 'price_high'
  | 'newest';

interface SearchBody {
  slug?: unknown;
  q?: unknown;
  category?: unknown;
  minPrice?: unknown;
  maxPrice?: unknown;
  inStock?: unknown;
  bulk?: unknown;
  minWeight?: unknown;
  maxWeight?: unknown;
  sort?: unknown;
  limit?: unknown;
}

function asFiniteNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function asBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v === 'true' || v === '1';
  return false;
}

function asTrimmedString(v: unknown, maxLen = 200): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim().slice(0, maxLen);
  return t.length === 0 ? null : t;
}

function escapeIlike(text: string): string {
  // Escape PostgreSQL ILIKE special characters so user input cannot run wildcard
  // injections. Escapes: \ % _ and [ (POSIX character-class delimiter).
  // Also strip commas AND parentheses -- both are PostgREST .or() grammar: a comma
  // separates conditions and a ')' prematurely closes the or=(...) group. Neither
  // can be backslash-escaped inside the filter string, so a search term containing
  // them would corrupt the query (400/500). The query is still hard-scoped by
  // .eq('agent_id', ...) so this is query-integrity hardening, not a data leak.
  return text.replace(/[\\%_[]/g, m => `\\${m}`).replace(/[,()]/g, '');
}

const SORT_OPTIONS: ReadonlySet<SortKey> = new Set<SortKey>([
  'popular',
  'name_asc',
  'name_desc',
  'price_low',
  'price_high',
  'newest',
]);

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const ip = getClientIp(req);
  const limited = await rateLimit({
    key: 'storefront_search',
    limit: 60,
    windowSeconds: 60,
    identifier: ip,
  });
  if (!limited.allowed) {
    return NextResponse.json(
      { error: 'Too Many Requests. Please Wait And Try Again.' },
      { status: 429 }
    );
  }

  const body: SearchBody = await req.json().catch(() => ({}));

  const slug = asTrimmedString(body.slug);
  if (!slug) {
    return NextResponse.json(
      { error: 'Slug Is Required.' },
      { status: 400 }
    );
  }

  const q = asTrimmedString(body.q, 100);
  const category = asTrimmedString(body.category, 80);
  const minPrice = asFiniteNumber(body.minPrice);
  const maxPrice = asFiniteNumber(body.maxPrice);
  const inStock = asBool(body.inStock);
  const bulk = asBool(body.bulk);
  const minWeight = asFiniteNumber(body.minWeight);
  const maxWeight = asFiniteNumber(body.maxWeight);
  const sortRaw = asTrimmedString(body.sort, 24) as SortKey | null;
  const sort: SortKey = sortRaw && SORT_OPTIONS.has(sortRaw) ? sortRaw : 'popular';
  const limitRaw = asFiniteNumber(body.limit);
  const limit =
    limitRaw === null
      ? 50
      : Math.max(1, Math.min(500, Math.floor(limitRaw)));

  try {
    // Service client because this is a public route with no caller session.
    // RLS would otherwise hide most rows for an anonymous fetch.
    const supabase = await createServiceClient();

    // Vector/semantic search is disabled (no embedding provider configured).
    // Keyword ILIKE search is the active fallback.
    const matchedProductIds: string[] = [];

    // BUG 6 fix: use exact equality (with lowercase normalisation) instead of
    // .ilike() for slug resolution. ILIKE allows wildcard chars like _ and %,
    // which could match a different agent's slug. Slugs are stored lowercase.
    const { data: agent, error: agentErr } = await supabase
      .from('agent_profiles')
      .select('id, slug, is_active')
      .eq('slug', slug.toLowerCase())
      .maybeSingle();

    if (agentErr || !agent) {
      return NextResponse.json({ products: [], total: 0 }, { status: 200 });
    }
    if (agent.is_active === false) {
      return NextResponse.json({ products: [], total: 0 }, { status: 200 });
    }

    let query = supabase
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
        sort_order,
        created_at,
        products!inner (
          name,
          description,
          image_url,
          category,
          backorder_days,
          unit_size,
          unit_measure,
          weight_oz,
          inventory_count,
          low_stock_threshold,
          sku,
          admin_bulk_price,
          admin_bulk_threshold,
          is_active,
          is_banned
        )
      `)
      .eq('agent_id', agent.id)
      .eq('is_visible', true)
      .eq('products.is_active', true)
      .eq('products.is_banned', false);

    if (typeof minPrice === 'number') query = query.gte('retail_price', minPrice);
    if (typeof maxPrice === 'number') query = query.lte('retail_price', maxPrice);
    if (category) query = query.eq('products.category', category);
    if (q) {
      if (matchedProductIds.length > 0) {
        query = query.in('product_id', matchedProductIds);
      } else {
        const term = `%${escapeIlike(q)}%`;
        query = query.or(`name.ilike.${term},description.ilike.${term},category.ilike.${term}`, { foreignTable: 'products' });
      }
    }
    if (typeof minWeight === 'number')
      query = query.gte('products.weight_oz', minWeight);
    if (typeof maxWeight === 'number')
      query = query.lte('products.weight_oz', maxWeight);
    if (bulk) query = query.not('products.admin_bulk_price', 'is', null);

    switch (sort) {
      case 'name_asc':
        query = query.order('name', { foreignTable: 'products', ascending: true });
        break;
      case 'name_desc':
        query = query.order('name', { foreignTable: 'products', ascending: false });
        break;
      case 'price_low':
        query = query.order('retail_price', { ascending: true });
        break;
      case 'price_high':
        query = query.order('retail_price', { ascending: false });
        break;
      case 'newest':
        query = query.order('created_at', { ascending: false });
        break;
      case 'popular':
      default:
        query = query.order('sort_order', { ascending: true, nullsFirst: false });
        break;
    }

    query = query.limit(limit);

    const { data: rows, error } = await query;
    if (error) {
      return NextResponse.json(
        { error: 'Search Failed.', products: [], total: 0 },
        { status: 500 }
      );
    }

    // Inventory map for the inStock filter. agent_inventory is the canonical
    // per-agent count; we fall back to master inventory_count when the agent
    // hasn't received any stock yet.
    let inventoryByProductId: Record<string, number> = {};
    const productIds = (rows ?? [])
      .map(r => r.product_id)
      .filter((v): v is string => !!v);
    if (productIds.length > 0) {
      const { data: inv } = await supabase
        .from('agent_inventory')
        .select('product_id, stock_count')
        .eq('agent_id', agent.id)
        .in('product_id', productIds);
      inventoryByProductId = Object.fromEntries(
        (inv ?? []).map(r => [r.product_id, Number(r.stock_count ?? 0)])
      );
    }

    let products = rows ?? [];
    if (inStock) {
      products = products.filter(p => {
        const localCount = Number(inventoryByProductId[p.product_id] ?? 0);
        const masterRaw = (p as { products: unknown }).products;
        const master = Array.isArray(masterRaw) ? masterRaw[0] : masterRaw;
        const masterCount = Number(
          (master as { inventory_count?: number } | undefined)?.inventory_count ?? 0
        );
        return localCount > 0 || masterCount > 0;
      });
    }

    // Scrub private/internal fields before returning - these were needed for
    // server-side filtering (bulk, inStock) but must not be exposed publicly.
    const publicProducts = products.map(p => {
      const productsRaw = (p as { products: unknown }).products;
      const scrubProduct = (prod: unknown) => {
        if (prod && typeof prod === 'object') {
          const { admin_bulk_price, admin_bulk_threshold, inventory_count, low_stock_threshold, ...rest } = prod as Record<string, unknown>;
          void admin_bulk_price; void admin_bulk_threshold; void inventory_count; void low_stock_threshold;
          return rest;
        }
        return prod;
      };
      return {
        ...p,
        products: Array.isArray(productsRaw)
          ? productsRaw.map(scrubProduct)
          : scrubProduct(productsRaw),
      };
    });

    return NextResponse.json(
      {
        products: publicProducts,
        total: publicProducts.length,
        agent: { id: agent.id, slug: agent.slug },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('[storefront/search] POST error:', err);
    return NextResponse.json(
      { error: 'Search Failed.', products: [], total: 0 },
      { status: 500 }
    );
  }
}
