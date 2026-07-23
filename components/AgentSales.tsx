'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts';
import Link from 'next/link';
import AgentOrders from './AgentOrders';
import { createClient } from '@/lib/supabase/client';
import AgentTierWidget from './AgentTierWidget';
import { Star, ArrowUp, ArrowDown } from 'lucide-react';

// Revenue is only "collected" once an order is approved or further along. Pending
// and approval-stage orders are treated as pipeline (potential, not yet earned).
const COLLECTED = new Set(['approved_ship', 'approved_pickup', 'in_fulfillment', 'shipped', 'delivered']);
const PENDING = new Set(['pending_customer_payment', 'agent_approval_pending', 'admin_approval_pending']);

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Lifetime revenue milestones (collected). Drives the badge ladder + celebration.
const MILESTONES = [
  { amount: 1000, label: 'First $1K' },
  { amount: 5000, label: '$5K Club' },
  { amount: 10000, label: '$10K Earner' },
  { amount: 25000, label: '$25K Pro' },
  { amount: 50000, label: '$50K Elite' },
  { amount: 100000, label: 'Six Figures' },
  { amount: 250000, label: 'Quarter Million' },
];

const PIE_COLORS = ['#00E5FF', '#00FF9D', '#7C5CFF', '#FFB020', '#FF6B81', '#27C2D6', '#A0AEC0'];

const fmt = (val: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(val) || 0);
const fmtCompact = (val: number) => {
  const n = Number(val) || 0;
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return `$${n.toFixed(0)}`;
};
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Lightweight, dependency-free celebratory confetti burst (balanced tone).
function burstConfetti() {
  if (typeof document === 'undefined') return;
  const colors = ['#00E5FF', '#00FF9D', '#7C5CFF', '#FFB020', '#FF6B81'];
  const root = document.createElement('div');
  root.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:0;z-index:100001;pointer-events:none;';
  document.body.appendChild(root);
  for (let i = 0; i < 28; i++) {
    const s = document.createElement('div');
    const c = colors[i % colors.length];
    const left = 18 + Math.random() * 64;
    const delay = Math.random() * 0.15;
    const dur = 1.1 + Math.random() * 0.8;
    s.style.cssText = `position:absolute;top:60px;left:${left}%;width:8px;height:13px;background:${c};border-radius:2px;opacity:1;animation:pnl-confetti ${dur}s ${delay}s ease-out forwards;`;
    root.appendChild(s);
  }
  setTimeout(() => root.remove(), 2300);
}

interface WalletSummary {
  primaryLabel: string;
  primary: number;
  owedThisWeek: number;
  nextStatementDate: string | null;
  forecastNext: number;
  accountType: string | null;
  creditLimit: number;
  creditUsed: number;
  prepaidBalance: number;
}

export default function AgentSales({ orders, setOrders, agentId, userProfile }: { orders: any[]; setOrders: any; agentId: string; userProfile?: any }) {
  const [, setData] = useState<{ liveCarts: any[]; sales: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [insights, setInsights] = useState<any | null>(null);
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [commission, setCommission] = useState<{ lifetime: number; thisMonth: number; has: boolean } | null>(null);
  const [view, setView] = useState<string>('30'); // '7' | '30' | '90' | 'm0' | 'm1' | ...
  const [goal, setGoal] = useState<number>(0);
  const [goalLoaded, setGoalLoaded] = useState(false);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState('');
  const supabase = useMemo(() => createClient(), []);
  const isFetching = useRef(false);
  const needsRefetch = useRef(false);
  const milestoneSeeded = useRef(false);
  const goalSeeded = useRef(false);

  // -- Retention data --
  interface RetentionData {
    retention_rate: number;
    at_risk: { user_id: string; name: string; last_order_date: string; days_since_order: number; total_spent: number }[];
    champions: { user_id: string; name: string; total_orders: number; total_spent: number; avg_order_value: number; member_since: string }[];
  }
  const [retention, setRetention] = useState<RetentionData | null>(null);
  const [retentionLoading, setRetentionLoading] = useState(false);
  const [retentionTab, setRetentionTab] = useState(false);

  // -- Monthly revenue goal: durable + cross-device via /api/agent/sales/goal,
  //    with a localStorage cache for instant first paint. --
  useEffect(() => {
    let cancelled = false;
    let cache = 5000;
    try { const raw = localStorage.getItem(`pnl_sales_goal_${agentId}`); if (raw) cache = Math.max(0, Number(raw) || 0); } catch { /* ignore */ }
    setGoal(cache);
    setGoalLoaded(false);
    (async () => {
      try {
        const res = await fetch('/api/agent/sales/goal', { cache: 'no-store' });
        if (res.ok) {
          const j = await res.json();
          const cents = j?.goal?.target_cents;
          if (cents != null && !cancelled) {
            const dollars = Math.round(Number(cents)) / 100;
            setGoal(dollars);
            try { localStorage.setItem(`pnl_sales_goal_${agentId}`, String(dollars)); } catch { /* ignore */ }
          }
        }
      } catch { /* offline - keep cache */ }
      finally { if (!cancelled) setGoalLoaded(true); }
    })();
    return () => { cancelled = true; };
  }, [agentId]);

  const saveGoal = useCallback(async (next: number) => {
    const v = Math.max(0, Math.round(next));
    setGoal(v);
    try { localStorage.setItem(`pnl_sales_goal_${agentId}`, String(v)); } catch { /* ignore */ }
    if (v > 0) {
      try {
        await fetch('/api/agent/sales/goal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target_cents: Math.round(v * 100) }),
        });
      } catch { /* best-effort - cached locally */ }
    }
  }, [agentId]);

  const fetchSales = useCallback(async () => {
    if (isFetching.current) { needsRefetch.current = true; return; }
    isFetching.current = true;
    try {
      const res = await fetch(`/api/agent/sales?t=${Date.now()}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed To Fetch Sales Data');
      setData(json.data);
      if (json.data?.sales) setOrders(json.data.sales);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      isFetching.current = false;
      if (needsRefetch.current) { needsRefetch.current = false; fetchSales(); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchSales();
    const channel = supabase
      .channel(`agent-sales-${agentId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `agent_id=eq.${agentId}` }, () => fetchSales())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `referring_agent_id=eq.${agentId}` }, () => fetchSales())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  useEffect(() => {
    if (!retentionTab || retention) return;
    let cancelled = false;
    setRetentionLoading(true);
    (async () => {
      try {
        const res = await fetch('/api/agent/sales/retention', { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed To Load Retention Data');
        if (!cancelled) setRetention(json);
      } catch { /* best-effort */ } finally {
        if (!cancelled) setRetentionLoading(false);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retentionTab]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [iRes, wRes, cRes] = await Promise.all([
          fetch('/api/agent/sales/insights', { cache: 'no-store' }),
          fetch('/api/agent/wallet/summary', { cache: 'no-store' }),
          fetch('/api/agent/wallet/commissions', { cache: 'no-store' }),
        ]);
        if (iRes.ok) { const j = await iRes.json(); if (!cancelled) setInsights(j); }
        if (wRes.ok) { const j = await wRes.json(); if (!cancelled) setWallet(j); }
        if (cRes.ok) {
          const j = await cRes.json();
          const rows = [...(j.pending || []), ...(j.settled || [])];
          const lifetime = Number(j?.totals?.pending || 0) + Number(j?.totals?.settled || 0);
          const now = new Date();
          const mStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
          const thisMonth = rows.reduce((s: number, r: any) => {
            const t = new Date(r.date).getTime();
            return Number.isFinite(t) && t >= mStart ? s + Number(r.commission_amount || 0) : s;
          }, 0);
          if (!cancelled) setCommission({ lifetime, thisMonth, has: rows.length > 0 || lifetime > 0 });
        }
      } catch { /* best-effort */ }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- orders ref changes on every render; use stable key so status updates also trigger refresh
  }, [orders.map((o: any) => o.id + o.status).join(',')]);

  // -- All analytics derived from the orders array --
  const a = useMemo(() => {
    const all = (orders || []) as any[];
    const collected = all.filter((o) => COLLECTED.has(o.status));
    const pending = all.filter((o) => PENDING.has(o.status));

    const sum = (arr: any[], k: string) => arr.reduce((s, o) => s + (Number(o[k]) || 0), 0);

    const lifetimeRevenue = sum(collected, 'total');
    const lifetimeProfit = sum(collected, 'profit');
    const lifetimeOrders = collected.length;
    const aov = lifetimeOrders ? lifetimeRevenue / lifetimeOrders : 0;
    const margin = lifetimeRevenue ? (lifetimeProfit / lifetimeRevenue) * 100 : 0;
    const pipeline = sum(pending, 'total');

    // Super agent split: profit/sales earned on the agent's own orders vs the
    // markup spread earned on a downline agent's orders.
    const downlineCollected = collected.filter((o) => o.is_downline_order);
    const ownCollected = collected.filter((o) => !o.is_downline_order);
    const ownProfit = sum(ownCollected, 'profit');
    const downlineProfit = sum(downlineCollected, 'profit');
    const downlineSalesTotal = sum(downlineCollected, 'total');
    const downlineOrderCount = downlineCollected.length;

    const orderCogs = (o: any) => (o.items || []).reduce((s: number, it: any) => s + (Number(it.unit_cost_price) || 0) * (Number(it.quantity) || 0), 0);

    // Daily aggregation (collected)
    const daily = new Map<string, { revenue: number; profit: number; orders: number }>();
    for (const o of collected) {
      const d = new Date(o.created_at);
      if (isNaN(d.getTime())) continue;
      const key = dayKey(d);
      const cur = daily.get(key) || { revenue: 0, profit: 0, orders: 0 };
      cur.revenue += Number(o.total) || 0;
      cur.profit += Number(o.profit) || 0;
      cur.orders += 1;
      daily.set(key, cur);
    }

    const series = (days: number) => {
      const out: { date: string; revenue: number; profit: number }[] = [];
      const today = new Date();
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today.getTime() - i * DAY_MS);
        const rec = daily.get(dayKey(d));
        out.push({ date: `${d.getMonth() + 1}/${d.getDate()}`, revenue: rec?.revenue || 0, profit: rec?.profit || 0 });
      }
      return out;
    };

    const now = Date.now();
    const windowSum = (fromMs: number, toMs: number, k: string) =>
      collected.filter((o) => { const t = new Date(o.created_at).getTime(); return t >= fromMs && t < toMs; })
        .reduce((s, o) => s + (Number(o[k]) || 0), 0);
    const windowCount = (fromMs: number, toMs: number) =>
      collected.filter((o) => { const t = new Date(o.created_at).getTime(); return t >= fromMs && t < toMs; }).length;

    const rev30 = windowSum(now - 30 * DAY_MS, now, 'total');
    const revPrev30 = windowSum(now - 60 * DAY_MS, now - 30 * DAY_MS, 'total');
    const orders30 = windowCount(now - 30 * DAY_MS, now);
    const ordersPrev30 = windowCount(now - 60 * DAY_MS, now - 30 * DAY_MS);

    const pct = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : cur > 0 ? 100 : 0);

    // Calendar months
    const tnow = new Date();
    const monthStart = new Date(tnow.getFullYear(), tnow.getMonth(), 1).getTime();
    const lastMonthStart = new Date(tnow.getFullYear(), tnow.getMonth() - 1, 1).getTime();
    const monthRevenue = windowSum(monthStart, now, 'total');
    const monthProfit = windowSum(monthStart, now, 'profit');
    const lastMonthRevenue = windowSum(lastMonthStart, monthStart, 'total');
    const momDelta = pct(monthRevenue, lastMonthRevenue);
    const daysInMonth = new Date(tnow.getFullYear(), tnow.getMonth() + 1, 0).getDate();
    const dayOfMonth = tnow.getDate();
    const projectedMonth = dayOfMonth > 0 ? (monthRevenue / dayOfMonth) * daysInMonth : 0;

    // Streak
    let streak = 0;
    {
      const t0 = new Date();
      let cursor = new Date(t0.getFullYear(), t0.getMonth(), t0.getDate());
      if (!daily.has(dayKey(cursor))) cursor = new Date(cursor.getTime() - DAY_MS);
      while (daily.has(dayKey(cursor))) { streak += 1; cursor = new Date(cursor.getTime() - DAY_MS); }
    }

    // Personal best day
    let best = { date: '', revenue: 0 };
    for (const [k, v] of daily.entries()) if (v.revenue > best.revenue) best = { date: k, revenue: v.revenue };

    // Best weekday
    const wd = WEEKDAYS.map(() => ({ revenue: 0 }));
    for (const o of collected) { const d = new Date(o.created_at); if (!isNaN(d.getTime())) wd[d.getDay()].revenue += Number(o.total) || 0; }
    let bestWeekday = -1; let bestWeekdayRev = 0;
    wd.forEach((w, i) => { if (w.revenue > bestWeekdayRev) { bestWeekdayRev = w.revenue; bestWeekday = i; } });

    // Repeat buyer rate
    const buyerOrders = new Map<string, number>();
    for (const o of collected) { const id = o.buyer_id || 'unknown'; buyerOrders.set(id, (buyerOrders.get(id) || 0) + 1); }
    const distinctBuyers = buyerOrders.size;
    const repeatRate = distinctBuyers ? (Array.from(buyerOrders.values()).filter((n) => n > 1).length / distinctBuyers) * 100 : 0;

    // Product mix
    const prodAgg = new Map<string, number>();
    for (const o of collected) for (const it of (o.items || [])) {
      const name = it.product_name || 'Product';
      prodAgg.set(name, (prodAgg.get(name) || 0) + (Number(it.unit_retail_price) || 0) * (Number(it.quantity) || 0));
    }
    const productMix = Array.from(prodAgg.entries()).map(([name, revenue]) => ({ name, revenue })).sort((x, y) => y.revenue - x.revenue);
    const topProductSlices = (() => {
      const top = productMix.slice(0, 6);
      const rest = productMix.slice(6).reduce((s, p) => s + p.revenue, 0);
      const out = top.map((p) => ({ name: p.name, value: Number(p.revenue.toFixed(2)) }));
      if (rest > 0) out.push({ name: 'Other', value: Number(rest.toFixed(2)) });
      return out;
    })();

    // Payment method mix
    const payAgg = new Map<string, number>();
    for (const o of collected) { const m = (o.payment_method || 'Other') as string; payAgg.set(m, (payAgg.get(m) || 0) + (Number(o.total) || 0)); }
    const payMix = Array.from(payAgg.entries()).map(([method, revenue]) => ({ method: method.replace('_', ' '), revenue: Number(revenue.toFixed(2)) })).sort((x, y) => y.revenue - x.revenue);

    // Monthly P&L (last 12 months, newest first)
    const pnlMap = new Map<string, { tag: string; label: string; revenue: number; cogs: number; shipping: number; net: number; orders: number; ts: number }>();
    for (const o of collected) {
      const d = new Date(o.created_at);
      if (isNaN(d.getTime())) continue;
      const tag = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const row = pnlMap.get(tag) || { tag, label: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }), revenue: 0, cogs: 0, shipping: 0, net: 0, orders: 0, ts: new Date(d.getFullYear(), d.getMonth(), 1).getTime() };
      row.revenue += Number(o.total) || 0;
      row.cogs += orderCogs(o);
      row.shipping += Number(o.shipping_cost) || 0;
      row.net += Number(o.profit) || 0;
      row.orders += 1;
      pnlMap.set(tag, row);
    }
    const pnl = Array.from(pnlMap.values()).sort((x, y) => y.ts - x.ts).slice(0, 12);

    return {
      hasCollected: collected.length > 0,
      lifetimeRevenue, lifetimeProfit, lifetimeOrders, aov, margin, pipeline,
      ownProfit, downlineProfit, downlineSalesTotal, downlineOrderCount,
      pendingCount: pending.length,
      rev30, revDelta30: pct(rev30, revPrev30), orders30, ordersDelta30: pct(orders30, ordersPrev30),
      monthRevenue, monthProfit, lastMonthRevenue, momDelta, projectedMonth, daysInMonth, dayOfMonth,
      streak, best, bestWeekday, bestWeekdayRev, repeatRate, distinctBuyers,
      productMix, topProductSlices, payMix, pnl,
      dailyMap: daily, series7: series(7), series30: series(30), series90: series(90),
    };
  }, [orders]);

  // Build chart data from the current view (trailing window or a calendar month).
  const chartData = useMemo(() => {
    if (view === '7') return a.series7;
    if (view === '30') return a.series30;
    if (view === '90') return a.series90;
    const k = Number(view.slice(1)) || 0;
    const base = new Date();
    const y = base.getFullYear(); const m = base.getMonth() - k;
    const first = new Date(y, m, 1);
    const days = new Date(y, m + 1, 0).getDate();
    const out: { date: string; revenue: number; profit: number }[] = [];
    for (let i = 1; i <= days; i++) {
      const d = new Date(first.getFullYear(), first.getMonth(), i);
      const rec = a.dailyMap.get(dayKey(d));
      out.push({ date: `${d.getMonth() + 1}/${d.getDate()}`, revenue: rec?.revenue || 0, profit: rec?.profit || 0 });
    }
    return out;
  }, [view, a]);

  const monthOptions = useMemo(() => {
    const out: { value: string; label: string }[] = [];
    const now = new Date();
    for (let k = 0; k < 6; k++) {
      const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
      out.push({ value: `m${k}`, label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) });
    }
    return out;
  }, []);

  // Goal pacing
  const goalPct = goal > 0 ? Math.min(100, (a.monthRevenue / goal) * 100) : 0;
  const expectedByNow = goal > 0 && a.daysInMonth > 0 ? goal * (a.dayOfMonth / a.daysInMonth) : 0;
  const onTrack = a.monthRevenue >= expectedByNow;
  const paceGap = Math.abs(a.monthRevenue - expectedByNow);

  // Milestones
  const nextMilestone = MILESTONES.find((m) => a.lifetimeRevenue < m.amount) || null;
  const achievedMilestones = MILESTONES.filter((m) => a.lifetimeRevenue >= m.amount);

  // -- Celebration: fire once when a new milestone or the monthly goal is crossed.
  //    Seeds silently on first load so we never burst on initial mount. --
  useEffect(() => {
    if (loading) return;
    const mKey = `pnl_celebrated_milestone_${agentId}`;
    const gKey = `pnl_goal_hit_${agentId}`;
    const achievedMax = achievedMilestones.length ? achievedMilestones[achievedMilestones.length - 1].amount : 0;
    const monthTag = `${new Date().getFullYear()}-${new Date().getMonth()}`;
    const celebrate = (msg: string) => { try { toast.success(msg); } catch { /* ignore */ } burstConfetti(); };
    try {
      // Milestones - seed silently on the first loaded pass (orders are in by now,
      // since we only run when !loading), celebrate only on a later crossing.
      if (!milestoneSeeded.current) {
        if (localStorage.getItem(mKey) == null) localStorage.setItem(mKey, String(achievedMax));
        milestoneSeeded.current = true;
      } else {
        const prevM = Number(localStorage.getItem(mKey) || '0');
        if (achievedMax > prevM) {
          const m = MILESTONES.find((x) => x.amount === achievedMax);
          celebrate(`Milestone Unlocked - ${m?.label ?? fmt(achievedMax)}`);
          localStorage.setItem(mKey, String(achievedMax));
        }
      }
      // Goal - only evaluate once the REAL goal has loaded from the server, so we
      // never fire on a goal that was already met when the page opened (the goal
      // arrives async and starts at a cached/default value).
      if (goalLoaded && goal > 0) {
        if (!goalSeeded.current) {
          if (a.monthRevenue >= goal) localStorage.setItem(gKey, monthTag);
          goalSeeded.current = true;
        } else if (a.monthRevenue >= goal && localStorage.getItem(gKey) !== monthTag) {
          celebrate('Monthly Goal Reached - Nice Work!');
          localStorage.setItem(gKey, monthTag);
        }
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, goalLoaded, a.lifetimeRevenue, a.monthRevenue, goal]);

  const downloadCsv = useCallback((rows: (string | number)[][], name: string) => {
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = name; link.click();
    URL.revokeObjectURL(url);
  }, []);

  const exportOrdersCsv = useCallback(() => {
    const rows: (string | number)[][] = [['Order Id', 'Date', 'Status', 'Buyer', 'Payment', 'Revenue', 'Profit']];
    for (const o of (orders || [])) {
      rows.push([
        o.id, new Date(o.created_at).toISOString().slice(0, 10), o.status,
        (o.buyer_name || '').replace(/,/g, ' '), (o.payment_method || ''),
        (Number(o.total) || 0).toFixed(2), (Number(o.profit) || 0).toFixed(2),
      ]);
    }
    downloadCsv(rows, `sales-orders-${new Date().toISOString().slice(0, 10)}.csv`);
  }, [orders, downloadCsv]);

  const exportPnlCsv = useCallback(() => {
    const rows: (string | number)[][] = [['Month', 'Orders', 'Revenue', 'COGS', 'Shipping', 'Owed To Platform', 'Net Profit']];
    for (const m of a.pnl) rows.push([m.label, m.orders, Number(m.revenue || 0).toFixed(2), Number(m.cogs || 0).toFixed(2), Number(m.shipping || 0).toFixed(2), Number((m.cogs || 0) + (m.shipping || 0)).toFixed(2), Number(m.net || 0).toFixed(2)]);
    downloadCsv(rows, `profit-and-loss-${new Date().toISOString().slice(0, 10)}.csv`);
  }, [a.pnl, downloadCsv]);

  if (loading) return <div style={{ padding: 'var(--space-6)', color: 'var(--silver)' }}>Loading Live Sales Data...</div>;
  if (error) return <div style={{ padding: 'var(--space-6)', color: 'var(--red)' }}>Error: {error}</div>;

  const isSub = userProfile?.is_sub_agent === true;
  const showCommission = false;
  const tabHref = (tab: string) => `/dashboard/agent?tab=${encodeURIComponent(tab)}`;
  const PROFIT_HELP = 'Profit = what the customer paid, minus your product cost and the shipping the platform bills you.';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .sa-label { font-size: 0.72rem; color: var(--grey-400); text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; }
        .sa-stat { font-size: 1.9rem; font-weight: 800; font-family: var(--font-brand); color: var(--white); line-height: 1.1; }
        .sa-delta-up { color: #00FF9D; font-weight: 700; font-size: 0.78rem; }
        .sa-delta-down { color: #FF6B81; font-weight: 700; font-size: 0.78rem; }
        .sa-range-btn { padding: 6px 14px; border-radius: 8px; font-size: 0.8rem; font-weight: 700; cursor: pointer; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.04); color: var(--silver); }
        .sa-range-btn.active { background: var(--teal); color: #04201f; border-color: var(--teal); }
        .sa-month-select { padding: 6px 10px; border-radius: 8px; font-size: 0.8rem; font-weight: 700; border: 1px solid rgba(255,255,255,0.12); background: rgba(0,0,0,0.5); color: var(--silver); cursor: pointer; }
        .sa-badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 999px; font-size: 0.74rem; font-weight: 800; }
        .sa-info { display: inline-flex; align-items: center; justify-content: center; width: 15px; height: 15px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.35); color: var(--grey-300); font-size: 0.62rem; font-weight: 800; cursor: help; margin-left: 6px; vertical-align: middle; }
        .sa-cta { display: inline-flex; align-items: center; gap: 6px; padding: 10px 16px; border-radius: 10px; font-weight: 800; font-size: 0.85rem; text-decoration: none; }
        .sa-table { width: 100%; border-collapse: collapse; font-size: 0.84rem; min-width: 520px; }
        .sa-table th { text-align: right; color: var(--grey-400); font-weight: 700; padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,0.1); font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; }
        .sa-table th:first-child, .sa-table td:first-child { text-align: left; }
        .sa-table td { text-align: right; padding: 9px 10px; border-bottom: 1px solid rgba(255,255,255,0.05); color: var(--silver); }
        .sa-box-centered { display: flex; flex-direction: column; align-items: center; text-align: center; }
        .sa-capitalize-all { text-transform: capitalize; }
        .sa-capitalize-all text { text-transform: capitalize; }
        @keyframes sa-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(0,255,157,0.0);} 50% { box-shadow: 0 0 0 6px rgba(0,255,157,0.12);} }
        @keyframes pnl-confetti { from { opacity: 1; transform: translateY(0) rotate(0deg);} to { opacity: 0; transform: translateY(72vh) rotate(540deg);} }
      `}} />

      {/* GLOBAL HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <h2 style={{ fontSize: '1.4rem', margin: 0, fontFamily: 'var(--font-brand)' }}>Sales &amp; Accounting</h2>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <Link href="/dashboard/agent/analytics" className="btn-silver" style={{ textDecoration: 'none' }}>
            Storefront Analytics
          </Link>
          <Link href="/dashboard/agent/invoices" className="btn-silver" style={{ textDecoration: 'none' }}>
            Invoices
          </Link>
          <Link href="/dashboard/agent/sales-v2" className="btn-neon-cyan" style={{ textDecoration: 'none' }}>
            Sales Performance
          </Link>
        </div>
      </div>

      {/* ACCOUNTING / MONEY STRIP */}
      <div className="sa-capitalize-all" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
        <div className="glass-panel" style={{ cursor: 'pointer', transition: 'all 0.2s ease', position: 'relative' }}>
          <Link href="/wallet" style={{ textDecoration: 'none', color: 'inherit', display: 'block', height: '100%' }}>
            <div className=" sa-box-centered" style={{ padding: 'var(--space-5)' }}>
              <div className="sa-label">{wallet?.primaryLabel || 'Available'}</div>
              <div className="sa-stat" style={{ color: '#00E5FF', marginTop: 6 }}>{fmt(wallet?.primary ?? 0)}</div>
              <span style={{ color: 'var(--teal)', fontSize: '0.76rem', fontWeight: 700, marginTop: 8, display: 'inline-block' }}>Open Wallet</span>
            </div>
          </Link>
        </div>
        <div className="glass-panel" style={{ cursor: 'pointer', transition: 'all 0.2s ease', position: 'relative' }}>
          <Link href="/wallet" style={{ textDecoration: 'none', color: 'inherit', display: 'block', height: '100%' }}>
            <div className=" sa-box-centered" style={{ padding: 'var(--space-5)' }}>
              <div className="sa-label">Owed This Week</div>
              <div className="sa-stat" style={{ color: (wallet?.owedThisWeek ?? 0) > 0 ? '#FF6B81' : 'var(--white)', marginTop: 6 }}>{fmt(wallet?.owedThisWeek ?? 0)}</div>
              <div style={{ color: 'var(--grey-400)', fontSize: '0.74rem', marginTop: 8 }}>
                {wallet?.nextStatementDate ? `Due ${new Date(wallet.nextStatementDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'No Open Statement'}
              </div>
            </div>
          </Link>
        </div>
        <div className="glass-panel" style={{ cursor: 'pointer', transition: 'all 0.2s ease', position: 'relative' }}>
          <Link href="/dashboard/agent?tab=Orders" style={{ textDecoration: 'none', color: 'inherit', display: 'block', height: '100%' }}>
            <div className=" sa-box-centered" style={{ padding: 'var(--space-5)' }}>
              <div className="sa-label">Profit This Month<span className="sa-info" title={PROFIT_HELP}>i</span></div>
              <div className="sa-stat" style={{ color: '#00FF9D', marginTop: 6 }}>{fmt(a.monthProfit)}</div>
              <div style={{ color: 'var(--grey-400)', fontSize: '0.74rem', marginTop: 8 }}>{fmt(a.monthRevenue)} Revenue</div>
            </div>
          </Link>
        </div>
        <div className="glass-panel" style={{ cursor: 'pointer', transition: 'all 0.2s ease', position: 'relative' }}>
          <Link href="/dashboard/agent?tab=Orders" style={{ textDecoration: 'none', color: 'inherit', display: 'block', height: '100%' }}>
            <div className=" sa-box-centered" style={{ padding: 'var(--space-5)' }}>
              <div className="sa-label">Lifetime Profit<span className="sa-info" title={PROFIT_HELP}>i</span></div>
              <div className="sa-stat" style={{ marginTop: 6 }}>{fmt(a.lifetimeProfit)}</div>
              <div style={{ color: 'var(--grey-400)', fontSize: '0.74rem', marginTop: 8 }}>{Number(a.margin || 0).toFixed(0)}% Margin</div>
            </div>
          </Link>
        </div>
        }</span>}
            </div>
          </div>
        </div>

        <div className="glass-panel">
          <div className="" style={{ padding: 'var(--space-6)' }}>
            <div className="sa-label">Projected Month-End</div>
            <div className="sa-stat" style={{ color: '#7C5CFF', marginTop: 6 }}>{fmt(a.projectedMonth)}</div>
            <div style={{ color: 'var(--grey-400)', fontSize: '0.8rem', marginTop: 4 }}>Based On {a.dayOfMonth} Of {a.daysInMonth} Days</div>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '14px 0' }} />
            <div className="sa-label">This Month vs Last</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
              <span style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--white)', fontFamily: 'var(--font-brand)' }}>{fmt(a.monthRevenue)}</span>
              <span className={a.momDelta >= 0 ? 'sa-delta-up' : 'sa-delta-down'} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>{a.momDelta >= 0 ? <ArrowUp size={12} aria-hidden /> : <ArrowDown size={12} aria-hidden />}{Number(Math.abs(a.momDelta || 0)).toFixed(0)}%</span>
            </div>
            <div style={{ color: 'var(--grey-400)', fontSize: '0.74rem', marginTop: 4 }}>Last Month: {fmt(a.lastMonthRevenue)}</div>
          </div>
        </div>
      </div>

      {/* MILESTONES */}
      <div className="glass-panel">
        <div className="" style={{ padding: 'var(--space-6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <h2 className="metal-text" style={{ fontSize: '1.05rem', fontFamily: 'var(--font-brand)', margin: 0 }}>Milestones</h2>
            <span style={{ color: 'var(--grey-400)', fontSize: '0.78rem' }}>{achievedMilestones.length} Of {MILESTONES.length} Unlocked</span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            {MILESTONES.map((m) => {
              const hit = a.lifetimeRevenue >= m.amount;
              return (
                <span key={m.amount} className="sa-badge" style={{
                  background: hit ? 'rgba(0,255,157,0.12)' : 'rgba(255,255,255,0.04)',
                  color: hit ? '#00FF9D' : 'var(--grey-500)',
                  border: `1px solid ${hit ? 'rgba(0,255,157,0.35)' : 'rgba(255,255,255,0.08)'}`,
                }}><Star size={12} aria-hidden fill={hit ? '#00FF9D' : 'none'} stroke={hit ? '#00FF9D' : 'var(--grey-500)'} /> {m.label}</span>
              );
            })}
          </div>
          {nextMilestone && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--grey-400)', marginBottom: 6 }}>
                <span>Next: {nextMilestone.label}</span>
                <span>{fmt(a.lifetimeRevenue)} / {fmt(nextMilestone.amount)}</span>
              </div>
              <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, (a.lifetimeRevenue / nextMilestone.amount) * 100)}%`, height: '100%', background: 'linear-gradient(90deg, #00E5FF, #00FF9D)', borderRadius: 999, transition: 'width 0.6s ease' }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* KPI SNAPSHOT */}
      <div className="sa-capitalize-all" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-4)' }}>
        <KpiCard
          label="Collected Revenue"
          value={fmt(a.lifetimeRevenue)}
          delta={a.revDelta30}
          deltaLabel="Vs Prior 30d"
          sub={a.downlineOrderCount > 0 ? `Includes ${a.downlineOrderCount} Downline Orders (${fmt(a.downlineSalesTotal)})` : undefined}
          href="/dashboard/agent?tab=Orders"
        />
        {a.downlineOrderCount > 0 ? (
          <>
            <KpiCard label="My Sales Profit" value={fmt(a.ownProfit)} color="#00FF9D" help={PROFIT_HELP} href="/wallet" />
            <KpiCard label="Downline Profit" value={fmt(a.downlineProfit)} color="#7C5CFF" href="/wallet" />
            <KpiCard label="Total Profit" value={fmt(a.lifetimeProfit)} color="#00FF9D" help={PROFIT_HELP} href="/wallet" />
          </>
        ) : (
          <KpiCard label="Total Profit" value={fmt(a.lifetimeProfit)} color="#00FF9D" help={PROFIT_HELP} href="/wallet" />
        )}
        <KpiCard label="Orders" value={String(a.lifetimeOrders)} delta={a.ordersDelta30} deltaLabel="Vs Prior 30d" color="#00E5FF" href="/dashboard/agent?tab=Orders" />
        <KpiCard label="Avg Order Value" value={fmt(a.aov)} href="/dashboard/agent/analytics" />
        <KpiCard label="Repeat Buyer Rate" value={`${Number(a.repeatRate || 0).toFixed(0)}%`} sub={`${a.distinctBuyers} Buyers`} href="/dashboard/agent/analytics" />
      </div>

      {/* TREND CHART */}
      <div className="glass-panel">
        <div className="" style={{ padding: 'var(--space-6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 'var(--space-4)' }}>
            <h2 className="metal-text" style={{ fontSize: '1.15rem', fontFamily: 'var(--font-brand)', margin: 0 }}>Revenue And Profit</h2>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              {['7', '30', '90'].map((r) => (
                <button key={r} className={`sa-range-btn ${view === r ? 'active' : ''}`} onClick={() => setView(r)}>{r}D</button>
              ))}
              <select className="sa-month-select" value={view.startsWith('m') ? view : ''} onChange={(e) => e.target.value && setView(e.target.value)}>
                <option value="">By Month...</option>
                {monthOptions.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ width: '100%', height: 320 }} role="img" aria-label="Area Chart Of Revenue And Profit Over The Selected Date Range">
            {a.hasCollected ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="cRev" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00E5FF" stopOpacity={0.4} /><stop offset="95%" stopColor="#00E5FF" stopOpacity={0} /></linearGradient>
                    <linearGradient id="cPro" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00FF9D" stopOpacity={0.4} /><stop offset="95%" stopColor="#00FF9D" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="date" stroke="var(--grey-400)" fontSize={11} tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis stroke="var(--grey-400)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => fmtCompact(Number(v))} width={48} />
                  <Tooltip contentStyle={{ backgroundColor: 'rgba(5,10,15,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff' }} formatter={(value: any, name: any) => [fmt(Number(value) || 0), name]} />
                  <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#00E5FF" strokeWidth={3} fillOpacity={1} fill="url(#cRev)" />
                  <Area type="monotone" dataKey="profit" name="Profit" stroke="#00FF9D" strokeWidth={3} fillOpacity={1} fill="url(#cPro)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : <EmptyChart label="Your Revenue Trend Will Appear Here After Your First Sale" />}
          </div>
        </div>
      </div>

      {/* BREAKDOWNS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
        <div className="glass-panel">
          <div className="" style={{ padding: 'var(--space-6)' }}>
            <h2 className="metal-text" style={{ fontSize: '1.05rem', fontFamily: 'var(--font-brand)', margin: '0 0 12px' }}>Revenue By Product</h2>
            {a.topProductSlices.length > 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                <div style={{ width: 170, height: 170 }} role="img" aria-label={`Pie Chart Of Revenue By Product Across ${a.topProductSlices.length} Products`}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={a.topProductSlices} dataKey="value" nameKey="name" innerRadius={48} outerRadius={80} paddingAngle={2} stroke="none">
                        {a.topProductSlices.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: 'rgba(5,10,15,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff' }} formatter={(v: any, n: any) => [fmt(Number(v) || 0), n]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ flex: 1, minWidth: 140, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {a.topProductSlices.map((p, i) => (
                    <div key={p.name + String(i)} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem' }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                      <span style={{ color: 'var(--silver)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{p.name}</span>
                      <span style={{ color: 'var(--white)', fontWeight: 700 }}>{fmt(p.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : <p style={{ color: 'var(--grey-400)', fontSize: '0.85rem' }}>No Product Sales Yet.</p>}
          </div>
        </div>

        <div className="glass-panel">
          <div className="" style={{ padding: 'var(--space-6)' }}>
            <h2 className="metal-text" style={{ fontSize: '1.05rem', fontFamily: 'var(--font-brand)', margin: '0 0 12px' }}>Revenue By Payment Method</h2>
            {a.payMix.length > 0 ? (
              <div style={{ width: '100%', height: 200 }} role="img" aria-label="Bar Chart Of Revenue By Payment Method">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={a.payMix} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                    <XAxis type="number" stroke="var(--grey-400)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => fmtCompact(Number(v))} />
                    <YAxis type="category" dataKey="method" stroke="var(--grey-400)" fontSize={11} tickLine={false} axisLine={false} width={84} tickFormatter={(v) => String(v).replace(/\b\w/g, (c) => c.toUpperCase())} />
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} contentStyle={{ backgroundColor: 'rgba(5,10,15,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff' }} formatter={(v: any) => [fmt(Number(v) || 0), 'Revenue']} />
                    <Bar dataKey="revenue" radius={[0, 6, 6, 0]}>
                      {a.payMix.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <p style={{ color: 'var(--grey-400)', fontSize: '0.85rem' }}>No Payments Recorded Yet.</p>}
            {a.bestWeekday >= 0 && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: '0.82rem', color: 'var(--silver)' }}>
                Your Strongest Day Is <strong style={{ color: 'var(--white)' }}>{WEEKDAYS[a.bestWeekday]}</strong> - {fmt(a.bestWeekdayRev)} Lifetime
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MONTHLY PROFIT & LOSS */}
      <div className="glass-panel">
        <div className="" style={{ padding: 'var(--space-6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            <h2 className="metal-text" style={{ fontSize: '1.15rem', fontFamily: 'var(--font-brand)', margin: 0 }}>
              Monthly Profit &amp; Loss<span className="sa-info" title={PROFIT_HELP}>i</span>
            </h2>
            {a.pnl.length > 0 && (
              <button onClick={exportPnlCsv} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.18)', color: 'var(--white)', borderRadius: 10, padding: '9px 16px', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>Download Statement</button>
            )}
          </div>
          {a.pnl.length > 0 ? (
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table className="sa-table">
                <thead>
                  <tr><th>Month</th><th>Orders</th><th>Revenue</th><th>COGS</th><th>Shipping</th><th title="What You Owe The Platform This Month: Product Cost + Shipping">Owed</th><th>Net Profit</th></tr>
                </thead>
                <tbody>
                  {a.pnl.map((m) => (
                    <tr key={m.tag}>
                      <td style={{ color: 'var(--white)', fontWeight: 700 }}>{m.label}</td>
                      <td>{m.orders}</td>
                      <td>{fmt(m.revenue)}</td>
                      <td>{fmt(m.cogs)}</td>
                      <td>{fmt(m.shipping)}</td>
                      <td style={{ color: '#FFB020' }}>{fmt(m.cogs + m.shipping)}</td>
                      <td style={{ color: '#00FF9D', fontWeight: 800 }}>{fmt(m.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p style={{ color: 'var(--grey-400)', fontSize: '0.85rem', margin: 0 }}>No Collected Sales Yet. Your Monthly P&amp;L Builds Here Automatically.</p>}
        </div>
      </div>

      {/* TOP PRODUCTS / RESEARCHERS */}
      {insights && (insights.topProducts?.length > 0 || insights.topBuyers?.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
          <RankList title="Top Products" rows={(insights.topProducts || []).map((p: any) => ({ name: p.name, primary: fmt(p.revenue), secondary: `${p.qty} Sold` }))} empty="No Sales Yet." />
          <RankList title="Top Researchers" rows={(insights.topBuyers || []).map((b: any) => ({ name: b.name, primary: fmt(b.spend), secondary: `${b.orders} Orders` }))} empty="No Buyers Yet." />
        </div>
      )}

      {/* ORDERS MANAGER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <h2 className="metal-text" style={{ fontSize: '1.15rem', fontFamily: 'var(--font-brand)', margin: 0 }}>Orders</h2>
        <button onClick={exportOrdersCsv} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.18)', color: 'var(--white)', borderRadius: 10, padding: '9px 16px', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>Export Orders CSV</button>
      </div>
      <div style={{ minWidth: 0 }}>
        <AgentOrders orders={orders} setOrders={setOrders} />
      </div>

      {/* ACCOUNTING */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <AgentTierWidget />
      </div>

      {/* RETENTION TAB */}
      <div className="glass-panel">
        <div style={{ padding: 'var(--space-6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: retentionTab ? 'var(--space-5)' : 0 }}>
            <div>
              <h2 className="metal-text" style={{ fontSize: '1.15rem', fontFamily: 'var(--font-brand)', margin: '0 0 2px' }}>Retention</h2>
              <p style={{ color: 'var(--grey-400)', fontSize: '0.82rem', margin: 0 }}>Researcher reorder rate, at-risk accounts, and top performers</p>
            </div>
            <button
              onClick={() => setRetentionTab((v) => !v)}
              style={{ background: retentionTab ? 'var(--teal)' : 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.18)', color: retentionTab ? '#04201f' : 'var(--white)', borderRadius: 10, padding: '9px 16px', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}
            >
              {retentionTab ? 'Hide Retention' : 'Show Retention'}
            </button>
          </div>

          {retentionTab && (
            <>
              {retentionLoading && <div style={{ color: 'var(--silver)', padding: 'var(--space-4)' }}>Loading Retention Data...</div>}
              {!retentionLoading && retention && (
                <>
                  {/* Rate stat */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
                    <div className="glass-panel">
                      <div className="sa-box-centered" style={{ padding: 'var(--space-5)' }}>
                        <div className="sa-label">90-Day Retention Rate</div>
                        <div className="sa-stat" style={{ color: '#00FF9D', marginTop: 6 }}>{retention.retention_rate}%</div>
                        <div style={{ color: 'var(--grey-400)', fontSize: '0.74rem', marginTop: 8 }}>Researchers Who Reordered Within 90 Days Of First Order</div>
                      </div>
                    </div>
                    <div className="glass-panel">
                      <div className="sa-box-centered" style={{ padding: 'var(--space-5)' }}>
                        <div className="sa-label">At-Risk Accounts</div>
                        <div className="sa-stat" style={{ color: retention.at_risk.length > 0 ? '#FFB020' : 'var(--white)', marginTop: 6 }}>{retention.at_risk.length}</div>
                        <div style={{ color: 'var(--grey-400)', fontSize: '0.74rem', marginTop: 8 }}>No Order In Over 45 Days</div>
                      </div>
                    </div>
                    <div className="glass-panel">
                      <div className="sa-box-centered" style={{ padding: 'var(--space-5)' }}>
                        <div className="sa-label">Champion Researchers</div>
                        <div className="sa-stat" style={{ color: '#7C5CFF', marginTop: 6 }}>{retention.champions.length}</div>
                        <div style={{ color: 'var(--grey-400)', fontSize: '0.74rem', marginTop: 8 }}>Top 5 By Lifetime Spend</div>
                      </div>
                    </div>
                  </div>

                  {/* At-Risk table */}
                  {retention.at_risk.length > 0 && (
                    <div style={{ marginBottom: 'var(--space-5)' }}>
                      <h3 style={{ fontSize: '1rem', fontFamily: 'var(--font-brand)', color: '#FFB020', margin: '0 0 10px' }}>At-Risk Researchers</h3>
                      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                        <table className="sa-table">
                          <thead>
                            <tr>
                              <th>Name</th>
                              <th>Last Order Date</th>
                              <th>Days Since Order</th>
                              <th>Total Spent</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {retention.at_risk.map((r) => (
                              <tr key={r.user_id}>
                                <td style={{ color: 'var(--white)', fontWeight: 700 }}>{r.name}</td>
                                <td>{new Date(r.last_order_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                                <td style={{ color: r.days_since_order > 90 ? '#FF6B81' : '#FFB020', fontWeight: 700 }}>{r.days_since_order}d</td>
                                <td style={{ color: '#00FF9D', fontWeight: 700 }}>{fmt(r.total_spent)}</td>
                                <td>
                                  <a
                                    href={`/messenger?to=${r.user_id}`}
                                    style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 12px', borderRadius: 8, background: 'rgba(0,229,255,0.1)', color: '#00E5FF', fontSize: '0.78rem', fontWeight: 700, textDecoration: 'none', border: '1px solid rgba(0,229,255,0.25)' }}
                                  >
                                    Send Message
                                  </a>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  {retention.at_risk.length === 0 && (
                    <p style={{ color: '#00FF9D', fontSize: '0.85rem', margin: '0 0 var(--space-4)' }}>All researchers ordered recently. No at-risk accounts.</p>
                  )}

                  {/* Champions table */}
                  {retention.champions.length > 0 && (
                    <div>
                      <h3 style={{ fontSize: '1rem', fontFamily: 'var(--font-brand)', color: '#7C5CFF', margin: '0 0 10px' }}>Champion Researchers</h3>
                      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                        <table className="sa-table">
                          <thead>
                            <tr>
                              <th>Name</th>
                              <th>Total Orders</th>
                              <th>Total Spent</th>
                              <th>Avg Order Value</th>
                              <th>Member Since</th>
                            </tr>
                          </thead>
                          <tbody>
                            {retention.champions.map((c, i) => (
                              <tr key={c.user_id}>
                                <td style={{ color: 'var(--white)', fontWeight: 700 }}>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ width: 20, height: 20, borderRadius: 6, background: 'rgba(124,92,255,0.2)', color: '#7C5CFF', fontSize: '0.7rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                                    {c.name}
                                  </span>
                                </td>
                                <td>{c.total_orders}</td>
                                <td style={{ color: '#00FF9D', fontWeight: 700 }}>{fmt(c.total_spent)}</td>
                                <td>{fmt(c.avg_order_value)}</td>
                                <td style={{ color: 'var(--grey-400)' }}>{new Date(c.member_since).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// -- Small presentational helpers --
function KpiCard({ label, value, delta, deltaLabel, sub, color, help, href }: { label: string; value: string; delta?: number; deltaLabel?: string; sub?: string; color?: string; help?: string; href?: string }) {
  const content = (
    <div className=" sa-box-centered" style={{ padding: 'var(--space-5)' }}>
      <div className="sa-label">{label}{help && <span className="sa-info" title={help}>i</span>}</div>
      <div className="sa-stat" style={{ marginTop: 6, color: color || 'var(--white)' }}>{value}</div>
      {typeof delta === 'number' && (
        <div className={delta >= 0 ? 'sa-delta-up' : 'sa-delta-down'} style={{ marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          {delta >= 0 ? <ArrowUp size={12} aria-hidden /> : <ArrowDown size={12} aria-hidden />} {Math.abs(delta).toFixed(0)}% <span style={{ color: 'var(--grey-500)', fontWeight: 600 }}>{deltaLabel}</span>
        </div>
      )}
      {sub && <div style={{ color: 'var(--grey-400)', fontSize: '0.74rem', marginTop: 6 }}>{sub}</div>}
    </div>
  );

  return (
    <div className="glass-panel" style={href ? { cursor: 'pointer', transition: 'all 0.2s ease', position: 'relative' } : undefined}>
      {href ? <Link href={href} style={{ textDecoration: 'none', color: 'inherit', display: 'block', height: '100%' }}>{content}</Link> : content}
    </div>
  );
}

function GoalRing({ pct, hit }: { pct: number; hit: boolean }) {
  const r = 34; const c = 2 * Math.PI * r; const off = c - (Math.min(100, pct) / 100) * c;
  return (
    <div style={{ position: 'relative', width: 88, height: 88, flexShrink: 0 }}>
      <svg width="88" height="88" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
        <circle cx="44" cy="44" r={r} fill="none" stroke={hit ? '#00FF9D' : '#00E5FF'} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 44 44)" style={{ transition: 'stroke-dashoffset 0.7s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontFamily: 'var(--font-brand)', color: hit ? '#00FF9D' : 'var(--white)', fontSize: '1.05rem' }}>
        {Math.round(pct)}%
      </div>
    </div>
  );
}

function RankList({ title, rows, empty }: { title: string; rows: { name: string; primary: string; secondary: string }[]; empty: string }) {
  return (
    <div className="glass-panel">
      <div className="" style={{ padding: 'var(--space-6)' }}>
        <h2 className="metal-text" style={{ fontSize: '1.05rem', fontFamily: 'var(--font-brand)', margin: '0 0 12px' }}>{title}</h2>
        {rows.length === 0 ? <p style={{ color: 'var(--grey-400)', fontSize: '0.82rem', margin: 0 }}>{empty}</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.map((r, i) => (
              <div key={r.name + String(i)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, borderBottom: i < rows.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', paddingBottom: 7 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span style={{ width: 20, height: 20, borderRadius: 6, background: 'rgba(255,255,255,0.06)', color: 'var(--grey-400)', fontSize: '0.7rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ color: 'var(--silver)', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                </span>
                <span style={{ flexShrink: 0, textAlign: 'right' }}>
                  <span style={{ color: '#00FF9D', fontWeight: 700, fontSize: '0.85rem' }}>{r.primary}</span>
                  <span style={{ color: 'var(--grey-400)', fontSize: '0.72rem', marginLeft: 8 }}>{r.secondary}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--grey-400)', fontSize: '0.9rem', padding: '0 20px' }}>
      {label}
    </div>
  );
}
