'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts';
import AgentOrders from './AgentOrders';
import { createClient } from '@/lib/supabase/client';
import AgentStatements from './AgentStatements';
import AgentDownlineInvoices from './AgentDownlineInvoices';
import AgentTierWidget from './AgentTierWidget';

// Revenue is only "collected" once an order is approved or further along. Pending
// and approval-stage orders are treated as pipeline (potential, not yet earned).
const COLLECTED = new Set(['approved_ship', 'approved_pickup', 'in_fulfillment', 'shipped', 'delivered']);
const PENDING = new Set(['pending_customer_payment', 'agent_approval_pending', 'admin_approval_pending']);

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Lifetime revenue milestones (collected). Drives the badge ladder.
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
  const [range, setRange] = useState<7 | 30 | 90>(30);
  const [goal, setGoal] = useState<number>(0);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState('');
  const supabase = createClient();
  const isFetching = useRef(false);
  const needsRefetch = useRef(false);

  // ── Monthly revenue goal (persisted per-agent in localStorage) ──────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`pnl_sales_goal_${agentId}`);
      setGoal(raw ? Math.max(0, Number(raw) || 0) : 5000);
    } catch { setGoal(5000); }
  }, [agentId]);
  const saveGoal = useCallback((next: number) => {
    const v = Math.max(0, Math.round(next));
    setGoal(v);
    try { localStorage.setItem(`pnl_sales_goal_${agentId}`, String(v)); } catch { /* ignore */ }
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
    let cancelled = false;
    (async () => {
      try {
        const [iRes, wRes] = await Promise.all([
          fetch('/api/agent/sales/insights', { cache: 'no-store' }),
          fetch('/api/agent/wallet/summary', { cache: 'no-store' }),
        ]);
        if (iRes.ok) { const j = await iRes.json(); if (!cancelled) setInsights(j); }
        if (wRes.ok) { const j = await wRes.json(); if (!cancelled) setWallet(j); }
      } catch { /* best-effort */ }
    })();
    return () => { cancelled = true; };
  }, [orders.length]);

  // ── All analytics derived from the orders array ─────────────────────────────
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

    // Continuous series for the selected range (fill zero days)
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

    // Window helpers
    const now = Date.now();
    const windowSum = (fromMs: number, toMs: number, k: string) =>
      collected.filter((o) => {
        const t = new Date(o.created_at).getTime();
        return t >= fromMs && t < toMs;
      }).reduce((s, o) => s + (Number(o[k]) || 0), 0);
    const windowCount = (fromMs: number, toMs: number) =>
      collected.filter((o) => {
        const t = new Date(o.created_at).getTime();
        return t >= fromMs && t < toMs;
      }).length;

    const rev30 = windowSum(now - 30 * DAY_MS, now, 'total');
    const revPrev30 = windowSum(now - 60 * DAY_MS, now - 30 * DAY_MS, 'total');
    const profit30 = windowSum(now - 30 * DAY_MS, now, 'profit');
    const orders30 = windowCount(now - 30 * DAY_MS, now);
    const ordersPrev30 = windowCount(now - 60 * DAY_MS, now - 30 * DAY_MS);
    const rev7 = windowSum(now - 7 * DAY_MS, now, 'total');
    const revPrev7 = windowSum(now - 14 * DAY_MS, now - 7 * DAY_MS, 'total');

    const pct = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : cur > 0 ? 100 : 0);

    // This calendar month + run-rate projection
    const tnow = new Date();
    const monthStart = new Date(tnow.getFullYear(), tnow.getMonth(), 1).getTime();
    const monthRevenue = windowSum(monthStart, now, 'total');
    const monthProfit = windowSum(monthStart, now, 'profit');
    const daysInMonth = new Date(tnow.getFullYear(), tnow.getMonth() + 1, 0).getDate();
    const dayOfMonth = tnow.getDate();
    const projectedMonth = dayOfMonth > 0 ? (monthRevenue / dayOfMonth) * daysInMonth : 0;

    // Streak: consecutive days ending today/yesterday with at least one collected order
    let streak = 0;
    {
      const t0 = new Date();
      let cursor = new Date(t0.getFullYear(), t0.getMonth(), t0.getDate());
      if (!daily.has(dayKey(cursor))) cursor = new Date(cursor.getTime() - DAY_MS);
      while (daily.has(dayKey(cursor))) {
        streak += 1;
        cursor = new Date(cursor.getTime() - DAY_MS);
      }
    }

    // Personal best day
    let best = { date: '', revenue: 0 };
    for (const [k, v] of daily.entries()) {
      if (v.revenue > best.revenue) best = { date: k, revenue: v.revenue };
    }

    // Best weekday by total revenue
    const wd = WEEKDAYS.map(() => ({ revenue: 0 }));
    for (const o of collected) {
      const d = new Date(o.created_at);
      if (isNaN(d.getTime())) continue;
      wd[d.getDay()].revenue += Number(o.total) || 0;
    }
    let bestWeekday = -1; let bestWeekdayRev = 0;
    wd.forEach((w, i) => { if (w.revenue > bestWeekdayRev) { bestWeekdayRev = w.revenue; bestWeekday = i; } });

    // Repeat buyer rate
    const buyerOrders = new Map<string, number>();
    for (const o of collected) {
      const id = o.buyer_id || 'unknown';
      buyerOrders.set(id, (buyerOrders.get(id) || 0) + 1);
    }
    const distinctBuyers = buyerOrders.size;
    const repeatBuyers = Array.from(buyerOrders.values()).filter((n) => n > 1).length;
    const repeatRate = distinctBuyers ? (repeatBuyers / distinctBuyers) * 100 : 0;

    // Product mix (top by revenue, from item snapshots)
    const prodAgg = new Map<string, number>();
    for (const o of collected) {
      for (const it of (o.items || [])) {
        const name = it.product_name || 'Product';
        const rev = (Number(it.unit_retail_price) || 0) * (Number(it.quantity) || 0);
        prodAgg.set(name, (prodAgg.get(name) || 0) + rev);
      }
    }
    const productMix = Array.from(prodAgg.entries())
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((x, y) => y.revenue - x.revenue);
    const topProductSlices = (() => {
      const top = productMix.slice(0, 6);
      const rest = productMix.slice(6).reduce((s, p) => s + p.revenue, 0);
      const out = top.map((p) => ({ name: p.name, value: Number(p.revenue.toFixed(2)) }));
      if (rest > 0) out.push({ name: 'Other', value: Number(rest.toFixed(2)) });
      return out;
    })();

    // Payment method mix
    const payAgg = new Map<string, number>();
    for (const o of collected) {
      const m = (o.payment_method || 'Other') as string;
      payAgg.set(m, (payAgg.get(m) || 0) + (Number(o.total) || 0));
    }
    const payMix = Array.from(payAgg.entries())
      .map(([method, revenue]) => ({ method: method.replace('_', ' '), revenue: Number(revenue.toFixed(2)) }))
      .sort((x, y) => y.revenue - x.revenue);

    return {
      hasCollected: collected.length > 0,
      lifetimeRevenue, lifetimeProfit, lifetimeOrders, aov, margin, pipeline,
      pendingCount: pending.length,
      rev30, revDelta30: pct(rev30, revPrev30), profit30, orders30, ordersDelta30: pct(orders30, ordersPrev30),
      rev7, revDelta7: pct(rev7, revPrev7),
      monthRevenue, monthProfit, projectedMonth, daysInMonth, dayOfMonth,
      streak, best, bestWeekday, bestWeekdayRev, repeatRate, distinctBuyers,
      productMix, topProductSlices, payMix,
      series7: series(7), series30: series(30), series90: series(90),
    };
  }, [orders]);

  const chartData = range === 7 ? a.series7 : range === 30 ? a.series30 : a.series90;

  // Goal pacing
  const goalPct = goal > 0 ? Math.min(100, (a.monthRevenue / goal) * 100) : 0;
  const expectedByNow = goal > 0 && a.daysInMonth > 0 ? goal * (a.dayOfMonth / a.daysInMonth) : 0;
  const onTrack = a.monthRevenue >= expectedByNow;
  const paceGap = Math.abs(a.monthRevenue - expectedByNow);

  // Milestones
  const nextMilestone = MILESTONES.find((m) => a.lifetimeRevenue < m.amount) || null;
  const achievedMilestones = MILESTONES.filter((m) => a.lifetimeRevenue >= m.amount);

  const exportCsv = useCallback(() => {
    const rows = [['Order Id', 'Date', 'Status', 'Buyer', 'Payment', 'Revenue', 'Profit']];
    for (const o of (orders || [])) {
      rows.push([
        o.id, new Date(o.created_at).toISOString().slice(0, 10), o.status,
        (o.buyer_name || '').replace(/,/g, ' '), (o.payment_method || ''),
        String(Number(o.total) || 0), String(Number(o.profit) || 0),
      ]);
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? '')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sales-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [orders]);

  if (loading) return <div style={{ padding: 'var(--space-6)', color: 'var(--silver)' }}>Loading Live Sales Data...</div>;
  if (error) return <div style={{ padding: 'var(--space-6)', color: 'var(--red)' }}>Error: {error}</div>;

  const isSub = !!(userProfile?.tier && String(userProfile.tier).includes('sub-agent'));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .sa-label { font-size: 0.72rem; color: var(--grey-400); text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; }
        .sa-stat { font-size: 1.9rem; font-weight: 800; font-family: var(--font-brand); color: var(--white); line-height: 1.1; }
        .sa-delta-up { color: #00FF9D; font-weight: 700; font-size: 0.78rem; }
        .sa-delta-down { color: #FF6B81; font-weight: 700; font-size: 0.78rem; }
        .sa-range-btn { padding: 6px 14px; border-radius: 8px; font-size: 0.8rem; font-weight: 700; cursor: pointer; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.04); color: var(--silver); }
        .sa-range-btn.active { background: var(--teal); color: #04201f; border-color: var(--teal); }
        .sa-badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 999px; font-size: 0.74rem; font-weight: 800; }
        @keyframes sa-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(0,255,157,0.0);} 50% { box-shadow: 0 0 0 6px rgba(0,255,157,0.12);} }
      `}} />

      {/* ─────────────── ACCOUNTING / MONEY STRIP ─────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 'var(--space-4)' }}>
        <div className="metal-frame">
          <div className="metal-content" style={{ padding: 'var(--space-5)' }}>
            <div className="sa-label">{wallet?.primaryLabel || 'Available'}</div>
            <div className="sa-stat" style={{ color: '#00E5FF', marginTop: 6 }}>{fmt(wallet?.primary ?? 0)}</div>
            <a href="/wallet" style={{ color: 'var(--teal)', fontSize: '0.76rem', fontWeight: 700, marginTop: 8, display: 'inline-block' }}>Open Wallet</a>
          </div>
        </div>
        <div className="metal-frame">
          <div className="metal-content" style={{ padding: 'var(--space-5)' }}>
            <div className="sa-label">Owed This Week</div>
            <div className="sa-stat" style={{ color: (wallet?.owedThisWeek ?? 0) > 0 ? '#FF6B81' : 'var(--white)', marginTop: 6 }}>{fmt(wallet?.owedThisWeek ?? 0)}</div>
            <div style={{ color: 'var(--grey-400)', fontSize: '0.74rem', marginTop: 8 }}>
              {wallet?.nextStatementDate ? `Due ${new Date(wallet.nextStatementDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'No Open Statement'}
            </div>
          </div>
        </div>
        <div className="metal-frame">
          <div className="metal-content" style={{ padding: 'var(--space-5)' }}>
            <div className="sa-label">Profit This Month</div>
            <div className="sa-stat" style={{ color: '#00FF9D', marginTop: 6 }}>{fmt(a.monthProfit)}</div>
            <div style={{ color: 'var(--grey-400)', fontSize: '0.74rem', marginTop: 8 }}>{fmt(a.monthRevenue)} Revenue</div>
          </div>
        </div>
        <div className="metal-frame">
          <div className="metal-content" style={{ padding: 'var(--space-5)' }}>
            <div className="sa-label">Lifetime Profit</div>
            <div className="sa-stat" style={{ marginTop: 6 }}>{fmt(a.lifetimeProfit)}</div>
            <div style={{ color: 'var(--grey-400)', fontSize: '0.74rem', marginTop: 8 }}>{a.margin.toFixed(0)}% Margin</div>
          </div>
        </div>
      </div>

      {/* ─────────────── GOAL + STREAK + FORECAST ─────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
        {/* Monthly goal ring */}
        <div className="metal-frame" style={goal > 0 && goalPct >= 100 ? { animation: 'sa-pulse 2.4s ease-in-out infinite' } : undefined}>
          <div className="metal-content" style={{ padding: 'var(--space-6)', display: 'flex', gap: 'var(--space-5)', alignItems: 'center' }}>
            <GoalRing pct={goalPct} hit={goalPct >= 100} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div className="sa-label">Monthly Revenue Goal</div>
                {!editingGoal && (
                  <button onClick={() => { setGoalDraft(String(goal)); setEditingGoal(true); }} style={{ background: 'none', border: 'none', color: 'var(--teal)', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', padding: 0 }}>Edit</button>
                )}
              </div>
              {editingGoal ? (
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <input type="number" min="0" value={goalDraft} onChange={(e) => setGoalDraft(e.target.value)}
                    style={{ width: 120, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, color: 'var(--white)', padding: '6px 8px', fontSize: '0.9rem' }} />
                  <button onClick={() => { saveGoal(Number(goalDraft) || 0); setEditingGoal(false); }} style={{ background: 'var(--teal)', color: '#04201f', border: 'none', borderRadius: 8, padding: '6px 12px', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer' }}>Save</button>
                </div>
              ) : (
                <>
                  <div className="sa-stat" style={{ marginTop: 6 }}>{fmt(a.monthRevenue)}</div>
                  <div style={{ color: 'var(--grey-400)', fontSize: '0.8rem', marginTop: 2 }}>of {fmt(goal)} target</div>
                  <div style={{ marginTop: 8, fontSize: '0.8rem', fontWeight: 700, color: onTrack ? '#00FF9D' : '#FFB020' }}>
                    {goal <= 0 ? 'Set A Goal To Track Pace' : onTrack ? `On Track — Ahead By ${fmt(paceGap)}` : `Behind Pace By ${fmt(paceGap)}`}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Streak + best day */}
        <div className="metal-frame">
          <div className="metal-content" style={{ padding: 'var(--space-6)' }}>
            <div className="sa-label">Selling Streak</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 6 }}>
              <span className="sa-stat" style={{ color: a.streak > 0 ? '#FFB020' : 'var(--grey-500)' }}>{a.streak}</span>
              <span style={{ color: 'var(--silver)', fontWeight: 700 }}>{a.streak === 1 ? 'Day' : 'Days'} In A Row</span>
            </div>
            <div style={{ color: 'var(--grey-400)', fontSize: '0.8rem', marginTop: 8 }}>
              {a.streak > 0 ? 'Make A Sale Today To Keep It Alive' : 'Make A Sale To Start A Streak'}
            </div>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '14px 0' }} />
            <div className="sa-label">Personal Best Day</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
              <span style={{ fontSize: '1.3rem', fontWeight: 800, color: '#00E5FF', fontFamily: 'var(--font-brand)' }}>{a.best.revenue > 0 ? fmt(a.best.revenue) : '—'}</span>
              {a.best.date && <span style={{ color: 'var(--grey-400)', fontSize: '0.78rem' }}>on {new Date(a.best.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
            </div>
          </div>
        </div>

        {/* Forecast / run-rate */}
        <div className="metal-frame">
          <div className="metal-content" style={{ padding: 'var(--space-6)' }}>
            <div className="sa-label">Projected Month-End</div>
            <div className="sa-stat" style={{ color: '#7C5CFF', marginTop: 6 }}>{fmt(a.projectedMonth)}</div>
            <div style={{ color: 'var(--grey-400)', fontSize: '0.8rem', marginTop: 4 }}>Based On {a.dayOfMonth} Of {a.daysInMonth} Days</div>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '14px 0' }} />
            <div className="sa-label">Open Pipeline</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
              <span style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--white)', fontFamily: 'var(--font-brand)' }}>{fmt(a.pipeline)}</span>
              <span style={{ color: 'var(--grey-400)', fontSize: '0.78rem' }}>{a.pendingCount} Awaiting</span>
            </div>
            {wallet && wallet.forecastNext > 0 && (
              <div style={{ color: 'var(--grey-400)', fontSize: '0.74rem', marginTop: 8 }}>Forecast Owed Next Statement: {fmt(wallet.forecastNext)}</div>
            )}
          </div>
        </div>
      </div>

      {/* ─────────────── MILESTONES ─────────────── */}
      <div className="metal-frame">
        <div className="metal-content" style={{ padding: 'var(--space-6)' }}>
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
                }}>
                  {hit ? '★' : '○'} {m.label}
                </span>
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

      {/* ─────────────── KPI SNAPSHOT ─────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-4)' }}>
        <KpiCard label="Collected Revenue" value={fmt(a.lifetimeRevenue)} delta={a.revDelta30} deltaLabel="vs prior 30d" />
        <KpiCard label="Total Profit" value={fmt(a.lifetimeProfit)} color="#00FF9D" />
        <KpiCard label="Orders" value={String(a.lifetimeOrders)} delta={a.ordersDelta30} deltaLabel="vs prior 30d" color="#00E5FF" />
        <KpiCard label="Avg Order Value" value={fmt(a.aov)} />
        <KpiCard label="Repeat Buyer Rate" value={`${a.repeatRate.toFixed(0)}%`} sub={`${a.distinctBuyers} Buyers`} />
      </div>

      {/* ─────────────── TREND CHART ─────────────── */}
      <div className="metal-frame">
        <div className="metal-content" style={{ padding: 'var(--space-6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 'var(--space-4)' }}>
            <h2 className="metal-text" style={{ fontSize: '1.15rem', fontFamily: 'var(--font-brand)', margin: 0 }}>Revenue And Profit</h2>
            <div style={{ display: 'flex', gap: 6 }}>
              {[7, 30, 90].map((r) => (
                <button key={r} className={`sa-range-btn ${range === r ? 'active' : ''}`} onClick={() => setRange(r as 7 | 30 | 90)}>{r}D</button>
              ))}
            </div>
          </div>
          <div style={{ width: '100%', height: 320 }}>
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

      {/* ─────────────── BREAKDOWNS ─────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
        {/* Product mix donut */}
        <div className="metal-frame">
          <div className="metal-content" style={{ padding: 'var(--space-6)' }}>
            <h2 className="metal-text" style={{ fontSize: '1.05rem', fontFamily: 'var(--font-brand)', margin: '0 0 12px' }}>Revenue By Product</h2>
            {a.topProductSlices.length > 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                <div style={{ width: 170, height: 170 }}>
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
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem' }}>
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

        {/* Payment method bars */}
        <div className="metal-frame">
          <div className="metal-content" style={{ padding: 'var(--space-6)' }}>
            <h2 className="metal-text" style={{ fontSize: '1.05rem', fontFamily: 'var(--font-brand)', margin: '0 0 12px' }}>Revenue By Payment Method</h2>
            {a.payMix.length > 0 ? (
              <div style={{ width: '100%', height: 200 }}>
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
                Your Strongest Day Is <strong style={{ color: 'var(--white)' }}>{WEEKDAYS[a.bestWeekday]}</strong> — {fmt(a.bestWeekdayRev)} Lifetime
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─────────────── TOP PRODUCTS / RESEARCHERS ─────────────── */}
      {insights && (insights.topProducts?.length > 0 || insights.topBuyers?.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
          <RankList title="Top Products" rows={(insights.topProducts || []).map((p: any) => ({ name: p.name, primary: fmt(p.revenue), secondary: `${p.qty} Sold` }))} empty="No Sales Yet." />
          <RankList title="Top Researchers" rows={(insights.topBuyers || []).map((b: any) => ({ name: b.name, primary: fmt(b.spend), secondary: `${b.orders} Orders` }))} empty="No Buyers Yet." />
        </div>
      )}

      {/* ─────────────── ORDERS MANAGER ─────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <h2 className="metal-text" style={{ fontSize: '1.15rem', fontFamily: 'var(--font-brand)', margin: 0 }}>Orders</h2>
        <button onClick={exportCsv} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.18)', color: 'var(--white)', borderRadius: 10, padding: '9px 16px', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>Export CSV</button>
      </div>
      <div style={{ minWidth: 0 }}>
        <AgentOrders orders={orders} setOrders={setOrders} />
      </div>

      {/* ─────────────── ACCOUNTING ─────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <AgentTierWidget />
        {!isSub && <div style={{ animation: 'fadeIn 0.3s ease-out' }}><AgentStatements /></div>}
        {(userProfile?.is_super_agent || isSub) && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}><AgentDownlineInvoices isSuperAgent={!!userProfile?.is_super_agent} /></div>
        )}
      </div>
    </div>
  );
}

// ── Small presentational helpers ──────────────────────────────────────────────
function KpiCard({ label, value, delta, deltaLabel, sub, color }: { label: string; value: string; delta?: number; deltaLabel?: string; sub?: string; color?: string }) {
  return (
    <div className="metal-frame">
      <div className="metal-content" style={{ padding: 'var(--space-5)' }}>
        <div className="sa-label">{label}</div>
        <div className="sa-stat" style={{ marginTop: 6, color: color || 'var(--white)' }}>{value}</div>
        {typeof delta === 'number' && (
          <div className={delta >= 0 ? 'sa-delta-up' : 'sa-delta-down'} style={{ marginTop: 6 }}>
            {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(0)}% <span style={{ color: 'var(--grey-500)', fontWeight: 600 }}>{deltaLabel}</span>
          </div>
        )}
        {sub && <div style={{ color: 'var(--grey-400)', fontSize: '0.74rem', marginTop: 6 }}>{sub}</div>}
      </div>
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
    <div className="metal-frame">
      <div className="metal-content" style={{ padding: 'var(--space-6)' }}>
        <h2 className="metal-text" style={{ fontSize: '1.05rem', fontFamily: 'var(--font-brand)', margin: '0 0 12px' }}>{title}</h2>
        {rows.length === 0 ? <p style={{ color: 'var(--grey-400)', fontSize: '0.82rem', margin: 0 }}>{empty}</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, borderBottom: i < rows.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', paddingBottom: 7 }}>
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
