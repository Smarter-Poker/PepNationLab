/**
 * POST /api/admin/shippo/reprint-label
 *
 * Voids the existing label purchase, purchases a fresh replacement label,
 * and updates the order with the new tracking number and label URL.
 *
 * This is a two-step operation:
 *   1. Refund the existing Shippo transaction.
 *   2. Insert a new label_jobs row in 'pending' status so the cron picks it up,
 *      OR immediately call buyLabel if the caller wants a synchronous response.
 *
 * For M1 we take the immediate synchronous path for simplicity. If the label
 * purchase takes >10s the call will time out on Vercel; the async queue path
 * is available via posting to label_jobs directly.
 *
 * Body:
 *   { order_id: string; service_level_token?: string; reason?: string }
 *
 * Guards: admin role + same-origin CSRF.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { refundLabel, buyLabel } from '@/lib/shippo';
import { createServiceClient } from '@/lib/supabase/server';
import { enqueueOrderPush } from '@/lib/push-enqueue';

export const dynamic = 'force-dynamic';
// Extended timeout hint for Vercel (Shippo may take 5-8s).
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const csrfErr = assertSameOrigin(req);
  if (csrfErr) return csrfErr;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  let body: { order_id?: unknown; service_level_token?: unknown; reason?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const orderId = typeof body.order_id === 'string' ? body.order_id.trim() : '';
  const serviceLevel = typeof body.service_level_token === 'string' ? body.service_level_token.trim() : null;
  const reason = typeof body.reason === 'string' ? body.reason.trim() : 'Admin Reprint';

  if (!orderId) {
    return NextResponse.json({ error: 'order_id Is Required.' }, { status: 400 });
  }

  const supabase = await createServiceClient();

  // Fetch the order to verify it exists and get agent_id.
  const { data: order } = await supabase
    .from('orders')
    .select('id, agent_id, status')
    .eq('id', orderId)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ error: 'Order Not Found.' }, { status: 404 });
  }

  // Find the active label purchase.
  const { data: purchase } = await supabase
    .from('shipping_label_purchases')
    .select('id, shippo_transaction_id, label_amount_cents, label_cost_cents')
    .eq('order_id', orderId)
    .eq('refunded', false)
    .maybeSingle();

  // Step 1: Refund the existing label (if any).
  if (purchase?.shippo_transaction_id) {
    const refundResult = await refundLabel(purchase.shippo_transaction_id);
    // Coalesce: label_amount_cents is NULL until webhook fires; RPC raises on NULL.
    const refundAmountCents: number = purchase.label_amount_cents ?? purchase.label_cost_cents ?? 0;
    if (refundResult.ok || refundResult.status === 'QUEUED') {
      // Mark the old purchase as refunded via RPC.
      await supabase.rpc('shippo_record_refund', {
        p_label_purchase_id: purchase.id,
        p_refund_amount_cents: refundAmountCents,
        p_shippo_refund_id: refundResult.shippoRefundId ?? null,
        p_reason: `Reprint: ${reason}`,
        p_initiated_by: gate.userId,
      });
    }
  }

  // Step 2: Purchase a fresh label.
  const agentId = order.agent_id as string;
  const labelResult = await buyLabel({
    orderId,
    agentId,
    preferredServiceLevel: serviceLevel,
  });

  if (!labelResult.ok) {
    return NextResponse.json(
      { error: `Replacement Label Failed: ${labelResult.error}` },
      { status: 502 },
    );
  }

  await supabase.from('admin_audit_log').insert({
    actor_id: gate.userId,
    action: 'shippo_label_reprint',
    entity_type: 'orders',
    entity_id: orderId,
    changes: {
      previous_purchase_id: purchase?.id ?? null,
      new_transaction_id: labelResult.shippoTransactionId,
      tracking_number: labelResult.trackingNumber,
      label_cost_cents: labelResult.labelCostCents,
      reason,
    },
  });

  // Enqueue push for buyer — best-effort.
  try {
    const { data: orderFull } = await supabase
      .from('orders')
      .select('buyer_id')
      .eq('id', orderId)
      .maybeSingle();
    if (orderFull?.buyer_id) {
      await enqueueOrderPush(supabase, {
        userId: orderFull.buyer_id,
        orderId,
        event: 'order_shipped',
        tracking: labelResult.trackingNumber,
      });
    }
  } catch { /* non-blocking */ }

  return NextResponse.json({
    ok: true,
    trackingNumber: labelResult.trackingNumber,
    labelUrl: labelResult.labelUrl,
    carrier: labelResult.carrier,
    serviceLevel: labelResult.serviceLevel,
    labelCostCents: labelResult.labelCostCents,
    mode: labelResult.mode,
  });
}
