export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

// Researcher-facing product alert subscriptions (back-in-stock / price-drop).
// GET    -> list the caller's alerts
// POST   -> subscribe { product_id, agent_id?, alert_type }
// DELETE -> unsubscribe ?id=... (or ?product_id=&alert_type=)

const ALERT_TYPES = ['back_in_stock', 'price_drop'] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not Authenticated.' }, { status: 401 });

  const { data, error } = await supabase
    .from('product_alerts')
    .select('id, product_id, agent_id, alert_type, reference_price, status, created_at, notified_at, products(name, image_url, inventory_count)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: 'Could Not Load Your Alerts.' }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(req: NextRequest) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not Authenticated.' }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid Request Body.' }, { status: 400 }); }

  const productId = String(body?.product_id ?? '');
  const agentId = body?.agent_id ? String(body.agent_id) : null;
  const alertType = String(body?.alert_type ?? 'back_in_stock');

  if (!UUID_RE.test(productId)) return NextResponse.json({ error: 'Invalid Product.' }, { status: 400 });
  if (agentId && !UUID_RE.test(agentId)) return NextResponse.json({ error: 'Invalid Store.' }, { status: 400 });
  if (!ALERT_TYPES.includes(alertType as any)) return NextResponse.json({ error: 'Invalid Alert Type.' }, { status: 400 });

  // Server-computed reference price for price-drop alerts (never trust the
  // client). Uses the effective agent storefront price when an agent context is
  // supplied; back-in-stock alerts do not need a reference price.
  let referencePrice: number | null = null;
  if (alertType === 'price_drop' && agentId) {
    const admin = createAdminClient();
    const { data: ap } = await admin
      .from('agent_products')
      .select('retail_price, is_on_sale, sale_price')
      .eq('agent_id', agentId)
      .eq('product_id', productId)
      .maybeSingle();
    if (ap) {
      const effective = ap.is_on_sale && ap.sale_price != null ? Number(ap.sale_price) : Number(ap.retail_price);
      referencePrice = Number.isFinite(effective) ? effective / 10 : null;
    }
  }

  // Upsert on the unique (user_id, product_id, alert_type) key so re-subscribing
  // reactivates a previously notified/cancelled row.
  const { data, error } = await supabase
    .from('product_alerts')
    .upsert({
      user_id: user.id,
      product_id: productId,
      agent_id: agentId,
      alert_type: alertType,
      reference_price: referencePrice,
      status: 'active',
      notified_at: null,
    }, { onConflict: 'user_id,product_id,alert_type' })
    .select('id, product_id, alert_type, status')
    .maybeSingle();

  if (error) return NextResponse.json({ error: 'Could Not Save Your Alert.' }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not Authenticated.' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  const productId = req.nextUrl.searchParams.get('product_id');
  const alertType = req.nextUrl.searchParams.get('alert_type');

  let q = supabase.from('product_alerts').delete().eq('user_id', user.id);
  if (id) {
    q = q.eq('id', id);
  } else if (productId) {
    q = q.eq('product_id', productId);
    if (alertType) q = q.eq('alert_type', alertType);
  } else {
    return NextResponse.json({ error: 'Missing Alert Reference.' }, { status: 400 });
  }

  const { error } = await q;
  if (error) return NextResponse.json({ error: 'Could Not Remove The Alert.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
