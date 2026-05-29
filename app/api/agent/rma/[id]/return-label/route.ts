import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { purchaseReturnLabel } from '@/lib/shippo-returns';
import { pickOne } from '@/lib/relations';

export const dynamic = 'force-dynamic';

/**
 * POST /api/agent/rma/[id]/return-label
 * Agent purchases a Shippo return label for the RMA. Uses the owning agent's
 * Shippo API key and warehouse address; buyer address is taken from the order.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAgent();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: 'Id Required' }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = await createServiceClient();

  // Determine which agent's Shippo credentials to charge — owning agent
  // (preferred). The caller must be that agent or their parent super_agent.
  const { data: rma, error: rmaErr } = await service
    .from('rma_requests')
    .select('id, order_id, status, requester_id, orders(agent_id, profiles:profiles!orders_agent_id_fkey(parent_agent_id))')
    .eq('id', id)
    .single();

  if (rmaErr || !rma) return NextResponse.json({ error: 'Not Found' }, { status: 404 });

  const order = pickOne<{ agent_id: string | null; profiles: any }>(rma.orders);
  if (!order || !order.agent_id) {
    return NextResponse.json({ error: 'Order Has No Agent To Bill' }, { status: 422 });
  }
  const ownerParent = pickOne<{ parent_agent_id: string | null }>(order.profiles);
  const allowed = order.agent_id === user.id || ownerParent?.parent_agent_id === user.id;
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const result = await purchaseReturnLabel(service, { rmaId: id, agentId: order.agent_id });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  // Notify buyer in-app.
  if (rma.requester_id) {
    await service.from('internal_messages').insert({
      sender_id: user.id,
      receiver_id: rma.requester_id,
      subject: 'Return Shipping Label Ready',
      body: `Your Return Shipping Label Is Ready. Tracking Number: ${result.trackingNumber}. View The Label In Your Returns Tab.`,
      type: 'direct_message',
    });
  }

  return NextResponse.json({ ok: true, tracking_number: result.trackingNumber, label_url: result.labelUrl });
}
