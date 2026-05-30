import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

/**
 * Wishlist route — thin wrapper over researcher_favorites.
 * GET returns enriched product rows. POST/DELETE accept { productId }.
 */
export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = await createServiceClient();

  const { data: profile } = await service
    .from('profiles')
    .select('referring_agent_id')
    .eq('id', user.id)
    .maybeSingle();
  const referringAgentId = profile?.referring_agent_id ?? null;

  const { data, error } = await service
    .from('researcher_favorites')
    .select('product_id, created_at, products:product_id(id, name, image_url, category, in_stock, unit_size, unit_measure, is_active, is_banned)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });

  type Row = {
    product_id: string;
    created_at: string;
    products: {
      id: string;
      name: string;
      image_url: string | null;
      category: string | null;
      in_stock: boolean | null;
      unit_size: string | null;
      unit_measure: string | null;
      is_active: boolean | null;
      is_banned: boolean | null;
    } | null;
  };
  const rows = (data as unknown as Row[]) ?? [];
  const productIds = rows.map(r => r.product_id);

  const priceMap = new Map<string, number>();
  if (referringAgentId && productIds.length > 0) {
    const { data: agentProducts } = await service
      .from('agent_products')
      .select('product_id, retail_price, is_on_sale, sale_price')
      .eq('agent_id', referringAgentId)
      .in('product_id', productIds);
    for (const ap of agentProducts ?? []) {
      const price = ap.is_on_sale && ap.sale_price != null ? Number(ap.sale_price) : Number(ap.retail_price);
      if (Number.isFinite(price) && price > 0) priceMap.set(ap.product_id, price);
    }
  }

  const items = rows
    .filter(r => r.products && r.products.is_active && !r.products.is_banned)
    .map(r => ({
      product_id: r.product_id,
      created_at: r.created_at,
      name: r.products!.name,
      image_url: r.products!.image_url,
      category: r.products!.category,
      in_stock: r.products!.in_stock,
      unit_size: r.products!.unit_size,
      unit_measure: r.products!.unit_measure,
      retail_price: priceMap.get(r.product_id) ?? null,
    }));

  return NextResponse.json({ items, ids: items.map(i => i.product_id) });
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const productId = typeof body?.productId === 'string' ? body.productId : null;
  if (!productId) return NextResponse.json({ error: 'Missing productId' }, { status: 400 });

  const service = await createServiceClient();
  const { error } = await service.from('researcher_favorites').upsert(
    { user_id: user.id, product_id: productId },
    { onConflict: 'user_id,product_id' }
  );

  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const productId = typeof body?.productId === 'string' ? body.productId : null;
  if (!productId) return NextResponse.json({ error: 'Missing productId' }, { status: 400 });

  const service = await createServiceClient();
  const { error } = await service.from('researcher_favorites').delete()
    .eq('user_id', user.id)
    .eq('product_id', productId);

  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  return NextResponse.json({ success: true });
}
