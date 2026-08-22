
'use client';

import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import { createClient } from '@/lib/supabase/client';
import { CHART_SERIES, RANK_COLORS } from '@/lib/brand-colors';

interface AnalyticsData {
  revenueData: { date: string; revenue: number }[];
  topProducts: { name: string; sales: number; revenue: number }[];
  ordersByStatus: { name: string; value: number; color: string }[];
  agentPerformance: { name: string; revenue: number; orders: number }[];
  revenueThisMonth: number;
  revenueLastMonth: number;
  ordersThisMonth: number;
  ordersLastMonth: number;
  newResearchersWeek: number;
  totalRevenue: number;
  avgOrderValue: number;
}

// Brand chart ramp (single source of truth). Alternates teal / neutral so
// adjacent series stay distinguishable without leaving the palette.
const COLORS = CHART_SERIES;

export default function AdminAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const supabase = createClient();
      const now = new Date();
      const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
      const rangeStart = new Date(now.getTime() - days * 86400000).toISOString();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();
      const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();

      // Parallel queries
      const [ordersRes, allOrdersRes, ordersWithItemsRes, researchersRes, agentsRes] = await Promise.all([
        supabase.from('orders').select('id, total, status, created_at, agent_id').gte('created_at', rangeStart).neq('status', 'cancelled'),
        supabase.from('orders').select('total, status, created_at').neq('status', 'cancelled'),
        // Fetch orders in range with nested items - filters applied directly on orders
        // to avoid PostgREST nested FK filter silent failures.
        supabase.from('orders').select('order_items(product_name, product_id, quantity, unit_retail_price, products(name))').gte('created_at', rangeStart).neq('status', 'cancelled'),
        supabase.from('profiles').select('created_at').eq('role', 'researcher').gte('created_at', weekAgo),
        supabase.from('profiles').select('id, full_name, email').in('role', ['agent', 'super_agent']),
      ]);

      const orders = ordersRes.data ?? [];
      const allOrders = allOrdersRes.data ?? [];
      // Flatten nested order_items from each order into a single array
      const items = (ordersWithItemsRes.data ?? []).flatMap((o: any) => o.order_items ?? []);
      const agents = agentsRes.data ?? [];

      // Revenue by day
      const dailyMap = new Map<string, number>();
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 86400000);
        dailyMap.set(d.toISOString().slice(0, 10), 0);
      }
      orders.forEach(o => {
        const day = (o.created_at || "").slice(0, 10);
        if (dailyMap.has(day)) dailyMap.set(day, (dailyMap.get(day) || 0) + Number(o.total));
      });
      const revenueData = Array.from(dailyMap.entries()).map(([date, revenue]) => ({
        date: date.slice(5), revenue: Math.round(revenue * 100) / 100,
      }));

      // Top products -- use canonical products.name via FK join; fall back to snapshot
      const productMap = new Map<string, { sales: number; revenue: number }>();
      items.forEach((item: any) => {
        const name = (item.products as any)?.name || item.product_name;
        if (!name) return;
        const existing = productMap.get(name) || { sales: 0, revenue: 0 };
        existing.sales += Number(item.quantity) || 0;
        existing.revenue += (Number(item.quantity) || 0) * (Number(item.unit_retail_price) || 0);
        productMap.set(name, existing);
      });
      const topProducts = Array.from(productMap.entries())
        .map(([name, v]) => ({ name: name.length > 20 ? name.slice(0, 18) + '…' : name, ...v }))
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 10);

      // Orders by status (pie chart)
      const statusCounts: Record<string, number> = {};
      orders.forEach(o => { statusCounts[o.status] = (statusCounts[o.status] || 0) + 1; });
      // Seven DISTINCT on-brand colors - these are pie slices, so any two
      // statuses sharing a color would be indistinguishable in the chart.
      const statusLabels: Record<string, { label: string; color: string }> = {
        pending_customer_payment: { label: 'Pending Payment', color: '#F87171' },
        agent_approval_pending: { label: 'Pending Approval', color: '#D0DAE4' },
        approved_ship: { label: 'Approved Ship', color: '#5EEAD4' },
        approved_pickup: { label: 'Approved Pickup', color: '#A8B4C0' },
        in_fulfillment: { label: 'Fulfilling', color: '#2DD4BF' },
        shipped: { label: 'Shipped', color: '#00C4BC' },
        delivered: { label: 'Delivered', color: '#5A6A7A' },
      };
      const ordersByStatus = Object.entries(statusCounts)
        .filter(([k]) => statusLabels[k])
        .map(([k, v]) => ({ name: statusLabels[k].label, value: v, color: statusLabels[k].color }));

      // Agent performance
      const agentRevMap: Record<string, { revenue: number; orders: number }> = {};
      orders.forEach(o => {
        if (!o.agent_id) return;
        if (!agentRevMap[o.agent_id]) agentRevMap[o.agent_id] = { revenue: 0, orders: 0 };
        agentRevMap[o.agent_id].revenue += Number(o.total);
        agentRevMap[o.agent_id].orders++;
      });
      const agentPerformance = agents
        .map(a => ({
          name: (a.full_name || a.email || 'Agent').split(' ')[0],
          revenue: Math.round((agentRevMap[a.id]?.revenue || 0) * 100) / 100,
          orders: agentRevMap[a.id]?.orders || 0,
        }))
        .filter(a => a.revenue > 0)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 8);

      // Monthly comparisons
      const thisMonthOrders = allOrders.filter(o => o.created_at && o.created_at >= thisMonthStart); // @ts-ignore
      const lastMonthOrders = allOrders.filter(o => o.created_at && o.created_at >= lastMonthStart && o.created_at <= lastMonthEnd); // @ts-ignore

      const revenueThisMonth = thisMonthOrders.reduce((s, o) => s + Number(o.total), 0);
      const revenueLastMonth = lastMonthOrders.reduce((s, o) => s + Number(o.total), 0);
      const totalRevenue = allOrders.reduce((s, o) => s + Number(o.total), 0);
      const avgOrderValue = allOrders.length > 0 ? totalRevenue / allOrders.length : 0;

      setData({
        revenueData,
        topProducts,
        ordersByStatus,
        agentPerformance,
        revenueThisMonth,
        revenueLastMonth,
        ordersThisMonth: thisMonthOrders.length,
        ordersLastMonth: lastMonthOrders.length,
        newResearchersWeek: researchersRes.data?.length ?? 0,
        totalRevenue,
        avgOrderValue,
      });
      setLoading(false);
    }
    fetchData();
  }, [range]);

  if (loading || !data) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
        {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 300, borderRadius: 16 }} />)}
      </div>
    );
  }

  const pctChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? '+100%' : '0%';
    const pct = ((current - previous) / previous * 100).toFixed(1);
    return Number(pct) >= 0 ? `+${pct}%` : `${pct}%`;
  };
  const isPositive = (current: number, previous: number) => current >= previous;

  const rangeOptions = [
    { value: '7d' as const, label: '7 Days' },
    { value: '30d' as const, label: '30 Days' },
    { value: '90d' as const, label: '90 Days' },
  ];

  return (
    <div style={{ marginBottom: 'var(--space-8)' }}>
      {/* Range selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
        <h3 style={{ fontSize: '1rem', color: '#fff', margin: 0 }}>Analytics</h3>
        <div style={{ display: 'flex', gap: 4 }}>
          {rangeOptions.map(r => (
            <button key={r.value} onClick={() => setRange(r.value)}
              style={{
                padding: '4px 12px', borderRadius: 6, cursor: 'pointer',
                fontSize: '0.72rem', fontWeight: range === r.value ? 700 : 500,
                background: range === r.value ? 'rgba(168,180,192,0.08)' : 'transparent',
                color: range === r.value ? 'var(--teal)' : 'rgba(255,255,255,0.35)',
                border: range === r.value ? '1px solid rgba(168,180,192,0.15)' : '1px solid rgba(255,255,255,0.04)',
              }}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        {[
          {
            label: 'Revenue This Month', value: `$${Number(data.revenueThisMonth || 0).toFixed(2)}`,
            change: pctChange(data.revenueThisMonth, data.revenueLastMonth),
            positive: isPositive(data.revenueThisMonth, data.revenueLastMonth),
          },
          {
            label: 'Orders This Month', value: data.ordersThisMonth.toString(),
            change: pctChange(data.ordersThisMonth, data.ordersLastMonth),
            positive: isPositive(data.ordersThisMonth, data.ordersLastMonth),
          },
          {
            label: 'Avg Order Value', value: `$${Number(data.avgOrderValue || 0).toFixed(2)}`,
            change: '', positive: true,
          },
          {
            label: 'New Researchers (7d)', value: data.newResearchersWeek.toString(),
            change: '', positive: true,
          },
        ].map((kpi, i) => (
          <div key={i} className="glass-panel">
            <div className="" style={{ padding: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 8, minHeight: 20 }}>

                {kpi.change && (
                  <span style={{
                    fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                    background: kpi.positive ? 'rgba(72,187,120,0.1)' : 'rgba(229,62,62,0.1)',
                    color: kpi.positive ? '#48BB78' : '#F87171',
                  }}>{kpi.change}</span>
                )}
              </div>
              <div className="metal-text" style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--teal)', fontFamily: 'var(--font-brand)' }}>{kpi.value}</div>
              <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{kpi.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
        {/* Revenue Trend */}
        <div className="glass-panel">
          <div className="" style={{ padding: 'var(--space-6)' }}>
            <h3 className="metal-text" style={{ fontSize: '0.92rem', color: '#fff', marginBottom: 'var(--space-4)', fontFamily: 'var(--font-brand)' }}>
              Revenue Trend
            </h3>
          <div style={{ height: 260, width: '100%' }} role="img" aria-label="Area Chart Of Platform Revenue Trend Over The Selected Date Range">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.revenueData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#A8B4C0" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#A8B4C0" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="date" stroke="rgba(255,255,255,0.2)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="rgba(255,255,255,0.2)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
                <Tooltip
                  contentStyle={{ background: '#111827', border: '1px solid rgba(168,180,192,0.2)', borderRadius: 10, fontSize: '0.8rem' }}
                  itemStyle={{ color: '#A8B4C0' }}
                  formatter={(val: any) => [`$${Number(val).toFixed(2)}`, 'Revenue']}
                />
                <Area type="monotone" dataKey="revenue" stroke="#A8B4C0" strokeWidth={2.5} fill="url(#revGrad)" dot={false} activeDot={{ r: 5, fill: '#A8B4C0' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          </div>
        </div>

        {/* Order Status Pie */}
        <div className="glass-panel">
          <div className="" style={{ padding: 'var(--space-6)' }}>
            <h3 className="metal-text" style={{ fontSize: '0.92rem', color: '#fff', marginBottom: 'var(--space-4)', fontFamily: 'var(--font-brand)' }}>
              Order Pipeline
            </h3>
          {data.ordersByStatus.length > 0 ? (
            <>
              <div style={{ height: 180, width: '100%' }} role="img" aria-label={`Pie Chart Of Orders By Status: ${data.ordersByStatus.map((s) => `${s.name} ${s.value}`).join(', ')}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.ordersByStatus} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value" strokeWidth={0}>
                      {data.ordersByStatus.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: '0.78rem' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {data.ordersByStatus.map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.68rem', color: 'rgba(255,255,255,0.5)' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
                    {s.name} ({s.value})
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.25)', fontSize: '0.8rem' }}>No Orders In Range</div>
          )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
        {/* Top Products */}
        <div className="glass-panel">
          <div className="" style={{ padding: 'var(--space-6)' }}>
            <h3 className="metal-text" style={{ fontSize: '0.92rem', color: '#fff', marginBottom: 'var(--space-4)', fontFamily: 'var(--font-brand)' }}>
              Top Products (By Revenue)
            </h3>
          {data.topProducts.length > 0 ? (
            <div style={{ height: 240, width: '100%' }} role="img" aria-label={`Bar Chart Of Top ${data.topProducts.length} Products By Revenue`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.topProducts} layout="vertical" margin={{ top: 5, right: 5, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                  <XAxis type="number" stroke="rgba(255,255,255,0.2)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
                  <YAxis type="category" dataKey="name" stroke="rgba(255,255,255,0.3)" fontSize={11} tickLine={false} axisLine={false} width={100} />
                  <Tooltip
                    contentStyle={{ background: '#111827', border: '1px solid rgba(208, 218, 228,0.2)', borderRadius: 8, fontSize: '0.78rem' }}
                    formatter={(val: any) => [`$${Number(val).toFixed(2)}`, 'Revenue']}
                    cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                  />
                  <Bar dataKey="revenue" fill="#00C4BC" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.25)', fontSize: '0.8rem' }}>No Product Data</div>
          )}
          </div>
        </div>

        {/* Agent Performance */}
        <div className="glass-panel">
          <div className="" style={{ padding: 'var(--space-6)' }}>
            <h3 className="metal-text" style={{ fontSize: '0.92rem', color: '#fff', marginBottom: 'var(--space-4)', fontFamily: 'var(--font-brand)' }}>
              Agent Revenue
            </h3>
          {data.agentPerformance.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.agentPerformance.map((a, i) => {
                const maxRev = data.agentPerformance[0].revenue;
                const barWidth = maxRev > 0 ? (a.revenue / maxRev * 100) : 0;
                return (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 4 }}>
                      <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
                        <span style={{ color: 'rgba(255,255,255,0.3)', marginRight: 6 }}>#{i + 1}</span>
                        {a.name}
                      </span>
                      <span style={{ color: 'var(--teal)', fontWeight: 700 }}>${Number(a.revenue || 0).toFixed(2)}</span>
                    </div>
                    <div style={{ height: 6, background: 'rgba(255,255,255,0.04)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 3,
                        width: `${barWidth}%`,
                        background: `linear-gradient(90deg, ${COLORS[i % COLORS.length]}, ${COLORS[(i + 1) % COLORS.length]})`,
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                    <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>{a.orders} orders</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.25)', fontSize: '0.8rem' }}>No Agent Data</div>
          )}
          </div>
        </div>
      </div>

      {/* Top 10 Peptides */}
      {data.topProducts.length > 0 && (
        <div className="glass-panel" style={{ marginTop: 'var(--space-6)' }}>
          <div style={{ padding: 'var(--space-6)' }}>
            <h3 className="metal-text" style={{ fontSize: '0.92rem', color: '#fff', marginBottom: 'var(--space-4)', fontFamily: 'var(--font-brand)' }}>
              Top 10 Peptides
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', minWidth: 360 }}>
                <thead>
                  <tr>
                    <th style={{ padding: 'var(--space-2) var(--space-4)', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontWeight: 700, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap' }}>Rank</th>
                    <th style={{ padding: 'var(--space-2) var(--space-4)', textAlign: 'left', color: 'rgba(255,255,255,0.3)', fontWeight: 700, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap' }}>Product</th>
                    <th style={{ padding: 'var(--space-2) var(--space-4)', textAlign: 'right', color: 'rgba(255,255,255,0.3)', fontWeight: 700, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap' }}>Units Sold</th>
                    <th style={{ padding: 'var(--space-2) var(--space-4)', textAlign: 'right', color: 'rgba(255,255,255,0.3)', fontWeight: 700, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap' }}>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topProducts.map((prod, i) => (
                    <tr key={i} style={{ borderBottom: i < data.topProducts.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                      <td style={{ padding: 'var(--space-2) var(--space-4)', textAlign: 'center', fontWeight: 800, fontSize: '0.78rem', color: i < RANK_COLORS.length ? RANK_COLORS[i] : 'rgba(255,255,255,0.25)' }}>
                        {i + 1}
                      </td>
                      <td style={{ padding: 'var(--space-2) var(--space-4)', color: 'rgba(255,255,255,0.8)', fontWeight: 600, fontSize: '0.85rem' }}>
                        {prod.name}
                      </td>
                      <td style={{ padding: 'var(--space-2) var(--space-4)', textAlign: 'right', color: 'var(--teal)', fontWeight: 700, fontFamily: 'var(--font-brand)' }}>
                        {prod.sales}
                      </td>
                      <td style={{ padding: 'var(--space-2) var(--space-4)', textAlign: 'right', color: 'var(--silver)', fontFamily: 'var(--font-brand)' }}>
                        ${Number(prod.revenue || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
