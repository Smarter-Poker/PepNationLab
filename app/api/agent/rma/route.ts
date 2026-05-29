import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/rma
 * Returns RMAs for orders the calling agent owns (and any sub-agent in their
 * downline if they are a super_agent). Optional query filter `?status=`.
 */
export async function GET(req: Request) {
  const gate = await requireAgent();
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  const statusFilter = url.searchParams.get('status');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = await createServiceClient();

  // Build list of agent ids the caller can see: themselves + any sub-agents.
  const { data: subAgents } = await service
    .from('profiles')
    .select('id')
    .eq('parent_agent_id', user.id);
  const agentIds = [user.id, ...((subAgents ?? []).map((p) => p.id))];

  // Find orders attributed to one of those agents.
  const { data: orders } = await service
    .from('orders')
    .select('id, agent_id, buyer_id, total, status, created_at')
    .in('agent_id', agentIds);

  const orderIds = (orders ?? []).map((o) => o.id);
  if (orderIds.length === 0) return NextResponse.json({ rmas: [] });

  let query = service
    .from('rma_requests')
    .select(`
      id, order_id, requester_id, status, reason_category, reason_details, requested_resolution,
      return_label_url, return_tracking_number, return_label_purchased_at,
      received_at, inspected_at, restock_decision, resolution_type, resolved_at,
      rejected_reason, created_at, updated_at,
      rma_items(id, product_name, quantity, unit_amount, condition_received),
      requester:profiles!rma_requests_requester_id_fkey(full_name, email, username)
    `)
    .in('order_id', orderIds)
    .order('created_at', { ascending: false });

  if (statusFilter) query = query.eq('status', statusFilter);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Annotate each rma with the order's basic info.
  const orderMap = new Map((orders ?? []).map((o) => [o.id, o]));
  const enriched = (data ?? []).map((r) => ({ ...r, order: orderMap.get(r.order_id) ?? null }));

  return NextResponse.json({ rmas: enriched });
}
