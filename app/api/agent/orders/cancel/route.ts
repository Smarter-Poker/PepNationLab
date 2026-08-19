import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAgentOrAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { logOrderEvent } from '@/lib/order-events';
import { notifyOrderCancelled, notify } from '@/lib/notify';
import { emailConfigured, sendOrderCancelledEmail } from '@/lib/email';
import { shortOrderId } from '@/lib/push-enqueue';
import { recomputeBillingForCancelledOrder } from '@/lib/statement-recompute';

const CancelSchema = z.object({
  orderId: z.string().uuid(),
  reason: z.string().min(1).max(500),
});

const NON_CANCELLABLE = new Set(['shipped', 'delivered', 'cancelled']);

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAgentOrAdmin();
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => ({}));
  const parsed = CancelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid Cancel Payload', details: parsed.error.issues }, { status: 400 });
  }

  const { orderId, reason } = parsed.data;
  const callerId = gate.user.id;
  const isAdmin = gate.isAdmin;

  const service = createAdminClient();

  // Fetch the order — include the order-agent's parent_agent_id so we can
  // check super-agent hierarchy (a super_agent may cancel their downline's orders).
  const { data: order, error: readErr } = await service
    .from('orders')
    .select('id, status, agent_id, buyer_id, agent:profiles!agent_id(parent_agent_id)')
    .eq('id', orderId)
    .maybeSingle();

  if (readErr || !order) {
    return NextResponse.json({ error: 'Order Not Found.' }, { status: 404 });
  }

  const agentParentId = (order.agent as { parent_agent_id?: string | null } | null)?.parent_agent_id ?? null;
  const isDirectAgent = order.agent_id === callerId;
  const isSuperAgentParent = agentParentId === callerId;

  // Non-admins must either own the order or be the parent super-agent.
  if (!isAdmin && !isDirectAgent && !isSuperAgentParent) {
    return NextResponse.json({ error: 'You Are Not Authorized To Cancel This Order.' }, { status: 403 });
  }

  if (NON_CANCELLABLE.has(order.status)) {
    return NextResponse.json(
      { error: `Cannot Cancel An Order That Is Already ${order.status}.` },
      { status: 422 }
    );
  }

  // Run the cancel RPC.
  const { error: rpcError } = await service.rpc('cancel_order', {
    p_order_id: orderId,
    p_reason: reason,
    p_refund_type: 'none',
    p_actor_id: callerId,
  });

  if (rpcError) {
    return NextResponse.json({ error: 'Failed to cancel order. Please try again.' }, { status: 422 });
  }

  // Re-settle any weekly bill this order was already rolled into.
  await recomputeBillingForCancelledOrder(service, orderId, callerId).catch(() => { /* best-effort */ });

  // Fan-out: notifications + audit log. Best-effort — cancel is already committed.
  try {
    const short = shortOrderId(orderId);

    // Notify buyer
    if (order.buyer_id) {
      await notifyOrderCancelled(service, order.buyer_id, orderId, short);

      if (emailConfigured()) {
        const { data: buyerProf } = await service
          .from('profiles')
          .select('contact_email, email_verified, full_name')
          .eq('id', order.buyer_id)
          .maybeSingle();
        let to: string | null = (buyerProf?.contact_email && buyerProf.email_verified) ? buyerProf.contact_email : null;
        if (!to) {
          const { data: authUser } = await service.auth.admin.getUserById(order.buyer_id);
          to = authUser?.user?.email ?? null;
        }
        if (to) {
          sendOrderCancelledEmail({ to, fullName: buyerProf?.full_name ?? null, orderId }).catch(() => {});
        }
      }
    }

    // Notify agent if cancelled by an admin
    if (isAdmin && order.agent_id && order.agent_id !== callerId) {
      await notify(service, {
        userId: order.agent_id,
        type: 'system',
        title: `Order #${short} Cancelled By Admin`,
        body: `Order #${short} On Your Store Was Cancelled By An Administrator.${reason ? ` Reason: ${reason}` : ''}`,
        url: `/dashboard/agent?tab=Orders&order=${short}`,
      });
    }

    // Notify the sub-agent when their upline super-agent cancels their order
    if (!isAdmin && isSuperAgentParent && order.agent_id) {
      await notify(service, {
        userId: order.agent_id,
        type: 'system',
        title: `Order #${short} Cancelled By Your Upline`,
        body: `Order #${short} Was Cancelled By Your Upline Manager.${reason ? ` Reason: ${reason}` : ''}`,
        url: `/orders/${orderId}`,
      });
    }

    // Notify buyer if cancelled by agent (and buyer is different person)
    if (!isAdmin && order.buyer_id && order.buyer_id !== callerId) {
      await notify(service, {
        userId: order.buyer_id,
        type: 'system',
        title: `Order #${short} Cancelled`,
        body: `Your order has been cancelled.${reason ? ` Reason: ${reason}` : ''}`,
        url: `/orders/${orderId}`,
      });
    }

    await logOrderEvent(service, {
      orderId,
      event: 'cancelled',
      actorId: callerId,
      actorRole: isAdmin ? 'admin' : isSuperAgentParent ? 'super_agent' : 'agent',
      payload: { reason, via: isAdmin ? 'admin_agent_cancel_endpoint' : isSuperAgentParent ? 'super_agent_cancel_endpoint' : 'agent_cancel_endpoint' },
    });
  } catch { /* fan-out must not mask committed cancel */ }

  return NextResponse.json({ success: true, cancelled: true });
}

