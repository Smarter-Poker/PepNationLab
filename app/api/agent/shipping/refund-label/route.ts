/**
 * POST /api/agent/shipping/refund-label
 *
 * EasyPost Forge: refund a label the agent bought with their own sub-account
 * wallet. Looks up the unrefunded shipping_label_purchases row for the order
 * where paid_by = 'agent' AND agent_id = caller (which is also the ownership
 * check - only the purchasing agent may refund), requests the refund from
 * EasyPost WITH THE AGENT'S key, then records it via the
 * shipping_record_refund RPC (service-role-execute-only, hence the
 * createAdminClient).
 *
 * Body: { orderId: string }
 *
 * Guards: assertSameOrigin -> requireAgent -> Forge enabled.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAgent } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { createAdminClient } from '@/lib/supabase/server';
import { isForgeEnabled } from '@/lib/forge';
import { refundLabel } from '@/lib/shipping';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  try {
    const gate = await requireAgent();
    if (!gate.ok) return gate.response;
    const callerId = gate.user.id;

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const orderId = typeof body?.orderId === 'string' ? body.orderId.trim() : '';
    if (!orderId) {
      return NextResponse.json({ error: 'Order ID Required' }, { status: 400 });
    }

    const admin = createAdminClient();
    const available = await isForgeEnabled(admin);
    if (!available) {
      return NextResponse.json(
        { error: 'Shipping Accounts Are Not Enabled On This Platform Yet.' },
        { status: 403 },
      );
    }

    const { data: purchase, error: fetchErr } = await admin
      .from('shipping_label_purchases')
      .select('id, provider_transaction_id, label_cost_cents, tracking_number, created_at')
      .eq('order_id', orderId)
      .eq('paid_by', 'agent')
      .eq('agent_id', callerId)
      .eq('refunded', false)
      .maybeSingle();

    if (fetchErr) {
      console.error('[agent-refund-label] purchase fetch error:', fetchErr.message);
      return NextResponse.json({ error: 'Database Error Fetching Label Purchase.' }, { status: 500 });
    }
    if (!purchase) {
      return NextResponse.json(
        { error: 'No Refundable Label Found For This Order.' },
        { status: 404 },
      );
    }
    if (!purchase.provider_transaction_id) {
      return NextResponse.json(
        { error: 'Label Purchase Has No EasyPost Shipment ID - Cannot Refund.' },
        { status: 422 },
      );
    }

    // Carriers reject refunds on old labels; mirror the admin route's window.
    if (purchase.created_at) {
      const ageMs = Date.now() - new Date(purchase.created_at as string).getTime();
      if (ageMs > 90 * 24 * 60 * 60 * 1000) {
        return NextResponse.json(
          { error: 'Refund Window Expired - Label Is More Than 90 Days Old.' },
          { status: 422 },
        );
      }
    }

    const labelCostCents = Number(purchase.label_cost_cents) || 0;

    // The shipment lives on the AGENT's sub-account - refund with their key.
    const refundResult = await refundLabel(purchase.provider_transaction_id as string, callerId);
    if (!refundResult.ok) {
      return NextResponse.json(
        { error: refundResult.error || 'EasyPost Refund Request Was Rejected.' },
        { status: 502 },
      );
    }

    const { error: rpcErr } = await admin.rpc('shipping_record_refund', {
      p_label_purchase_id: purchase.id,
      p_refund_amount_cents: labelCostCents,
      p_provider_refund_id: refundResult.providerRefundId ?? null,
      p_reason: 'agent_refund',
      p_initiated_by: callerId,
    });
    if (rpcErr) {
      console.error('[agent-refund-label] shipping_record_refund RPC failed:', rpcErr.message);
      return NextResponse.json({ error: 'Refund Ledger Write Failed.' }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      providerRefundId: refundResult.providerRefundId ?? null,
      providerStatus: refundResult.status ?? 'QUEUED',
      refundAmountCents: labelCostCents,
    });
  } catch (error) {
    console.error('Agent Refund Label API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
