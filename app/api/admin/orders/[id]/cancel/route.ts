import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';

const CancelSchema = z.object({
  reason: z.string().min(1).max(500),
  refund_type: z
    .enum(['agent_balance', 'store_credit', 'original_payment', 'admin_manual', 'none'])
    .optional()
    .default('none'),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: 'Order Id Required' }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const parsed = CancelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid Cancel Payload', details: parsed.error.issues }, { status: 400 });
  }

  const service = await createServiceClient();

  const { data: refundId, error: rpcError } = await service.rpc('cancel_order', {
    p_order_id: id,
    p_reason: parsed.data.reason,
    p_refund_type: parsed.data.refund_type,
    p_actor_id: gate.userId,
  });

  if (rpcError) {
    return NextResponse.json({ error: rpcError.message || 'Cancel Failed' }, { status: 422 });
  }

  await service.from('admin_audit_log').insert({
    actor_id: gate.userId,
    action: 'order_cancelled',
    entity_type: 'order',
    entity_id: id,
    changes: {
      reason: parsed.data.reason,
      refund_type: parsed.data.refund_type,
      refund_id: refundId,
    },
  });

  return NextResponse.json({
    success: true,
    cancelled: true,
    refund_id: refundId ?? null,
  });
}
