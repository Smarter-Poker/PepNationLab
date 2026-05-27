'use client';

import React, { useState, useEffect } from 'react';

export default function AgentSales() {
  const [data, setData] = useState<{ liveCarts: any[]; sales: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSales = async () => {
    try {
      const res = await fetch('/api/agent/sales');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch sales data');
      setData(json.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
    // Auto-refresh every 30 seconds for live updates
    const interval = setInterval(fetchSales, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div style={{ padding: 'var(--space-6)', color: 'var(--silver)' }}>Loading live sales data...</div>;
  if (error) return <div style={{ padding: 'var(--space-6)', color: 'var(--red)' }}>Error: {error}</div>;

  const { liveCarts, sales } = data || { liveCarts: [], sales: [] };

  const formatCurrency = (val: number) => `$${(Number(val) || 0).toFixed(2)}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
      
      {/* Live Carts Section */}
      <section>
        <h2 style={{ fontSize: '1.25rem', color: 'var(--white)', marginBottom: 'var(--space-4)', fontFamily: 'var(--font-brand)' }}>
          Live Downline Carts <span style={{ fontSize: '0.8rem', color: 'var(--teal)', marginLeft: 8 }}>Auto-refreshes</span>
        </h2>
        {liveCarts.length === 0 ? (
          <div className="card-metal" style={{ textAlign: 'center', padding: 'var(--space-8)', opacity: 0.7 }}>
            No researchers currently have items in their cart.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {liveCarts.map((cartRecord: any) => {
              const cartTotal = cartRecord.cart.reduce((sum: number, item: any) => sum + (Number(item.retailPrice) * Number(item.quantity)), 0);
              
              return (
                <div key={cartRecord.id} className="card-metal" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 'var(--space-3)' }}>
                    <div>
                      <strong style={{ color: 'var(--teal)' }}>{cartRecord.name}</strong>
                      <div style={{ fontSize: '0.8rem', color: 'var(--grey-400)' }}>{cartRecord.email}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: 'var(--white)', fontWeight: 'bold' }}>Potential: {formatCurrency(cartTotal)}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--silver)' }}>
                        Last Active: {new Date(cartRecord.updated_at).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                    {cartRecord.cart.map((item: any, idx: number) => (
                      <span key={idx} style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 4, fontSize: '0.8rem', color: 'var(--silver)' }}>
                        {item.quantity}x {item.name}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Sales & Profit Section */}
      <section>
        <h2 style={{ fontSize: '1.25rem', color: 'var(--white)', marginBottom: 'var(--space-4)', fontFamily: 'var(--font-brand)' }}>
          Completed Sales & Profit
        </h2>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Buyer</th>
                <th>Order ID</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Order Total</th>
                <th style={{ textAlign: 'right', color: 'var(--green)' }}>Your Profit</th>
              </tr>
            </thead>
            <tbody>
              {sales.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', opacity: 0.5 }}>No sales recorded yet.</td>
                </tr>
              ) : (
                sales.map((sale: any) => (
                  <tr key={sale.id}>
                    <td>{new Date(sale.created_at).toLocaleDateString()}</td>
                    <td>{sale.buyer_name}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--silver)' }}>{sale.id.split('-')[0]}</td>
                    <td>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: 12,
                        fontSize: '0.75rem',
                        background: sale.status === 'cancelled' ? 'rgba(245,101,101,0.1)' : 'rgba(0,196,188,0.1)',
                        color: sale.status === 'cancelled' ? 'var(--red)' : 'var(--teal)'
                      }}>
                        {sale.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(sale.total)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--green)' }}>
                      {formatCurrency(sale.profit)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
