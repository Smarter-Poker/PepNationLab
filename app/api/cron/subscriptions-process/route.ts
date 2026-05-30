import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';
import { shortOrderId } from '@/lib/push-enqueue';
import { enqueueWebhook } from '@/lib/webhook-dispatch';

export const dynamic = 'force-dynamic';

const BATCH_LIMIT = 200;

interface SnapshotItem {
  agent_product_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_retail_price: number;
}

interface DueSubscription {
  id: string;
  researcher_id: string;
  agent_id: string;
  cadence_days: number;
  payment_method: string;
  fulfillment_method: string;
  shipping_address: Record<string, unknown> | null;
  items_snapshot: SnapshotItem[];
  failure_count: number;
}

/**
 * Hourly cron: process all `active` subscriptions whose `next_run_at` has come
 * due. For each row we:
 *   1. Re-validate every item against agent_products. If any item is gone /
 *      hidden / banned, we PAUSE the subscription with a reason and log a
 *      `failed` run row — we DO NOT create a partial order.
 *   2. Recompute totals server-side from the snapshot quantities and the
 *      current retail prices.
 *   3. Insert a `pending_customer_payment` order with a fresh idempotency_key.
 *   4. Insert the order_items.
 *   5. Notify the researcher (in-app message).
 *   6. Update the subscription's last_run_at / next_run_at / last_order_id.
 *
 * Notifications and per-row failures NEVER abort the batch — the goal is best
 * effort across all due subscriptions in this slice.
 */
export async function GET(req: NextRequest) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  // Partition by hour. A retry inside the same UTC hour is a no-op claim.
  const partition = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
  const claim = await claimCronRun('subscriptions_process', partition);
  if (!claim) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'already_ran_this_hour' });
  }

  const service = await createServiceClient();
  const summary = {
    considered: 0,
    succeeded: 0,
    paused: 0,
    failed: 0,
  };

  try {
    const { data: due, error: dueError } = await service
      .from('subscriptions')
      .select('id, researcher_id, agent_id, cadence_days, payment_method, fulfillment_method, shipping_address, items_snapshot, failure_count')
      .eq('status', 'active')
      .lte('next_run_at', new Date().toISOString())
      .order('next_run_at', { ascending: true })
      .limit(BATCH_LIMIT);

    if (dueError) {
      await finishCronRun(claim.id, 'failed', dueError.message);
      return NextResponse.json({ ok: false, error: dueError.message }, { status: 500 });
    }

    const subs = (due ?? []) as unknown as DueSubscription[];
    summary.considered = subs.length;

    for (const sub of subs) {
      try {
        const result = await processOne(service, sub);
        if (result === 'succeeded') summary.succeeded += 1;
        else if (result === 'paused') summary.paused += 1;
        else summary.failed += 1;
      } catch (err) {
        summary.failed += 1;
        try {
          await service.from('subscription_runs').insert({
            subscription_id: sub.id,
            status: 'failed',
            failure_reason: (err as Error)?.message?.slice(0, 500) ?? 'Unknown Error',
          });
          await service
            .from('subscriptions')
            .update({
              failure_count: (sub.failure_count ?? 0) + 1,
              last_failure_reason: (err as Error)?.message?.slice(0, 500) ?? 'Unknown Error',
              updated_at: new Date().toISOString(),
            })
            .eq('id', sub.id);
        } catch {
          // Logging failure must not break the loop.
        }
      }
    }

    await finishCronRun(claim.id, 'succeeded', JSON.stringify(summary));
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    await finishCronRun(claim.id, 'failed', (err as Error)?.message ?? 'Unknown Error');
    return NextResponse.json({ ok: false, error: (err as Error)?.message }, { status: 500 });
  }
}

type RunOutcome = 'succeeded' | 'paused' | 'failed';

async function processOne(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: any,
  sub: DueSubscription
): Promise<RunOutcome> {
  const snapshot = Array.isArray(sub.items_snapshot) ? sub.items_snapshot : [];
  if (snapshot.length === 0) {
    await pauseWithReason(service, sub, 'No Items In Subscription');
    return 'paused';
  }

  // Re-resolve item state. If any item is gone / hidden / banned, pause.
  const apIds = snapshot.map((i) => String(i.agent_product_id));
  const { data: agentProducts, error: apError } = await service
    .from('agent_products')
    .select('id, agent_id, product_id, retail_price, is_visible, custom_name')
    .in('id', apIds);

  if (apError) {
    await recordFailedRun(service, sub, apError.message ?? 'agent_products Lookup Failed');
    return 'failed';
  }

  if (!agentProducts || agentProducts.length !== apIds.length) {
    await pauseWithReason(service, sub, 'Item No Longer Available');
    return 'paused';
  }

  const productIds = Array.from(new Set(agentProducts.map((ap: any) => ap.product_id))).filter(Boolean);
  const { data: products } = await service
    .from('products')
    .select('id, name, is_banned, base_cost')
    .in('id', productIds);

  const productById = new Map<string, any>();
  for (const p of products ?? []) {
    if (p.is_banned) {
      await pauseWithReason(service, sub, 'Item No Longer Available');
      return 'paused';
    }
    productById.set(String(p.id), p);
  }

  const apById = new Map<string, any>();
  for (const ap of agentProducts) {
    if (ap.agent_id !== sub.agent_id) {
      await pauseWithReason(service, sub, 'Item Ownership Changed');
      return 'paused';
    }
    if (ap.is_visible === false) {
      await pauseWithReason(service, sub, 'Item No Longer Available');
      return 'paused';
    }
    apById.set(String(ap.id), ap);
  }

  // Fetch agent tier + multipliers so we can compute per-vial cost (unit_cost_price).
  // IMPORTANT: All per-vial prices must match the convention used by orders/route.ts
  // and orders/new/route.ts:
  //   unit_retail_price = ap.retail_price / 10  (per-vial retail)
  //   unit_cost_price   = base_cost × mult / 10 (per-vial agent cost)
  // The approve/accounting routes multiply both by quantity (# vials) to compute
  // revenue and COGS — so both MUST be per-vial to stay dimensionally consistent.
  const { data: agentProfile } = await service
    .from('profiles')
    .select('tier')
    .eq('id', sub.agent_id)
    .maybeSingle();
  const agentTier: string = agentProfile?.tier ?? 'tier_3';

  const { data: tierRow } = await service
    .from('pricing_tiers')
    .select('multiplier')
    .eq('tier_name', agentTier)
    .maybeSingle();
  const globalMult: number = tierRow?.multiplier != null ? Number(tierRow.multiplier) : 1.7;

  // Recompute totals from current retail prices.
  let subtotal = 0;
  const orderItems: Array<{
    agent_product_id: string;
    product_id: string;
    product_name: string;
    quantity: number;
    unit_retail_price: number;
    unit_cost_price: number;
    unit_super_agent_cost: number | null;
  }> = [];

  for (const snap of snapshot) {
    const ap = apById.get(String(snap.agent_product_id));
    const prod = productById.get(String(ap.product_id));
    const qty = Number(snap.quantity);
    // Divide by 10: ap.retail_price is stored as a 10-pack price in the DB.
    // orders/route.ts (line 290) and orders/new/route.ts (line 72) both divide
    // by 10 before writing unit_retail_price — we must match that convention.
    const unitRetailPrice = Math.round((Number(ap.retail_price ?? 0) / 10) * 100) / 100;
    const baseCost = Number(prod?.base_cost ?? 0);

    // Resolve per-product tier multiplier override if one exists.
    const { data: overrideRow } = await service
      .from('product_tier_overrides')
      .select('custom_multiplier')
      .eq('product_id', ap.product_id)
      .eq('tier_name', agentTier)
      .maybeSingle();
    const effectiveMult: number = overrideRow?.custom_multiplier != null
      ? Number(overrideRow.custom_multiplier)
      : globalMult;

    // unit_cost_price = per-VIAL agent cost (what agent pays PNL per vial).
    // base_cost in the DB is a per-10-vial-pack price; divide by 10 to get
    // per-vial cost. The agent/orders/approve route multiplies unit_cost_price
    // by quantity (vials) to compute totalCogs — so this MUST be per-vial.
    // Storing the per-pack value would inflate COGS by 10×.
    const agentCostPerVial = Math.round((baseCost * effectiveMult / 10) * 100) / 100;

    subtotal += unitRetailPrice * qty;
    orderItems.push({
      agent_product_id: ap.id,
      product_id: ap.product_id,
      product_name: ap.custom_name || prod?.name || 'Item',
      quantity: qty,
      unit_retail_price: unitRetailPrice,  // per-vial (ap.retail_price ÷ 10)
      unit_cost_price: agentCostPerVial,   // per-vial (base_cost × mult ÷ 10)
      unit_super_agent_cost: null,
    });
  }

  // Resolve buyer info from profiles for snapshot fields on orders.
  const { data: buyer } = await service
    .from('profiles')
    .select('id, full_name, email')
    .eq('id', sub.researcher_id)
    .maybeSingle();

  // Shipping cost on auto-replenish defaults to 0; agent can recompute on
  // approval if needed. We do not call Shippo here to keep the cron cheap.
  const shippingCost = 0;
  const discount = 0;
  const total = Math.max(0, subtotal + shippingCost - discount);

  const { data: order, error: orderError } = await service
    .from('orders')
    .insert({
      buyer_id: sub.researcher_id,
      agent_id: sub.agent_id,
      status: 'pending_customer_payment',
      payment_method: sub.payment_method,
      fulfillment_method: sub.fulfillment_method,
      shipping_address: sub.fulfillment_method === 'ship' ? sub.shipping_address : null,
      subtotal,
      shipping_cost: shippingCost,
      discount_amount: discount,
      total,
      buyer_name: buyer?.full_name ?? null,
      buyer_email: buyer?.email ?? null,
      idempotency_key: crypto.randomUUID(),
    })
    .select('id')
    .single();

  if (orderError || !order) {
    await recordFailedRun(service, sub, orderError?.message ?? 'Order Insert Failed');
    return 'failed';
  }

  const orderId = String(order.id);

  const itemsToInsert = orderItems.map((it) => ({
    order_id: orderId,
    ...it,
  }));
  const { error: itemsError } = await service.from('order_items').insert(itemsToInsert);
  if (itemsError) {
    // Order exists but items failed — the order is in an invalid state.
    // Mark a failed run and return 'failed' so the subscription schedule is NOT
    // advanced. The orphaned order header is left intact for manual resolution.
    await recordFailedRun(
      service,
      sub,
      `Order ${orderId} Created But Items Insert Failed: ${itemsError.message}`
    );
    return 'failed';
  }

  // Log the run, link the order, and roll the schedule forward.
  const nextRunAt = new Date(Date.now() + sub.cadence_days * 24 * 60 * 60 * 1000).toISOString();
  await service.from('subscription_runs').insert({
    subscription_id: sub.id,
    status: 'succeeded',
    order_id: orderId,
  });
  await service
    .from('subscriptions')
    .update({
      last_run_at: new Date().toISOString(),
      next_run_at: nextRunAt,
      last_order_id: orderId,
      failure_count: 0,
      last_failure_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sub.id);

  // Best-effort notifications.
  await notifyResearcher(service, sub, orderId, total);

  // Fire-and-forget webhook: subscription.run
  void (async () => {
    try {
      await enqueueWebhook(service, {
        event: 'subscription.run',
        agentId: sub.agent_id ?? null,
        payload: {
          subscription_id: sub.id,
          order_id: orderId,
          total,
        },
        relatedOrderId: orderId,
      });
    } catch { /* webhook must not break cron */ }
  })();

  return 'succeeded';
}

async function pauseWithReason(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: any,
  sub: DueSubscription,
  reason: string
) {
  await service.from('subscription_runs').insert({
    subscription_id: sub.id,
    status: 'failed',
    failure_reason: reason,
  });
  await service
    .from('subscriptions')
    .update({
      status: 'paused',
      paused_at: new Date().toISOString(),
      failure_count: (sub.failure_count ?? 0) + 1,
      last_failure_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sub.id);

  // Best-effort: tell the researcher their subscription paused.
  try {
    await service.from('internal_messages').insert({
      sender_id: sub.agent_id,
      recipient_id: sub.researcher_id,
      body: `Your Auto-Replenish Subscription Was Paused: ${reason}. Visit Your Account To Update It.`,
    });
  } catch {
    /* notification best effort */
  }
}

async function recordFailedRun(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: any,
  sub: DueSubscription,
  reason: string
) {
  try {
    await service.from('subscription_runs').insert({
      subscription_id: sub.id,
      status: 'failed',
      failure_reason: reason.slice(0, 500),
    });
    await service
      .from('subscriptions')
      .update({
        failure_count: (sub.failure_count ?? 0) + 1,
        last_failure_reason: reason.slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq('id', sub.id);
  } catch {
    /* swallow */
  }
}

async function notifyResearcher(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: any,
  sub: DueSubscription,
  orderId: string,
  total: number
) {
  const short = shortOrderId(orderId);
  const body = `Auto-Replenish Order ${short} Created For $${total.toFixed(2)}. Sign In To Send Payment.`;

  try {
    await service.from('internal_messages').insert({
      sender_id: sub.agent_id,
      recipient_id: sub.researcher_id,
      body,
    });
  } catch {
    /* swallow */
  }

  // SMS removed 2026-05-29. In-app message above is the durable channel; push
  // delivery is handled separately by lib/push-enqueue when callers opt in.
}
