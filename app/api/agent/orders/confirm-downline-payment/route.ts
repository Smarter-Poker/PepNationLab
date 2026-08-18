import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { notify } from '@/lib/notify';
import { logOrderEvent } from '@/lib/order-events';
import { shortOrderId } from '@/lib/push-enqueue';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/agent/orders/confirm-downline-payment
 *
 * Platform rule: prepaid downlines settle per order (not via a weekly
 * statement/invoice like credit accounts), so their upline has to manually
 * acknowledge each order's payment was received. This is that acknowledgment
 * - the upline (the order agent's parent_agent_id) or an admin confirms
 * receipt, stamping orders.upline_payment_confirmed_at / _by, logging a
 * timeline event, and notifying the downline agent.
 *
 * COLUMN COLLISION FIX (2026-08-18): this route previously wrote
 * payment_confirmed_at - the SAME column mark-paid uses for "the agent
 * received the BUYER's payment". Whichever confirmation happened first
 * permanently blocked the other (the second caller got a 409), and any order
 * the downline had marked paid could never be settlement-acknowledged by the
 * upline. The upline acknowledgment now lives in its own column.
 */
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAgent();
  if (!gate.ok) return gate.response;

  const svc = createAdminClient();
  const callerId = gate.user.id;

  const body = await req.json().catch(() => ({}));
  const { orderId } = body ?? {};

  if (!orderId || typeof orderId !== 'string' || !UUID_RE.test(orderId)) {
    return NextResponse.json({ error: 'A Valid Order ID Is Required.' }, { status: 400 });
  }

  const { data: order, error: orderErr } = await svc
    .from('orders')
    .select('id, agent_id, status, total, upline_payment_confirmed_at')
    .eq('id', orderId)
    .maybeSingle();

  if (orderErr || !order) {
    return NextResponse.json({ error: 'Order Not Found.' }, { status: 404 });
  }

  if (!order.agent_id) {
    return NextResponse.json({ error: 'This Order Has No Agent Of Record.' }, { status: 400 });
  }

  const { data: agentProfile } = await svc
    .from('profiles')
    .select('account_type, parent_agent_id, full_name')
    .eq('id', order.agent_id)
    .maybeSingle();

  if (!agentProfile) {
    return NextResponse.json({ error: 'Order Agent Profile Not Found.' }, { status: 404 });
  }

  let isCallerAdmin = false;
  if (callerId !== agentProfile.parent_agent_id) {
    const { data: callerProfile } = await svc
      .from('profiles')
      .select('role')
      .eq('id', callerId)
      .maybeSingle();
    isCallerAdmin = callerProfile?.role === 'admin';
  }

  if (callerId !== agentProfile.parent_agent_id && !isCallerAdmin) {
    return NextResponse.json(
      { error: "Only The Order Agent's Upline Or An Admin Can Confirm This Payment." },
      { status: 403 }
    );
  }

  if (agentProfile.account_type !== 'prepaid') {
    return NextResponse.json(
      { error: 'This Downline Is Credit-Based. Credit Balances Settle Through Weekly Invoices.' },
      { status: 409 }
    );
  }

  if (order.status === 'cancelled') {
    return NextResponse.json({ error: 'This Order Was Cancelled.' }, { status: 409 });
  }

  if (order.upline_payment_confirmed_at) {
    return NextResponse.json({ error: 'Payment Was Already Confirmed.' }, { status: 409 });
  }

  const nowIso = new Date().toISOString();

  // Compare-and-swap: only the first caller to hit an unconfirmed order wins.
  const { data: claimed, error: updateErr } = await svc
    .from('orders')
    .update({ upline_payment_confirmed_at: nowIso, upline_payment_confirmed_by: callerId })
    .eq('id', orderId)
    .is('upline_payment_confirmed_at', null)
    .select('id');

  if (updateErr) {
    console.error('[confirm-downline-payment] update failed:', updateErr.message);
    return NextResponse.json({ error: 'Failed To Confirm Payment. Please Try Again.' }, { status: 500 });
  }
  if (!claimed || claimed.length === 0) {
    return NextResponse.json({ error: 'Payment Was Already Confirmed.' }, { status: 409 });
  }

  try {
    await logOrderEvent(svc, {
      orderId,
      event: 'upline_payment_confirmed',
      actorId: callerId,
      actorRole: 'agent',
      payload: { downline_acknowledgment: true },
    });

    const short = shortOrderId(orderId);
    await notify(svc, {
      userId: order.agent_id,
      type: 'payment_confirmed',
      title: `Payment Confirmed For Order #${short}`,
      body: `Your Upline Confirmed Receipt Of Your Payment For Order #${short}.`,
      url: '/dashboard?tab=Orders',
    });
  } catch (err) {
    console.error('[confirm-downline-payment] notification error:', err);
  }

  return NextResponse.json({ success: true });
}
