'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { RangePreset } from '@/lib/sales-range';
import SalesFilterBar from './SalesFilterBar';
import SalesKPIStrip from './SalesKPIStrip';
import SalesTimeseriesChart from './LazySalesTimeseriesChart';
import GoalTracker from './GoalTracker';
import AutoInsightsCallouts from './AutoInsightsCallouts';
import SalesHeatmap from './SalesHeatmap';
import SubAgentRollupTable from './SubAgentRollupTable';
import AIWeeklySummary from './AIWeeklySummary';

// Order statuses that count as collected revenue (matches agent_sales_kpis RPC)
const COLLECTED = new Set(['approved_ship', 'approved_pickup', 'in_fulfillment', 'shipped', 'delivered']);

interface SaleRow {
  id: string;
  status: string;
  created_at: string;
  total: number;
  profit: number;
  buyer_name: string | null;
  is_downline_order: boolean;
  downline_agent_name: string | null;
  payment_method: string | null;
  items?: Array<{ product_name?: string | null; quantity?: number; unit_retail_price?: number; unit_cost_price?: number }>;
}

function presetStart(preset: RangePreset): Date | null {
  const now = new Date();
  if (preset === 'today') { const d = new Date(now); d.setHours(0, 0, 0, 0); return d; }
  if (preset === '7d') return new Date(now.getTime() - 7 * 864e5);
  if (preset === '30d') return new Date(now.getTime() - 30 * 864e5);
  if (preset === 'mtd') return new Date(now.getFullYear(), now.getMonth(), 1);
  if (preset === 'qtd') return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  if (preset === 'ytd') return new Date(now.getFullYear(), 0, 1);
  return null; // custom / unknown: no client-side window
}

const fmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const panel: React.CSSProperties = { padding: 14, borderRadius: 12 };
const h3Style: React.CSSProperties = { color: 'var(--white)', fontSize: '0.95rem', margin: '0 0 10px', fontFamily: 'var(--font-brand)', textTransform: 'uppercase', letterSpacing: '0.04em' };

export default function SalesPageV2() {
  const [preset, setPreset] = useState<RangePreset>('30d');
  const [kpis, setKpis] = useState<any>(null);
  const [points, setPoints] = useState<any[]>([]);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async (p: RangePreset) => {
    setLoading(true);
    setError(null);
    try {
      const [k, t, s] = await Promise.all([
        fetch(`/api/agent/sales/kpis-v2?range=${p}`, { cache: 'no-store' }),
        fetch(`/api/agent/sales/timeseries-v2?range=${p}`, { cache: 'no-store' }),
        fetch(`/api/agent/sales?t=${Date.now()}`, { cache: 'no-store' }),
      ]);
      if (!k.ok && !t.ok && !s.ok) throw new Error('Sales Data Is Temporarily Unavailable.');
      if (k.ok) setKpis(await k.json());
      if (t.ok) { const tj = await t.json(); setPoints(tj?.points ?? []); }
      if (s.ok) { const sj = await s.json(); setSales(Array.isArray(sj?.data?.sales) ? sj.data.sales : []); }
    } catch (e: any) {
      setError(e?.message || 'Could Not Load Sales Data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(preset); }, [preset, load, reloadKey]);

  // Window the per-order feed to the selected preset + collected statuses.
  const windowed = useMemo(() => {
    const start = presetStart(preset);
    return sales.filter((o) => {
      if (!COLLECTED.has(o.status)) return false;
      if (start && new Date(o.created_at) < start) return false;
      return true;
    });
  }, [sales, preset]);

  const split = useMemo(() => {
    let ownProfit = 0, ownRevenue = 0, ownOrders = 0;
    let dlProfit = 0, dlRevenue = 0, dlOrders = 0;
    for (const o of windowed) {
      if (o.is_downline_order) { dlProfit += Number(o.profit) || 0; dlRevenue += Number(o.total) || 0; dlOrders += 1; }
      else { ownProfit += Number(o.profit) || 0; ownRevenue += Number(o.total) || 0; ownOrders += 1; }
    }
    return { ownProfit, ownRevenue, ownOrders, dlProfit, dlRevenue, dlOrders };
  }, [windowed]);

  const topProducts = useMemo(() => {
    const map = new Map<string, { units: number; revenue: number; profit: number }>();
    for (const o of windowed) {
      const items = o.items || [];
      const orderRetail = items.reduce((s, it) => s + (Number(it.unit_retail_price) || 0) * (Number(it.quantity) || 0), 0);
      for (const it of items) {
        const name = it.product_name || 'Unknown';
        const qty = Number(it.quantity) || 0;
        const retail = (Number(it.unit_retail_price) || 0) * qty;
        // Attribute order profit across items proportionally to retail value.
        const share = orderRetail > 0 ? retail / orderRetail : (items.length ? 1 / items.length : 0);
        const cur = map.get(name) || { units: 0, revenue: 0, profit: 0 };
        cur.units += qty;
        cur.revenue += retail;
        cur.profit += (Number(o.profit) || 0) * share;
        map.set(name, cur);
      }
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 8);
  }, [windowed]);

  const exportCsv = useCallback(() => {
    const rows: (string | number)[][] = [['Order Id', 'Date', 'Status', 'Buyer', 'Source', 'Revenue', 'Profit']];
    for (const o of windowed) {
      rows.push([
        o.id,
        new Date(o.created_at).toLocaleDateString(),
        o.status,
        o.buyer_name || '',
        o.is_downline_order ? `Downline: ${o.downline_agent_name || 'Agent'}` : 'My Store',
        (Number(o.total) || 0).toFixed(2),
        (Number(o.profit) || 0).toFixed(2),
      ]);
    }
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-${preset}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [windowed, preset]);

  const revenueCents = Number(kpis?.current?.revenue_cents ?? 0);

  return (
    <div style={{ textTransform: 'capitalize', paddingTop: 'calc(var(--nav-offset, 60px) + 12px)', paddingRight: 12, paddingBottom: 12, paddingLeft: 12, minHeight: '100dvh', background: 'var(--black)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 style={{ fontSize: '1.6rem', color: 'var(--white)', margin: 0, fontFamily: 'var(--font-brand)' }}>Sales Performance</h1>
            <p style={{ color: 'var(--grey-400)', fontSize: '0.88rem', margin: '4px 0 0' }}>
              Live Analytics With Period-Over-Period Comparison
            </p>
          </div>
          {loading && <span style={{ color: 'var(--teal)', fontSize: '0.78rem', fontWeight: 700 }}>Refreshing…</span>}
        </header>

        <SalesFilterBar preset={preset} onChange={setPreset} />

        {error && (
          <div role="alert" className="glass-panel" style={{ ...panel, border: '1px solid rgba(255,107,129,0.4)' }}>
            <p style={{ color: '#FF6B81', margin: '0 0 10px', fontSize: '0.85rem', fontWeight: 600 }}>{error}</p>
            <button type="button" onClick={() => setReloadKey(k => k + 1)} className="btn-neon-cyan"
              style={{ padding: '9px 16px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
              Retry
            </button>
          </div>
        )}

        <AutoInsightsCallouts />
        <SalesKPIStrip data={kpis} />
        <SalesTimeseriesChart points={points} />

        {/* Own store vs downline profit split */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          <div className="glass-panel" style={panel}>
            <h3 style={h3Style}>My Store Sales</h3>
            <div style={{ color: 'var(--white)', fontSize: '1.35rem', fontWeight: 800 }}>{fmt(split.ownProfit)}</div>
            <p style={{ color: 'var(--grey-400)', fontSize: '0.76rem', margin: '4px 0 0' }}>
              Profit On {split.ownOrders} Order{split.ownOrders !== 1 ? 's' : ''} · {fmt(split.ownRevenue)} Revenue
            </p>
          </div>
          <div className="glass-panel" style={panel}>
            <h3 style={{ ...h3Style, color: '#B39DFF' }}>Downline Markup Profit</h3>
            <div style={{ color: '#B39DFF', fontSize: '1.35rem', fontWeight: 800 }}>{fmt(split.dlProfit)}</div>
            <p style={{ color: 'var(--grey-400)', fontSize: '0.76rem', margin: '4px 0 0' }}>
              Earned On {split.dlOrders} Downline Order{split.dlOrders !== 1 ? 's' : ''} · {fmt(split.dlRevenue)} Downline Volume
            </p>
          </div>
          <div className="glass-panel" style={panel}>
            <h3 style={{ ...h3Style, color: 'var(--teal)' }}>Total Profit This Period</h3>
            <div style={{ color: 'var(--teal)', fontSize: '1.35rem', fontWeight: 800 }}>{fmt(split.ownProfit + split.dlProfit)}</div>
            <p style={{ color: 'var(--grey-400)', fontSize: '0.76rem', margin: '4px 0 0' }}>
              My Store + Downline Markup Combined
            </p>
          </div>
        </div>

        <GoalTracker revenueCents={revenueCents} />

        {/* Top products by profit */}
        {topProducts.length > 0 && (
          <div className="glass-panel" style={panel}>
            <h3 style={h3Style}>Top Products By Profit</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ color: 'var(--grey-400)', textAlign: 'left' }}>
                    <th style={{ padding: '6px 8px', fontWeight: 600 }}>Product</th>
                    <th style={{ padding: '6px 8px', fontWeight: 600, textAlign: 'right' }}>Units</th>
                    <th style={{ padding: '6px 8px', fontWeight: 600, textAlign: 'right' }}>Revenue</th>
                    <th style={{ padding: '6px 8px', fontWeight: 600, textAlign: 'right' }}>Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map(p => (
                    <tr key={p.name} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <td style={{ padding: '8px', color: 'var(--white)', fontWeight: 500 }}>{p.name}</td>
                      <td style={{ padding: '8px', color: 'var(--silver-light)', textAlign: 'right' }}>{p.units}</td>
                      <td style={{ padding: '8px', color: 'var(--silver-light)', textAlign: 'right' }}>{fmt(p.revenue)}</td>
                      <td style={{ padding: '8px', color: 'var(--teal)', fontWeight: 700, textAlign: 'right' }}>{fmt(p.profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Per-sale profit ledger */}
        <div className="glass-panel" style={panel}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <h3 style={h3Style}>Profit Per Sale</h3>
            <button type="button" onClick={exportCsv} disabled={windowed.length === 0}
              style={{ padding: '8px 12px', borderRadius: 8, fontSize: '0.76rem', fontWeight: 700, cursor: windowed.length ? 'pointer' : 'default', background: 'rgba(255,255,255,0.05)', color: 'var(--white)', border: '1px solid rgba(255,255,255,0.1)', opacity: windowed.length ? 1 : 0.5 }}>
              Export CSV ({windowed.length})
            </button>
          </div>
          {windowed.length === 0 ? (
            <p style={{ color: 'var(--grey-400)', fontSize: '0.82rem', margin: 0 }}>
              No Collected Sales In This Period Yet. Once An Order Is Approved, It Appears Here With Your Exact Profit.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ color: 'var(--grey-400)', textAlign: 'left' }}>
                    <th style={{ padding: '6px 8px', fontWeight: 600 }}>Date</th>
                    <th style={{ padding: '6px 8px', fontWeight: 600 }}>Buyer</th>
                    <th style={{ padding: '6px 8px', fontWeight: 600 }}>Source</th>
                    <th style={{ padding: '6px 8px', fontWeight: 600, textAlign: 'right' }}>Revenue</th>
                    <th style={{ padding: '6px 8px', fontWeight: 600, textAlign: 'right' }}>My Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {windowed.slice(0, 50).map(o => (
                    <tr key={o.id} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <td style={{ padding: '8px', color: 'var(--silver-light)', whiteSpace: 'nowrap' }}>{new Date(o.created_at).toLocaleDateString()}</td>
                      <td style={{ padding: '8px', color: 'var(--white)' }}>{o.buyer_name || '—'}</td>
                      <td style={{ padding: '8px' }}>
                        {o.is_downline_order
                          ? <span style={{ color: '#B39DFF', fontWeight: 600 }}>Downline · {o.downline_agent_name || 'Agent'}</span>
                          : <span style={{ color: 'var(--silver-light)' }}>My Store</span>}
                      </td>
                      <td style={{ padding: '8px', color: 'var(--silver-light)', textAlign: 'right', whiteSpace: 'nowrap' }}>{fmt(Number(o.total) || 0)}</td>
                      <td style={{ padding: '8px', color: (Number(o.profit) || 0) >= 0 ? 'var(--teal)' : '#FF6B81', fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap' }}>{fmt(Number(o.profit) || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {windowed.length > 50 && (
                <p style={{ color: 'var(--grey-400)', fontSize: '0.72rem', margin: '8px 0 0' }}>
                  Showing Latest 50 Of {windowed.length} Orders — Use Export CSV For The Full List.
                </p>
              )}
            </div>
          )}
        </div>

        <AIWeeklySummary />
        <SalesHeatmap preset={preset} />
        <SubAgentRollupTable preset={preset} />

        <div className="glass-panel" style={panel}>
          <h3 style={h3Style}>Exports</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a href={`/api/agent/sales/export/tax?year=${new Date().getFullYear()}`} download
              style={{
                padding: '10px 14px', borderRadius: 8, minHeight: 44, textDecoration: 'none',
                background: 'rgba(255,255,255,0.05)', color: 'var(--white)',
                border: '1px solid rgba(255,255,255,0.1)', fontWeight: 700, fontSize: '0.85rem',
                display: 'inline-flex', alignItems: 'center',
              }}>Tax-Ready CSV ({new Date().getFullYear()})</a>
          </div>
        </div>
      </div>
    </div>
  );
}
