import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { isAgentAncestorOf } from '@/lib/agent-auth';
import { assertSameOrigin } from '@/lib/csrf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

  const { error: updateErr } = await svc
    .from('orders')
    .update({
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId);

  if (updateErr) {
    console.error('[mark-paid] order update failed:', updateErr.message);
    return NextResponse.json({ error: 'Failed To Update Order Status. Please Try Again.' }, { status: 500 });
  }

  try {
    if (order.buyer_id && order.agent_id) {
      const conversationId = await findOrCreateDirectConversation(svc, order.buyer_id, order.agent_id);
      if (conversationId) {
        const shortId = orderId.slice(0, 8).toUpperCase();
        const totalStr = Number(order.total).toFixed(2);
        const statusMsg = isAgentPickup
          ? `Payment Verified For Order #${shortId} ($${totalStr}). Your Order Has Been Approved For Pickup - Your Agent Will Contact You Shortly.`
          : `Payment Verified For Order #${shortId} ($${totalStr}). Your Order Has Been Submitted To Fulfillment For Processing. You Will Receive A Tracking Number Once Shipped.`;

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

async function findOrCreateDirectConversation(
  svc: ReturnType<typeof createAdminClient>,
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
