/**
 * POST /api/agent/shipping/purchase
 *
 * Purchases a shipping label for an order.
 *
 * This endpoint routes through `purchaseLabelForOrder` from lib/shipping.ts,
 * which uses the platform EasyPost account key. Per-agent shipping API keys
 * no longer exist - shipping is platform-managed.
 *
 * Guards: requireAgent - caller must own the order (or be the parent super-agent).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { pickOne } from '@/lib/relations';
import { purchaseLabelForOrder } from '@/lib/shipping';
import { shortOrderId } from '@/lib/push-enqueue';
import { enqueueWebhook, fetchOrderForWebhook } from '@/lib/webhook-dispatch';
import { notifyOrderShipped } from '@/lib/notify';
import { logOrderEvent } from '@/lib/order-events';
import { emailConfigured, sendOrderShippedEmail } from '@/lib/email';

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
      .select('*, profiles!orders_agent_id_fkey(parent_agent_id), buyer:profiles!orders_buyer_id_fkey(full_name, email, contact_email, email_verified)')
      .eq('id', orderId).maybeSingle();

    if (orderError || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const orderAgentProfile = pickOne<{ parent_agent_id: string | null }>(order.profiles);
    if (order.agent_id !== agentId && orderAgentProfile?.parent_agent_id !== agentId) {
      return NextResponse.json({ error: 'Unauthorized to ship this order' }, { status: 403 });
    }

    // GATE: an agent may only purchase a label AFTER the order has cleared the
    // mandatory admin-approval gate. Pre-gate statuses (pending_customer_payment,
    // agent_approval_pending, admin_approval_pending) must never be shippable -
    // buying a label there would skip admin release and push the order straight
    // into the shipping pipeline. Only approved_ship (the admin-released ship
    // state) or an order already in_fulfillment may have a label purchased.
    if (order.status !== 'approved_ship' && order.status !== 'in_fulfillment') {
      return NextResponse.json(
        { error: 'This Order Must Be Approved By An Admin Before A Shipping Label Can Be Purchased.' },
        { status: 409 }
      );
    }

    // Use the platform EasyPost account key via purchaseLabelForOrder.
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

    // Awaited in-app + push notification - never blocks shipping.
    if (order.buyer_id) {
      try {
        const short = shortOrderId(orderId);
        await notifyOrderShipped(supabase, order.buyer_id, orderId, short, trackingNumber ?? undefined);
      } catch { /* notification failures must not break shipping */ }

      try {
        await logOrderEvent(supabase, {
          orderId,
          event: 'shipped',
          actorId: agentId,
          actorRole: 'agent',
          payload: { tracking_number: trackingNumber ?? null, via: 'label_purchase' },
        });
      } catch { /* timeline must not break shipping */ }

      // Tracking email on the PRIMARY shipping path. Label purchase is how
      // agents actually ship; the shipped email previously existed only on the
      // admin manual mark-shipped path, which is unreachable once the label
      // purchase has already set status='shipped' -- so buyers never received
      // tracking by email. Awaited (a detached promise can be killed by the
      // serverless runtime) and best-effort: never breaks shipping.
      try {
        const buyer = pickOne<{ full_name: string | null; contact_email: string | null; email_verified: boolean | null }>(order.buyer);
        if (emailConfigured() && buyer?.contact_email && buyer.email_verified) {
          await sendOrderShippedEmail({
            to: buyer.contact_email,
            fullName: buyer.full_name,
            orderId,
            trackingNumber: trackingNumber ?? undefined,
          });
        }
      } catch { /* email failures must not break shipping */ }
    }

    // Awaited webhook: order.shipped
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

    return NextResponse.json({ success: true, trackingNumber, labelUrl });
  } catch (error) {
    console.error('Agent Shipping Purchase API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
