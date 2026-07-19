import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { isAgentAncestorOf } from '@/lib/agent-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { findOrCreateDirectConversation } from '@/lib/messenger/conversations';
import { notifyPaymentConfirmed, notifyAdmins, notify } from '@/lib/notify';
import { emailConfigured, sendPaymentConfirmedEmail } from '@/lib/email';
import { logOrderEvent } from '@/lib/order-events';
import { shortOrderId } from '@/lib/push-enqueue';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/agent/orders/mark-paid
 *
 * The agent (or an upline ancestor) confirms they received the buyer's
 * peer-to-peer payment. This is the platform's payment-confirmation moment,
 * so it now:
 *   - stamps orders.payment_confirmed_at / payment_confirmed_by (audit)
 *   - stamps the latest unverified payment_proofs row verified_at/verified_by
 *   - notifies the buyer (in-app + push + email) with honest status copy
 *   - notifies the agent's upline super agent and all admins
 *   - appends a payment_confirmed order_events row
 *   - drops a messenger message in the buyer<->agent thread (as before)
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

  if (!orderId || typeof orderId !== 'string') {
    return NextResponse.json({ error: 'Order ID Is Required.' }, { status: 400 });
  }

  const { data: order, error: orderErr } = await svc
    .from('orders')
    .select('id, agent_id, buyer_id, status, fulfillment_method, total, payment_method, created_at')
    .eq('id', orderId)
    .maybeSingle();

  if (orderErr || !order) {
    return NextResponse.json({ error: 'Order Not Found.' }, { status: 404 });
  }

  const isDirectAgent = order.agent_id === callerId;
  const isAncestor = !isDirectAgent && order.agent_id
    ? await isAgentAncestorOf(svc, callerId, order.agent_id)
    : false;

  if (!isDirectAgent && !isAncestor) {
    return NextResponse.json({ error: 'Forbidden. You Do Not Manage This Order.' }, { status: 403 });
  }

  if (order.status !== 'pending_customer_payment') {
    return NextResponse.json(
      { error: `Order Is Already At Status "${order.status}". Only Pending Payment Orders Can Be Marked Paid.` },
      { status: 400 }
    );
  }

  const isAgentPickup = order.fulfillment_method === 'agent_pickup';
  const nextStatus = 'agent_approval_pending';
  const nowIso = new Date().toISOString();

  // Compare-and-swap on status so two concurrent mark-paid clicks (agent on
  // two devices, or agent + upline) cannot both win and double-notify.
  const { data: claimed, error: updateErr } = await svc
    .from('orders')
    .update({
      status: nextStatus,
      payment_confirmed_at: nowIso,
      payment_confirmed_by: callerId,
      // Fresh escalation ladder for the new waiting stage.
      stale_escalation_level: 0,
      last_stale_escalation_at: null,
      updated_at: nowIso,
    })
    .eq('id', orderId)
    .eq('status', 'pending_customer_payment')
    .select('id');

  if (updateErr) {
    console.error('[mark-paid] order update failed:', updateErr.message);
    return NextResponse.json({ error: 'Failed To Update Order Status. Please Try Again.' }, { status: 500 });
  }
  if (!claimed || claimed.length === 0) {
    return NextResponse.json({ error: 'Order Was Already Processed. Please Refresh To See Its Current Status.' }, { status: 409 });
  }

  const short = shortOrderId(orderId);
  const total = Number(order.total) || 0;
  const totalStr = total.toFixed(2);
  const totalFmt = `$${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Link the confirmation to the buyer's uploaded proof (if one exists):
  // stamp the newest unverified payment_proofs row for this order.
  try {
    const { data: proof } = await svc
      .from('payment_proofs')
      .select('id')
      .eq('order_id', orderId)
      .is('verified_at', null)
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (proof?.id) {
      await svc
        .from('payment_proofs')
        .update({ verified_at: nowIso, verified_by: callerId })
        .eq('id', proof.id);
    }
  } catch (err) {
    console.error('[mark-paid] proof verification stamp failed:', err);
  }

  // Order timeline.
  await logOrderEvent(svc, {
    orderId,
    event: 'payment_confirmed',
    actorId: callerId,
    actorRole: isDirectAgent ? 'agent' : 'upline',
    payload: { total, payment_method: order.payment_method },
  });

  // Buyer: in-app + push + email. Honest copy - the order now awaits agent
  // approval; it has NOT been submitted to fulfillment yet.
  try {
    if (order.buyer_id) {
      await notifyPaymentConfirmed(svc, order.buyer_id, orderId, short, totalFmt);
      if (emailConfigured()) {
        const { data: buyer } = await svc
          .from('profiles')
          .select('contact_email, email_verified, full_name')
          .eq('id', order.buyer_id)
          .maybeSingle();
        let buyerTo: string | null = (buyer?.contact_email && buyer.email_verified) ? buyer.contact_email : null;
        if (!buyerTo) {
          // Fallback: the auth account email (already verified by the login flow).
          const { data: authUser } = await svc.auth.admin.getUserById(order.buyer_id);
          buyerTo = authUser?.user?.email ?? null;
        }
        if (buyerTo) {
          await sendPaymentConfirmedEmail({
            to: buyerTo,
            fullName: buyer?.full_name ?? null,
            orderId,
            total,
          }).catch(() => {});
        }
      }
    }
  } catch (err) {
    console.error('[mark-paid] buyer notification error:', err);
  }

  // Upline super agent + admins: payment confirmations are money events -
  // the whole chain should see them, not just the confirming agent.
  try {
    let agentName: string | null = null;
    let parentAgentId: string | null = null;
    if (order.agent_id) {
      const { data: agentProf } = await svc
        .from('profiles')
        .select('full_name, parent_agent_id')
        .eq('id', order.agent_id)
        .maybeSingle();
      agentName = agentProf?.full_name ?? null;
      parentAgentId = agentProf?.parent_agent_id ?? null;
    }
    if (parentAgentId && parentAgentId !== callerId) {
      await notify(svc, {
        userId: parentAgentId,
        type: 'payment_confirmed',
        title: `Downline Payment Confirmed: Order #${short}`,
        body: `${agentName || 'Your Sub-Agent'} Confirmed A ${totalFmt} Payment On Order #${short}. It Now Awaits Approval.`,
        url: '/dashboard?tab=Orders',
      });
    }
    await notifyAdmins(svc, {
      type: 'payment_confirmed',
      title: `Payment Confirmed: Order #${short} ($${totalStr})`,
      body: `${agentName || 'An Agent'} Confirmed Payment On Order #${short}. The Order Is Now Awaiting Approval.`,
      url: `/admin/orders?highlight=${orderId}`,
      skipUserIds: [callerId],
    });
  } catch (err) {
    console.error('[mark-paid] chain notification error:', err);
  }

  // Messenger thread message (as before, with corrected status copy).
  try {
    if (order.buyer_id && order.agent_id) {
      const conversationId = await findOrCreateDirectConversation(svc, order.buyer_id, order.agent_id);
      if (conversationId) {
        const statusMsg = isAgentPickup
          ? `Payment Verified For Order #${short} ($${totalStr}). Your Order Is Now Awaiting Final Approval For Pickup - Your Agent Will Contact You Shortly.`
          : `Payment Verified For Order #${short} ($${totalStr}). Your Order Is Now Awaiting Final Approval - You Will Be Notified As Soon As It Is Approved, And Again When It Ships With Tracking.`;

        await svc.from('messenger_messages').insert({
          conversation_id: conversationId,
          sender_id: callerId,
          text: statusMsg,
          message_type: 'text',
          media_url: null,
          media_metadata: {},
        });
      }
    }
  } catch (err) {
    console.error('[mark-paid] messenger notification error:', err);
  }

  return NextResponse.json({
    success: true,
    orderId,
    newStatus: nextStatus,
    isAgentPickup,
  });
}
