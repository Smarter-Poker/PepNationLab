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
        <div className="card-metal" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
          <h4 style={{ color: 'var(--grey-400)', fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>Total Retail Collected</h4>
          <div style={{ fontSize: '2rem', fontFamily: 'var(--font-brand)', color: 'var(--white)' }}>
            {formatCurrency(ledgerData?.summary?.totalCollected || 0)}
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--grey-500)', marginTop: 4 }}>Money You Collected From Your Customers</p>
        </div>

        <div className="card-metal" style={{ padding: 'var(--space-6)', textAlign: 'center', borderTop: '4px solid var(--red)' }}>
          <h4 style={{ color: 'var(--grey-400)', fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>Total Wholesale Owed</h4>
          <div style={{ fontSize: '2rem', fontFamily: 'var(--font-brand)', color: 'var(--red)' }}>
            {formatCurrency(ledgerData?.summary?.totalOwed || 0)}
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--grey-500)', marginTop: 4 }}>Money You Owe The Admin Or Super Agent</p>
        </div>

        <div className="card-metal" style={{ padding: 'var(--space-6)', textAlign: 'center', borderTop: '4px solid var(--teal)' }}>
          <h4 style={{ color: 'var(--grey-400)', fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>Net Profit</h4>
          <div style={{ fontSize: '2rem', fontFamily: 'var(--font-brand)', color: 'var(--teal)' }}>
            {formatCurrency(ledgerData?.summary?.totalProfit || 0)}
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--grey-500)', marginTop: 4 }}>Your True Take-Home Earnings</p>
        </div>
      </div>

      {/* Chart Section */}
      {ledgerData?.transactions?.length > 0 && (
        <div className="card-metal" style={{ padding: 'var(--space-6)', height: 300 }}>
          <h3 style={{ fontSize: '1.1rem', fontFamily: 'var(--font-brand)', color: 'var(--white)', marginBottom: 'var(--space-4)' }}>Profit Trend</h3>
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
              <Line type="monotone" dataKey="Profit" stroke="var(--teal)" strokeWidth={3} dot={{ r: 4, fill: 'var(--teal)' }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="Retail" stroke="var(--grey-400)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Transaction Table */}
      <div className="card-metal" style={{ padding: 'var(--space-6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <h3 style={{ fontSize: '1.2rem', fontFamily: 'var(--font-brand)', color: 'var(--white)' }}>Ledger Transactions</h3>
          {ledgerData?.transactions?.length > 0 && (
            <button onClick={handleDownloadCSV} className="btn btn-secondary btn-sm" style={{ padding: '4px 12px', fontSize: '0.8rem' }}>
              Download CSV
            </button>
          )}
        </div>
        
        {ledgerData?.transactions?.length === 0 ? (
          <p style={{ color: 'var(--grey-400)' }}>No Transactions Found For Your Downline.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {ledgerData.transactions.map((tx: any) => (
              <div 
                key={tx.id} 
                style={{
                  background: 'linear-gradient(180deg, #0b0f16 0%, #121822 100%)',
                  borderTop: '1px solid rgba(0,0,0,0.8)',
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  borderLeft: '1px solid rgba(0,0,0,0.5)',
                  borderRight: '1px solid rgba(255,255,255,0.03)',
                  boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.9)',
                  borderRadius: '16px',
                  padding: '16px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}
              >
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
                  <div><span className="badge badge-teal">{tx.status.replaceAll('_', ' ')}</span></div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '100px', textAlign: 'right' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Collected</span>
                  <span style={{ fontSize: '0.95rem', color: 'var(--white)', fontWeight: 600 }}>{formatCurrency(tx.collected)}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '100px', textAlign: 'right' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Owed</span>
                  <span style={{ fontSize: '0.95rem', color: 'var(--red)', fontWeight: 600 }}>{formatCurrency(tx.owed)}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '100px', textAlign: 'right' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Profit</span>
                  <span style={{ fontSize: '1.1rem', color: 'var(--teal)', fontWeight: 800 }}>{formatCurrency(tx.profit)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
