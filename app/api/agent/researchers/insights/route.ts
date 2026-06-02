import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';

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
  cohort_month: string; // YYYY-MM of researcher signup
  size: number;
  retained_by_month: number[]; // retention[i] = active in month i after signup
}

/**
 * GET /api/agent/researchers/insights
 *
 * Returns derived datasets that power the Charts and Acquisition tabs:
 *   - dow_heatmap: 7×HEATMAP_WEEKS matrix of order counts by weekday × week
 *   - top_customers: top 10 researchers by lifetime value (with name + LTV)
 *   - cohort_retention: monthly cohorts of researcher signups with month-by-
 *       month retention (active = placed an order in that calendar month)
 *   - funnel: source visit → signup → first_order → repeat conversion ratios
 *       (visit counts come from storefront_events; everything else from orders)
 *
 * Computed server-side to avoid a 6-table join in the browser. Returned in
 * one round-trip so the Charts tab paints in a single fetch.
 */
export async function GET() {
  const gate = await requireAgent();
  if (!gate.ok) return gate.response;
  const agentId = gate.user.id;
  const svc = await createServiceClient();

  const now = new Date();
  const startOfHeatmap = new Date(now);
  startOfHeatmap.setDate(startOfHeatmap.getDate() - HEATMAP_WEEKS * 7);

  const [{ data: orders }, { data: researchers }, { data: visits }] = await Promise.all([
    svc
      .from('orders')
      .select('buyer_id, total, status, created_at')
      .eq('agent_id', agentId)
      .gte('created_at', startOfHeatmap.toISOString()),
    svc
      .from('profiles')
      .select('id, full_name, username, email, created_at, acquisition_source')
      .eq('referring_agent_id', agentId)
      .eq('role', 'researcher'),
    svc
      .from('storefront_events')
      .select('event_type, source, created_at')
      .eq('agent_id', agentId)
      .gte('created_at', startOfHeatmap.toISOString())
      .limit(5000),
  ]);

  // Day-of-week × week heatmap (7×HEATMAP_WEEKS)
  const heatmap: number[][] = Array.from({ length: 7 }, () =>
    Array(HEATMAP_WEEKS).fill(0),
  );
  for (const o of orders ?? []) {
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

  // Top customers (lifetime value, scope: ALL orders not just heatmap window)
  const { data: allOrders } = await svc
    .from('orders')
    .select('buyer_id, total, status')
    .eq('agent_id', agentId);

  const buyerAgg = new Map<string, { ltv: number; count: number }>();
  for (const o of allOrders ?? []) {
    if (!o.buyer_id) continue;
    if (!COLLECTED.has(o.status as string)) continue;
    const a = buyerAgg.get(o.buyer_id as string) ?? { ltv: 0, count: 0 };
    a.ltv += Number(o.total ?? 0);
    a.count += 1;
    buyerAgg.set(o.buyer_id as string, a);
  }
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
    .sort((a, b) => b.lifetime_value - a.lifetime_value)
    .slice(0, 10);

  // Cohort retention: signup month → retention[i] = % active in month i after signup
  const cohortMap = new Map<string, { ids: Set<string>; signupAt: Date }>();
  for (const r of researchers ?? []) {
    const created = new Date(r.created_at as string);
    const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`;
    const bucket = cohortMap.get(key) ?? { ids: new Set<string>(), signupAt: created };
    bucket.ids.add(r.id as string);
    cohortMap.set(key, bucket);
  }
  // Build a per-buyer set of "month indices where they ordered"
  const buyerMonths = new Map<string, Set<string>>();
  for (const o of allOrders ?? []) {
    if (!o.buyer_id || COLLECTED.has(o.status as string) === false) continue;
    const order = await svc
      .from('orders')
      .select('created_at')
      .eq('buyer_id', o.buyer_id as string)
      .eq('agent_id', agentId)
      .limit(1);
    if (!order.data?.[0]) continue;
    const d = new Date(order.data[0].created_at as string);
    const monKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const s = buyerMonths.get(o.buyer_id as string) ?? new Set<string>();
    s.add(monKey);
    buyerMonths.set(o.buyer_id as string, s);
  }
  // Limit cohort horizon to 6 months
  const COHORT_MONTHS = 6;
  const sortedCohorts = [...cohortMap.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .slice(0, 6);
  const cohort_retention: CohortBucket[] = sortedCohorts.map(([cohort_month, b]) => {
    const retained = Array(COHORT_MONTHS).fill(0);
    const signup = b.signupAt;
    for (const id of b.ids) {
      const months = buyerMonths.get(id);
      if (!months) continue;
      for (let i = 0; i < COHORT_MONTHS; i += 1) {
        const target = new Date(signup);
        target.setMonth(target.getMonth() + i);
        const key = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}`;
        if (months.has(key)) retained[i] += 1;
      }
    }
    return { cohort_month, size: b.ids.size, retained_by_month: retained };
  });

  // Funnel: visits → signups → first_order → repeat
  const visitCount = (visits ?? []).filter((v) => v.event_type === 'storefront_visit').length;
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
}
