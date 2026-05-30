/**
 * POST /api/agent/shipping/purchase
 *
 * Purchases a shipping label for an order.
 *
 * M1 MIGRATION (2026-06-01): This endpoint now routes through
 * `purchaseLabelForOrder` from lib/shippo.ts, which uses the platform
 * Shippo account key instead of per-agent keys. Per-agent Shippo API keys
 * in `agent_profiles.shippo_api_key` are deprecated and ignored.
 *
 * Guards: requireAgent — caller must own the order (or be the parent super-agent).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { pickOne } from '@/lib/relations';
import { purchaseLabelForOrder } from '@/lib/shippo';
import { enqueueOrderPush, shortOrderId } from '@/lib/push-enqueue';
import { enqueueWebhook, fetchOrderForWebhook } from '@/lib/webhook-dispatch';
import { notifyOrderShipped } from '@/lib/notify';

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  try {
    const gate = await requireAgent();
    if (!gate.ok) return gate.response;

    const supabase = await createServiceClient();
    const agentId = gate.user.id;
    const body = await req.json().catch(() => ({}));
    const { orderId, preferredServiceLevel } = body || {};

    if (!orderId) return NextResponse.json({ error: 'Order ID required' }, { status: 400 });

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, profiles!orders_agent_id_fkey(parent_agent_id), buyer:profiles!orders_buyer_id_fkey(full_name, email)')
      .eq('id', orderId).single();

    if (orderError || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const orderAgentProfile = pickOne<{ parent_agent_id: string | null }>(order.profiles);
    if (order.agent_id !== agentId && orderAgentProfile?.parent_agent_id !== agentId) {
      return NextResponse.json({ error: 'Unauthorized to ship this order' }, { status: 403 });
    }

    // Use the platform Shippo account key via the new purchaseLabelForOrder shim.
    // Per-agent keys are no longer required or consulted.
    const result = await purchaseLabelForOrder(supabase, {
      orderId,
      agentId,
      preferredServiceLevel: preferredServiceLevel ?? null,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status >= 400 ? result.status : 502 });
    }

    const { trackingNumber, labelUrl } = result;

    // Fire-and-forget in-app + push notification — never blocks shipping.
    if (order.buyer_id) {
      void (async () => {
        try {
          const short = shortOrderId(orderId);
          await notifyOrderShipped(supabase, order.buyer_id, orderId, short, trackingNumber ?? undefined);
          await enqueueOrderPush(supabase, { userId: order.buyer_id, orderId, event: 'order_shipped', tracking: trackingNumber });
        } catch { /* notification failures must not break shipping */ }
      })();
    }

    // Fire-and-forget webhook: order.shipped
    void (async () => {
      try {
        const orderPayload = await fetchOrderForWebhook(supabase, orderId);
        if (orderPayload) {
          await enqueueWebhook(supabase, {
            event: 'order.shipped',
            agentId: (orderPayload as { agent_id?: string | null }).agent_id ?? null,
            payload: { order: orderPayload },
            relatedOrderId: orderId,
          });
        }
      } catch { /* webhook errors must not break shipping */ }
    })();

    return NextResponse.json({ success: true, trackingNumber, labelUrl });
  } catch (error) {
    console.error('Agent Shipping Purchase API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
