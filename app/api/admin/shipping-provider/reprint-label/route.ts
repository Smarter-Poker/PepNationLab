/**
 * POST /api/admin/shipping-provider/reprint-label
 *
 * Refunds the existing label (when one is active) and immediately purchases a
 * replacement label for the order via EasyPost.
 *
 * Guards: admin role + same-origin CSRF.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { refundLabel, buyLabel } from '@/lib/shipping';
import { createServiceClient } from '@/lib/supabase/server';
import { enqueueOrderPush } from '@/lib/push-enqueue';

export const dynamic = 'force-dynamic';
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

  const { data: order } = await supabase
    .from('orders')
    .select('id, agent_id, status')
    .eq('id', orderId)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ error: 'Order Not Found.' }, { status: 404 });
  }

  const currentStatus = String(order.status ?? '');
  if (currentStatus === 'cancelled' || currentStatus === 'delivered') {
    return NextResponse.json(
      { error: 'Order Is In A Terminal State And Cannot Be Reprinted.' },
      { status: 422 },
    );
  }

  const { data: purchase, error: purchaseFetchErr } = await supabase
    .from('shipping_label_purchases')
    .select('id, provider_transaction_id, label_amount_cents, label_cost_cents, created_at')
    .eq('order_id', orderId)
    .eq('refunded', false)
    .maybeSingle();
  if (purchaseFetchErr) {
    console.error('[label-reprint] purchase fetch error', purchaseFetchErr.message);
    return NextResponse.json({ error: 'Database Error' }, { status: 500 });
  }

  if (purchase?.provider_transaction_id) {
    if (purchase.created_at) {
      const ageMs = Date.now() - new Date(purchase.created_at).getTime();
      const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
      if (ageMs > ninetyDaysMs) {
        return NextResponse.json(
          { error: 'Existing Label Is Past The 90-Day Refund Window - Cannot Reprint.' },
          { status: 422 },
        );
      }
    }
    const refundResult = await refundLabel(purchase.provider_transaction_id);
    if (!refundResult.ok) {
      return NextResponse.json(
        { error: 'EasyPost Refund Of Existing Label Was Rejected.' },
        { status: 502 },
      );
    }
    const refundAmountCents: number = purchase.label_amount_cents ?? purchase.label_cost_cents ?? 0;
    const { error: refundRpcErr } = await supabase.rpc('shipping_record_refund', {
      p_label_purchase_id: purchase.id,
      p_refund_amount_cents: refundAmountCents,
      p_provider_refund_id: refundResult.providerRefundId ?? null,
      p_reason: `Reprint: ${reason}`,
      p_initiated_by: gate.userId,
    });
    if (refundRpcErr) {
      console.error('[label-reprint] refund ledger RPC failed', refundRpcErr.message);
      return NextResponse.json(
        { error: 'Refund Ledger Write Failed - Reprint Aborted.' },
        { status: 500 },
      );
    }
  }

  const agentId = (order.agent_id as string | null) ?? '';
  const labelResult = await buyLabel({
    orderId,
    agentId,
    preferredServiceLevel: serviceLevel,
  });

  if (!labelResult.ok) {
    console.error('[label-reprint] buyLabel failed', labelResult.error);
    return NextResponse.json(
      { error: 'Replacement Label Purchase Failed.' },
      { status: 502 },
    );
  }

  await supabase.from('admin_audit_log').insert({
    actor_id: gate.userId,
    action: 'shipping_label_reprint',
    entity_type: 'orders',
    entity_id: orderId,
    changes: {
      previous_purchase_id: purchase?.id ?? null,
      new_transaction_id: labelResult.providerTransactionId,
      tracking_number: labelResult.trackingNumber,
      label_cost_cents: labelResult.labelCostCents,
      reason,
    },
  });

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
