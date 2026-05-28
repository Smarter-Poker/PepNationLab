import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { isAgentAncestorOf } from '@/lib/agent-auth';

// GET: Line items for a single order. The agent must own the order (or be its
// super-agent ancestor); admins are always allowed.
export async function GET(req: NextRequest) {
  const gate = await requireAgent();
  if (!gate.ok) return gate.response;

  const supabase = await createServiceClient();
  const orderId = req.nextUrl.searchParams.get('orderId');

  if (!orderId) {
    return NextResponse.json({ error: 'Missing Order Id Parameter' }, { status: 400 });
  }

  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('id, agent_id')
    .eq('id', orderId)
    .maybeSingle();

  if (orderErr || !order) {
    return NextResponse.json({ error: 'Order Not Found' }, { status: 404 });
  }

  const callerId = gate.user.id;
  let isOwner =
    order.agent_id === callerId ||
    (order.agent_id ? await isAgentAncestorOf(supabase, callerId, order.agent_id) : false);

  if (!isOwner) {
    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', callerId)
      .maybeSingle();
    if (callerProfile?.role === 'admin') {
      isOwner = true;
    }
  }

  if (!isOwner) {
    return NextResponse.json({ error: 'You Do Not Own This Order' }, { status: 403 });
  }

  const { data, error } = await supabase
    .from('order_items')
    .select('id, product_name, quantity, unit_retail_price, unit_cost_price, product_id')
    .eq('order_id', orderId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
