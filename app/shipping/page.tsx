'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

export default function ShippingDashboard() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/shipping/orders');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch orders');
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

  const handleUpdateTracking = async (orderId: string, trackingNumber: string, action: 'save_tracking' | 'mark_shipped') => {
    try {
      const res = await fetch('/api/shipping/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, tracking_number: trackingNumber, action })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update order');
      
      toast.success(action === 'mark_shipped' ? 'Order marked as shipped!' : 'Tracking number saved');
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (loading && orders.length === 0) return <div style={{ color: 'var(--silver)' }}>Loading fulfillment queue...</div>;
  if (error) return <div style={{ color: 'var(--red)' }}>Error: {error}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', opacity: loading ? 0.7 : 1, transition: 'opacity 0.2s' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontFamily: 'var(--font-brand)', color: 'var(--white)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Fulfillment Queue
          </h1>
          <p style={{ color: 'var(--grey-400)', fontSize: '0.9rem', marginTop: 4 }}>
            Orders ready to be shipped. Paste tracking numbers and dispatch.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
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
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', opacity: 0.5, padding: 'var(--space-8)' }}>
                      No orders in the fulfillment queue.
                    </td>
                  </tr>
                ) : (
                  orders.map(order => (
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
                            {order.shipping_address.name}<br />
                            {order.shipping_address.street1} {order.shipping_address.street2}<br />
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
                          placeholder="Paste tracking..." 
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
                              toast.error('Please enter a tracking number first');
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
