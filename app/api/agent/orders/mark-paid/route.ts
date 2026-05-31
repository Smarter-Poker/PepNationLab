import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { isAgentAncestorOf } from '@/lib/agent-auth';
import { assertSameOrigin } from '@/lib/csrf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/agent/orders/mark-paid
 *
 * Agent confirms payment receipt for a researcher's order.
 * - Validates the caller is the order's agent (or an ancestor).
 * - Moves status: pending_customer_payment → agent_approval_pending.
 * - For agent_pickup fulfillment (in-stock items): moves directly to
 *   approved_pickup without requiring admin review.
 * - Finds (or creates) the direct messenger conversation between the
 *   researcher and agent, then posts a status notification message.
 * - Notifies all admins so they can action agent_approval_pending orders.
 */
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAgent();
  if (!gate.ok) return gate.response;

  const svc = await createServiceClient();
  const callerId = gate.user.id;

  const body = await req.json().catch(() => ({}));
  const { orderId } = body ?? {};

  if (!orderId || typeof orderId !== 'string') {
    return NextResponse.json({ error: 'orderId Is Required.' }, { status: 400 });
  }

  // ── 1. Fetch the order ──────────────────────────────────────────────────
  const { data: order, error: orderErr } = await svc
    .from('orders')
    .select('id, agent_id, buyer_id, status, fulfillment_method, total, payment_method, created_at')
    .eq('id', orderId)
    .maybeSingle();

  if (orderErr || !order) {
    return NextResponse.json({ error: 'Order Not Found.' }, { status: 404 });
  }

  // ── 2. Authorize ────────────────────────────────────────────────────────
  const isDirectAgent = order.agent_id === callerId;
  const isAncestor = !isDirectAgent && order.agent_id
    ? await isAgentAncestorOf(svc, callerId, order.agent_id)
    : false;

  if (!isDirectAgent && !isAncestor) {
    return NextResponse.json({ error: 'Forbidden. You Do Not Manage This Order.' }, { status: 403 });
  }

  // ── 3. Validate current status ──────────────────────────────────────────
  if (order.status !== 'pending_customer_payment') {
    return NextResponse.json(
      { error: `Order Is Already At Status "${order.status}". Only Pending Payment Orders Can Be Marked Paid.` },
      { status: 400 }
    );
  }

  // ── 4. Determine next status ────────────────────────────────────────────
  // Agent pickup = in-stock item fulfilled directly by agent → no admin needed.
  // Ship = needs China fulfillment → goes to admin for approval.
  const isAgentPickup = order.fulfillment_method === 'agent_pickup';
  const nextStatus = isAgentPickup ? 'approved_pickup' : 'agent_approval_pending';

  // ── 5. Update order status ──────────────────────────────────────────────
  const { error: updateErr } = await svc
    .from('orders')
    .update({
      status: nextStatus,
      agent_approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId);

  if (updateErr) {
    console.error('[mark-paid] order update failed:', updateErr.message);
    return NextResponse.json({ error: 'Failed To Update Order Status. Please Try Again.' }, { status: 500 });
  }

  // ── 6. Messenger notification (awaited) ─────────────────────────
  try {
    if (order.buyer_id && order.agent_id) {
      const conversationId = await findOrCreateDirectConversation(svc, order.buyer_id, order.agent_id);
      if (conversationId) {
        const shortId = orderId.slice(0, 8).toUpperCase();
        const totalStr = Number(order.total).toFixed(2);
        const statusMsg = isAgentPickup
          ? `✅ Payment verified for Order #${shortId} ($${totalStr}). Your order has been approved for pickup — your agent will contact you shortly.`
          : `✅ Payment verified for Order #${shortId} ($${totalStr}). Your order has been submitted to fulfillment for processing. You will receive a tracking number once shipped.`;

        // Send as the agent (they are marking it paid)
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

  // ── 7. Notify admins (awaited) ─────────────────────────────────
  if (!isAgentPickup) {
    try {
      const { data: admins } = await svc
        .from('profiles')
        .select('id')
        .eq('role', 'admin');

      if (admins && admins.length > 0) {
        const shortId = orderId.slice(0, 8).toUpperCase();
        const totalStr = Number(order.total).toFixed(2);

        const notifications = admins.map((admin) => ({
          user_id: admin.id,
          title: 'Order Ready For Approval',
          body: `Order #${shortId} ($${totalStr}) — Payment verified by agent. Ready for fulfillment approval.`,
          type: 'system',
          url: '/admin/orders',
        }));

        await svc.from('notifications').insert(notifications);
      }
    } catch (err) {
      console.error('[mark-paid] admin notification error:', err);
    }
  }

  return NextResponse.json({
    success: true,
    orderId,
    newStatus: nextStatus,
    isAgentPickup,
  });
}

// ── Helper shared with payment-proof route ─────────────────────────────────────
async function findOrCreateDirectConversation(
  svc: Awaited<ReturnType<typeof createServiceClient>>,
  userAId: string,
  userBId: string
): Promise<string | null> {
  try {
    const { data: aParticipations } = await svc
      .from('messenger_participants')
      .select('conversation_id')
      .eq('user_id', userAId);

    const aConvoIds = (aParticipations ?? [])
      .map((p) => p.conversation_id)
      .filter(Boolean) as string[];

    if (aConvoIds.length > 0) {
      const { data: sharedDirectConvos } = await svc
        .from('messenger_conversations')
        .select('id')
        .eq('type', 'direct')
        .in('id', aConvoIds);

      const sharedDirectIds = (sharedDirectConvos ?? []).map(c => c.id);

      if (sharedDirectIds.length > 0) {
        const { data: sharedPart } = await svc
          .from('messenger_participants')
          .select('conversation_id')
          .eq('user_id', userBId)
          .in('conversation_id', sharedDirectIds)
          .limit(1)
          .maybeSingle();

        if (sharedPart?.conversation_id) return sharedPart.conversation_id;
      }
    }

    // Create a new direct conversation
    const { data: newConvo, error: convoErr } = await svc
      .from('messenger_conversations')
      .insert({ type: 'direct' })
      .select('id')
      .single();

    if (convoErr || !newConvo?.id) return null;

    await svc.from('messenger_participants').insert([
      { conversation_id: newConvo.id, user_id: userAId },
      { conversation_id: newConvo.id, user_id: userBId },
    ]);

    return newConvo.id;
  } catch {
    return null;
  }
}
