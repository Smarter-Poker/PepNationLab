import { z } from "zod";
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { withIdempotency, readIdempotencyKey } from '@/lib/idempotency';
import { recordServerAnalyticsEvent } from '@/lib/server-analytics';

// All sales are final - no refunds or exchanges. Cancellation simply voids
// the order and commission rows. No refund_type parameter is accepted.
const CancelSchema = z.object({
  reason: z.string().min(1).max(500),
});


const POSTBodySchema = z.any();

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: 'Order Id Required' }, { status: 400 });

  
  const __rawBody = await req.json().catch(() => ({}));
  const __bodyParse = POSTBodySchema.safeParse(__rawBody);
  if (!__bodyParse.success) {
    return NextResponse.json({ error: "Invalid Request Body", details: __bodyParse.error.issues }, { status: 400 });
  }
  const body = __bodyParse.data;

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

      // Terminal-state guard: cancel_order does not itself block cancelling a
      // shipped/delivered order, and cancelling one cascades into reversing the
      // credit-line charge and voiding commissions for goods that already shipped
      // (with no offsetting refund) -- accounting corruption. The bulk cancel path
      // already blocks these; enforce the same here.
      const { data: existing, error: readErr } = await service
        .from('orders')
        .select('status')
        .eq('id', id)
        .maybeSingle();
      if (readErr) {
        return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
      }
      if (!existing) {
        return NextResponse.json({ error: 'Order Not Found.' }, { status: 404 });
      }
      if (existing.status === 'shipped' || existing.status === 'delivered' || existing.status === 'cancelled') {
        return NextResponse.json(
          { error: `Cannot Cancel An Order That Is Already ${existing.status}.` },
          { status: 422 }
        );
      }

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

      // The order is already committed-cancelled by the RPC above. If the audit
      // insert throws, it must NOT bubble out of the handler: withIdempotency
      // would delete the key and rethrow a 500, misleading the client into
      // thinking the cancel failed (a retry then hits the terminal-state guard).
      // Wrap it like every other route so a committed cancel is never masked.
      try {
        await service.from('admin_audit_log').insert({
          actor_id: gate.userId,
          action: 'order_cancelled',
          entity_type: 'order',
          entity_id: id,
          changes: { reason: parsed.data.reason },
        });
      } catch { /* audit failure must not mask a committed cancel */ }

      // Funnel analytics: net this order out of the 30d revenue rollup.
      // Best-effort and deduped per order id by a partial unique index.
      try {
        const { data: cancelled } = await service
          .from('orders')
          .select('agent_id, total, is_wholesale_restock')
          .eq('id', id)
          .maybeSingle();
        if (cancelled?.agent_id) {
          await recordServerAnalyticsEvent(service, {
            agent_id: cancelled.agent_id,
            event_type: 'order_cancelled',
            order_id: id,
            amount_cents: Math.round((Number(cancelled.total) || 0) * 100),
            is_wholesale: cancelled.is_wholesale_restock === true,
          });
        }
      } catch { /* analytics must never fail a cancellation */ }

      return NextResponse.json({ success: true, cancelled: true });
    },
  });
}
