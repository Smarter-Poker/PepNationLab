import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { enqueueWebhook } from '@/lib/webhook-dispatch';

export const dynamic = 'force-dynamic';

const ELIGIBLE_STATUSES = new Set([
  'shipped',
  'delivered',
  'approved_ship',
  'approved_pickup',
  'in_fulfillment',
]);

const ItemSchema = z.object({
  order_item_id: z.string().uuid(),
  quantity: z.number().int().positive(),
  unit_amount: z.number().nonnegative(),
  condition_received: z.enum(['unopened', 'damaged', 'tampered', 'partial', 'as_expected']).optional().nullable(),
});

const CreateSchema = z.object({
  order_id: z.string().uuid(),
  reason_category: z.enum(['damaged', 'wrong_item', 'quality_issue', 'not_as_described', 'other']),
  reason_details: z.string().min(5).max(2000),
  requested_resolution: z.enum(['refund', 'store_credit', 'replacement']).default('refund'),
  items: z.array(ItemSchema).min(1).max(50),
});

/**
 * GET /api/researcher/rma
 * Returns the current researcher's RMA requests + items.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = await createServiceClient();
  const { data, error } = await service
    .from('rma_requests')
    .select(`
      id, order_id, status, reason_category, reason_details, requested_resolution,
      return_label_url, return_tracking_number, return_label_purchased_at,
      received_at, inspected_at, inspection_notes, restock_decision,
      resolution_type, resolved_at, rejected_reason,
      created_at, updated_at,
      rma_items(id, product_name, quantity, unit_amount, condition_received)
    `)
    .eq('requester_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  return NextResponse.json({ rmas: data ?? [] });
}

/**
 * POST /api/researcher/rma
 * Buyer creates a new return request for one of their orders. Requires that
 * the order is currently in a fulfillment / post-fulfillment state and that
 * the buyer owns it. Items reference rows on the order being returned.
 */
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid Return Request', details: parsed.error.issues }, { status: 400 });
  }

  const service = await createServiceClient();

  // Verify ownership + status of the order.
  const { data: order, error: orderErr } = await service
    .from('orders')
    .select('id, buyer_id, agent_id, status')
    .eq('id', parsed.data.order_id)
    .single();
  if (orderErr || !order) return NextResponse.json({ error: 'Order Not Found' }, { status: 404 });
  if (order.buyer_id !== user.id) return NextResponse.json({ error: 'Order Does Not Belong To You' }, { status: 403 });
  if (!ELIGIBLE_STATUSES.has(order.status)) {
    return NextResponse.json({ error: 'Order Status Is Not Eligible For A Return' }, { status: 422 });
  }

  // Verify all referenced order items belong to the order.
  const itemIds = parsed.data.items.map((i) => i.order_item_id);
  const { data: orderItems } = await service
    .from('order_items')
    .select('id, product_name, quantity, unit_retail_price, order_id')
    .in('id', itemIds);
  if (!orderItems || orderItems.length !== itemIds.length) {
    return NextResponse.json({ error: 'One Or More Items Do Not Match This Order' }, { status: 400 });
  }
  for (const oi of orderItems) {
    if (oi.order_id !== order.id) {
      return NextResponse.json({ error: 'Item Does Not Belong To This Order' }, { status: 400 });
    }
  }
  const itemMap = new Map(orderItems.map((oi) => [oi.id, oi]));
  for (const reqItem of parsed.data.items) {
    const oi = itemMap.get(reqItem.order_item_id)!;
    if (reqItem.quantity > Number(oi.quantity)) {
      return NextResponse.json({ error: `Quantity Exceeds Purchased Amount For ${oi.product_name}` }, { status: 400 });
    }
  }

  // Insert RMA + items.
  const { data: newRma, error: insertErr } = await service
    .from('rma_requests')
    .insert({
      order_id: order.id,
      requester_id: user.id,
      reason_category: parsed.data.reason_category,
      reason_details: parsed.data.reason_details,
      requested_resolution: parsed.data.requested_resolution,
    })
    .select('id')
    .single();
  if (insertErr || !newRma) {
    return NextResponse.json({ error: insertErr?.message || 'Failed To Create Return Request' }, { status: 500 });
  }

  const itemsRows = parsed.data.items.map((it) => {
    const oi = itemMap.get(it.order_item_id)!;
    return {
      rma_id: newRma.id,
      order_item_id: it.order_item_id,
      product_name: oi.product_name,
      quantity: it.quantity,
      unit_amount: Number(oi.unit_retail_price), // always use server-side price from order_items
      condition_received: it.condition_received ?? null,
    };
  });
  const { error: itemsErr } = await service.from('rma_items').insert(itemsRows);
  if (itemsErr) {
    // Roll back parent — best effort.
    await service.from('rma_requests').delete().eq('id', newRma.id);
    return NextResponse.json({ error: itemsErr.message }, { status: 500 });
  }

  // Notify the owning agent in-app.
  if (order.agent_id) {
    await service.from('internal_messages').insert({
      sender_id: user.id,
      receiver_id: order.agent_id,
      subject: 'New Return Request Received',
      body: `A New Return Request Has Been Filed For Order ${order.id.slice(0, 8).toUpperCase()}. Please Review In The Returns Tab.`,
      type: 'direct_message',
    });
  }

  // Fire-and-forget webhook: rma.created
  void (async () => {
    try {
      await enqueueWebhook(service, {
        event: 'rma.created',
        agentId: order.agent_id ?? null,
        payload: {
          rma: {
            id: newRma.id,
            order_id: order.id,
            status: 'requested',
            reason_category: parsed.data.reason_category,
            requested_resolution: parsed.data.requested_resolution,
          },
        },
        relatedOrderId: order.id,
      });
    } catch { /* webhook must not break RMA create */ }
  })();

  return NextResponse.json({ ok: true, id: newRma.id });
}
