'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { ArrowUp, ArrowDown } from 'lucide-react';
import Pagination from '@/components/Pagination';
import { exportCSV, downloadCSV } from '@/lib/export';
import type { RangePreset } from '@/lib/sales-range';
import DownlineInvoicesSection from '@/components/admin/DownlineInvoicesSection';
import { getRealEmail } from '@/lib/profile-utils';

// ─── Lazy-loaded chart components (~400KB recharts) ───────────────────────────
const AdminProfitTimeseriesChart = dynamic(
  () => import('@/components/sales/AdminProfitTimeseriesChart'),
  { ssr: false, loading: () => <ChartSkeleton height={260} /> },
);
const AdminRevenueByAgentChart = dynamic(
  () => import('@/components/sales/AdminRevenueByAgentChart'),
  { ssr: false, loading: () => <ChartSkeleton height={250} /> },
);
const AdminTopProductsChart = dynamic(
  () => import('@/components/sales/AdminTopProductsChart'),
  { ssr: false, loading: () => <ChartSkeleton height={320} /> },
);
const AdminTierDonutChart = dynamic(
  () => import('@/components/sales/AdminTierDonutChart'),
  { ssr: false, loading: () => <ChartSkeleton height={200} /> },
);

// ─── Types ────────────────────────────────────────────────────────────────────
interface AgentSales {
  agent_id: string;
  full_name: string;
  email: string;
  tier: string | null;
  order_count: number;
  total_revenue: number;
  pending_count: number;
}
interface AgentSalesData {
  agents: AgentSales[];
  direct: { revenue: number; count: number };
  totals: { revenue: number; orders: number };
}
interface KpiData {
  current: {
    revenue_cents: number;
    profit_cents: number;
    orders_count: number;
    aov_cents: number;
    cancelled_count: number;
    direct_revenue_cents: number;
    agent_revenue_cents: number;
    active_agents: number;
    margin_pct: number;
  };
  deltas: {
    revenue: number | null;
    profit: number | null;
    orders: number | null;
    aov: number | null;
    margin: number | null;
    active_agents: number | null;
  };
}
interface TimeseriesPoint {
  day: string;
  revenue_cents: number;
  profit_cents: number;
  orders: number;
}
interface Product {
  name: string;
  revenue_cents: number;
  profit_cents: number;
  cogs_cents: number;
  units: number;
}
interface TierEntry {
  tier: string;
  label: string;
  revenue_cents: number;
  orders: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 25;

const TIER_LABELS: Record<string, string> = {
  tier_1: 'Tier 1',
  tier_2: 'Tier 2',
  tier_3: 'Tier 3',
};

const RANGE_TABS: { id: RangePreset; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7 Days' },
  { id: '30d', label: '30 Days' },
  { id: 'mtd', label: 'MTD' },
  { id: 'qtd', label: 'QTD' },
  { id: 'ytd', label: 'YTD' },
];

const TX_TYPE_COLORS: Record<string, string> = {
  credit: '#68D391',
  initial_deposit: '#68D391',
  statement_payment: '#68D391',
  debit: 'var(--red)',
  order_charge: 'var(--red)',
  adjustment: '#00E5FF',
};

// ─── Helper components ────────────────────────────────────────────────────────
function ChartSkeleton({ height }: { height: number }) {
  return (
    <div
      style={{
        minHeight: height,
        background: 'rgba(255,255,255,0.02)',
        borderRadius: 8,
        animation: 'pulse 1.5s ease-in-out infinite',
      }}
      aria-hidden
    />
  );
}

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-16)' }}>
      <div
        style={{
          width: 36, height: 36, borderRadius: '50%',
          border: '2px solid var(--teal)', borderTopColor: 'transparent',
          animation: 'spin 0.8s linear infinite',
        }}
      />
    </div>
  );
}

function Delta({ d, invert = false }: { d: number | null; invert?: boolean }) {
  if (d === null || !isFinite(d)) return <span style={{ color: 'var(--grey-500)', fontSize: '0.72rem' }}>—</span>;
  const up = invert ? d <= 0 : d >= 0;
  const color = up ? '#2ed573' : '#ff4757';
  return (
    <span style={{ color, fontSize: '0.74rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
      {up ? <ArrowUp size={11} aria-hidden /> : <ArrowDown size={11} aria-hidden />}
      {Math.abs(d).toFixed(1)}%
    </span>
  );
}

const money = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
    (Number(cents) || 0) / 100,
  );

function StatCard({
  label,
  value,
  sub,
  delta,
  deltaInvert,
  accent,
  delay,
}: {
  label: string;
  value: string;
  sub?: string;
  delta?: number | null;
  deltaInvert?: boolean;
  accent?: string;
  delay?: string;
}) {
  return (
    <div
      className="glass-panel hover-lift stagger-fade-in"
      style={{ animationDelay: delay }}
    >
      <div style={{ padding: 'var(--space-5)' }}>
        <div style={{ fontSize: '0.7rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
          {label}
        </div>
        <div style={{ fontSize: '1.55rem', fontWeight: 800, fontFamily: 'var(--font-brand)', color: accent ?? 'var(--white)', lineHeight: 1 }}>
          {value}
        </div>
        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
          {delta !== undefined && delta !== null && <Delta d={delta} invert={deltaInvert} />}
          {sub && <span style={{ fontSize: '0.7rem', color: 'var(--grey-500)' }}>{sub}</span>}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminSalesPage() {
  const [range, setRange] = useState<RangePreset>('30d');
  // KPIs
  const [kpis, setKpis] = useState<KpiData | null>(null);
  const [kpiLoading, setKpiLoading] = useState(true);
  // Timeseries
  const [points, setPoints] = useState<TimeseriesPoint[]>([]);
  const [tsLoading, setTsLoading] = useState(true);
  // Top products
  const [products, setProducts] = useState<Product[]>([]);
  const [prodLoading, setProdLoading] = useState(true);
  // Tier breakdown
  const [tierBreakdown, setTierBreakdown] = useState<TierEntry[]>([]);
  const [tierLoading, setTierLoading] = useState(true);
  // Agent table (existing endpoint)
  const [agentData, setAgentData] = useState<AgentSalesData | null>(null);
  const [agentLoading, setAgentLoading] = useState(true);
  const [agentError, setAgentError] = useState('');
  const [page, setPage] = useState(1);
  // Ledger
  const [selectedAgent, setSelectedAgent] = useState<AgentSales | null>(null);
  const [ledger, setLedger] = useState<any[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  const rangeParam = `?range=${range}`;

  const loadAll = useCallback(async () => {
    setKpiLoading(true);
    setTsLoading(true);
    setProdLoading(true);
    setTierLoading(true);
    setAgentLoading(true);
    setAgentError('');
    setPage(1);

    const oldRange =
      range === 'today' ? 'all' :
      range === '7d' ? 'week' :
      range === '30d' ? 'month' :
      'all';

    await Promise.allSettled([
      // KPIs
      fetch(`/api/admin/sales/kpis${rangeParam}`).then((r) => r.json()).then((j) => { setKpis(j); setKpiLoading(false); }).catch(() => setKpiLoading(false)),
      // Timeseries
      fetch(`/api/admin/sales/timeseries${rangeParam}`).then((r) => r.json()).then((j) => { setPoints(j.points ?? []); setTsLoading(false); }).catch(() => setTsLoading(false)),
      // Top products
      fetch(`/api/admin/sales/top-products${rangeParam}`).then((r) => r.json()).then((j) => { setProducts(j.products ?? []); setProdLoading(false); }).catch(() => setProdLoading(false)),
      // Tier breakdown
      fetch(`/api/admin/sales/tier-breakdown${rangeParam}`).then((r) => r.json()).then((j) => { setTierBreakdown(j.breakdown ?? []); setTierLoading(false); }).catch(() => setTierLoading(false)),
      // Agent table (legacy endpoint, map range)
      fetch(`/api/admin/sales?range=${oldRange}`).then((r) => r.json()).then((j) => {
        if (j.agents) { setAgentData(j); } else { setAgentError(j.error || 'Failed to load agent data'); }
        setAgentLoading(false);
      }).catch((e) => { setAgentError(e.message || 'Network error'); setAgentLoading(false); }),
    ]);
  }, [range]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadAll(); }, [loadAll]);

  async function loadAgentLedger(agent: AgentSales) {
    setSelectedAgent(agent);
    setLedgerLoading(true);
    setLedger([]);
    try {
      const res = await fetch(`/api/admin/transactions?agent_id=${agent.agent_id}&limit=50`);
      const json = await res.json();
      if (res.ok) { setLedger(json.data || []); }
      else { toast.error(json.error || 'Failed to load ledger'); }
    } catch { toast.error('Network error loading ledger'); }
    finally { setLedgerLoading(false); }
  }

  const c = kpis?.current;
  const d = kpis?.deltas;

  const totalRevenue = c?.revenue_cents ?? 0;
  const directRevenue = c?.direct_revenue_cents ?? 0;
  const agentRevenue = c?.agent_revenue_cents ?? 0;
  const directPct = totalRevenue > 0 ? Math.round((directRevenue / totalRevenue) * 100) : 0;
  const agentPct = 100 - directPct;

  return (
    <div style={{ padding: 'var(--space-8)' }}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-8)', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h1 className="animated-gradient-text" style={{ fontSize: '1.6rem', marginBottom: 'var(--space-2)' }}>
            Sales Overview
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--grey-400)' }}>
            Revenue, Profit, Top Products, Agent Leaderboard
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Export */}
          <button
            type="button"
            className="btn-silver btn-sm"
            disabled={!agentData || agentData.agents.length === 0}
            onClick={() => {
              if (!agentData) return;
              const rows = agentData.agents.map((a) => ({
                full_name: a.full_name || '',
                email: (getRealEmail(a) || '') || '',
                tier: a.tier || '',
                order_count: a.order_count,
                pending_count: a.pending_count,
                total_revenue: Number(a.total_revenue || 0).toFixed(2),
              }));
              const csv = exportCSV(rows, [
                { key: 'full_name', label: 'Agent' },
                { key: 'email', label: 'Email' },
                { key: 'tier', label: 'Tier' },
                { key: 'order_count', label: 'Orders' },
                { key: 'pending_count', label: 'Pending' },
                { key: 'total_revenue', label: 'Revenue' },
              ]);
              downloadCSV(`admin_sales_${range}_${new Date().toISOString().slice(0, 10)}.csv`, csv);
            }}
          >
            Export CSV
          </button>
          {/* Range Filter */}
          <div style={{ display: 'flex', gap: 4, background: 'var(--black-2)', padding: 4, borderRadius: 'var(--radius-md)', border: 'var(--border-subtle)', flexWrap: 'wrap' }}>
            {RANGE_TABS.map((tab) => (
              <button
                type="button"
                key={tab.id}
                onClick={() => setRange(tab.id)}
                style={{
                  padding: '6px 12px', fontSize: '0.78rem', fontWeight: 600,
                  color: range === tab.id ? '#fff' : 'var(--grey-400)',
                  background: range === tab.id ? 'var(--teal)' : 'transparent',
                  border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── KPI Strip ──────────────────────────────────────────────────────── */}
      {kpiLoading ? (
        <div className="grid-4" style={{ marginBottom: 'var(--space-8)' }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="glass-panel" style={{ height: 94, animation: 'pulse 1.5s ease-in-out infinite' }} aria-hidden />
          ))}
        </div>
      ) : c ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))',
            gap: 'var(--space-4)',
            marginBottom: 'var(--space-8)',
          }}
        >
          <StatCard label="Total Revenue" value={money(c.revenue_cents)} delta={d?.revenue} accent="var(--teal)" delay="0.05s" />
          <StatCard label="Net Profit" value={money(c.profit_cents)} delta={d?.profit} accent="#2ed573" delay="0.1s" />
          <StatCard label="Profit Margin" value={`${c.margin_pct.toFixed(1)}%`} delta={d?.margin} delay="0.15s" />
          <StatCard label="Total Orders" value={String(c.orders_count)} delta={d?.orders} delay="0.2s" />
          <StatCard label="Avg Order Value" value={money(c.aov_cents)} delta={d?.aov} accent="var(--silver)" delay="0.25s" />
          <StatCard label="Active Agents" value={String(c.active_agents)} delta={d?.active_agents} delay="0.3s" />
          <StatCard label="Direct Revenue" value={money(c.direct_revenue_cents)} sub={`${directPct}% of total`} delay="0.35s" />
          <StatCard label="Cancelled" value={String(c.cancelled_count)} deltaInvert delay="0.4s" />
        </div>
      ) : null}

      {/* ── Revenue vs Profit Timeseries ───────────────────────────────────── */}
      <div className="glass-panel hover-lift stagger-fade-in" style={{ marginBottom: 'var(--space-6)', animationDelay: '0.45s' }}>
        <div style={{ padding: 'var(--space-5) var(--space-6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <h3 style={{ fontSize: '1rem', fontFamily: 'var(--font-brand)', color: 'var(--white)', margin: 0 }}>
              Revenue vs. Profit Trend
            </h3>
            <span style={{ fontSize: '0.72rem', color: 'var(--grey-500)' }}>Daily</span>
          </div>
          {tsLoading ? <ChartSkeleton height={260} /> : <AdminProfitTimeseriesChart points={points} />}
        </div>
      </div>

      {/* ── Tier Donut + Revenue Split + Margin Ring ──────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
          gap: 'var(--space-6)',
          marginBottom: 'var(--space-6)',
        }}
      >
        {/* Tier Donut */}
        <div className="glass-panel hover-lift stagger-fade-in" style={{ animationDelay: '0.5s' }}>
          <div style={{ padding: 'var(--space-5)' }}>
            <h3 style={{ fontSize: '0.95rem', color: 'var(--silver)', margin: '0 0 var(--space-3)' }}>Revenue By Tier</h3>
            {tierLoading ? <ChartSkeleton height={200} /> : <AdminTierDonutChart breakdown={tierBreakdown} />}
          </div>
        </div>

        {/* Revenue Source Split */}
        <div className="glass-panel hover-lift stagger-fade-in" style={{ animationDelay: '0.55s' }}>
          <div style={{ padding: 'var(--space-5)' }}>
            <h3 style={{ fontSize: '0.95rem', color: 'var(--silver)', margin: '0 0 var(--space-4)' }}>Revenue Sources</h3>
            {kpiLoading || !c ? <ChartSkeleton height={130} /> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {[
                  { label: 'Agent Network', pct: agentPct, amount: c.agent_revenue_cents, color: 'var(--teal)' },
                  { label: 'Direct / Organic', pct: directPct, amount: c.direct_revenue_cents, color: '#C0B8A8' },
                ].map(({ label, pct, amount, color }) => (
                  <div key={label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--grey-300)' }}>{label}</span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color, fontFamily: 'var(--font-brand)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {money(amount)} <span style={{ color: 'var(--grey-500)', fontWeight: 400 }}>({pct}%)</span>
                      </span>
                    </div>
                    <div style={{ height: 6, background: 'var(--surface-2)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width 0.5s ease' }} />
                    </div>
                  </div>
                ))}
                {/* Profit margin bar */}
                <div style={{ marginTop: 'var(--space-2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--grey-300)' }}>Gross Margin</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#2ed573', fontFamily: 'var(--font-brand)' }}>
                      {c.margin_pct.toFixed(1)}%
                    </span>
                  </div>
                  <div style={{ height: 6, background: 'var(--surface-2)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(c.margin_pct, 100)}%`, background: '#2ed573', borderRadius: 99, transition: 'width 0.5s ease' }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Revenue by Agent Bar Chart */}
        <div className="glass-panel hover-lift stagger-fade-in" style={{ animationDelay: '0.6s' }}>
          <div style={{ padding: 'var(--space-5)' }}>
            <h3 style={{ fontSize: '0.95rem', color: 'var(--silver)', margin: '0 0 var(--space-3)' }}>Top Agents</h3>
            {agentLoading ? <ChartSkeleton height={200} /> : agentData?.agents?.length ? (
              <AdminRevenueByAgentChart agents={agentData.agents.slice(0, 8)} />
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--grey-500)', fontSize: '0.83rem', padding: 'var(--space-8) 0' }}>No agent data</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Top Products ─────────────────────────────────────────────────────── */}
      <div className="glass-panel hover-lift stagger-fade-in" style={{ marginBottom: 'var(--space-6)', animationDelay: '0.65s' }}>
        <div style={{ padding: 'var(--space-5) var(--space-6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <h3 style={{ fontSize: '1rem', fontFamily: 'var(--font-brand)', color: 'var(--white)', margin: 0 }}>
              Top 10 Products By Revenue
            </h3>
            {!prodLoading && products.length > 0 && (
              <span style={{ fontSize: '0.72rem', color: 'var(--grey-500)' }}>
                {products.length} products tracked
              </span>
            )}
          </div>
          {prodLoading ? <ChartSkeleton height={320} /> : products.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--grey-500)', fontSize: '0.83rem', padding: 'var(--space-8) 0' }}>
              No product data in this period
            </div>
          ) : (
            <>
              <AdminTopProductsChart products={products} />
              {/* Table summary below chart */}
              <div style={{ marginTop: 'var(--space-4)', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <caption className="sr-only">Top Products Revenue Breakdown</caption>
                  <thead>
                    <tr style={{ background: 'var(--surface-2)' }}>
                      {['Product', 'Units', 'Revenue', 'Profit', 'Margin'].map((h) => (
                        <th key={h} scope="col" style={{ padding: '8px 12px', textAlign: h === 'Product' ? 'left' : 'right', fontSize: '0.7rem', fontWeight: 700, color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p, i) => {
                      const margin = p.revenue_cents > 0 ? ((p.profit_cents / p.revenue_cents) * 100) : 0;
                      return (
                        <tr key={p.name} style={{ borderBottom: i < products.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                          <td style={{ padding: '8px 12px', fontSize: '0.83rem', color: 'var(--silver)' }}>{p.name}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '0.83rem', color: 'var(--grey-300)' }}>{p.units}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '0.85rem', fontWeight: 700, color: 'var(--teal)', fontFamily: 'var(--font-brand)' }}>{money(p.revenue_cents)}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '0.85rem', fontWeight: 700, color: '#2ed573', fontFamily: 'var(--font-brand)' }}>{money(p.profit_cents)}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '0.8rem', color: margin >= 30 ? '#2ed573' : margin >= 15 ? '#ffa502' : '#ff4757' }}>
                            {margin.toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Agent Table + Ledger ─────────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: selectedAgent ? 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))' : '1fr',
          gap: 'var(--space-6)',
          alignItems: 'start',
        }}
      >
        {/* Agent Table */}
        <div className="glass-panel hover-lift stagger-fade-in" style={{ overflowX: 'auto', animationDelay: '0.7s' }}>
          <div>
            <div style={{ padding: 'var(--space-4) var(--space-5)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '0.95rem', color: 'var(--silver)', margin: 0 }}>Agent Leaderboard</h3>
              <span style={{ fontSize: '0.76rem', color: 'var(--grey-500)' }}>Click any row to view ledger</span>
            </div>
            {agentLoading ? (
              <Spinner />
            ) : agentError ? (
              <div className="disclaimer-warning" style={{ padding: 'var(--space-5)', margin: 'var(--space-4)' }}>
                <p style={{ color: 'var(--red)', margin: 0 }}>{agentError}</p>
              </div>
            ) : (
              <>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <caption className="sr-only">Agent Revenue Leaderboard</caption>
                  <thead>
                    <tr style={{ background: 'var(--surface-2)' }}>
                      {['#', 'Agent', 'Tier', 'Orders', 'Pending', 'Revenue', ''].map((h) => (
                        <th key={h} scope="col" style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {!agentData || agentData.agents.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: 'var(--space-10)', textAlign: 'center', color: 'var(--grey-400)', fontSize: '0.85rem' }}>
                          No Agent Sales Yet In This Period
                        </td>
                      </tr>
                    ) : (() => {
                      const totalPages = Math.max(1, Math.ceil(agentData.agents.length / PAGE_SIZE));
                      const safePage = Math.min(page, totalPages);
                      const paginated = agentData.agents.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
                      return paginated.map((agent, i) => {
                        const rank = (safePage - 1) * PAGE_SIZE + i + 1;
                        const rankColor = rank === 1 ? '#FFD700' : rank === 2 ? '#C0C0C0' : rank === 3 ? '#CD7F32' : 'var(--grey-500)';
                        return (
                          <tr
                            key={agent.agent_id}
                            onClick={() => loadAgentLedger(agent)}
                            className="table-row-hover"
                            style={{
                              borderBottom: i < paginated.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                              background: selectedAgent?.agent_id === agent.agent_id ? 'rgba(0,196,188,0.05)' : 'transparent',
                              cursor: 'pointer', transition: 'background 0.15s',
                            }}
                          >
                            <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: '0.85rem', fontWeight: 800, color: rankColor, fontFamily: 'var(--font-brand)', width: 36 }}>
                              {rank}
                            </td>
                            <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--teal)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff', fontSize: '0.85rem', flexShrink: 0 }}>
                                  {(agent.full_name || '?')[0].toUpperCase()}
                                </div>
                                <div>
                                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--silver)' }}>{agent.full_name || 'Unknown'}</div>
                                  <div style={{ fontSize: '0.7rem', color: 'var(--grey-500)' }}>{(getRealEmail(agent) || '')}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--teal)', background: 'rgba(0,196,188,0.1)', padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(0,196,188,0.3)' }}>
                                {agent.tier ? (TIER_LABELS[agent.tier] ?? agent.tier) : '—'}
                              </span>
                            </td>
                            <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: '0.88rem', color: 'var(--silver)', fontWeight: 600 }}>{agent.order_count}</td>
                            <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                              {agent.pending_count > 0 ? (
                                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--red)', background: 'rgba(229,62,62,0.1)', padding: '2px 8px', borderRadius: 4 }}>{agent.pending_count}</span>
                              ) : <span style={{ fontSize: '0.78rem', color: 'var(--grey-500)' }}>—</span>}
                            </td>
                            <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: '0.9rem', fontWeight: 700, color: 'var(--teal)', fontFamily: 'var(--font-brand)' }}>
                              ${Number(agent.total_revenue || 0).toFixed(2)}
                            </td>
                            <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                              <button
                                onClick={(e) => { e.stopPropagation(); loadAgentLedger(agent); }}
                                style={{ fontSize: '0.75rem', color: 'var(--teal)', background: 'none', border: '1px solid rgba(0,196,188,0.3)', borderRadius: 4, padding: '3px 10px', cursor: 'pointer' }}
                              >
                                Ledger
                              </button>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
                {agentData && agentData.agents.length > PAGE_SIZE && (
                  <Pagination
                    page={Math.min(page, Math.max(1, Math.ceil(agentData.agents.length / PAGE_SIZE)))}
                    totalPages={Math.max(1, Math.ceil(agentData.agents.length / PAGE_SIZE))}
                    onPageChange={setPage}
                  />
                )}
              </>
            )}
          </div>
        </div>

        {/* Transaction Ledger Drawer */}
        {selectedAgent && (
          <div className="glass-panel hover-lift stagger-fade-in" style={{ position: 'sticky', top: 'var(--space-6)', animationDelay: '0.1s' }}>
            <div style={{ padding: 'var(--space-5)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                <div>
                  <h3 style={{ fontSize: '0.95rem', margin: 0 }}>Transaction Ledger</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--grey-400)', marginTop: 2 }}>{selectedAgent.full_name}</p>
                </div>
                <button
                  onClick={() => setSelectedAgent(null)}
                  style={{ background: 'none', border: 'none', color: 'var(--grey-400)', cursor: 'pointer' }}
                  aria-label="Close ledger"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              {ledgerLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-8)' }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--teal)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                </div>
              ) : ledger.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--grey-400)', fontSize: '0.83rem', padding: 'var(--space-8) 0' }}>No Transactions Yet</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', maxHeight: '60vh', overflowY: 'auto' }}>
                  {ledger.map((tx: any) => {
                    const isCredit = tx.type === 'adjustment' ? Number(tx.amount) >= 0 : ['credit', 'initial_deposit', 'statement_payment'].includes(tx.type);
                    const color = TX_TYPE_COLORS[tx.type] ?? 'var(--grey-400)';
                    return (
                      <div key={tx.id} style={{ padding: 'var(--space-3)', background: 'var(--surface-1)', borderRadius: 'var(--radius-md)', border: 'var(--border-subtle)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.78rem', color: 'var(--silver)', fontWeight: 600, marginBottom: 2 }}>{tx.description}</div>
                            <div suppressHydrationWarning style={{ fontSize: '0.7rem', color: 'var(--grey-500)' }}>{new Date(tx.created_at).toLocaleString()}</div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 'var(--space-3)' }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color, fontFamily: 'var(--font-brand)' }}>
                              {isCredit ? '+' : '−'}${Number(tx.amount).toFixed(2)}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--grey-500)' }}>Bal: ${Number(tx.balance_after).toFixed(2)}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <DownlineInvoicesSection />
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
