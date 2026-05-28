'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

type StatusFilter = 'all' | 'approved_ship' | 'in_fulfillment' | 'shipped';

export default function ShippingDashboard() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

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

  useEffect(() => {
    fetchOrders();
  }, []);

  const filteredOrders = statusFilter === 'all'
    ? orders
    : orders.filter(o => o.status === statusFilter);

  const handleUpdateTracking = async (orderId: string, trackingNumber: string, action: 'save_tracking' | 'mark_shipped') => {
    try {
      const res = await fetch('/api/shipping/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, tracking_number: trackingNumber, action })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed To Update Order');

      toast.success(action === 'mark_shipped' ? 'Order Marked As Shipped' : 'Tracking Number Saved');
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (loading && orders.length === 0) return <div style={{ color: 'var(--silver)' }}>Loading Fulfillment Queue...</div>;
  if (error) return <div style={{ color: 'var(--red)' }}>Error: {error}</div>;

  const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'approved_ship', label: 'New Orders' },
    { value: 'in_fulfillment', label: 'In Progress' },
    { value: 'shipped', label: 'Shipped' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', opacity: loading ? 0.7 : 1, transition: 'opacity 0.2s' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontFamily: 'var(--font-brand)', color: 'var(--white)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Fulfillment Queue
          </h1>
          <p style={{ color: 'var(--grey-400)', fontSize: '0.9rem', marginTop: 4 }}>
            Orders Ready To Be Shipped. Paste Tracking Numbers And Dispatch.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={fetchOrders}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <div className="card-metal" style={{ padding: 'var(--space-3) var(--space-5)', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', color: 'var(--teal)', fontFamily: 'var(--font-brand)' }}>
              {orders.filter(o => o.status === 'approved_ship').length}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--silver)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>New</div>
          </div>
          <div className="card-metal" style={{ padding: 'var(--space-3) var(--space-5)', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', color: 'var(--gold)', fontFamily: 'var(--font-brand)' }}>
              {orders.filter(o => o.status === 'in_fulfillment').length}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--silver)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>In Progress</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        {STATUS_FILTERS.map(f => (
          <button
            key={f.value}
            type="button"
            onClick={() => setStatusFilter(f.value)}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-md)',
              border: statusFilter === f.value ? '1px solid var(--teal)' : '1px solid rgba(255,255,255,0.06)',
              background: statusFilter === f.value ? 'rgba(0,196,188,0.1)' : 'var(--surface-3)',
              color: statusFilter === f.value ? 'var(--teal)' : 'var(--silver)',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="card-metal" style={{ padding: 'var(--space-6)' }}>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Date</th>
                <th>Buyer</th>
                <th>Shipping Address</th>
                <th>Status</th>
                <th>Tracking Number</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', opacity: 0.5, padding: 'var(--space-8)' }}>
                      No Orders In The Fulfillment Queue.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map(order => (
                    <motion.tr 
                      key={order.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      layout
                    >
                      <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--silver)' }}>
                        {order.id.split('-')[0]}...
                      </td>
                      <td>{new Date(order.created_at).toLocaleDateString()}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{order.buyer?.full_name || 'Anonymous'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--grey-400)' }}>{order.buyer?.email}</div>
                      </td>
                      <td>
                        {order.shipping_address ? (
                          <div style={{ fontSize: '0.8rem', color: 'var(--silver)', lineHeight: 1.4 }}>
                            {order.shipping_address.fullName}<br />
                            {order.shipping_address.street}{order.shipping_address.suite ? `, ${order.shipping_address.suite}` : ''}<br />
                            {order.shipping_address.city}, {order.shipping_address.state} {order.shipping_address.zip}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--red)', fontSize: '0.8rem' }}>No Address Provided</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${order.status === 'in_fulfillment' ? 'badge-gold' : 'badge-teal'}`}>
                          {order.status === 'in_fulfillment' ? 'In Progress' : 'New Order'}
                        </span>
                      </td>
                      <td>
                        <input 
                          type="text" 
                          id={`tracking-${order.id}`}
                          aria-label="Tracking Number"
                          className="form-input" 
                          defaultValue={order.tracking_number || ''}
                          placeholder="Paste Tracking..."
                          style={{ width: 180, fontSize: '0.8rem', padding: '6px 10px' }}
                        />
                      </td>
                      <td style={{ textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button 
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            const val = (document.getElementById(`tracking-${order.id}`) as HTMLInputElement).value;
                            handleUpdateTracking(order.id, val, 'save_tracking');
                          }}
                        >
                          Save
                        </button>
                        <button 
                          className="btn btn-primary btn-sm"
                          onClick={() => {
                            const val = (document.getElementById(`tracking-${order.id}`) as HTMLInputElement).value;
                            if (!val) {
                              toast.error('Please Enter A Tracking Number First');
                              return;
                            }
                            handleUpdateTracking(order.id, val, 'mark_shipped');
                          }}
                        >
                          Dispatch
                        </button>
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
