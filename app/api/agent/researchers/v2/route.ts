import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/researchers/v2
 *
 * R30: rich CRM payload that powers the new researchers page. Everything the
 * UI needs in a single round-trip:
 *
 *   researchers[] : list with status, sparkline (12 weeks of order counts),
 *                   churn_risk, tags, is_pinned, last_contacted_at, source
 *   kpis          : 10 metric cards with current value, sparkline,
 *                   delta vs previous period, target click filter
 *   insights[]    : 2 to 4 actionable nudges with primary action
 *   activity[]    : last 20 events from orders + new researcher signups
 *   goal          : current month growth target + progress + streak count
 *   kanban_counts : counts per lifecycle stage for the toggle view
 *
 * Computed entirely on the server in one shot so the page renders fast.
 */

const COLLECTED = new Set([
  'approved_ship',
  'approved_pickup',
  'in_fulfillment',
  'shipped',
  'delivered',
]);

const MS_DAY = 86_400_000;
const MS_WEEK = 7 * MS_DAY;
const SPARK_WEEKS = 12;

type ResearcherStatus = 'lead' | 'new' | 'first_order' | 'active' | 'vip' | 'at_risk' | 'churned';

interface OrderRow {
  buyer_id: string | null;
  total: number | string | null;
  status: string;
  created_at: string;
}

interface Researcher {
  id: string;
  full_name: string | null;
  username: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
  auto_approve_orders: boolean | null;
  last_sign_in_at: string | null;
  first_sign_in_at: string | null;
  acquisition_source: string | null;
  referring_agent_id: string | null;
  account_type?: string | null;
}

function weekIndexFromNow(iso: string, now: number): number {
  const diff = now - new Date(iso).getTime();
  return Math.floor(diff / MS_WEEK);
}

function safeNum(v: unknown): number {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
}

function pctDelta(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

export async function GET() {
  try {
    const gate = await requireAgent();
    if (!gate.ok) return gate.response;

    const agentId = gate.user.id;
    const svc = await createServiceClient();
    const now = Date.now();
    const today = new Date(now);

    // 1. RESEARCHERS ------------------------------------------------------
    const { data: researchersRaw } = await svc
      .from('profiles')
      .select('id, full_name, username, email, phone, created_at, auto_approve_orders, last_sign_in_at, first_sign_in_at, acquisition_source, referring_agent_id, account_type')
      .eq('referring_agent_id', agentId)
      .eq('role', 'researcher')
      .order('created_at', { ascending: false });

    const researchers: Researcher[] = (researchersRaw ?? []) as Researcher[];

    if (researchers.length === 0) {
      return NextResponse.json(emptyPayload());
    }

    const researcherIds = researchers.map((r) => r.id);

    // 2. ORDERS (last 180 days) ------------------------------------------
    const cutoff180 = new Date(now - 180 * MS_DAY).toISOString();
    const { data: orders } = await svc
      .from('orders')
      .select('buyer_id, total, status, created_at')
      .eq('agent_id', agentId)
      .gte('created_at', cutoff180);

    const allOrders: OrderRow[] = (orders ?? []) as OrderRow[];

    // 3. TAGS / PINS / NOTES / REMINDERS ---------------------------------
    const [tagsRes, pinsRes, notesRes, remindersRes] = await Promise.all([
      svc.from('agent_researcher_tags').select('researcher_id, tag, color').eq('agent_id', agentId),
      svc.from('agent_researcher_pins').select('researcher_id').eq('agent_id', agentId),
      svc.from('agent_researcher_notes').select('researcher_id, note, updated_at').eq('agent_id', agentId),
      svc.from('agent_researcher_reminders').select('id, researcher_id, title, remind_at, completed_at').eq('agent_id', agentId).is('completed_at', null).order('remind_at', { ascending: true }),
    ]);

    const tagsByResearcher = new Map<string, { tag: string; color: string | null }[]>();
    for (const t of tagsRes.data ?? []) {
      const arr = tagsByResearcher.get(t.researcher_id as string) ?? [];
      arr.push({ tag: t.tag as string, color: (t.color as string | null) ?? null });
      tagsByResearcher.set(t.researcher_id as string, arr);
    }
    const pinned = new Set((pinsRes.data ?? []).map((p) => p.researcher_id as string));
    const noteByResearcher = new Map<string, { note: string; updated_at: string }>();
    for (const n of notesRes.data ?? []) {
      noteByResearcher.set(n.researcher_id as string, {
        note: (n.note as string) ?? '',
        updated_at: (n.updated_at as string) ?? '',
      });
    }
    const remindersByResearcher = new Map<string, { id: string; title: string; remind_at: string }[]>();
    for (const r of remindersRes.data ?? []) {
      const arr = remindersByResearcher.get(r.researcher_id as string) ?? [];
      arr.push({
        id: r.id as string,
        title: r.title as string,
        remind_at: r.remind_at as string,
      });
      remindersByResearcher.set(r.researcher_id as string, arr);
    }

    // 4. LAST CONTACTED -------------------------------------------------
    // For each researcher, find the most recent message sent by THIS agent
    // to a conversation that includes them. Use a single batched query.
    const lastContactedByResearcher = new Map<string, string>();
    try {
      const { data: convoRows } = await svc
        .from('messenger_participants')
        .select('conversation_id, user_id')
        .in('user_id', researcherIds);
      const convoToResearcher = new Map<string, string>();
      const conversationIds: string[] = [];
      for (const c of convoRows ?? []) {
        const userId = c.user_id as string;
        const convId = c.conversation_id as string;
        if (!conversationIds.includes(convId)) conversationIds.push(convId);
        convoToResearcher.set(convId, userId);
      }
      if (conversationIds.length > 0) {
        const { data: msgs } = await svc
          .from('messenger_messages')
          .select('conversation_id, created_at, sender_id')
          .in('conversation_id', conversationIds)
          .eq('sender_id', agentId)
          .order('created_at', { ascending: false });
        for (const m of msgs ?? []) {
          const rid = convoToResearcher.get(m.conversation_id as string);
          if (rid && !lastContactedByResearcher.has(rid)) {
            lastContactedByResearcher.set(rid, m.created_at as string);
          }
        }
      }
    } catch {
      /* last_contacted is best-effort; never fail the whole endpoint over it */
    }

    // 5. AGGREGATE per researcher ----------------------------------------
    interface Agg {
      orderCount: number;
      paidCount: number;
      totalSpent: number;
      lastOrderAt: string | null;
      firstOrderAt: string | null;
      sparkline: number[]; // last SPARK_WEEKS, oldest first
      cohortMonth: string | null;
    }
    function newAgg(): Agg {
      return {
        orderCount: 0,
        paidCount: 0,
        totalSpent: 0,
        lastOrderAt: null,
        firstOrderAt: null,
        sparkline: Array.from({ length: SPARK_WEEKS }, () => 0),
        cohortMonth: null,
      };
    }
    const aggByBuyer = new Map<string, Agg>();
    for (const o of allOrders) {
      const buyerId = o.buyer_id;
      if (!buyerId) continue;
      const status = o.status;
      if (status === 'cancelled') continue;
      const a = aggByBuyer.get(buyerId) ?? newAgg();
      a.orderCount += 1;
      if (COLLECTED.has(status)) {
        a.paidCount += 1;
        a.totalSpent += safeNum(o.total);
      }
      const created = o.created_at;
      if (!a.lastOrderAt || created > a.lastOrderAt) a.lastOrderAt = created;
      if (!a.firstOrderAt || created < a.firstOrderAt) a.firstOrderAt = created;
      const wi = weekIndexFromNow(created, now);
      if (wi >= 0 && wi < SPARK_WEEKS) {
        const idx = SPARK_WEEKS - 1 - wi;
        a.sparkline[idx] = (a.sparkline[idx] ?? 0) + 1;
      }
      aggByBuyer.set(buyerId, a);
    }

    // VIP threshold = top 10% by lifetime spend (min 5 researchers)
    const spendValues = researchers
      .map((r) => aggByBuyer.get(r.id)?.totalSpent ?? 0)
      .filter((v) => v > 0)
      .sort((a, b) => b - a);
    const vipCutoff =
      spendValues.length >= 5
        ? spendValues[Math.max(0, Math.floor(spendValues.length * 0.1) - 1)] ?? Infinity
        : Infinity;

    function statusFor(r: Researcher, a: Agg | undefined): ResearcherStatus {
      const daysSinceJoin = Math.floor((now - new Date(r.created_at).getTime()) / MS_DAY);
      if (!a || a.orderCount === 0) {
        if (daysSinceJoin <= 30) return 'lead';
        return 'lead';
      }
      const daysSinceLast = a.lastOrderAt
        ? Math.floor((now - new Date(a.lastOrderAt).getTime()) / MS_DAY)
        : 9999;
      if (daysSinceLast > 60) return 'churned';
      if (daysSinceLast > 30) return 'at_risk';
      if (a.totalSpent >= vipCutoff && spendValues.length >= 5) return 'vip';
      if (a.orderCount === 1) return 'first_order';
      return 'active';
    }

    // Churn risk score 0-100. Higher = riskier.
    function churnRisk(r: Researcher, a: Agg | undefined): number {
      if (!a || a.orderCount === 0) {
        const daysSinceJoin = Math.floor((now - new Date(r.created_at).getTime()) / MS_DAY);
        return Math.min(80, Math.max(20, daysSinceJoin));
      }
      const daysSinceLast = a.lastOrderAt
        ? Math.floor((now - new Date(a.lastOrderAt).getTime()) / MS_DAY)
        : 9999;
      let score = Math.min(70, daysSinceLast * 0.9);
      if (a.orderCount === 1) score += 10;
      if (a.totalSpent < 100) score += 5;
      return Math.max(0, Math.min(100, Math.round(score)));
    }

    // 6. BUILD RESEARCHER ROWS -----------------------------------------
    const rows = researchers.map((r) => {
      const a = aggByBuyer.get(r.id);
      const status = statusFor(r, a);
      const orderCount = a?.orderCount ?? 0;
      const totalSpent = a?.totalSpent ?? 0;
      const paidCount = a?.paidCount ?? 0;
      const avgOrder = paidCount > 0 ? totalSpent / paidCount : 0;
      return {
        id: r.id,
        full_name: r.full_name,
        username: r.username,
        email: r.email,
        phone: r.phone,
        created_at: r.created_at,
        auto_approve_orders: r.auto_approve_orders ?? false,
        last_sign_in_at: r.last_sign_in_at,
        first_sign_in_at: r.first_sign_in_at,
        order_count: orderCount,
        total_spent: Number(totalSpent.toFixed(2)),
        avg_order: Number(avgOrder.toFixed(2)),
        last_order_at: a?.lastOrderAt ?? null,
        first_order_at: a?.firstOrderAt ?? null,
        sparkline: a?.sparkline ?? Array.from({ length: SPARK_WEEKS }, () => 0),
        status,
        churn_risk: churnRisk(r, a),
        tags: tagsByResearcher.get(r.id) ?? [],
        is_pinned: pinned.has(r.id),
        note: noteByResearcher.get(r.id)?.note ?? '',
        note_updated_at: noteByResearcher.get(r.id)?.updated_at ?? null,
        reminders: remindersByResearcher.get(r.id) ?? [],
        last_contacted_at: lastContactedByResearcher.get(r.id) ?? null,
        acquisition_source: r.acquisition_source ?? null,
        account_type: r.account_type ?? null,
      };
    });

    // Pinned first, then VIPs, then by LTV
    const statusRank: Record<ResearcherStatus, number> = {
      vip: 1,
      active: 2,
      first_order: 3,
      at_risk: 4,
      lead: 5,
      churned: 6,
      new: 2,
    };
    rows.sort((x, y) => {
      if (x.is_pinned && !y.is_pinned) return -1;
      if (!x.is_pinned && y.is_pinned) return 1;
      const sr = statusRank[x.status] - statusRank[y.status];
      if (sr !== 0) return sr;
      return y.total_spent - x.total_spent;
    });

    // 7. KPI COMPUTATIONS ------------------------------------------------
    // Build per-week buckets across the population for sparklines on KPI tiles.
    const weeklyOrders = Array.from({ length: SPARK_WEEKS }, () => 0);
    const weeklyRevenue = Array.from({ length: SPARK_WEEKS }, () => 0);
    const weeklyNewResearchers = Array.from({ length: SPARK_WEEKS }, () => 0);
    for (const o of allOrders) {
      if (o.status === 'cancelled') continue;
      const wi = weekIndexFromNow(o.created_at, now);
      if (wi >= 0 && wi < SPARK_WEEKS) {
        const idx = SPARK_WEEKS - 1 - wi;
        weeklyOrders[idx]++;
        if (COLLECTED.has(o.status)) weeklyRevenue[idx] += safeNum(o.total);
      }
    }
    for (const r of researchers) {
      const wi = weekIndexFromNow(r.created_at, now);
      if (wi >= 0 && wi < SPARK_WEEKS) {
        const idx = SPARK_WEEKS - 1 - wi;
        weeklyNewResearchers[idx]++;
      }
    }

    const totalLTV = rows.reduce((s, r) => s + r.total_spent, 0);
    const totalOrders = rows.reduce((s, r) => s + r.order_count, 0);
    const activeBuyers = rows.filter((r) => r.order_count > 0).length;
    const repeatBuyers = rows.filter((r) => r.order_count >= 2).length;
    const repeatRate = activeBuyers > 0 ? (repeatBuyers / activeBuyers) * 100 : 0;
    const aov = totalOrders > 0 ? totalLTV / totalOrders : 0;

    const thisMonthStart = startOfMonth(today);
    const thisMonthEnd = endOfMonth(today);
    const lastMonthStart = startOfMonth(new Date(today.getFullYear(), today.getMonth() - 1, 1));
    const lastMonthEnd = endOfMonth(new Date(today.getFullYear(), today.getMonth() - 1, 1));

    const newThisMonth = rows.filter((r) => {
      const d = new Date(r.created_at);
      return d >= thisMonthStart && d <= thisMonthEnd;
    }).length;
    const newLastMonth = rows.filter((r) => {
      const d = new Date(r.created_at);
      return d >= lastMonthStart && d <= lastMonthEnd;
    }).length;

    const atRiskCount = rows.filter((r) => r.status === 'at_risk' || r.status === 'churned').length;

    const ltvThisMonth = allOrders
      .filter((o) => COLLECTED.has(o.status) && new Date(o.created_at) >= thisMonthStart)
      .reduce((s, o) => s + safeNum(o.total), 0);
    const ltvLastMonth = allOrders
      .filter((o) => COLLECTED.has(o.status) && new Date(o.created_at) >= lastMonthStart && new Date(o.created_at) <= lastMonthEnd)
      .reduce((s, o) => s + safeNum(o.total), 0);

    const ordersThisMonth = allOrders
      .filter((o) => o.status !== 'cancelled' && new Date(o.created_at) >= thisMonthStart)
      .length;
    const ordersLastMonth = allOrders
      .filter((o) => o.status !== 'cancelled' && new Date(o.created_at) >= lastMonthStart && new Date(o.created_at) <= lastMonthEnd)
      .length;

    const bestCustomer = rows.find((r) => r.total_spent > 0) ?? null;

    // 8. INSIGHTS --------------------------------------------------------
    const insights: { id: string; severity: 'warn' | 'info' | 'good'; text: string; action_label?: string; action_href?: string }[] = [];
    if (atRiskCount > 0) {
      insights.push({
        id: 'at-risk',
        severity: 'warn',
        text: `${atRiskCount} Researcher${atRiskCount === 1 ? ' Has' : 's Have'} Not Ordered In 30+ Days. Send A Check-In?`,
        action_label: 'View At-Risk',
        action_href: '#filter=at_risk',
      });
    }
    if (activeBuyers >= 5 && repeatRate < 35) {
      insights.push({
        id: 'repeat-rate',
        severity: 'info',
        text: `Your Repeat-Buyer Rate Is ${Math.round(repeatRate)}%. Try A Returning-Customer Coupon.`,
        action_label: 'Create Coupon',
        action_href: '/dashboard/agent?tab=Coupons',
      });
    }
    if (ltvLastMonth > 0) {
      insights.push({
        id: 'commission',
        severity: 'good',
        text: `You Earned $${ltvLastMonth.toFixed(0)} In Revenue From This List Last Month.`,
        action_label: 'Open Wallet',
        action_href: '/wallet',
      });
    }
    if (newThisMonth === 0 && rows.length > 0) {
      insights.push({
        id: 'no-growth',
        severity: 'warn',
        text: `No New Researchers This Month. Share Your Storefront Link To Grow.`,
        action_label: 'Share Storefront',
        action_href: '#share-storefront',
      });
    }

    // 9. ACTIVITY FEED ---------------------------------------------------
    const activity: { id: string; kind: string; text: string; at: string; researcher_id?: string }[] = [];
    const recentOrdersSorted = [...allOrders]
      .filter((o) => o.status !== 'cancelled' && o.buyer_id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 12);
    for (const o of recentOrdersSorted) {
      const buyer = rows.find((r) => r.id === o.buyer_id);
      if (!buyer) continue;
      const name = buyer.full_name || buyer.username || 'A Researcher';
      activity.push({
        id: `order-${o.created_at}-${o.buyer_id}`,
        kind: 'order',
        text: `${name} Placed An Order ($${safeNum(o.total).toFixed(2)}).`,
        at: o.created_at,
        researcher_id: o.buyer_id ?? undefined,
      });
    }
    const recentJoins = [...researchers]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 5);
    for (const r of recentJoins) {
      activity.push({
        id: `join-${r.id}`,
        kind: 'signup',
        text: `${r.full_name || r.username || 'A New Researcher'} Joined Your Storefront.`,
        at: r.created_at,
        researcher_id: r.id,
      });
    }
    activity.sort((a, b) => b.at.localeCompare(a.at));

    // 10. GOAL + STREAK -------------------------------------------------
    const { data: goalRow } = await svc
      .from('agent_researcher_growth_goals')
      .select('period_start, period_end, target_count')
      .eq('agent_id', agentId)
      .eq('period_start', thisMonthStart.toISOString().slice(0, 10))
      .maybeSingle();
    const targetCount = (goalRow?.target_count as number | undefined) ?? null;

    // Streak: consecutive months where this month's new researcher count > 0
    // and >= previous month's count.
    let streak = 0;
    {
      const monthlyCounts: number[] = [];
      for (let i = 0; i < 12; i++) {
        const start = startOfMonth(new Date(today.getFullYear(), today.getMonth() - i, 1));
        const end = endOfMonth(start);
        const count = researchers.filter((r) => {
          const d = new Date(r.created_at);
          return d >= start && d <= end;
        }).length;
        monthlyCounts.push(count);
      }
      for (let i = 0; i < monthlyCounts.length - 1; i++) {
        const cur = monthlyCounts[i] ?? 0;
        const prev = monthlyCounts[i + 1] ?? 0;
        if (cur > 0 && cur >= prev) streak++;
        else break;
      }
    }

    // 11. KANBAN COUNTS -------------------------------------------------
    const kanbanCounts = {
      lead: rows.filter((r) => r.status === 'lead' && r.order_count === 0).length,
      first_order: rows.filter((r) => r.status === 'first_order').length,
      active: rows.filter((r) => r.status === 'active').length,
      vip: rows.filter((r) => r.status === 'vip').length,
      at_risk: rows.filter((r) => r.status === 'at_risk').length,
      churned: rows.filter((r) => r.status === 'churned').length,
    };

    // 12. SOURCE BREAKDOWN ----------------------------------------------
    const sourceCounts: Record<string, number> = {};
    for (const r of rows) {
      const src = r.acquisition_source ?? 'unknown';
      sourceCounts[src] = (sourceCounts[src] ?? 0) + 1;
    }

    return NextResponse.json({
      researchers: rows,
      kpis: {
        researchers_count: {
          value: rows.length,
          sparkline: weeklyNewResearchers,
          delta_pct: pctDelta(newThisMonth, newLastMonth),
          label: 'Researchers',
        },
        lifetime_value: {
          value: Number(totalLTV.toFixed(2)),
          sparkline: weeklyRevenue,
          delta_pct: pctDelta(ltvThisMonth, ltvLastMonth),
          label: 'Lifetime Value',
        },
        total_orders: {
          value: totalOrders,
          sparkline: weeklyOrders,
          delta_pct: pctDelta(ordersThisMonth, ordersLastMonth),
          label: 'Total Orders',
        },
        active_buyers: {
          value: activeBuyers,
          sparkline: weeklyOrders,
          delta_pct: 0,
          label: 'Active Buyers',
        },
        avg_order_value: {
          value: Number(aov.toFixed(2)),
          sparkline: weeklyRevenue.map((v, i) => (weeklyOrders[i] ? v / weeklyOrders[i] : 0)),
          delta_pct: 0,
          label: 'Avg Order Value',
        },
        repeat_rate: {
          value: Math.round(repeatRate),
          sparkline: [],
          delta_pct: 0,
          label: 'Repeat Buyer Rate',
        },
        new_this_month: {
          value: newThisMonth,
          sparkline: weeklyNewResearchers,
          delta_pct: pctDelta(newThisMonth, newLastMonth),
          label: 'New This Month',
        },
        at_risk: {
          value: atRiskCount,
          sparkline: [],
          delta_pct: 0,
          label: 'Churn Risk',
        },
        // CRMv2 reads k.best_customer.label directly. NEVER return null here -
        // doing so crashes the entire dashboard tab with TypeError: Cannot read
        // properties of null (reading 'label') on the client. When there is no
        // best customer, return an empty-shape Kpi the render path can read safely.
        best_customer: bestCustomer
          ? {
              value: Number(bestCustomer.total_spent ?? 0),
              sparkline: [],
              delta_pct: 0,
              label: bestCustomer.full_name || bestCustomer.username || 'Top Researcher',
              subvalue: `$${Number(bestCustomer.total_spent ?? 0).toFixed(0)}`,
              researcher_id: bestCustomer.id,
            }
          : { value: 0, sparkline: [], delta_pct: 0, label: '-' },
        lifetime_commission: {
          value: Number((totalLTV * 0.05).toFixed(2)),
          sparkline: weeklyRevenue.map((v) => v * 0.05),
          delta_pct: pctDelta(ltvThisMonth, ltvLastMonth),
          label: 'Est Commission',
        },
      },
      insights,
      activity: activity.slice(0, 16),
      goal: {
        period_start: thisMonthStart.toISOString().slice(0, 10),
        target_count: targetCount,
        achieved_count: newThisMonth,
        progress_pct: targetCount ? Math.min(100, Math.round((newThisMonth / targetCount) * 100)) : null,
        streak_months: streak,
      },
      kanban_counts: kanbanCounts,
      source_counts: sourceCounts,
    });
  } catch (err) {
    console.error('[researchers/v2] unexpected:', err);
    return NextResponse.json({ error: 'Internal Server Error.' }, { status: 500 });
  }
}

function emptyPayload() {
  return {
    researchers: [],
    kpis: {
      researchers_count: { value: 0, sparkline: [], delta_pct: 0, label: 'Researchers' },
      lifetime_value: { value: 0, sparkline: [], delta_pct: 0, label: 'Lifetime Value' },
      total_orders: { value: 0, sparkline: [], delta_pct: 0, label: 'Total Orders' },
      active_buyers: { value: 0, sparkline: [], delta_pct: 0, label: 'Active Buyers' },
      avg_order_value: { value: 0, sparkline: [], delta_pct: 0, label: 'Avg Order Value' },
      repeat_rate: { value: 0, sparkline: [], delta_pct: 0, label: 'Repeat Buyer Rate' },
      new_this_month: { value: 0, sparkline: [], delta_pct: 0, label: 'New This Month' },
      at_risk: { value: 0, sparkline: [], delta_pct: 0, label: 'Churn Risk' },
      best_customer: { value: 0, sparkline: [], delta_pct: 0, label: '-' },
      lifetime_commission: { value: 0, sparkline: [], delta_pct: 0, label: 'Est Commission' },
    },
    insights: [],
    activity: [],
    goal: { period_start: null, target_count: null, achieved_count: 0, progress_pct: null, streak_months: 0 },
    kanban_counts: { lead: 0, first_order: 0, active: 0, vip: 0, at_risk: 0, churned: 0 },
    source_counts: {},
  };
}
