import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getEffectiveUser } from '@/lib/impersonation';
import { assertSameOrigin } from '@/lib/csrf';
import { rateLimit } from '@/lib/rate-limit';

/** GET: list current user's recently viewed products with best-effort retail price */
export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await getEffectiveUser(supabase);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = await createServiceClient();

  const { data: profile } = await service
    .from('profiles')
    .select('referring_agent_id')
    .eq('id', user.id)
    .maybeSingle();
  const referringAgentId = profile?.referring_agent_id ?? null;

  const { data, error } = await service
    .from('researcher_recently_viewed')
    .select('product_id, agent_id, viewed_at, products:product_id(id, name, image_url, category, in_stock, unit_size, unit_measure, is_active, is_banned)')
    .eq('user_id', user.id)
    .order('viewed_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });

  type Row = {
    product_id: string;
    agent_id: string | null;
    viewed_at: string;
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
      agent_id: r.agent_id,
      viewed_at: r.viewed_at,
      name: r.products!.name,
      imageUrl: r.products!.image_url,
      category: r.products!.category,
      inStock: r.products!.in_stock,
      unit_size: r.products!.unit_size,
      unit_measure: r.products!.unit_measure,
      retail_price: priceMap.get(r.product_id) ?? null,
    }));

  return NextResponse.json({ items });
}

/** POST { productId, agentId? }: upsert a recently-viewed row (viewed_at = NOW()) */
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const supabase = await createClient();
  const { data: { user } } = await getEffectiveUser(supabase);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await rateLimit({
    key: 'recently_viewed_post',
    limit: 60,
    windowSeconds: 60,
    identifier: user.id,
  });
  if (!rl.allowed) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });

  const body = await req.json().catch(() => ({}));
  const productId = typeof body?.productId === 'string' ? body.productId : null;
  const agentId = typeof body?.agentId === 'string' ? body.agentId : null;
  if (!productId) return NextResponse.json({ error: 'Missing productId' }, { status: 400 });

  const service = await createServiceClient();
  const { error } = await service.from('researcher_recently_viewed').upsert(
    {
      user_id: user.id,
      product_id: productId,
      agent_id: agentId,
      viewed_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,product_id' }
  );

  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  return NextResponse.json({ success: true });
}

/** DELETE: Clear all recently viewed history for the current user */
export async function DELETE(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const supabase = await createClient();
  const { data: { user } } = await getEffectiveUser(supabase);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await rateLimit({
    key: 'recently_viewed_delete',
    limit: 10,
    windowSeconds: 60,
    identifier: user.id,
  });
  if (!rl.allowed) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });

  const service = await createServiceClient();
  const { error } = await service
    .from('researcher_recently_viewed')
    .delete()
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: 'Failed to clear history' }, { status: 500 });
  return NextResponse.json({ success: true });
}
