import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/sub-agents/network
 *
 * Downline rollup for the network map. Returns the calling agent (root) plus a
 * node per sub-agent (profiles.parent_agent_id = caller, is_sub_agent), each
 * carrying revenue, order count, pending commission, and storefront slug so the
 * UI can draw a branching tree of the downline and rank top performers.
 */

const COLLECTED_STATUSES = new Set([
  'approved_ship',
  'approved_pickup',
  'in_fulfillment',
  'shipped',
  'delivered',
]);

export async function GET() {
  try {
    const gate = await requireAgent();
    if (!gate.ok) return gate.response;

    const callerId = gate.user.id;
    const svc = await createAdminClient();

    // Caller must be a super-agent or agent (not sub-agent).
    const { data: caller } = await svc
      .from('profiles')
      .select('id, full_name, username, email, is_super_agent, is_sub_agent, role')
      .eq('id', callerId)
      .maybeSingle();

    if (!caller || caller.is_sub_agent === true) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const isSuperAgent = caller.role === 'super_agent' || caller.is_super_agent === true;

    // Downline directly under this caller.
    let query = svc
      .from('profiles')
      .select('id, full_name, username, email, commission_pct, is_active, created_at')
      .eq('parent_agent_id', callerId)
      .order('created_at', { ascending: false });

    if (isSuperAgent) {
      query = query.eq('is_sub_agent', false);
    } else {
      query = query.eq('is_sub_agent', true);
    }

    const { data: subs, error: sErr } = await query;

    if (sErr) {
      console.error('[network] subs error:', sErr.message);
      return NextResponse.json({ error: 'Failed To Load Sub-Agents.' }, { status: 500 });
    }

    const subList = subs ?? [];
    const subIds = subList.map((s) => s.id as string);

    // Batched: orders for all sub-agents, pending commission ledger, storefront slugs.
    const [ordersRes, ledgerRes, profilesRes] = await Promise.all([
      subIds.length
        ? svc.from('orders').select('agent_id, total, status').in('agent_id', subIds)
        : Promise.resolve({ data: [] as Array<{ agent_id: string; total: number; status: string }> }),
      subIds.length
        ? svc.from('sub_agent_commission_ledger').select('sub_agent_id, commission_amount').in('sub_agent_id', subIds).eq('status', 'pending')
        : Promise.resolve({ data: [] as Array<{ sub_agent_id: string; commission_amount: number }> }),
      subIds.length
        ? svc.from('agent_profiles').select('id, slug, display_name').in('id', subIds)
        : Promise.resolve({ data: [] as Array<{ id: string; slug: string; display_name: string }> }),
    ]);

    const revenueBySub = new Map<string, number>();
    const ordersBySub = new Map<string, number>();
    for (const o of (ordersRes.data ?? []) as Array<{ agent_id: string; total: number; status: string }>) {
      const sid = o.agent_id;
      if (o.status === 'cancelled') continue;
      ordersBySub.set(sid, (ordersBySub.get(sid) ?? 0) + 1);
      if (COLLECTED_STATUSES.has(o.status)) {
        revenueBySub.set(sid, (revenueBySub.get(sid) ?? 0) + Number(o.total ?? 0));
      }
    }

    const pendingBySub = new Map<string, number>();
    for (const l of (ledgerRes.data ?? []) as Array<{ sub_agent_id: string; commission_amount: number }>) {
      pendingBySub.set(l.sub_agent_id, (pendingBySub.get(l.sub_agent_id) ?? 0) + Number(l.commission_amount ?? 0));
    }

    const slugBySub = new Map<string, string>();
    for (const p of (profilesRes.data ?? []) as Array<{ id: string; slug: string }>) {
      slugBySub.set(p.id, p.slug);
    }

    let totalDownlineRevenue = 0;
    let totalPendingCommission = 0;
    let totalDownlineOrders = 0;

    const nodes = subList.map((s) => {
      const id = s.id as string;
      const revenue = Number((revenueBySub.get(id) ?? 0).toFixed(2));
      const orderCount = ordersBySub.get(id) ?? 0;
      const pending = Number((pendingBySub.get(id) ?? 0).toFixed(2));

      totalDownlineRevenue += revenue;
      totalPendingCommission += pending;
      totalDownlineOrders += orderCount;

      return {
        id,
        full_name: s.full_name,
        username: s.username,
        slug: slugBySub.get(id) ?? null,
        commission_pct: Number(s.commission_pct ?? 0),
        is_active: s.is_active ?? false,
        revenue,
        order_count: orderCount,
        pending_commission: pending,
      };
    });

    nodes.sort((a, b) => b.revenue - a.revenue);

    return NextResponse.json({
      root: {
        id: caller.id,
        full_name: caller.full_name,
        username: caller.username,
      },
      nodes,
      totals: {
        sub_agents: subList.length,
        active_sub_agents: subList.filter((s) => s.is_active).length,
        downline_revenue: Number(totalDownlineRevenue.toFixed(2)),
        downline_orders: totalDownlineOrders,
        pending_commission: Number(totalPendingCommission.toFixed(2)),
      },
    });
  } catch (err) {
    console.error('[network] unexpected:', err);
    return NextResponse.json({ error: 'Internal Server Error.' }, { status: 500 });
  }
}
