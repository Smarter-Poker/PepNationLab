import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';

const RefundSchema = z.object({
  amount: z.number().positive(),
  reason: z.string().min(1).max(500),
  refund_type: z.enum(['agent_balance', 'store_credit', 'original_payment', 'admin_manual']),
  is_partial: z.boolean().optional().default(false),
  notes: z.string().max(2000).optional().nullable(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: 'Order Id Required' }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const parsed = RefundSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid Refund Payload', details: parsed.error.issues }, { status: 400 });
  }

  const service = await createServiceClient();

  const { data: refundId, error: rpcError } = await service.rpc('issue_refund', {
    p_order_id: id,
    p_amount: parsed.data.amount,
    p_reason: parsed.data.reason,
    p_refund_type: parsed.data.refund_type,
    p_is_partial: parsed.data.is_partial,
    p_notes: parsed.data.notes ?? null,
    p_actor_id: gate.userId,
  });

  if (rpcError) {
    return NextResponse.json({ error: rpcError.message || 'Refund Failed' }, { status: 422 });
  }

  const { data: orderAfter } = await service
    .from('orders')
    .select('refunded_amount, total')
    .eq('id', id)
    .single();

  await service.from('admin_audit_log').insert({
    actor_id: gate.userId,
    action: 'order_refund_issued',
    entity_type: 'order',
    entity_id: id,
    changes: {
      refund_id: refundId,
      amount: parsed.data.amount,
      refund_type: parsed.data.refund_type,
      reason: parsed.data.reason,
      is_partial: parsed.data.is_partial,
    },
  });

  return NextResponse.json({
    success: true,
    refund_id: refundId,
    new_refunded_amount: Number(orderAfter?.refunded_amount ?? 0),
    total: Number(orderAfter?.total ?? 0),
  });
}
