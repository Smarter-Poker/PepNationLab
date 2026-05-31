'use client';

import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Pagination from '@/components/Pagination';
import { exportCSV, downloadCSV } from '@/lib/export';

const PAGE_SIZE = 25;

interface AgentSales {
  agent_id: string;
  full_name: string;
  email: string;
  tier: string | null;
  order_count: number;
  total_revenue: number;
  pending_count: number;
}

interface SalesData {
  agents: AgentSales[];
  direct: { revenue: number; count: number };
  totals: { revenue: number; orders: number };
}

const TIER_LABELS: Record<string, string> = {
  tier_1: 'Tier 1',
  tier_2: 'Tier 2',
  tier_3: 'Tier 3',
};

export default function AdminSalesPage() {
  const [data, setData] = useState<SalesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [range, setRange] = useState<'week' | 'month' | 'all'>('all');
  const [selectedAgent, setSelectedAgent] = useState<AgentSales | null>(null);
  const [ledger, setLedger] = useState<any[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchSales();
    setPage(1);
  }, [range]);

  async function fetchSales() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/sales?range=${range}`);
      const json = await res.json();
      if (res.ok) {
        setData(json);
      } else {
        setError(json.error || 'Failed To Load Sales Data');
      }
    } catch (err: any) {
      setError(err.message || 'Network Error');
    } finally {
      setLoading(false);
    }
  }

  async function loadAgentLedger(agent: AgentSales) {
    setSelectedAgent(agent);
    setLedgerLoading(true);
    setLedger([]);
    try {
      const res = await fetch(`/api/admin/transactions?agent_id=${agent.agent_id}&limit=50`);
      const json = await res.json();
      if (res.ok) setLedger(json.data || []);
    } catch {/* silent */} finally {
      setLedgerLoading(false);
    }
  }

  const RANGE_TABS = [
    { id: 'week', label: 'Last 7 Days' },
    { id: 'month', label: 'Last 30 Days' },
    { id: 'all', label: 'All Time' },
  ] as const;

  const TX_TYPE_COLORS: Record<string, string> = {
    credit: '#68D391',
    initial_deposit: '#68D391',
    statement_payment: '#68D391',
    debit: 'var(--red)',
    order_charge: 'var(--red)',
    adjustment: '#F6AD55',
  };

  return (
    <div style={{ padding: 'var(--space-8)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-8)', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h1 className="animated-gradient-text" style={{ fontSize: '1.6rem', marginBottom: 'var(--space-2)' }}>
            Sales Overview
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--grey-400)' }}>
            Revenue By Agent, Order Totals, And Transaction History
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Export */}
          <button
            type="button"
            className="btn-silver btn-sm"
            disabled={!data || data.agents.length === 0}
            onClick={() => {
              if (!data) return;
              const rows = data.agents.map((a) => ({
                full_name: a.full_name || '',
                email: a.email || '',
                tier: a.tier || '',
                order_count: a.order_count,
                pending_count: a.pending_count,
                total_revenue: Number(a.total_revenue).toFixed(2),
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
          <div style={{ display: 'flex', gap: 6, background: 'var(--black-2)', padding: 4, borderRadius: 'var(--radius-md)', border: 'var(--border-subtle)' }}>
            {RANGE_TABS.map(tab => (
              <button key={tab.id} onClick={() => setRange(tab.id)}
                style={{
                  padding: '6px 14px', fontSize: '0.8rem', fontWeight: 600,
                  color: range === tab.id ? '#fff' : 'var(--grey-400)',
                  background: range === tab.id ? 'var(--teal)' : 'transparent',
                  border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                }}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-16)' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid var(--teal)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : error ? (
        <div className="disclaimer-warning" style={{ padding: 'var(--space-5)' }}>
          <p style={{ color: 'var(--red)' }}>{error}</p>
        </div>
      ) : data && (
        <>
          {/* Summary Cards */}
          <div className="grid-4" style={{ marginBottom: 'var(--space-8)' }}>
            {[
              { label: 'Total Revenue', value: `$${data.totals.revenue.toFixed(2)}`, color: 'var(--teal)' },
              { label: 'Total Orders', value: data.totals.orders, color: 'var(--silver)' },
              { label: 'Active Agents', value: data.agents.length, color: 'var(--silver)' },
              { label: 'Direct Revenue', value: `$${data.direct.revenue.toFixed(2)}`, color: 'var(--grey-400)' },
            ].map(({ label, value, color }, index) => (
              <div key={label} className="metal-frame hover-lift stagger-fade-in" style={{ animationDelay: `${0.1 + index * 0.1}s` }}>
                <div className="metal-content" style={{ padding: 'var(--space-5)' }}>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'var(--font-brand)', color, lineHeight: 1 }}>{value}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--grey-400)', marginTop: 'var(--space-2)' }}>{label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Agent Revenue Chart */}
          {data.agents.length > 0 && (
            <div className="metal-frame hover-lift stagger-fade-in" style={{ height: 320, marginBottom: 'var(--space-8)', animationDelay: '0.3s' }}>
              <div className="metal-content" style={{ padding: 'var(--space-6)', height: '100%' }}>
                <h3 style={{ fontSize: '1.1rem', fontFamily: 'var(--font-brand)', color: 'var(--white)', marginBottom: 'var(--space-4)' }}>Revenue By Agent</h3>
                <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.agents}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="full_name" stroke="var(--grey-500)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--grey-500)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--grey-900)', border: '1px solid var(--grey-800)', borderRadius: 8 }}
                    itemStyle={{ color: 'var(--silver)' }}
                    formatter={(value: any) => [`$${Number(value).toFixed(2)}`, 'Revenue']}
                    labelStyle={{ color: 'var(--grey-400)', marginBottom: 4 }}
                  />
                  <Bar dataKey="total_revenue" fill="var(--teal)" radius={[4, 4, 0, 0]} maxBarSize={60} />
                </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: selectedAgent ? 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))' : '1fr', gap: 'var(--space-6)', alignItems: 'start' }}>
            {/* Agent Table */}
            <div className="metal-frame hover-lift stagger-fade-in" style={{ overflowX: 'auto', animationDelay: '0.4s' }}>
              <div className="metal-content" style={{ padding: 0 }}>
                <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '0.95rem', color: 'var(--silver)' }}>Revenue By Agent</h3>
                <span style={{ fontSize: '0.76rem', color: 'var(--grey-500)' }}>Click Any Agent To View Their Transaction Ledger</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'var(--surface-2)' }}>
                    {['Agent', 'Tier', 'Orders', 'Pending', 'Revenue', 'Actions'].map(h => (
                      <th key={h} style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.agents.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: 'var(--space-10)', textAlign: 'center', color: 'var(--grey-400)', fontSize: '0.85rem' }}>
                        No Agent Sales Yet In This Period
                      </td>
                    </tr>
                  ) : (() => {
                    const totalPages = Math.max(1, Math.ceil(data.agents.length / PAGE_SIZE));
                    const safePage = Math.min(page, totalPages);
                    const paginated = data.agents.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
                    return paginated.map((agent, i) => (
                    <tr key={agent.agent_id}
                      onClick={() => loadAgentLedger(agent)}
                      className="table-row-hover"
                      style={{
                        borderBottom: i < paginated.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                        background: selectedAgent?.agent_id === agent.agent_id ? 'rgba(192,184,168,0.04)' : 'transparent',
                        cursor: 'pointer', transition: 'background 0.15s',
                      }}>
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                          <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--teal)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff', fontSize: '0.85rem', flexShrink: 0 }}>
                            {(agent.full_name || '?')[0].toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--silver)' }}>{agent.full_name || 'Unknown'}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--teal)', background: 'rgba(192,184,168,0.1)', padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(192,184,168,0.3)' }}>
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
                        ${agent.total_revenue.toFixed(2)}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <button onClick={e => { e.stopPropagation(); loadAgentLedger(agent); }}
                          style={{ fontSize: '0.75rem', color: 'var(--teal)', background: 'none', border: '1px solid rgba(192,184,168,0.3)', borderRadius: 4, padding: '3px 10px', cursor: 'pointer' }}>
                          Ledger
                        </button>
                      </td>
                    </tr>
                  ));
                  })()}
                </tbody>
              </table>
              {data.agents.length > PAGE_SIZE && (
                <Pagination
                  page={Math.min(page, Math.max(1, Math.ceil(data.agents.length / PAGE_SIZE)))}
                  totalPages={Math.max(1, Math.ceil(data.agents.length / PAGE_SIZE))}
                  onPageChange={setPage}
                />
              )}
              </div>
            </div>

            {/* Transaction Ledger Drawer */}
            {selectedAgent && (
              <div className="metal-frame hover-lift stagger-fade-in" style={{ position: 'sticky', top: 'var(--space-6)' }}>
                <div className="metal-content" style={{ padding: 'var(--space-5)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                  <div>
                    <h3 style={{ fontSize: '0.95rem' }}>Transaction Ledger</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--grey-400)', marginTop: 2 }}>{selectedAgent.full_name}</p>
                  </div>
                  <button onClick={() => setSelectedAgent(null)}
                    style={{ background: 'none', border: 'none', color: 'var(--grey-400)', cursor: 'pointer' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
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
                      const isCredit = ['credit', 'initial_deposit', 'statement_payment'].includes(tx.type);
                      const color = TX_TYPE_COLORS[tx.type] ?? 'var(--grey-400)';
                      return (
                        <div key={tx.id} style={{ padding: 'var(--space-3)', background: 'var(--surface-1)', borderRadius: 'var(--radius-md)', border: 'var(--border-subtle)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '0.78rem', color: 'var(--silver)', fontWeight: 600, marginBottom: 2 }}>{tx.description}</div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--grey-500)' }}>{new Date(tx.created_at).toLocaleString()}</div>
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
        </>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
