export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireManufacturer } from '@/lib/admin-auth';

/**
 * GET /api/manufacturer/network-orders
 * Returns orders placed through all agents in the manufacturer's downline.
 * Gated to manufacturer-only; all queries are scoped to the caller's downline.
 */
export async function GET() {
  const gate = await requireManufacturer();
  if (!gate.ok) return gate.response;

  const manufacturerId = gate.user.id;
  const supabase = createAdminClient();

  // Get all agent IDs under this manufacturer
  const { data: agentRows } = await supabase
    .from('profiles')
    .select('id, full_name, username')
    .eq('parent_agent_id', manufacturerId)
    .in('role', ['agent', 'super_agent']);

  const agentIds = (agentRows ?? []).map((a) => a.id);
  const agentMap: Record<string, string> = {};
  for (const a of agentRows ?? []) {
    agentMap[a.id] = a.full_name || a.username || a.id;
  }

  if (agentIds.length === 0) {
    return NextResponse.json({ orders: [], agentMap: {} });
  }

  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, created_at, status, buyer_name, subtotal, shipping_cost, total, agent_id, fulfillment_method, payment_method')
    .in('agent_id', agentIds)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    console.error('[manufacturer/network-orders]', error);
    return NextResponse.json({ error: 'Failed to load orders' }, { status: 500 });
  }

  return NextResponse.json({ orders: orders ?? [], agentMap });
}
