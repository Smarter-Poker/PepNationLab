import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

/**
 * Re-resolves cart items against the live catalog. Returns, per requested
 * agent_product id, the current retail_price and admin bulk pricing so the
 * client can update its local cart, and flags any item that is no longer
 * available (deleted, deactivated, or banned) so the client can drop it.
 *
 * Public endpoint - no auth required. We only echo the rows the caller
 * already references (anonymous shoppers must be able to see live prices on
 * the storefront), and we never reveal cost prices.
 *
 * fix-47: rate-limited per IP (120/min). Generous enough that a real shopper
 * with a busy cart never trips it; protects against a runaway client that
 * would otherwise repeat-poll the catalog forever.
 */
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const ip = getClientIp(req);
  const limited = await rateLimit({
    key: 'cart_refresh',
    limit: 120,
    windowSeconds: 60,
    identifier: ip,
  });
  if (!limited.allowed) {
    return NextResponse.json({ error: 'Rate Limit Exceeded' }, { status: 429 });
  }

  try {
    const body = await req.json();

    const agentProductIds = Array.isArray(body?.agentProductIds)
      ? (body.agentProductIds as unknown[]).filter((v): v is string => typeof v === 'string').slice(0, 200)
      : [];
    const productIds = Array.isArray(body?.productIds)
      ? (body.productIds as unknown[]).filter((v): v is string => typeof v === 'string').slice(0, 200)
      : [];

    const requestedIds = agentProductIds.length > 0 ? agentProductIds : productIds;

    if (requestedIds.length === 0) {
      return NextResponse.json({ items: [] });
    }

    const supabase = await createServiceClient();

    const SELECT = `
        id,
        retail_price,
        is_on_sale,
        sale_price,
        is_visible,
        product_id,
        products:product_id ( id, name, is_banned, is_active, admin_bulk_price, admin_bulk_threshold )
      `;

    // Cart items can be keyed by EITHER the agent_product id (by-name / quick-add
    // paths via /api/cart/resolve-name) OR the underlying product_id (reorder /
    // research catalog paths). The client cannot know which convention a given
    // item uses, so it sends the raw ids and we resolve against BOTH columns.
    // Matching only one column was the root cause of "Item Removed" wiping
    // freshly-added items - most visibly on mobile, where the storefront grid
    // (which keeps its own internal cart) is not mounted and the global
    // CartContext add path keys items by agent_product id.
    let rows: any[] | null = null;
    if (agentProductIds.length > 0) {
      const { data, error } = await supabase
        .from('agent_products')
        .select(SELECT)
        .in('id', requestedIds);
      if (error) {
        console.error('Cart Refresh Error:', error);
        return NextResponse.json({ error: 'Failed To Refresh Cart.' }, { status: 500 });
      }
      rows = data;
    } else {
      // Two parameterized .in() queries (one per column) merged + de-duped by
      // agent_product id. Avoids building a raw PostgREST .or() filter string
      // from caller-supplied ids (injection-safe).
      const [byId, byProduct] = await Promise.all([
        supabase.from('agent_products').select(SELECT).in('id', requestedIds),
        supabase.from('agent_products').select(SELECT).in('product_id', requestedIds),
      ]);
      if (byId.error || byProduct.error) {
        console.error('Cart Refresh Error:', byId.error || byProduct.error);
        return NextResponse.json({ error: 'Failed To Refresh Cart.' }, { status: 500 });
      }
      const merged = new Map<string, any>();
      for (const r of [...(byId.data ?? []), ...(byProduct.data ?? [])]) {
        if (!merged.has(r.id)) merged.set(r.id, r);
      }
      rows = Array.from(merged.values());
    }

    const items = (rows ?? []).map((row: any) => {
      const product = Array.isArray(row.products) ? row.products[0] : row.products;
      const available =
        !!product &&
        product.is_banned === false &&
        product.is_active !== false &&
        row.is_visible !== false;

      // Honor sale pricing: when the agent_product is on sale, the effective
      // retail price is sale_price. Omitting this made the refresh contract snap
      // sale items back to full retail whenever the client applied the result.
      const regularRetail = (Number(row.retail_price) || 0) / 10;
      const isOnSale = row.is_on_sale === true && row.sale_price != null;
      const salePrice = isOnSale ? (Number(row.sale_price) || 0) / 10 : null;
      const effectiveRetail = isOnSale && salePrice != null ? salePrice : regularRetail;

      return {
        id: row.id as string,
        productId: (product?.id ?? row.product_id) as string | null,
        name: product?.name ?? null,
        retailPrice: effectiveRetail,
        isOnSale,
        salePrice,
        bulkCostPrice:
          product?.admin_bulk_price != null ? Number(product.admin_bulk_price) / 10 : null,
        bulkThreshold:
          product?.admin_bulk_threshold != null ? Number(product.admin_bulk_threshold) : null,
        available,
      };
    });

    // An id is "present" if it matches a returned agent_product id OR its
    // underlying product_id, since the cart may reference either.
    const presentIds = new Set<string>();
    for (const i of items) {
      presentIds.add(i.id);
      if (i.productId) presentIds.add(i.productId);
    }
    const missing = requestedIds.filter(id => !presentIds.has(id));

    return NextResponse.json({ items, missing });
  } catch (err) {
    console.error('Cart Refresh Exception:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
