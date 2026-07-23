/**
 * POST /api/agent/orders/ship
 *
 * Agent-owned shipping: the agent buys a label with their own carrier account
 * (recommended tool: Pirate Ship) and pastes the tracking number here. The
 * order moves approved_ship | in_fulfillment -> shipped, the platform EasyPost
 * account subscribes a tracker for buyer-facing tracking, and the same shipped
 * side effects the retired label-purchase route fired (buyer notification,
 * timeline event, shipped email, order.shipped webhook) are dispatched.
 *
 * Body: { orderId: string, trackingNumber: string, carrier?: string }
 *
 * Guards: assertSameOrigin -> requireAgent -> ownership (agent or parent
 * super-agent, enforced inside shipOrderWithTracking) -> withIdempotency.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { withIdempotency, readIdempotencyKey } from '@/lib/idempotency';
import { shipOrderWithTracking } from '@/lib/agent-ship';

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  try {
    const gate = await requireAgent();
    if (!gate.ok) return gate.response;

    const callerId = gate.user.id;
    const body = await req.json().catch(() => ({}));
    const { orderId, trackingNumber, carrier } = body || {};

    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json({ error: 'Order ID Required' }, { status: 400 });
    }
    if (!trackingNumber || typeof trackingNumber !== 'string') {
      return NextResponse.json({ error: 'Tracking Number Required' }, { status: 400 });
    }

    return withIdempotency({
      userId: callerId,
      route: '/api/agent/orders/ship',
      key: readIdempotencyKey(req),
      request: { orderId, trackingNumber, carrier: carrier ?? null },
      handler: async () => {
        const supabase = await createServiceClient();
        const result = await shipOrderWithTracking(supabase, {
          orderId,
          actorId: callerId,
          rawTracking: trackingNumber,
          rawCarrier: typeof carrier === 'string' ? carrier : null,
        });

        if (!result.ok) {
          return NextResponse.json({ error: result.error }, { status: result.status });
        }

        return NextResponse.json({
          ok: true,
          status: 'shipped',
          trackingNumber: result.trackingNumber,
          carrier: result.carrier,
        });
      },
    });
  } catch (error) {
    console.error('Agent Order Ship API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
