/**
 * POST /api/admin/shippo/refund-label
 *
 * Requests a label refund from Shippo for a given order's label purchase.
 * Calls shippo_record_refund RPC which marks the shipping_label_purchases row
 * as refunded and inserts a matching row in order_refunds.
 *
 * Body: { order_id: string; reason?: string }
 *
 * Guards: admin role + same-origin CSRF.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { refundLabel } from '@/lib/shippo';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const csrfErr = assertSameOrigin(req);
  if (csrfErr) return csrfErr;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  let body: { order_id?: unknown; reason?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const orderId = typeof body.order_id === 'string' ? body.order_id.trim() : '';
  const reason = typeof body.reason === 'string' ? body.reason.trim() : 'Admin Label Refund';

  if (!orderId) {
    return NextResponse.json({ error: 'order_id Is Required.' }, { status: 400 });
  }

  const supabase = await createServiceClient();

  // Find the active (non-refunded) label purchase for this order.
  const { data: purchase, error: fetchErr } = await supabase
    .from('shipping_label_purchases')
    .select('id, shippo_transaction_id, label_amount_cents, label_cost_cents, tracking_number, refunded')
    .eq('order_id', orderId)
    .eq('refunded', false)
    .maybeSingle();

  if (fetchErr || !purchase) {
    return NextResponse.json(
      { error: 'No Active Label Purchase Found For This Order.' },
      { status: 404 },
    );
  }

  if (!purchase.shippo_transaction_id) {
    return NextResponse.json(
      { error: 'Label Purchase Has No Shippo Transaction ID — Cannot Refund.' },
      { status: 422 },
    );
  }

  // Request refund from Shippo.
  const refundResult = await refundLabel(purchase.shippo_transaction_id);

  // Coalesce label_amount_cents (set by Shippo webhook) with label_cost_cents (set at purchase time).
  // label_amount_cents starts NULL until the webhook fires; RPC raises if NULL is passed.
  const refundAmountCents: number = purchase.label_amount_cents ?? purchase.label_cost_cents ?? 0;

  // Call the DB RPC to mark the purchase as refunded and insert refund ledger row.
  const { error: rpcErr } = await supabase.rpc('shippo_record_refund', {
    p_label_purchase_id: purchase.id,
    p_refund_amount_cents: refundAmountCents,
    p_shippo_refund_id: refundResult.shippoRefundId ?? null,
    p_reason: reason,
    p_initiated_by: gate.userId,
  });

  if (rpcErr) {
    return NextResponse.json(
      { error: `Refund Ledger Error: ${rpcErr.message}` },
      { status: 500 },
    );
  }

  await supabase.from('admin_audit_log').insert({
    actor_id: gate.userId,
    action: 'shippo_label_refund',
    entity_type: 'shipping_label_purchases',
    entity_id: purchase.id,
    changes: {
      order_id: orderId,
      shippo_refund_id: refundResult.shippoRefundId,
      shippo_status: refundResult.status,
      amount_cents: refundAmountCents,
      reason,
    },
  });

  return NextResponse.json({
    ok: true,
    shippoRefundId: refundResult.shippoRefundId,
    shippoStatus: refundResult.status,
    refunded: !refundResult.ok ? false : true,
    shippoError: refundResult.ok ? null : refundResult.error,
  });
}
