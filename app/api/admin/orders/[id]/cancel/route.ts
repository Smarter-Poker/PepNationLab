import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { withIdempotency, readIdempotencyKey } from '@/lib/idempotency';

// All sales are final - no refunds or exchanges. Cancellation simply voids
// the order and commission rows. No refund_type parameter is accepted.
const CancelSchema = z.object({
  reason: z.string().min(1).max(500),
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

  // Idempotent so a double-click on Cancel doesn't fire cancel_order twice.
  return withIdempotency({
    userId: gate.userId,
    route: `/api/admin/orders/${id}/cancel`,
    key: readIdempotencyKey(req),
    request: { id, ...parsed.data },
    handler: async () => {
      const service = createAdminClient();

      // cancel_order RPC: pass 'none' as refund_type - all sales are final.
      const { error: rpcError } = await service.rpc('cancel_order', {
        p_order_id: id,
        p_reason: parsed.data.reason,
        p_refund_type: 'none',
        p_actor_id: gate.userId,
      });

      if (rpcError) {
        return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 422 });
      }

      await service.from('admin_audit_log').insert({
        actor_id: gate.userId,
        action: 'order_cancelled',
        entity_type: 'order',
        entity_id: id,
        changes: { reason: parsed.data.reason },
      });

      return NextResponse.json({ success: true, cancelled: true });
    },
  });
}
