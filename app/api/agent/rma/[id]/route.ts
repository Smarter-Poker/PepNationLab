import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { pickOne } from '@/lib/relations';
import { enqueueWebhook } from '@/lib/webhook-dispatch';

export const dynamic = 'force-dynamic';

const ApproveSchema = z.object({ action: z.literal('approve') });

const RejectSchema = z.object({
  action: z.literal('reject'),
  rejected_reason: z.string().min(3).max(500),
});

const MarkReceivedSchema = z.object({
  action: z.literal('mark_received'),
  received_at: z.string().datetime().optional().nullable(),
});

const MarkInspectedSchema = z.object({
  action: z.literal('mark_inspected'),
  inspection_notes: z.string().max(2000).optional().nullable(),
  restock_decision: z.enum(['restock', 'dispose', 'quarantine', 'vendor_return']),
  items_conditions: z.array(z.object({
    rma_item_id: z.string().uuid(),
    condition_received: z.enum(['unopened', 'damaged', 'tampered', 'partial', 'as_expected']),
  })).optional().default([]),
});

const ResolveSchema = z.object({
  action: z.literal('resolve'),
  resolution_type: z.enum(['refund_full', 'refund_partial', 'store_credit_full', 'store_credit_partial', 'replacement_sent', 'no_action']),
  refund_amount: z.number().nonnegative().optional(),
  refund_type: z.enum(['agent_balance', 'store_credit', 'original_payment', 'admin_manual']).optional(),
  reason: z.string().max(500).optional(),
  notes: z.string().max(2000).optional().nullable(),
});

const ActionSchema = z.discriminatedUnion('action', [
  ApproveSchema,
  RejectSchema,
  MarkReceivedSchema,
  MarkInspectedSchema,
  ResolveSchema,
]);

/**
 * GET /api/agent/rma/[id]
 * Returns the full detail of one RMA the agent owns.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAgent();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: 'Id Required' }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = await createServiceClient();

  const { data: rma, error: rmaErr } = await service
    .from('rma_requests')
    .select('*, orders(id, agent_id, buyer_id, status, total)')
    .eq('id', id)
    .single();

  if (rmaErr || !rma) return NextResponse.json({ error: 'Not Found' }, { status: 404 });

  // Ownership: caller must be the order's agent OR the agent's parent.
  const order = pickOne<{ id: string; agent_id: string | null; buyer_id: string | null; status: string; total: number }>(rma.orders);
  if (!order) return NextResponse.json({ error: 'Order Missing' }, { status: 404 });

  let allowed = order.agent_id === user.id;
  if (!allowed && order.agent_id) {
    const { data: agentProfile } = await service
      .from('profiles')
      .select('parent_agent_id')
      .eq('id', order.agent_id)
      .single();
    allowed = agentProfile?.parent_agent_id === user.id;
  }
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const [{ data: items }, { data: attachments }] = await Promise.all([
    service.from('rma_items').select('id, product_name, quantity, unit_amount, condition_received, order_item_id').eq('rma_id', id),
    service.from('rma_attachments').select('id, storage_key, mime_type, size_bytes, uploaded_at').eq('rma_id', id).order('uploaded_at', { ascending: false }),
  ]);

  const enrichedAttachments = await Promise.all(
    (attachments ?? []).map(async (row) => {
      const { data: signed } = await service.storage
        .from('rma-attachments')
        .createSignedUrl(row.storage_key, 600);
      return { ...row, signed_url: signed?.signedUrl ?? null };
    })
  );

  return NextResponse.json({ rma, order, items: items ?? [], attachments: enrichedAttachments });
}

/**
 * PATCH /api/agent/rma/[id]
 * Agent actions on a single RMA: approve, reject, mark_received,
 * mark_inspected, resolve. Each transitions status + writes audit columns.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAgent();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: 'Id Required' }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const parsed = ActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid Action', details: parsed.error.issues }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = await createServiceClient();

  const { data: rma, error: rmaErr } = await service
    .from('rma_requests')
    .select('id, order_id, status, requester_id, resolution_refund_id, return_label_url')
    .eq('id', id)
    .single();
  if (rmaErr || !rma) return NextResponse.json({ error: 'Not Found' }, { status: 404 });

  const { data: order } = await service
    .from('orders')
    .select('id, agent_id, buyer_id, total')
    .eq('id', rma.order_id)
    .single();
  if (!order) return NextResponse.json({ error: 'Order Missing' }, { status: 404 });

  let allowed = order.agent_id === user.id;
  if (!allowed && order.agent_id) {
    const { data: agentProfile } = await service
      .from('profiles')
      .select('parent_agent_id')
      .eq('id', order.agent_id)
      .single();
    allowed = agentProfile?.parent_agent_id === user.id;
  }
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const nowIso = new Date().toISOString();

  if (parsed.data.action === 'approve') {
    if (rma.status !== 'requested') {
      return NextResponse.json({ error: 'Only Requested RMAs Can Be Approved' }, { status: 409 });
    }
    const { error } = await service
      .from('rma_requests')
      .update({ status: 'approved', approved_by: user.id, approved_at: nowIso, updated_at: nowIso })
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (rma.requester_id) {
      await service.from('internal_messages').insert({
        sender_id: user.id,
        receiver_id: rma.requester_id,
        subject: 'Return Request Approved',
        body: 'Your Return Request Has Been Approved. You Will Receive Return Shipping Instructions Shortly.',
        type: 'direct_message',
      });
    }
    return NextResponse.json({ ok: true });
  }

  if (parsed.data.action === 'reject') {
    if (rma.status !== 'requested') {
      return NextResponse.json({ error: 'Only Requested RMAs Can Be Rejected' }, { status: 409 });
    }
    const { error } = await service
      .from('rma_requests')
      .update({
        status: 'rejected',
        rejected_by: user.id,
        rejected_at: nowIso,
        rejected_reason: parsed.data.rejected_reason,
        updated_at: nowIso,
      })
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (rma.requester_id) {
      await service.from('internal_messages').insert({
        sender_id: user.id,
        receiver_id: rma.requester_id,
        subject: 'Return Request Rejected',
        body: `Your Return Request Was Not Approved. Reason: ${parsed.data.rejected_reason}`,
        type: 'direct_message',
      });
    }
    return NextResponse.json({ ok: true });
  }

  if (parsed.data.action === 'mark_received') {
    if (!['label_sent', 'in_transit', 'approved'].includes(rma.status)) {
      return NextResponse.json({ error: 'Cannot Mark Received From Current Status' }, { status: 409 });
    }
    const receivedAt = parsed.data.received_at ?? nowIso;
    const { error } = await service
      .from('rma_requests')
      .update({ status: 'received', received_at: receivedAt, updated_at: nowIso })
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (parsed.data.action === 'mark_inspected') {
    if (rma.status !== 'received') {
      return NextResponse.json({ error: 'RMA Must Be Received Before Inspection' }, { status: 409 });
    }
    const { error } = await service
      .from('rma_requests')
      .update({
        status: 'inspected',
        inspected_at: nowIso,
        inspected_by: user.id,
        inspection_notes: parsed.data.inspection_notes ?? null,
        restock_decision: parsed.data.restock_decision,
        updated_at: nowIso,
      })
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Per-item condition updates.
    for (const c of parsed.data.items_conditions ?? []) {
      await service
        .from('rma_items')
        .update({ condition_received: c.condition_received })
        .eq('id', c.rma_item_id)
        .eq('rma_id', id);
    }
    return NextResponse.json({ ok: true });
  }

  if (parsed.data.action === 'resolve') {
    if (!['inspected', 'received', 'approved'].includes(rma.status)) {
      return NextResponse.json({ error: 'RMA Cannot Be Resolved From Current Status' }, { status: 409 });
    }

    const wantsRefund = parsed.data.resolution_type.startsWith('refund_') || parsed.data.resolution_type.startsWith('store_credit_');
    let refundId: string | null = null;

    if (wantsRefund) {
      const amount = parsed.data.refund_amount;
      if (!amount || amount <= 0) {
        return NextResponse.json({ error: 'Refund Amount Required For Refund Resolution' }, { status: 400 });
      }
      const refundType = parsed.data.refund_type
        ?? (parsed.data.resolution_type.startsWith('store_credit_') ? 'store_credit' : 'original_payment');
      const isPartial = parsed.data.resolution_type.endsWith('_partial');

      const { data: rpcResult, error: rpcErr } = await service.rpc('issue_refund', {
        p_order_id: rma.order_id,
        p_amount: amount,
        p_reason: parsed.data.reason || `RMA ${id.slice(0, 8).toUpperCase()} Resolution`,
        p_refund_type: refundType,
        p_is_partial: isPartial,
        p_notes: parsed.data.notes ?? null,
        p_actor_id: user.id,
      });
      if (rpcErr) {
        return NextResponse.json({ error: rpcErr.message || 'Refund Failed' }, { status: 422 });
      }
      refundId = (rpcResult as string) ?? null;
    }

    const { error } = await service
      .from('rma_requests')
      .update({
        status: 'resolved',
        resolution_type: parsed.data.resolution_type,
        resolution_refund_id: refundId,
        resolved_at: nowIso,
        resolved_by: user.id,
        notes: parsed.data.notes ?? null,
        updated_at: nowIso,
      })
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (rma.requester_id) {
      await service.from('internal_messages').insert({
        sender_id: user.id,
        receiver_id: rma.requester_id,
        subject: 'Return Request Resolved',
        body: `Your Return Request Has Been Resolved (${parsed.data.resolution_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}).`,
        type: 'direct_message',
      });
    }
    // Fire-and-forget webhook: rma.resolved
    const resolutionType = parsed.data.resolution_type;
    const resolvedOrderId = rma.order_id;
    const resolvedAgentId = order.agent_id ?? null;
    const resolvedRefundId = refundId;
    void (async () => {
      try {
        await enqueueWebhook(service, {
          event: 'rma.resolved',
          agentId: resolvedAgentId,
          payload: {
            rma: {
              id,
              order_id: resolvedOrderId,
              status: 'resolved',
              resolution_type: resolutionType,
              refund_id: resolvedRefundId,
            },
          },
          relatedOrderId: resolvedOrderId,
        });
      } catch { /* webhook must not break RMA resolve */ }
    })();

    return NextResponse.json({ ok: true, refund_id: refundId });
  }

  return NextResponse.json({ error: 'Unhandled Action' }, { status: 400 });
}
