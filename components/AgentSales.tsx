'use client';

import React, { useState, useEffect } from 'react';

const STATUS_LABELS: Record<string, string> = {
  pending_customer_payment: 'Pending Payment',
  agent_approval_pending: 'Approval Pending',
  approved_ship: 'Approved For Shipping',
  approved_pickup: 'Approved For Pickup',
  in_fulfillment: 'In Fulfillment',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

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

  if (loading) return <div style={{ padding: 'var(--space-6)', color: 'var(--silver)' }}>Loading Live Sales Data...</div>;
  if (error) return <div style={{ padding: 'var(--space-6)', color: 'var(--red)' }}>Error: {error}</div>;

  const { liveCarts, sales } = data || { liveCarts: [], sales: [] };

  const formatCurrency = (val: number) => `$${(Number(val) || 0).toFixed(2)}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
      
      {/* Live Carts Section */}
      <div className="metal-frame">
        <div className="metal-content">
          <h2 className="metal-text" style={{ fontSize: '1.25rem', marginBottom: 'var(--space-4)', fontFamily: 'var(--font-brand)' }}>
            Live Downline Carts <span style={{ fontSize: '0.8rem', color: '#00E5FF', marginLeft: 8 }}>Auto-refreshes</span>
          </h2>
          {liveCarts.length === 0 ? (
            <div className="metal-embossed-panel" style={{ textAlign: 'center', padding: 'var(--space-8)', opacity: 0.7 }}>
              No Researchers Currently Have Items In Their Cart.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {liveCarts.map((cartRecord: any) => {
                const cartTotal = cartRecord.cart.reduce((sum: number, item: any) => sum + (Number(item.retailPrice) * Number(item.quantity)), 0);
                
                return (
                  <div key={cartRecord.id} className="metal-embossed-panel" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 'var(--space-3)' }}>
                      <div>
                        <strong style={{ color: '#00E5FF' }}>{cartRecord.name}</strong>
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
                        <span key={idx} style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: 4, fontSize: '0.8rem', color: 'var(--silver)' }}>
                          {item.quantity}x {item.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Sales & Profit Section */}
      <div className="metal-frame">
        <div className="metal-content">
          <h2 className="metal-text" style={{ fontSize: '1.25rem', marginBottom: 'var(--space-4)', fontFamily: 'var(--font-brand)' }}>
            Completed Sales & Profit
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {sales.length === 0 ? (
              <div className="metal-embossed-panel" style={{ textAlign: 'center', padding: 'var(--space-6)', opacity: 0.5 }}>No Sales Recorded Yet.</div>
            ) : (
              sales.map((sale: any) => (
                <div 
                  key={sale.id}
                  className="metal-embossed-panel"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '100px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Date</span>
                    <span style={{ fontSize: '0.9rem', color: 'var(--silver)' }}>{new Date(sale.created_at).toLocaleDateString()}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 150px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Buyer</span>
                    <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--white)' }}>{sale.buyer_name}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '100px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Order ID</span>
                    <span style={{ fontSize: '0.9rem', color: 'var(--silver)' }}>{sale.id.split('-')[0]}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '120px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Status</span>
                    <div>
                      <span className="badge-metal" style={{ color: sale.status === 'cancelled' ? '#FFAAAA' : '#00FF9D' }}>
                        {STATUS_LABELS[sale.status] || sale.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '100px', textAlign: 'right' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Order Total</span>
                    <span style={{ fontSize: '1rem', color: 'var(--white)', fontWeight: 700 }}>{formatCurrency(sale.total)}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '100px', textAlign: 'right' }}>
                    <span style={{ fontSize: '0.75rem', color: '#00FF9D', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Your Profit</span>
                    <span style={{ fontSize: '1.1rem', color: '#00FF9D', fontWeight: 800 }}>{formatCurrency(sale.profit)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
