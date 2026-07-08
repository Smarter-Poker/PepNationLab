import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgentOrAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COLLECTED = new Set([
  'approved_ship',
  'approved_pickup',
  'in_fulfillment',
  'shipped',
  'delivered',
]);

const HEATMAP_WEEKS = 12;

interface TopCustomer {
  id: string;
  name: string;
  lifetime_value: number;
  orders_count: number;
}

interface CohortBucket {
  cohort_month: string;
  size: number;
  retained_by_month: number[];
}

/**
 * GET /api/agent/researchers/insights
 *
 * Derived datasets that power the Charts and Acquisition tabs:
 *   - dow_heatmap: 7xHEATMAP_WEEKS matrix of order counts (Sun->Sat x week)
 *   - top_customers: top 10 researchers by collected lifetime value
 *   - cohort_retention: monthly signup cohorts x month-by-month retention
 *   - funnel: visits -> signups -> first orders -> repeat orders
 *
 * Visit counts read agent_storefront_events.event_type='pageview' rather
 * than a hypothetical 'storefront_events' table; that's the real
 * analytics surface. Everything else is computed from the agent's orders.
 *
 * All work is server-side and returned in one round-trip to keep the
 * Charts tab paint cost down.
 */
export async function GET() {
  const gate = await requireAgentOrAdmin();
  if (!gate.ok) return gate.response;
  const agentId = gate.user.id;
  const svc = await createServiceClient();
  try {

  const now = new Date();
  const startOfHeatmap = new Date(now);
  startOfHeatmap.setDate(startOfHeatmap.getDate() - HEATMAP_WEEKS * 7);

  // Pull everything we need in parallel. Each individual table read is
  // either RLS-locked to the agent (via service client + filter) or
  // entirely public (event_type list).
  const [
    { data: heatmapOrders },
    { data: researchers },
    { data: visits },
    { data: allOrders },
  ] = await Promise.all([
    svc
      .from('orders')
      .select('buyer_id, status, created_at')
      .eq('agent_id', agentId)
      .gte('created_at', startOfHeatmap.toISOString()),
    svc
      .from('profiles')
      .select('id, full_name, username, email, created_at, acquisition_source')
      .eq('referring_agent_id', agentId)
      .eq('role', 'researcher'),
    svc
      .from('agent_storefront_events')
      .select('event_type, created_at')
      .eq('agent_id', agentId)
      .eq('event_type', 'pageview')
      .gte('created_at', startOfHeatmap.toISOString())
      .limit(20000),
    svc
      .from('orders')
      .select('buyer_id, total, status, created_at')
      .eq('agent_id', agentId),
  ]);

  // Day-of-week x week heatmap (7xHEATMAP_WEEKS)
  const heatmap: number[][] = Array.from({ length: 7 }, () =>
    Array(HEATMAP_WEEKS).fill(0),
  );
  for (const o of heatmapOrders ?? []) {
    if (o.status === 'cancelled') continue;
    const d = new Date(o.created_at as string);
    const dow = d.getDay(); // 0=Sun
    const weeksAgo = Math.floor(
      (now.getTime() - d.getTime()) / (7 * 86400000),
    );
    if (weeksAgo < 0 || weeksAgo >= HEATMAP_WEEKS) continue;
    const col = HEATMAP_WEEKS - 1 - weeksAgo;
    heatmap[dow][col] += 1;
  }

  // Buyer aggregates from the full (RLS-scoped) order set
  const buyerAgg = new Map<
    string,
    { ltv: number; count: number; firstOrderMonths: Set<string> }
  >();
  for (const o of allOrders ?? []) {
    if (!o.buyer_id) continue;
    const buyerId = o.buyer_id as string;
    const a =
      buyerAgg.get(buyerId) ?? {
        ltv: 0,
        count: 0,
        firstOrderMonths: new Set<string>(),
      };
    if (COLLECTED.has(o.status as string)) {
      a.ltv += Number(o.total ?? 0);
      a.count += 1;
      const d = new Date(o.created_at as string);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      a.firstOrderMonths.add(key);
    }
    buyerAgg.set(buyerId, a);
  }

  // Top customers
  const nameById = new Map<string, string>();
  for (const r of researchers ?? []) {
    nameById.set(
      r.id as string,
      (r.full_name as string) || (r.username as string) || 'Researcher',
    );
  }
  const top_customers: TopCustomer[] = [...buyerAgg.entries()]
    .map(([id, a]) => ({
      id,
      name: nameById.get(id) ?? 'Researcher',
      lifetime_value: a.ltv,
      orders_count: a.count,
    }))
    .filter((r) => r.lifetime_value > 0)
    .sort((a, b) => b.lifetime_value - a.lifetime_value)
    .slice(0, 10);

  // Cohort retention: signup month -> retention[i] for i=0..5 months after signup
  const COHORT_MONTHS = 6;
  const cohortMap = new Map<string, { ids: Set<string>; signupAt: Date }>();
  for (const r of researchers ?? []) {
    const created = new Date(r.created_at as string);
    const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`;
    const bucket =
      cohortMap.get(key) ?? { ids: new Set<string>(), signupAt: created };
    bucket.ids.add(r.id as string);
    cohortMap.set(key, bucket);
  }
  const sortedCohorts = [...cohortMap.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .slice(0, 6);
  const cohort_retention: CohortBucket[] = sortedCohorts.map(
    ([cohort_month, b]) => {
      const retained = Array(COHORT_MONTHS).fill(0);
      const signup = b.signupAt;
      for (const id of b.ids) {
        const months = buyerAgg.get(id)?.firstOrderMonths;
        if (!months) continue;
        for (let i = 0; i < COHORT_MONTHS; i += 1) {
          const target = new Date(signup);
          target.setMonth(target.getMonth() + i);
          const key = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}`;
          if (months.has(key)) retained[i] += 1;
        }
      }
      return {
        cohort_month,
        size: b.ids.size,
        retained_by_month: retained,
      };
    },
  );

  const visitCount = visits?.length ?? 0;
  const signupCount = (researchers ?? []).length;
  const firstOrderCount = [...buyerAgg.values()].filter((a) => a.count >= 1).length;
  const repeatCount = [...buyerAgg.values()].filter((a) => a.count >= 2).length;

    return NextResponse.json({
      dow_heatmap: heatmap,
      heatmap_weeks: HEATMAP_WEEKS,
      top_customers,
      cohort_retention,
      funnel: {
        visits: visitCount,
        signups: signupCount,
        first_orders: firstOrderCount,
        repeat_orders: repeatCount,
      },
    });
  } catch (err) {
    console.error('[researchers/insights] error:', err);
    return NextResponse.json({ error: 'Failed To Load Insights' }, { status: 500 });
  }
}
