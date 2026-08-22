import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireManufacturer } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/manufacturer/overview
 *
 * Everything the manufacturer dashboard renders in one round trip:
 * profile + store identity, the full catalog with their private cost,
 * recent orders (they fulfill every one), and the commission ledger with
 * all-time / 30-day aggregates.
 *
 * Manufacturer-only (requireManufacturer). Every query is scoped to the
 * caller's own id.
 */
export async function GET() {
  const gate = await requireManufacturer();
  if (!gate.ok) return gate.response;

  try {
    const supabase = await createServiceClient();
    const manufacturerId = gate.user.id;

    const [profileRes, storeRes, productsRes, ordersRes, ledgerRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('username, full_name, locale, manufacturer_commission_pct, is_manufacturer, is_admin_account')
        .eq('id', manufacturerId)
        .maybeSingle(),
      supabase
        .from('agent_profiles')
        .select('slug, display_name, is_active')
        .eq('id', manufacturerId)
        .maybeSingle(),
      supabase
        .from('agent_products')
        .select(`
          id, product_id, retail_price, manufacturer_cost, is_visible, is_on_sale, sale_price, sort_order, custom_name,
          products (name, unit_size, unit_measure, category, image_url, is_active, is_banned)
        `)
        .eq('agent_id', manufacturerId)
        .order('sort_order', { ascending: true }),
      supabase
        .from('orders')
        .select('id, created_at, status, buyer_name, subtotal, shipping_cost, total, fulfillment_method, payment_method, shipping_address, order_items (product_name, quantity, unit_retail_price)')
        .eq('agent_id', manufacturerId)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('manufacturer_ledger')
        .select('id, order_id, product_subtotal, commission_base, commission_pct, platform_commission, manufacturer_net, shipping_collected, voided_at, created_at')
        .eq('manufacturer_id', manufacturerId)
        .order('created_at', { ascending: false })
        .limit(1000),
    ]);

    if (!profileRes.data) {
      return NextResponse.json({ error: 'Profile Not Found.' }, { status: 404 });
    }

    const products = (productsRes.data ?? [])
      .filter((ap) => {
        const p = ap.products as { is_active?: boolean | null; is_banned?: boolean | null } | null;
        return p && p.is_active !== false && p.is_banned !== true;
      })
      .map((ap) => {
        const p = (ap.products as any as Record<string, unknown>) ?? {};
        return {
          id: ap.id as string,
          productId: ap.product_id as string,
          name: (ap.custom_name as string | null) || (p.name as string) || 'Product',
          unitSize: (p.unit_size as string | null) ?? null,
          unitMeasure: (p.unit_measure as string | null) ?? null,
          category: (p.category as string | null) ?? null,
          imageUrl: (p.image_url as string | null) ?? null,
          retailPrice: ap.retail_price != null ? Number(ap.retail_price) : null,
          manufacturerCost: ap.manufacturer_cost != null ? Number(ap.manufacturer_cost) : null,
          isVisible: ap.is_visible !== false,
        };
      });

    const orders = (ordersRes.data ?? []).map((o) => ({
      id: o.id as string,
      createdAt: o.created_at as string,
      status: o.status as string,
      buyerName: (o.buyer_name as string | null) ?? null,
      subtotal: Number(o.subtotal) || 0,
      shippingCost: Number(o.shipping_cost) || 0,
      total: Number(o.total) || 0,
      fulfillmentMethod: (o.fulfillment_method as string | null) ?? null,
      paymentMethod: (o.payment_method as string | null) ?? null,
      shippingAddress: (o.shipping_address as Record<string, unknown> | null) ?? null,
      items: ((o.order_items as Array<Record<string, unknown>> | null) ?? []).map((it) => ({
        name: (it.product_name as string) ?? 'Product',
        quantity: Number(it.quantity) || 0,
        unitPrice: Number(it.unit_retail_price) || 0,
      })),
    }));

    const ledgerRows = (ledgerRes.data ?? []).map((r) => ({
      id: r.id as string,
      orderId: r.order_id as string,
      productSubtotal: Number(r.product_subtotal) || 0,
      commissionBase: Number(r.commission_base) || 0,
      commissionPct: Number(r.commission_pct) || 0,
      platformCommission: Number(r.platform_commission) || 0,
      manufacturerNet: Number(r.manufacturer_net) || 0,
      shippingCollected: Number(r.shipping_collected) || 0,
      voided: r.voided_at != null,
      createdAt: r.created_at as string,
    }));

    const sum = (rows: typeof ledgerRows) => rows.reduce(
      (acc, r) => ({
        sales: Math.round((acc.sales + r.commissionBase) * 100) / 100,
        commission: Math.round((acc.commission + r.platformCommission) * 100) / 100,
        net: Math.round((acc.net + r.manufacturerNet) * 100) / 100,
        shipping: Math.round((acc.shipping + r.shippingCollected) * 100) / 100,
      }),
      { sales: 0, commission: 0, net: 0, shipping: 0 },
    );

    const active = ledgerRows.filter((r) => !r.voided);
    const cutoff30 = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const active30 = active.filter((r) => new Date(r.createdAt).getTime() >= cutoff30);

    return NextResponse.json({
      profile: {
        username: profileRes.data.username as string | null,
        fullName: profileRes.data.full_name as string | null,
        locale: (profileRes.data.locale as string | null) ?? null,
        commissionPct: Number(profileRes.data.manufacturer_commission_pct) || 10,
        slug: (storeRes.data?.slug as string | null) ?? null,
        displayName: (storeRes.data?.display_name as string | null) ?? null,
        storeActive: storeRes.data?.is_active !== false,
        isAdminAccount: profileRes.data.is_admin_account === true,
        isManufacturer: profileRes.data.is_manufacturer === true,
      },
      products,
      orders,
      ledger: {
        rows: ledgerRows.slice(0, 200),
        totals: sum(active),
        totals30: sum(active30),
      },
    });
  } catch (err) {
    console.error('[manufacturer/overview] GET error:', err);
    return NextResponse.json({ error: 'An Unexpected Error Occurred.' }, { status: 500 });
  }
}
