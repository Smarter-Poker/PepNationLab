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
    .select('id, shippo_transaction_id, label_amount_cents, label_cost_cents, tracking_number, refunded, created_at')
    .eq('order_id', orderId)
    .eq('refunded', false)
    .maybeSingle();

  if (fetchErr) {
    console.error('[shippo-refund] purchase fetch error', fetchErr.message);
    return NextResponse.json(
      { error: 'Database Error Fetching Label Purchase.', detail: fetchErr.message },
      { status: 500 },
    );
  }
  if (!purchase) {
    return NextResponse.json(
      { error: 'No Active Label Purchase Found For This Order.' },
      { status: 404 },
    );
  }

  if (!purchase.shippo_transaction_id) {
    return NextResponse.json(
      { error: 'Label Purchase Has No Shippo Transaction ID - Cannot Refund.' },
      { status: 422 },
    );
  }

  // Shippo enforces a 90-day refund window from label purchase time. Calling
  // the API outside that window returns a generic error; reject up-front so
  // we do not flip our refunded=true flag for a refund the carrier will not
  // honor.
  if (purchase.created_at) {
    const ageMs = Date.now() - new Date(purchase.created_at).getTime();
    const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
    if (ageMs > ninetyDaysMs) {
      return NextResponse.json(
        { error: 'Refund Window Expired - Label Is More Than 90 Days Old.' },
        { status: 422 },
      );
    }
  }

  // Guard: if both cost columns are null we cannot record a meaningful refund amount.
  const knownCost = purchase.label_amount_cents ?? purchase.label_cost_cents ?? null;
  if (knownCost === null || knownCost === 0) {
    return NextResponse.json(
      { error: 'Cannot Refund: Label Cost Unknown' },
      { status: 400 },
    );
  }

  // Request refund from Shippo.
  const refundResult = await refundLabel(purchase.shippo_transaction_id);

  // Shippo rejected the refund (4xx) - do NOT flip our ledger to refunded.
  if (!refundResult.ok) {
    return NextResponse.json(
      { error: 'Shippo Refund Request Was Rejected.' },
      { status: 502 },
    );
  }

  // Coalesce label_amount_cents (set by webhook) with label_cost_cents (set at
  // purchase time). label_amount_cents starts NULL until the webhook fires.
  const refundAmountCents: number = knownCost;

  // Call the DB RPC to mark the purchase as refunded and insert refund ledger row.
  const { error: rpcErr } = await supabase.rpc('shippo_record_refund', {
    p_label_purchase_id: purchase.id,
    p_refund_amount_cents: refundAmountCents,
    p_shippo_refund_id: refundResult.shippoRefundId ?? null,
    p_reason: reason,
    p_initiated_by: gate.userId,
  });

  if (rpcErr) {
    // Generic body - do not echo PG internals to the caller.
    console.error('[shippo-refund] RPC failed', rpcErr.message);
    return NextResponse.json(
      { error: 'Refund Ledger Write Failed.' },
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
    refunded: true,
  });
}
