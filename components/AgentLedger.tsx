'use client';

import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function AgentLedger({ agentId }: { agentId: string }) {
  const [ledgerData, setLedgerData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchLedger();
  }, [agentId]);

  async function fetchLedger() {
    try {
      const res = await fetch('/api/agent/ledger');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch ledger');
      setLedgerData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (val: number) => `$${(Number(val) || 0).toFixed(2)}`;

  const handleDownloadCSV = () => {
    if (!ledgerData?.transactions || ledgerData.transactions.length === 0) return;
    
    const headers = ['Date', 'Customer', 'Status', 'Collected (Retail)', 'Owed (Cost)', 'Profit'];
    const rows = ledgerData.transactions.map((tx: any) => [
      new Date(tx.date).toLocaleDateString(),
      `"${tx.customer}"`,
      tx.status,
      tx.collected.toFixed(2),
      tx.owed.toFixed(2),
      tx.profit.toFixed(2)
    ]);
    
    const csvContent = [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ledger_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return <div style={{ color: 'var(--teal)' }}>Loading Ledger...</div>;
  if (error) return <div style={{ color: 'var(--red)' }}>Error: {error}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 'var(--space-4)' }}>
        <div className="metal-frame">
          <div className="metal-content" style={{ padding: 'var(--space-6)', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h4 style={{ color: 'var(--grey-400)', fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>Total Retail Collected</h4>
            <div className="metal-text" style={{ fontSize: '2rem', fontFamily: 'var(--font-brand)', marginBottom: '8px' }}>
              {formatCurrency(ledgerData?.summary?.totalCollected || 0)}
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--grey-500)', marginTop: 4 }}>Money You Collected From Your Customers</p>
          </div>
        </div>

        <div className="metal-frame">
          <div className="metal-content" style={{ padding: 'var(--space-6)', textAlign: 'center', borderTop: '4px solid var(--red)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h4 style={{ color: 'var(--grey-400)', fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>Total Wholesale Owed</h4>
            <div style={{ fontSize: '2rem', fontFamily: 'var(--font-brand)', color: '#FFAAAA', textShadow: '0 2px 10px rgba(255,0,0,0.3)', marginBottom: '8px' }}>
              {formatCurrency(ledgerData?.summary?.totalOwed || 0)}
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--grey-500)', marginTop: 4 }}>Money You Owe The Admin Or Super Agent</p>
          </div>
        </div>

        <div className="metal-frame">
          <div className="metal-content" style={{ padding: 'var(--space-6)', textAlign: 'center', borderTop: '4px solid #00C4BC', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h4 style={{ color: 'var(--grey-400)', fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>Net Profit</h4>
            <div style={{ fontSize: '2rem', fontFamily: 'var(--font-brand)', color: '#00E5FF', textShadow: '0 2px 10px rgba(0,229,255,0.4)', marginBottom: '8px' }}>
              {formatCurrency(ledgerData?.summary?.totalProfit || 0)}
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--grey-500)', marginTop: 4 }}>Your True Take-Home Earnings</p>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      {ledgerData?.transactions?.length > 0 && (
        <div className="metal-frame">
          <div className="metal-content" style={{ padding: 'var(--space-6)', height: 350 }}>
            <h3 className="metal-text" style={{ fontSize: '1.2rem', fontFamily: 'var(--font-brand)', marginBottom: 'var(--space-4)' }}>Profit Trend</h3>
            <div style={{ height: 'calc(100% - 40px)' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={[...ledgerData.transactions].reverse().map((tx: any) => ({
                    date: new Date(tx.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                    Profit: tx.profit,
                    Retail: tx.collected
                  }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" stroke="var(--grey-500)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--grey-500)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--grey-900)', border: '1px solid var(--grey-800)', borderRadius: 8 }}
                    itemStyle={{ color: 'var(--silver)' }}
                  />
                  <Line type="monotone" dataKey="Profit" stroke="#00E5FF" strokeWidth={3} dot={{ r: 4, fill: '#00E5FF' }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="Retail" stroke="var(--grey-400)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Table */}
      <div className="metal-frame">
        <div className="metal-content" style={{ padding: 'var(--space-6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
            <h3 className="metal-text" style={{ fontSize: '1.2rem', fontFamily: 'var(--font-brand)' }}>Ledger Transactions</h3>
            {ledgerData?.transactions?.length > 0 && (
              <button onClick={handleDownloadCSV} className="btn-silver" style={{ padding: '6px 16px', fontSize: '0.8rem' }}>
                Download CSV
              </button>
            )}
          </div>
          
          {ledgerData?.transactions?.length === 0 ? (
            <p style={{ color: 'var(--grey-400)', textAlign: 'center', padding: '2rem 0' }}>No Transactions Found For Your Downline.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {ledgerData.transactions.map((tx: any) => (
                <div key={tx.id} className="metal-embossed-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '120px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Date</span>
                    <span style={{ fontSize: '0.9rem', color: 'var(--silver)' }}>{new Date(tx.date).toLocaleDateString()}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '150px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Customer</span>
                    <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--white)' }}>{tx.customer}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '120px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Status</span>
                    <div><span className="badge-metal">{tx.status.replaceAll('_', ' ')}</span></div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '100px', textAlign: 'right' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Collected</span>
                    <span style={{ fontSize: '0.95rem', color: 'var(--white)', fontWeight: 600 }}>{formatCurrency(tx.collected)}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '100px', textAlign: 'right' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Owed</span>
                    <span style={{ fontSize: '0.95rem', color: '#FFAAAA', fontWeight: 600 }}>{formatCurrency(tx.owed)}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '100px', textAlign: 'right' }}>
                    <span style={{ fontSize: '0.75rem', color: '#00E5FF', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Profit</span>
                    <span style={{ fontSize: '1.1rem', color: '#00E5FF', fontWeight: 800 }}>{formatCurrency(tx.profit)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
