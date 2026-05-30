import { NextResponse, type NextRequest } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

export const dynamic = 'force-dynamic';

const PAYMENT_METHODS = new Set(['zelle', 'cashapp', 'venmo', 'apple_pay']);
const FULFILLMENT_METHODS = new Set(['ship', 'agent_pickup']);

/**
 * GET — list the current researcher's subscriptions, with items_snapshot and
 * the last linked order id. RLS restricts visibility to the caller's own rows.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('subscriptions')
    .select('id, agent_id, status, cadence_days, payment_method, fulfillment_method, shipping_address, items_snapshot, next_run_at, last_run_at, last_order_id, failure_count, last_failure_reason, paused_at, cancelled_at, created_at, updated_at')
    .eq('researcher_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }

  // Decorate with agent display name + storefront slug for the UI.
  const agentIds = Array.from(new Set((data ?? []).map((s) => s.agent_id))).filter(Boolean);
  const agentMap: Record<string, { display_name: string | null; slug: string | null }> = {};
  if (agentIds.length > 0) {
    const service = await createServiceClient();
    const { data: agents } = await service
      .from('agent_profiles')
      .select('id, display_name, slug')
      .in('id', agentIds);
    for (const a of agents ?? []) {
      agentMap[String(a.id)] = { display_name: a.display_name ?? null, slug: a.slug ?? null };
    }
  }

  const subscriptions = (data ?? []).map((s) => ({
    ...s,
    agent: agentMap[String(s.agent_id)] ?? { display_name: null, slug: null },
  }));

  return NextResponse.json({ subscriptions });
}

/**
 * POST — create a new subscription. Body:
 *   { agent_id, cadence_days, payment_method, fulfillment_method, shipping_address?,
 *     items: [{ agent_product_id, quantity }] }
 *
 * Validates items against the agent's agent_products (must be visible AND owned by
 * the target agent) before snapshotting them with current retail prices.
 */
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid Body' }, { status: 400 });
  }

  const agentId = String(body?.agent_id ?? '').trim();
  const cadenceDays = Number(body?.cadence_days);
  const paymentMethod = String(body?.payment_method ?? '').trim();
  const fulfillmentMethod = String(body?.fulfillment_method ?? 'ship').trim();
  const shippingAddress = body?.shipping_address ?? null;
  const items: Array<{ agent_product_id: string; quantity: number }> = Array.isArray(body?.items)
    ? body.items
    : [];

  if (!agentId) {
    return NextResponse.json({ error: 'agent_id Is Required' }, { status: 400 });
  }
  if (!Number.isFinite(cadenceDays) || cadenceDays < 7 || cadenceDays > 365) {
    return NextResponse.json({ error: 'cadence_days Must Be Between 7 And 365' }, { status: 400 });
  }
  if (!PAYMENT_METHODS.has(paymentMethod)) {
    return NextResponse.json({ error: 'Invalid Payment Method' }, { status: 400 });
  }
  if (!FULFILLMENT_METHODS.has(fulfillmentMethod)) {
    return NextResponse.json({ error: 'Invalid Fulfillment Method' }, { status: 400 });
  }
  if (items.length === 0) {
    return NextResponse.json({ error: 'At Least One Item Is Required' }, { status: 400 });
  }
  for (const it of items) {
    if (!it?.agent_product_id || typeof it.agent_product_id !== 'string') {
      return NextResponse.json({ error: 'Item Missing agent_product_id' }, { status: 400 });
    }
    const q = Number(it.quantity);
    if (!Number.isFinite(q) || q < 1 || q > 1000) {
      return NextResponse.json({ error: 'Invalid Item Quantity' }, { status: 400 });
    }
  }
  if (fulfillmentMethod === 'ship') {
    if (!shippingAddress || typeof shippingAddress !== 'object') {
      return NextResponse.json({ error: 'Shipping Address Is Required For Shipped Subscriptions' }, { status: 400 });
    }
    for (const k of ['street', 'city', 'state', 'zip']) {
      if (!shippingAddress[k]) {
        return NextResponse.json({ error: `Shipping Address Missing ${k}` }, { status: 400 });
      }
    }
  }

  const service = await createServiceClient();

  // Validate items against the agent's catalog. Each agent_product must be
  // visible AND belong to the named agent.
  const apIds = items.map((i) => i.agent_product_id);
  const { data: agentProducts, error: apError } = await service
    .from('agent_products')
    .select('id, agent_id, product_id, retail_price, is_visible, custom_name')
    .in('id', apIds);

  if (apError) {
    return NextResponse.json({ error: apError.message }, { status: 500 });
  }

  if (!agentProducts || agentProducts.length !== apIds.length) {
    return NextResponse.json({ error: 'One Or More Items Are Invalid' }, { status: 400 });
  }

  const apById = new Map<string, any>();
  for (const ap of agentProducts) {
    if (ap.agent_id !== agentId) {
      return NextResponse.json({ error: 'Item Does Not Belong To The Selected Agent' }, { status: 400 });
    }
    if (ap.is_visible === false) {
      return NextResponse.json({ error: 'One Or More Items Are No Longer Available' }, { status: 400 });
    }
    apById.set(String(ap.id), ap);
  }

  // Resolve product display names for the snapshot.
  const productIds = Array.from(new Set(agentProducts.map((ap) => ap.product_id))).filter(Boolean);
  const { data: products } = await service
    .from('products')
    .select('id, name, is_banned')
    .in('id', productIds);
  const productById = new Map<string, any>();
  for (const p of products ?? []) {
    if (p.is_banned) {
      return NextResponse.json({ error: 'One Or More Products Are Banned' }, { status: 400 });
    }
    productById.set(String(p.id), p);
  }

  // Build the snapshot.
  const itemsSnapshot = items.map((it) => {
    const ap = apById.get(it.agent_product_id);
    const prod = productById.get(String(ap.product_id));
    const name = ap.custom_name || prod?.name || 'Item';
    return {
      agent_product_id: ap.id,
      product_id: ap.product_id,
      product_name: name,
      quantity: Number(it.quantity),
      unit_retail_price: Number(ap.retail_price ?? 0),
    };
  });

  const nextRunAt = new Date(Date.now() + cadenceDays * 24 * 60 * 60 * 1000).toISOString();

  const { data: created, error: insertError } = await service
    .from('subscriptions')
    .insert({
      researcher_id: user.id,
      agent_id: agentId,
      status: 'active',
      cadence_days: cadenceDays,
      payment_method: paymentMethod,
      fulfillment_method: fulfillmentMethod,
      shipping_address: fulfillmentMethod === 'ship' ? shippingAddress : null,
      items_snapshot: itemsSnapshot,
      next_run_at: nextRunAt,
    })
    .select('id, status, cadence_days, next_run_at')
    .single();

  if (insertError || !created) {
    return NextResponse.json({ error: insertError?.message ?? 'Failed To Create Subscription' }, { status: 500 });
  }

  return NextResponse.json({ subscription: created }, { status: 201 });
}
