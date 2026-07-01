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

  const knownCost = purchase.label_amount_cents ?? purchase.label_cost_cents ?? null;
  if (knownCost === null || knownCost === 0) {
    return NextResponse.json(
      { error: 'Cannot Refund: Label Cost Unknown' },
      { status: 400 },
    );
  }

  const refundResult = await refundLabel(purchase.shippo_transaction_id);

  if (!refundResult.ok) {
    return NextResponse.json(
      { error: 'Shippo Refund Request Was Rejected.' },
      { status: 502 },
    );
  }

  const refundAmountCents: number = knownCost;

  const { error: rpcErr } = await supabase.rpc('shippo_record_refund', {
    p_label_purchase_id: purchase.id,
    p_refund_amount_cents: refundAmountCents,
    p_shippo_refund_id: refundResult.shippoRefundId ?? null,
    p_reason: reason,
    p_initiated_by: gate.userId,
  });

  if (rpcErr) {
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
