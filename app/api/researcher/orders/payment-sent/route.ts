import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { notify } from '@/lib/notify';
import { logOrderEvent } from '@/lib/order-events';
import { shortOrderId } from '@/lib/push-enqueue';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/researcher/orders/payment-sent
 *
 * The buyer confirms "I Sent Payment" for an order they pay per-order
 * (offline P2P: Zelle / CashApp / Venmo / etc). This is the buyer's half of
 * the payment-confirmation chain:
 *
 *   buyer:  "I Sent Payment"        -> orders.buyer_payment_sent_at   (this route)
 *   agent:  "I Received Payment"    -> orders.payment_confirmed_at    (mark-paid)
 *   upline: "Downline Paid Me"      -> orders.upline_payment_confirmed_at
 *
 * It never moves money and never changes order status - it is an
 * acknowledgment stamp that (a) stops the buyer's 12-hour confirmation
 * reminders and (b) immediately asks the agent "Did You Receive Payment?".
 */
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const callerId = authData.user.id;

  const body = await req.json().catch(() => ({}));
  const { orderId } = body ?? {};
  if (!orderId || typeof orderId !== 'string' || !UUID_RE.test(orderId)) {
    return NextResponse.json({ error: 'A Valid Order ID Is Required.' }, { status: 400 });
  }

  const svc = createAdminClient();
  const { data: order, error: orderErr } = await svc
    .from('orders')
    .select('id, buyer_id, agent_id, status, total, payment_method, buyer_payment_sent_at, payment_confirmed_at')
    .eq('id', orderId)
    .maybeSingle();

  if (orderErr || !order) {
    return NextResponse.json({ error: 'Order Not Found.' }, { status: 404 });
  }
  if (order.buyer_id !== callerId) {
    return NextResponse.json({ error: 'Only The Buyer Of This Order Can Confirm Payment Was Sent.' }, { status: 403 });
  }
  if (order.status === 'cancelled') {
    return NextResponse.json({ error: 'This Order Was Cancelled.' }, { status: 409 });
  }
  if (order.buyer_payment_sent_at) {
    return NextResponse.json({ error: 'You Already Confirmed Sending Payment For This Order.' }, { status: 409 });
  }

  const nowIso = new Date().toISOString();

  // Compare-and-swap: only the first confirmation wins (double-tap safe).
  const { data: claimed, error: updateErr } = await svc
    .from('orders')
    .update({ buyer_payment_sent_at: nowIso, buyer_payment_sent_by: callerId, updated_at: nowIso })
    .eq('id', orderId)
    .is('buyer_payment_sent_at', null)
    .select('id');

  if (updateErr) {
    console.error('[payment-sent] update failed:', updateErr.message);
    return NextResponse.json({ error: 'Failed To Save Your Confirmation. Please Try Again.' }, { status: 500 });
  }
  if (!claimed || claimed.length === 0) {
    return NextResponse.json({ error: 'You Already Confirmed Sending Payment For This Order.' }, { status: 409 });
  }

  const short = shortOrderId(orderId);
  const total = Number(order.total) || 0;
  const totalFmt = `$${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Clear the buyer's now-answered "Did You Send Payment?" reminders.
  try {
    await svc
      .from('notifications')
      .update({ read_at: nowIso })
      .eq('user_id', callerId)
      .eq('type', 'payment_reminder')
      .is('read_at', null)
      .ilike('url', `%/orders/${orderId}%`);
  } catch { /* best-effort */ }

  try {
    await logOrderEvent(svc, {
      orderId,
      event: 'buyer_payment_sent',
      actorId: callerId,
      actorRole: 'buyer',
      payload: { total, payment_method: order.payment_method },
    });
  } catch (err) {
    console.error('[payment-sent] order event error:', err);
  }

  // Ask the agent the question immediately - this is the whole point.
  try {
    if (order.agent_id && !order.payment_confirmed_at) {
      await notify(svc, {
        userId: order.agent_id,
        type: 'payment_reminder',
        title: `Did You Receive Payment? Order #${short}`,
        body: `The Buyer Confirmed Sending ${totalFmt} For Order #${short}. Tap To Confirm You Received It So The Order Can Be Processed.`,
        url: `/dashboard/agent?tab=Orders&order=${short}`,
      });
    }
  } catch (err) {
    console.error('[payment-sent] agent notification error:', err);
  }

  return NextResponse.json({ success: true, orderId, buyerPaymentSentAt: nowIso });
}
