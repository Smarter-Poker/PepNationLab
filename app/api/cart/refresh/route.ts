import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * Re-resolves cart items against the live catalog. Returns, per requested
 * agent_product id, the current retail_price and admin bulk pricing so the
 * client can update its local cart, and flags any item that is no longer
 * available (deleted, deactivated, or banned) so the client can drop it.
 *
 * Public endpoint — no auth required. We only echo the rows the caller
 * already references (anonymous shoppers must be able to see live prices on
 * the storefront), and we never reveal cost prices.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Two query modes:
    // 1. agentProductIds: agent_products.id UUIDs (used by agent dashboard)
    // 2. productIds: master products.id UUIDs (used by CartContext main catalog path)
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

    // Build the query: either by agent_products.id or by product_id depending on mode.
    const query = supabase
      .from('agent_products')
      .select(`
        id,
        retail_price,
        is_visible,
        product_id,
        products:product_id ( id, name, is_banned, is_active, admin_bulk_price, admin_bulk_threshold )
      `);

    const { data: rows, error } = agentProductIds.length > 0
      ? await query.in('id', requestedIds)
      : await query.in('product_id', requestedIds);

    if (error) {
      console.error('Cart Refresh Error:', error);
      return NextResponse.json({ error: 'Failed To Refresh Cart.' }, { status: 500 });
    }

    const items = (rows ?? []).map((row: any) => {
      const product = Array.isArray(row.products) ? row.products[0] : row.products;
      const available =
        !!product &&
        product.is_banned === false &&
        product.is_active !== false &&
        row.is_visible !== false;

      return {
        id: row.id as string,
        productId: (product?.id ?? row.product_id) as string | null,
        name: product?.name ?? null,
        retailPrice: Number(row.retail_price) || 0,
        bulkCostPrice:
          product?.admin_bulk_price != null ? Number(product.admin_bulk_price) : null,
        bulkThreshold:
          product?.admin_bulk_threshold != null ? Number(product.admin_bulk_threshold) : null,
        available,
      };
    });

    const presentIds = new Set(items.map(i => i.id));
    const missing = requestedIds.filter(id => !presentIds.has(id));

    return NextResponse.json({ items, missing });
  } catch (err) {
    console.error('Cart Refresh Exception:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
