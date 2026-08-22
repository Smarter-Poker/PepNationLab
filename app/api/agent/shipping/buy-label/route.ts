/**
 * POST /api/agent/shipping/buy-label
 *
 * EasyPost Forge: the agent buys a shipping label inside the portal, paid
 * from THEIR OWN EasyPost wallet (their sub-account key is resolved inside
 * lib/shipping.getActiveKey via source 'agent_forge'; the ledger row records
 * paid_by 'agent'). The platform never touches shipping money.
 *
 * Body: { orderId: string, serviceLevel?: string }
 * Headers: Idempotency-Key supported (same as /api/agent/orders/ship);
 * buyLabel itself is additionally idempotent on order_id.
 *
 * Guards: assertSameOrigin -> requireAgent -> Forge enabled + caller billing
 * active -> ownership (agent or parent super-agent) + status
 * approved_ship | in_fulfillment + fulfillment 'ship' -> withIdempotency.
 *
 * On a fresh purchase the same shipped side effects as the paste-back flow
 * fire via lib/agent-ship.fireShippedSideEffects (tracker subscription, buyer
 * notification, timeline event, shipped email, order.shipped webhook).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, createAdminClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { withIdempotency, readIdempotencyKey } from '@/lib/idempotency';
import { pickOne } from '@/lib/relations';
import { isForgeEnabled, getAgentForgeStatus } from '@/lib/forge';
import { buyLabel } from '@/lib/shipping';
import { fireShippedSideEffects } from '@/lib/agent-ship';

export const dynamic = 'force-dynamic';

const SHIPPABLE_STATUSES = ['approved_ship', 'in_fulfillment'];

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  try {
    const gate = await requireAgent();
    if (!gate.ok) return gate.response;
    const callerId = gate.user.id;

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const orderId = typeof body?.orderId === 'string' ? body.orderId.trim() : '';
    const serviceLevel =
      typeof body?.serviceLevel === 'string' && body.serviceLevel.trim()
        ? body.serviceLevel.trim()
        : null;

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID Required' }, { status: 400 });
    }

    const admin = createAdminClient();
    const available = await isForgeEnabled(admin);
    if (!available) {
      return NextResponse.json(
        { error: 'Shipping Accounts Are Not Enabled On This Platform Yet.' },
        { status: 403 },
      );
    }
    const account = await getAgentForgeStatus(admin, callerId);
    if (!account.provisioned || account.billingStatus !== 'active') {
      return NextResponse.json(
        { error: 'Set Up Your Shipping Account And Add A Card Before Buying Labels.' },
        { status: 403 },
      );
    }

    // Pre-flight order checks. buyLabel enforces ownership again internally,
    // but it does NOT restrict status/fulfillment (the admin bulk path buys
    // in other states), so the agent route must.
    const { data: order, error: orderErr } = await admin
      .from('orders')
      .select('id, buyer_id, agent_id, status, fulfillment_method, profiles!orders_agent_id_fkey(parent_agent_id)')
      .eq('id', orderId)
      .maybeSingle();
    if (orderErr || !order) {
      return NextResponse.json({ error: 'Order Not Found' }, { status: 404 });
    }
    const orderAgent = pickOne<{ parent_agent_id: string | null }>(order.profiles);
    if (order.agent_id !== callerId && orderAgent?.parent_agent_id !== callerId) {
      return NextResponse.json({ error: 'Unauthorized To Ship This Order' }, { status: 403 });
    }
    if (order.fulfillment_method !== 'ship') {
      return NextResponse.json(
        { error: 'Pickup Orders Do Not Ship. Mark Them Delivered At Handoff Instead.' },
        { status: 409 },
      );
    }
    if (!SHIPPABLE_STATUSES.includes(order.status as string)) {
      return NextResponse.json(
        { error: 'This Order Is Not Ready To Ship. Only Approved Ship Or In Fulfillment Orders Can Buy A Label.' },
        { status: 409 },
      );
    }
    const buyerId = (order.buyer_id as string | null) ?? null;

    return withIdempotency({
      userId: callerId,
      route: '/api/agent/shipping/buy-label',
      key: readIdempotencyKey(req),
      request: { orderId, serviceLevel },
      handler: async () => {
        const result = await buyLabel({
          orderId,
          agentId: callerId,
          preferredServiceLevel: serviceLevel,
          labelFileType: 'PDF_4x6',
        });

        if (!result.ok) {
          return NextResponse.json({ error: result.error, code: result.code ?? null }, { status: result.status });
        }

        // Fresh purchase: fire the same shipped side effects as the
        // paste-back flow. Replays (idempotent hits) already fired them.
        if (!result.idempotent) {
          const supabase = await createServiceClient();
          await fireShippedSideEffects(supabase, {
            orderId,
            actorId: callerId,
            buyerId,
            trackingNumber: result.trackingNumber,
            carrier: result.carrier,
            via: 'agent_forge_label',
          });
        }

        return NextResponse.json({
          ok: true,
          status: 'shipped',
          trackingNumber: result.trackingNumber,
          labelUrl: result.labelUrl,
          labelCostCents: result.labelCostCents,
          carrier: result.carrier,
          serviceLevel: result.serviceLevel,
        });
      },
    });
  } catch (error) {
    console.error('Agent Buy Label API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
