import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';

// GET: Per-agent sales aggregates with optional date range
export async function GET(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const supabase = await createServiceClient();
  const { searchParams } = req.nextUrl;
  const range = searchParams.get('range') ?? 'all'; // 'week' | 'month' | 'all'

  let fromDate: string | null = null;
  if (range === 'week') {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    fromDate = d.toISOString();
  } else if (range === 'month') {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    fromDate = d.toISOString();
  }

  // Fetch all non-cancelled orders with agent info
  let query = supabase
    .from('orders')
    .select(`
      id,
      agent_id,
      total,
      status,
      created_at,
      profiles!orders_agent_id_fkey (
        full_name,
        email,
        tier
      )
    `)
    .neq('status', 'cancelled');

  if (fromDate) {
    query = query.gte('created_at', fromDate);
  }

  const { data: orders, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Aggregate by agent
  const agentMap: Record<string, {
    agent_id: string;
    full_name: string;
    email: string;
    tier: string | null;
    order_count: number;
    total_revenue: number;
    pending_count: number;
  }> = {};

  // Also track direct (no agent) orders
  let directRevenue = 0;
  let directCount = 0;

  for (const order of (orders ?? [])) {
    const total = Number(order.total ?? 0);
    if (!order.agent_id) {
      directRevenue += total;
      directCount++;
      continue;
    }

    const profile = (order.profiles as unknown) as { full_name: string; email: string; tier: string | null } | null;
    if (!agentMap[order.agent_id]) {
      agentMap[order.agent_id] = {
        agent_id: order.agent_id,
        full_name: profile?.full_name ?? 'Unknown Agent',
        email: profile?.email ?? '',
        tier: profile?.tier ?? null,
        order_count: 0,
        total_revenue: 0,
        pending_count: 0,
      };
    }

    agentMap[order.agent_id].order_count++;
    agentMap[order.agent_id].total_revenue += total;
    if (order.status === 'pending_customer_payment' || order.status === 'agent_approval_pending') {
      agentMap[order.agent_id].pending_count++;
    }
  }

  // Also get overall totals
  const agents = Object.values(agentMap).sort((a, b) => b.total_revenue - a.total_revenue);
  const grandTotal = agents.reduce((sum, a) => sum + a.total_revenue, 0) + directRevenue;
  const grandOrders = agents.reduce((sum, a) => sum + a.order_count, 0) + directCount;

  return NextResponse.json({
    agents,
    direct: { revenue: directRevenue, count: directCount },
    totals: { revenue: grandTotal, orders: grandOrders },
  });
}
