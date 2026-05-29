'use client';

import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

type StatusFilter = 'all' | 'approved_ship' | 'in_fulfillment' | 'shipped';

export default function ShippingDashboard() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [quickScanValue, setQuickScanValue] = useState('');
  const [showPackingSlip, setShowPackingSlip] = useState<string | null>(null);
  const quickScanRef = useRef<HTMLInputElement>(null);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/shipping/orders');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed To Fetch Orders');
      setOrders(json.data || []);
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, []);

  const filteredOrders = statusFilter === 'all' ? orders : orders.filter(o => o.status === statusFilter);

  // Stats
  const newOrders = orders.filter(o => o.status === 'approved_ship');
  const inProgress = orders.filter(o => o.status === 'in_fulfillment');
  const shippedToday = orders.filter(o => o.status === 'shipped' && new Date(o.updated_at || o.created_at).toDateString() === new Date().toDateString());
  const totalItemsToShip = [...newOrders, ...inProgress].reduce((s, o) => s + (o.items?.length || 0), 0);

  const handleUpdateTracking = async (orderId: string, trackingNumber: string, action: 'save_tracking' | 'mark_shipped') => {
    try {
      const res = await fetch('/api/shipping/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, tracking_number: trackingNumber, action })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed To Update Order');
      toast.success(action === 'mark_shipped' ? 'Order Dispatched ✅' : 'Tracking Saved');
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Batch mark shipped
  async function handleBatchShip() {
    if (selectedIds.size === 0) return;
    setBatchProcessing(true);
    let success = 0;
    for (const orderId of selectedIds) {
      const input = document.getElementById(`tracking-${orderId}`) as HTMLInputElement;
      const tracking = input?.value;
      if (!tracking) { toast.error(`Missing tracking for order ${orderId.slice(0, 8)}`); continue; }
      try {
        await handleUpdateTracking(orderId, tracking, 'mark_shipped');
        success++;
      } catch { /* individual error handled */ }
    }
    toast.success(`${success} orders dispatched`);
    setSelectedIds(new Set());
    setBatchProcessing(false);
    fetchOrders();
  }

  // Quick scan — auto-assign tracking to the next pending order
  function handleQuickScan() {
    if (!quickScanValue.trim()) return;
    const nextOrder = [...newOrders, ...inProgress][0];
    if (!nextOrder) { toast.error('No orders waiting for tracking'); return; }
    const input = document.getElementById(`tracking-${nextOrder.id}`) as HTMLInputElement;
    if (input) input.value = quickScanValue;
    handleUpdateTracking(nextOrder.id, quickScanValue, 'mark_shipped');
    setQuickScanValue('');
    quickScanRef.current?.focus();
  }

  // Toggle selection
  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleSelectAll() {
    const pending = filteredOrders.filter(o => o.status !== 'shipped');
    if (selectedIds.size === pending.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pending.map(o => o.id)));
    }
  }

  // Packing slip print
  function printPackingSlip(order: any) {
    const items = order.items || [];
    const addr = order.shipping_address || {};
    const html = `
      <html><head><title>Packing Slip</title>
      <style>body{font-family:Arial,sans-serif;padding:40px;color:#222}h1{font-size:18px;margin-bottom:4px}
      .meta{color:#666;font-size:12px;margin-bottom:20px}table{width:100%;border-collapse:collapse;margin-top:16px}
      th,td{text-align:left;padding:8px 12px;border-bottom:1px solid #eee;font-size:13px}
      th{background:#f5f5f5;font-weight:700}.addr{margin-top:20px;padding:12px;background:#f9f9f9;border-radius:6px;font-size:13px}
      .footer{margin-top:30px;padding-top:12px;border-top:1px solid #ddd;font-size:11px;color:#999;text-align:center}</style></head>
      <body>
        <h1>📦 PACKING SLIP</h1>
        <div class="meta">Order #${order.id.slice(0, 8)} • ${new Date(order.created_at).toLocaleDateString()}</div>
        <div class="addr"><strong>Ship To:</strong><br/>${addr.fullName || ''}<br/>${addr.street || ''}${addr.suite ? `, ${addr.suite}` : ''}<br/>${addr.city || ''}, ${addr.state || ''} ${addr.zip || ''}</div>
        <table><thead><tr><th>Product</th><th>Qty</th></tr></thead>
        <tbody>${items.map((i: any) => `<tr><td>${i.product_name}</td><td>${i.quantity}</td></tr>`).join('')}</tbody></table>
        <div class="footer">PEP NATION LAB — Research Use Only</div>
      </body></html>
    `;
    const w = window.open('', '_blank', 'width=600,height=700');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  }

  if (loading && orders.length === 0) return <div style={{ color: 'var(--silver)', padding: 'var(--space-8)' }}>Loading Fulfillment Queue...</div>;
  if (error) return <div style={{ color: 'var(--red)', padding: 'var(--space-8)' }}>Error: {error}</div>;

  const STATUS_FILTERS: { value: StatusFilter; label: string; count: number; color: string }[] = [
    { value: 'all', label: 'All', count: orders.length, color: 'var(--silver)' },
    { value: 'approved_ship', label: 'New Orders', count: newOrders.length, color: '#00C4BC' },
    { value: 'in_fulfillment', label: 'In Progress', count: inProgress.length, color: '#F6AD55' },
    { value: 'shipped', label: 'Shipped', count: orders.filter(o => o.status === 'shipped').length, color: '#68D391' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', opacity: loading ? 0.7 : 1, transition: 'opacity 0.2s' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontFamily: 'var(--font-brand)', color: 'var(--white)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
            Fulfillment Center
          </h1>
          <p style={{ color: 'var(--grey-400)', fontSize: '0.82rem', marginTop: 4, margin: 0 }}>
            Process, Track & Dispatch Orders
          </p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={fetchOrders} disabled={loading}>
          {loading ? 'Refreshing...' : '🔄 Refresh'}
        </button>
      </div>

      {/* Daily Summary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)' }}>
        {[
          { label: 'New Orders', value: newOrders.length, icon: '📬', color: '#00C4BC' },
          { label: 'In Progress', value: inProgress.length, icon: '⏳', color: '#F6AD55' },
          { label: 'Shipped Today', value: shippedToday.length, icon: '🚀', color: '#68D391' },
          { label: 'Total Items', value: totalItemsToShip, icon: '📦', color: '#63B3ED' },
        ].map((s, i) => (
          <div key={i} className="card-metal" style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
            <div style={{ fontSize: '1.4rem', marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: s.color, fontFamily: 'var(--font-brand)' }}>{s.value}</div>
            <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Quick Scan + Batch Controls */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
        {/* Quick Scan */}
        <div className="card-metal" style={{ padding: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.2rem' }}>📷</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', marginBottom: 4, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Quick Scan</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input ref={quickScanRef} type="text" value={quickScanValue} onChange={e => setQuickScanValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleQuickScan(); }}
                placeholder="Scan or paste tracking number..."
                className="form-input" style={{ fontSize: '0.8rem', padding: '6px 10px' }} />
              <button onClick={handleQuickScan} className="btn btn-primary btn-sm" disabled={!quickScanValue.trim()}>
                Assign →
              </button>
            </div>
            <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.2)', marginTop: 4 }}>
              Auto-assigns to next pending order and dispatches
            </div>
          </div>
        </div>

        {/* Batch controls */}
        <div className="card-metal" style={{ padding: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.2rem' }}>⚡</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', marginBottom: 4, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Batch Actions</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: '0.78rem', color: selectedIds.size > 0 ? 'var(--teal)' : 'rgba(255,255,255,0.3)', fontWeight: 600 }}>
                {selectedIds.size} selected
              </span>
              <button onClick={handleBatchShip} disabled={selectedIds.size === 0 || batchProcessing} className="btn btn-primary btn-sm">
                {batchProcessing ? 'Processing...' : `Dispatch ${selectedIds.size} Orders`}
              </button>
              {selectedIds.size > 0 && (
                <button onClick={() => setSelectedIds(new Set())} className="btn btn-secondary btn-sm">Clear</button>
              )}
            </div>
            <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.2)', marginTop: 4 }}>
              Select orders below, enter tracking, then batch dispatch
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        {STATUS_FILTERS.map(f => (
          <button key={f.value} type="button" onClick={() => setStatusFilter(f.value)}
            style={{
              padding: '6px 14px', borderRadius: 'var(--radius-md)',
              border: statusFilter === f.value ? `1px solid ${f.color}` : '1px solid rgba(255,255,255,0.06)',
              background: statusFilter === f.value ? `${f.color}15` : 'var(--surface-3)',
              color: statusFilter === f.value ? f.color : 'var(--silver)',
              fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
            {f.label}
            <span style={{
              fontSize: '0.62rem', fontWeight: 800, background: `${f.color}20`, color: f.color,
              padding: '1px 5px', borderRadius: 4, minWidth: 18, textAlign: 'center',
            }}>{f.count}</span>
          </button>
        ))}
      </div>

      {/* Order Table */}
      <div className="card-metal" style={{ padding: 'var(--space-6)' }}>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input type="checkbox" checked={selectedIds.size > 0 && selectedIds.size === filteredOrders.filter(o => o.status !== 'shipped').length}
                    onChange={toggleSelectAll} style={{ accentColor: 'var(--teal)' }} />
                </th>
                <th>Order</th>
                <th>Date</th>
                <th>Buyer</th>
                <th>Ship To</th>
                <th>Status</th>
                <th>Tracking Number</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', opacity: 0.5, padding: 'var(--space-8)' }}>
                      No Orders In Queue
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map(order => (
                    <motion.tr key={order.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} layout
                      style={{ background: selectedIds.has(order.id) ? 'rgba(192,184,168,0.03)' : undefined }}>
                      <td>
                        {order.status !== 'shipped' && (
                          <input type="checkbox" checked={selectedIds.has(order.id)} onChange={() => toggleSelect(order.id)} style={{ accentColor: 'var(--teal)' }} />
                        )}
                      </td>
                      <td>
                        <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--silver)', fontWeight: 600 }}>
                          #{order.id.split('-')[0]}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)' }}>
                          {order.items?.length || 0} items • ${Number(order.total || 0).toFixed(2)}
                        </div>
                      </td>
                      <td style={{ fontSize: '0.78rem' }}>{new Date(order.created_at).toLocaleDateString()}</td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{order.buyer?.full_name || 'Anonymous'}</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--grey-400)' }}>{order.buyer?.email}</div>
                      </td>
                      <td>
                        {order.shipping_address ? (
                          <div style={{ fontSize: '0.75rem', color: 'var(--silver)', lineHeight: 1.4 }}>
                            {order.shipping_address.fullName}<br />
                            {order.shipping_address.street}{order.shipping_address.suite ? `, ${order.shipping_address.suite}` : ''}<br />
                            {order.shipping_address.city}, {order.shipping_address.state} {order.shipping_address.zip}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--red)', fontSize: '0.75rem' }}>No Address</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${order.status === 'shipped' ? 'badge-teal' : order.status === 'in_fulfillment' ? 'badge-gold' : 'badge-silver'}`}
                          style={{ fontSize: '0.65rem' }}>
                          {order.status === 'shipped' ? '✅ Shipped' : order.status === 'in_fulfillment' ? '⏳ In Progress' : '📬 New'}
                        </span>
                      </td>
                      <td>
                        {order.status === 'shipped' ? (
                          <span style={{ fontSize: '0.78rem', fontFamily: 'monospace', color: '#68D391' }}>{order.tracking_number || '—'}</span>
                        ) : (
                          <input type="text" id={`tracking-${order.id}`} aria-label="Tracking Number" className="form-input"
                            defaultValue={order.tracking_number || ''} placeholder="Paste Tracking..."
                            style={{ width: 170, fontSize: '0.78rem', padding: '5px 8px' }} />
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          {order.status !== 'shipped' && (
                            <>
                              <button className="btn btn-secondary btn-sm" style={{ fontSize: '0.68rem', padding: '3px 8px' }}
                                onClick={() => {
                                  const val = (document.getElementById(`tracking-${order.id}`) as HTMLInputElement).value;
                                  handleUpdateTracking(order.id, val, 'save_tracking');
                                }}>Save</button>
                              <button className="btn btn-primary btn-sm" style={{ fontSize: '0.68rem', padding: '3px 8px' }}
                                onClick={() => {
                                  const val = (document.getElementById(`tracking-${order.id}`) as HTMLInputElement).value;
                                  if (!val) { toast.error('Enter Tracking Number First'); return; }
                                  handleUpdateTracking(order.id, val, 'mark_shipped');
                                }}>Dispatch</button>
                            </>
                          )}
                          <button className="btn btn-secondary btn-sm" style={{ fontSize: '0.68rem', padding: '3px 8px' }}
                            onClick={() => printPackingSlip(order)} title="Print Packing Slip">
                            🖨️
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
