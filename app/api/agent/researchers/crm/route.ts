import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/researchers/crm
 *
 * CRM rollup for the calling agent's researchers. For every researcher the
 * agent referred (profiles.referring_agent_id = caller), returns:
 *   - order_count    : non-cancelled orders placed on the agent's store
 *   - total_spent    : lifetime value (sum of fulfilled/collected order totals)
 *   - last_order_at  : most recent non-cancelled order date
 *   - avg_order      : total_spent / paidOrderCount
 *   - note           : the agent's private CRM note for this researcher
 *
 * Plus aggregate totals for the header cards.
 */

// Statuses where money is considered collected/committed (mirrors the agent
// dashboard's revenue calc so lifetime value lines up with what's shown elsewhere).
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

    const agentId = gate.user.id;
    const svc = await createServiceClient();

    // 1. The agent's researchers
    const { data: researchers, error: rErr } = await svc
      .from('profiles')
      .select('id, full_name, username, email, phone, created_at, auto_approve_orders, last_sign_in_at, first_sign_in_at')
      .eq('referring_agent_id', agentId)
      .eq('role', 'researcher')
      .order('created_at', { ascending: false });

    if (rErr) {
      console.error('[crm] researchers error:', rErr.message);
      return NextResponse.json({ error: 'Failed To Load Researchers.' }, { status: 500 });
    }

    const list = researchers ?? [];
    if (list.length === 0) {
      return NextResponse.json({
        data: [],
        totals: { researchers: 0, lifetime_value: 0, total_orders: 0, active_buyers: 0 },
      });
    }

    // 2. All of this agent's orders (used to aggregate per buyer)
    const { data: orders, error: oErr } = await svc
      .from('orders')
      .select('buyer_id, total, status, created_at')
      .eq('agent_id', agentId);

    if (oErr) {
      console.error('[crm] orders error:', oErr.message);
      return NextResponse.json({ error: 'Failed To Load Orders.' }, { status: 500 });
    }

    // 3. Private notes
    const { data: notes } = await svc
      .from('agent_researcher_notes')
      .select('researcher_id, note')
      .eq('agent_id', agentId);

    const noteByResearcher = new Map<string, string>();
    for (const n of notes ?? []) {
      noteByResearcher.set(n.researcher_id as string, (n.note as string) ?? '');
    }

    // 4. Aggregate orders per buyer
    interface Agg {
      orderCount: number;
      paidCount: number;
      totalSpent: number;
      lastOrderAt: string | null;
    }
    const aggByBuyer = new Map<string, Agg>();
    for (const o of orders ?? []) {
      const buyerId = o.buyer_id as string | null;
      if (!buyerId) continue;
      const status = o.status as string;
      if (status === 'cancelled') continue;

      const a = aggByBuyer.get(buyerId) ?? { orderCount: 0, paidCount: 0, totalSpent: 0, lastOrderAt: null };
      a.orderCount += 1;
      if (COLLECTED_STATUSES.has(status)) {
        a.paidCount += 1;
        a.totalSpent += Number(o.total ?? 0);
      }
      const created = o.created_at as string | null;
      if (created && (!a.lastOrderAt || created > a.lastOrderAt)) {
        a.lastOrderAt = created;
      }
      aggByBuyer.set(buyerId, a);
    }

    // 5. Build rows + totals
    let lifetimeValue = 0;
    let totalOrders = 0;
    let activeBuyers = 0;

    const data = list.map((r) => {
      const a = aggByBuyer.get(r.id as string);
      const orderCount = a?.orderCount ?? 0;
      const totalSpent = a?.totalSpent ?? 0;
      const paidCount = a?.paidCount ?? 0;
      const avgOrder = paidCount > 0 ? totalSpent / paidCount : 0;

      lifetimeValue += totalSpent;
      totalOrders += orderCount;
      if (orderCount > 0) activeBuyers += 1;

      return {
        id: r.id,
        full_name: r.full_name,
        username: r.username,
        email: r.email,
        phone: (r as { phone?: string | null }).phone ?? null,
        created_at: r.created_at,
        auto_approve_orders: r.auto_approve_orders ?? false,
        last_sign_in_at: (r as { last_sign_in_at?: string | null }).last_sign_in_at ?? null,
        first_sign_in_at: (r as { first_sign_in_at?: string | null }).first_sign_in_at ?? null,
        order_count: orderCount,
        total_spent: Number(totalSpent.toFixed(2)),
        avg_order: Number(avgOrder.toFixed(2)),
        last_order_at: a?.lastOrderAt ?? null,
        note: noteByResearcher.get(r.id as string) ?? '',
      };
    });

    // Sort by lifetime value descending so the best customers surface first.
    data.sort((x, y) => y.total_spent - x.total_spent);

    return NextResponse.json({
      data,
      totals: {
        researchers: list.length,
        lifetime_value: Number(lifetimeValue.toFixed(2)),
        total_orders: totalOrders,
        active_buyers: activeBuyers,
      },
    });
  } catch (err) {
    console.error('[crm] unexpected:', err);
    return NextResponse.json({ error: 'Internal Server Error.' }, { status: 500 });
  }
}
