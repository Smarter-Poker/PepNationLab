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
          <div className="table-responsive">
            <table className="data-table" style={{ width: '100%', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Collected (Retail)</th>
                  <th style={{ textAlign: 'right' }}>Owed (Cost)</th>
                  <th style={{ textAlign: 'right' }}>Profit</th>
                </tr>
              </thead>
              <tbody>
                {ledgerData.transactions.map((tx: any) => (
                  <tr key={tx.id}>
                    <td>{new Date(tx.date).toLocaleDateString()}</td>
                    <td style={{ fontWeight: 'bold' }}>{tx.customer}</td>
                    <td><span className="badge badge-teal">{tx.status.replaceAll('_', ' ')}</span></td>
                    <td style={{ textAlign: 'right', color: 'var(--white)' }}>{formatCurrency(tx.collected)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--red)' }}>{formatCurrency(tx.owed)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--teal)', fontWeight: 'bold' }}>{formatCurrency(tx.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
