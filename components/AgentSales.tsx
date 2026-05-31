import React, { useState, useEffect, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import AgentOrders from './AgentOrders';

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

export default function AgentSales({ orders, setOrders }: { orders: any[], setOrders: any }) {
  const [data, setData] = useState<{ liveCarts: any[]; sales: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSales = async () => {
    try {
      const res = await fetch('/api/agent/sales');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch sales data');
      setData(json.data);
      if (json.data?.sales) {
        setOrders(json.data.sales);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
    const interval = setInterval(fetchSales, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatCurrency = (val: number) => `$${(Number(val) || 0).toFixed(2)}`;

  const { liveCarts, sales } = data || { liveCarts: [], sales: [] };

  // KPI Calculations
  const metrics = useMemo(() => {
    // Only count non-cancelled items that are at least pending or approved.
    const validSales = sales.filter((s: any) => s.status !== 'cancelled');
    const totalSales = validSales.reduce((sum: number, s: any) => sum + (Number(s.total) || 0), 0);
    const totalProfit = validSales.reduce((sum: number, s: any) => sum + (Number(s.profit) || 0), 0);
    const totalOrders = validSales.length;

    // Build Chart Data
    const grouped: Record<string, { date: string; sales: number; profit: number }> = {};
    // Sort chronological
    const sortedSales = [...validSales].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    
    sortedSales.forEach((s: any) => {
      const d = new Date(s.created_at);
      const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
      if (!grouped[dateStr]) grouped[dateStr] = { date: dateStr, sales: 0, profit: 0 };
      grouped[dateStr].sales += (Number(s.total) || 0);
      grouped[dateStr].profit += (Number(s.profit) || 0);
    });

    return {
      totalSales,
      totalProfit,
      totalOrders,
      chartData: Object.values(grouped),
    };
  }, [sales]);

  if (loading) return <div style={{ padding: 'var(--space-6)', color: 'var(--silver)' }}>Loading Live Sales Data...</div>;
  if (error) return <div style={{ padding: 'var(--space-6)', color: 'var(--red)' }}>Error: {error}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
      
      {/* 1. TOP ROW: KPI SNAPSHOTS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 'var(--space-4)' }}>
        
        {/* Total Sales */}
        <div className="metal-frame">
          <div className="metal-content" style={{ padding: 'var(--space-6)', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px', fontWeight: 600 }}>Total Revenue</div>
            <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--white)', fontFamily: 'var(--font-brand)', textShadow: '0 0 10px rgba(255,255,255,0.2)' }}>
              {formatCurrency(metrics.totalSales)}
            </div>
          </div>
        </div>

        {/* Total Profit */}
        <div className="metal-frame">
          <div className="metal-content" style={{ padding: 'var(--space-6)', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at center, rgba(0, 255, 157, 0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ fontSize: '0.85rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px', fontWeight: 600 }}>Total Profit</div>
            <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#00FF9D', fontFamily: 'var(--font-brand)', textShadow: '0 0 15px rgba(0,255,157,0.3)' }}>
              {formatCurrency(metrics.totalProfit)}
            </div>
          </div>
        </div>

        {/* Total Orders */}
        <div className="metal-frame">
          <div className="metal-content" style={{ padding: 'var(--space-6)', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px', fontWeight: 600 }}>Completed Orders</div>
            <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#00E5FF', fontFamily: 'var(--font-brand)', textShadow: '0 0 10px rgba(0,229,255,0.2)' }}>
              {metrics.totalOrders}
            </div>
          </div>
        </div>

      </div>

      {/* 2. MIDDLE SECTION: CHARTS & RECENT TRANSACTIONS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
        
        {/* Left: Sales & Profit Chart */}
        <div className="metal-frame" style={{ flex: 1, minWidth: 0 }}>
          <div className="metal-content">
            <h2 className="metal-text" style={{ fontSize: '1.25rem', marginBottom: 'var(--space-6)', fontFamily: 'var(--font-brand)' }}>
              Performance Trends
            </h2>
            <div style={{ width: '100%', height: 350, marginTop: 'var(--space-4)' }}>
              {metrics.chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={metrics.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00E5FF" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#00E5FF" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00FF9D" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#00FF9D" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="date" stroke="var(--grey-400)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis 
                      stroke="var(--grey-400)" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false} 
                      tickFormatter={(val) => `$${val}`}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'rgba(5,10,15,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
                      itemStyle={{ color: '#fff' }}
                      formatter={(value: any) => [formatCurrency(Number(value) || 0), '']}
                    />
                    <Area type="monotone" dataKey="sales" name="Revenue" stroke="#00E5FF" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                    <Area type="monotone" dataKey="profit" name="Profit" stroke="#00FF9D" strokeWidth={3} fillOpacity={1} fill="url(#colorProfit)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--grey-400)' }}>
                  No chart data available yet.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Interactive Orders Manager */}
        <div style={{ flex: 1, minWidth: 0, marginTop: 'var(--space-6)' }}>
          <AgentOrders orders={orders} setOrders={setOrders} />
        </div>
      </div>

      {/* 3. BOTTOM SECTION: LIVE CARTS */}
      <div className="metal-frame">
        <div className="metal-content">
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 'var(--space-4)', gap: '12px' }}>
            <h2 className="metal-text" style={{ fontSize: '1.25rem', margin: 0, fontFamily: 'var(--font-brand)' }}>
              Live Downline Carts
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0, 229, 255, 0.1)', padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(0, 229, 255, 0.2)' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00E5FF', boxShadow: '0 0 8px #00E5FF', animation: 'pulse 2s infinite' }} />
              <span style={{ fontSize: '0.75rem', color: '#00E5FF', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Auto-refreshes</span>
            </div>
          </div>
          
          {liveCarts.length === 0 ? (
            <div className="metal-embossed-panel" style={{ textAlign: 'center', padding: 'var(--space-8)', opacity: 0.7 }}>
              No Researchers Currently Have Items In Their Cart.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
              {liveCarts.map((cartRecord: any) => {
                const cartTotal = cartRecord.cart.reduce((sum: number, item: any) => sum + (Number(item.retailPrice) * Number(item.quantity)), 0);
                
                return (
                  <div key={cartRecord.id} className="metal-embossed-panel" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 'var(--space-3)' }}>
                      <div>
                        <strong style={{ color: '#00E5FF', fontSize: '1.05rem' }}>{cartRecord.name}</strong>
                        <div style={{ fontSize: '0.8rem', color: 'var(--grey-400)', marginTop: 2 }}>{cartRecord.email}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ color: 'var(--white)', fontWeight: 'bold', fontSize: '1.1rem' }}>{formatCurrency(cartTotal)}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--silver)', textTransform: 'uppercase', marginTop: 2 }}>
                          Potential Sale
                        </div>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                      {cartRecord.cart.map((item: any, idx: number) => (
                        <div key={idx} style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', padding: '4px 8px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 100%' }}>
                          <span style={{ background: 'var(--surface-3)', color: 'var(--white)', fontWeight: 800, padding: '2px 6px', borderRadius: 4, fontSize: '0.75rem' }}>{item.quantity}x</span>
                          <span style={{ fontSize: '0.85rem', color: 'var(--silver)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</span>
                          <span style={{ fontSize: '0.85rem', color: '#00FF9D', fontWeight: 600 }}>{formatCurrency(item.retailPrice * item.quantity)}</span>
                        </div>
                      ))}
                    </div>
                    
                    <div style={{ fontSize: '0.7rem', color: 'var(--grey-400)', textAlign: 'right', marginTop: '4px' }}>
                      Last Active: {new Date(cartRecord.updated_at).toLocaleTimeString()}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
