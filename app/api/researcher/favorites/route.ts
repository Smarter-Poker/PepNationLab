
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = await createServiceClient();
  
  // 1. Get the user's referring agent
  const { data: profile } = await service
    .from('profiles')
    .select('referring_agent_id')
    .eq('id', user.id)
    .maybeSingle();
  const referringAgentId = profile?.referring_agent_id;

  // 2. Fetch Favorites
  const { data: favRows } = await service
    .from('researcher_favorites')
    .select('product_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  // 3. Fetch Past Orders
  const { data: orderRows } = await service
    .from('orders')
    .select('created_at, order_items(product_id)')
    .eq('buyer_id', user.id)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false });

  // 4. Collect Product IDs
  const favIds = new Set<string>();
  const favDates = new Map<string, string>();
  for (const r of favRows ?? []) {
    if (r.product_id) {
      favIds.add(r.product_id);
      favDates.set(r.product_id, r.created_at);
    }
  }
  
  const orderIds = new Set<string>();
  const pastOrderDates = new Map<string, string>();
  for (const o of orderRows ?? []) {
    const items = o.order_items as { product_id: string }[];
    for (const item of items ?? []) {
      if (item.product_id && !pastOrderDates.has(item.product_id)) {
        pastOrderDates.set(item.product_id, o.created_at); // @ts-ignore
        orderIds.add(item.product_id);
      }
    }
  }

  const allProductIds = Array.from(new Set([...favIds, ...orderIds]));
  
  if (allProductIds.length === 0) {
    return NextResponse.json({ favorites: [], pastOrders: [] });
  }

  // 5. Fetch Products
  const { data: products } = await service
    .from('products')
    .select('id, name, image_url, category, base_cost, in_stock, is_active')
    .in('id', allProductIds);

  const productsMap = new Map((products ?? []).map(p => [p.id, p]));

  // 6. Fetch Prices
  const priceMap = new Map<string, number>();
  if (referringAgentId) {
    const { data: agentProducts } = await service
      .from('agent_products')
      .select('product_id, retail_price, is_on_sale, sale_price')
      .eq('agent_id', referringAgentId)
      .in('product_id', allProductIds);
      
    for (const ap of agentProducts ?? []) {
      const rawPrice = ap.is_on_sale && ap.sale_price != null ? Number(ap.sale_price) : Number(ap.retail_price);
      const price = rawPrice / 10; // convert 10-pack price to per-vial
      if (Number.isFinite(price) && price > 0) priceMap.set(ap.product_id, price);
    }
  }

  // 7. Format Responses
  const mapToSchema = (id: string, date: string) => {
    const p = productsMap.get(id);
    if (!p || !p.is_active) return null;
    const finalPrice = priceMap.get(id) ?? p.base_cost ?? 0;
    
    return {
      product_id: id,
      created_at: date,
      products: {
        id: p.id,
        name: p.name,
        image_url: p.image_url,
        category: p.category,
        is_active: p.is_active,
        base_price: finalPrice // Client expects base_price
      }
    };
  };

  const formattedFavorites = Array.from(favIds)
    .map(id => mapToSchema(id, favDates.get(id)!))
    .filter(Boolean)
    .sort((a, b) => new Date(b!.created_at).getTime() - new Date(a!.created_at).getTime());

  const formattedPastOrders = Array.from(orderIds)
    .map(id => mapToSchema(id, pastOrderDates.get(id)!))
    .filter(Boolean)
    .sort((a, b) => new Date(b!.created_at).getTime() - new Date(a!.created_at).getTime());

  return NextResponse.json({ 
    favorites: formattedFavorites,
    pastOrders: formattedPastOrders
  });
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { productId } = body;
  
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (typeof productId !== 'string' || !UUID_RE.test(productId)) {
    return NextResponse.json({ error: 'Invalid productId' }, { status: 400 });
  }

  const service = await createServiceClient();
  
  const { count } = await service
    .from('researcher_favorites')
    .select('product_id', { count: 'exact', head: true })
    .eq('user_id', user.id);
    
  if ((count ?? 0) >= 200) {
    return NextResponse.json({ error: 'Favorites limit reached (200)' }, { status: 429 });
  }

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
  const { productId } = body;
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (typeof productId !== 'string' || !UUID_RE.test(productId)) {
    return NextResponse.json({ error: 'Invalid productId' }, { status: 400 });
  }

  const service = await createServiceClient();
  const { error } = await service.from('researcher_favorites').delete()
    .eq('user_id', user.id)
    .eq('product_id', productId);

  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  return NextResponse.json({ success: true });
}
