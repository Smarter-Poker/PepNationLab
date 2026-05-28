import React, { useState } from 'react';
import { toast } from 'sonner';

interface Order {
  id: string;
  buyer_id: string;
  status: string;
  fulfillment_method: string;
  payment_method: string;
  shipping_address: any;
  shipping_cost: number;
  subtotal: number;
  total: number;
  created_at: string;
  buyer_name: string;
  buyer_email: string;
  tracking_number?: string | null;
  label_url?: string | null;
}

interface AgentOrdersProps {
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
}

export default function AgentOrders({ orders, setOrders }: AgentOrdersProps) {
  const [loadingOrderId, setLoadingOrderId] = useState<string | null>(null);
  const [buyingLabelId, setBuyingLabelId] = useState<string | null>(null);
  const [trackingNumbers, setTrackingNumbers] = useState<Record<string, string>>({});

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    setLoadingOrderId(orderId);
    try {
      const tracking = trackingNumbers[orderId] || null;
      const res = await fetch('/api/agent/orders/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, newStatus, tracking_number: tracking })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed To Transition Order.');
      }

      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus, tracking_number: tracking || o.tracking_number } : o));
      toast.success(`Order Status Shifted To ${newStatus.replace(/_/g, ' ').toUpperCase()}`);
    } catch (err: any) {
      toast.error(err.message ?? 'An Error Occurred Updating Order Status.');
    } finally {
      setLoadingOrderId(null);
    }
  };

  const handleBuyShippingLabel = async (orderId: string) => {
    setBuyingLabelId(orderId);
    try {
      const res = await fetch('/api/agent/shipping/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to purchase shipping label.');
      }

      toast.success('Shipping Label Purchased Successfully!');
      if (data.labelUrl) {
        window.open(data.labelUrl, '_blank');
      }

      // Update local state
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'shipped', tracking_number: data.trackingNumber, label_url: data.labelUrl } : o));
    } catch (err: any) {
      toast.error(err.message ?? 'An Error Occurred Purchasing Shipping Label.');
    } finally {
      setBuyingLabelId(null);
    }
  };

  return (
    <div className="card-metal" style={{ padding: 'var(--space-6)' }}>
      <h3 style={{ fontSize: '1.1rem', color: 'var(--white)', marginBottom: 'var(--space-4)', fontFamily: 'var(--font-brand)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        Referred Order Ledger
      </h3>
      <p style={{ color: 'var(--grey-400)', fontSize: '0.85rem', marginBottom: 'var(--space-6)' }}>
        Manage Orders Registered By Your Clients. Coordinate Cash Settlements Offline And Release For System Fulfillment.
      </p>

      {orders.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {orders.map((order) => {
            const isPendingPayment = order.status === 'pending_customer_payment';
            const isPendingApproval = order.status === 'agent_approval_pending';
            const canApprove = isPendingPayment || isPendingApproval;

            return (
              <div key={order.id} style={{
                background: 'rgba(22, 34, 48, 0.4)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-5)',
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                alignItems: 'center',
                gap: 'var(--space-4)',
                transition: 'all 0.2s ease'
              }} className="message-card-hover">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--grey-400)', fontFamily: 'var(--font-brand)' }}>ID: {order.id}</span>
                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }} />
                    <span style={{ fontSize: '0.78rem', color: 'var(--silver)' }}>{new Date(order.created_at).toLocaleDateString()}</span>
                  </div>

                  <div style={{ marginBottom: 'var(--space-3)' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--white)' }}>
                      {order.buyer_name || 'Anonymous Scientist'}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--grey-400)', fontFamily: 'var(--font-brand)' }}>
                      {order.buyer_email ? `@${order.buyer_email.split('@')[0]}` : ''}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--silver-light)' }}>
                      <span style={{ color: 'var(--grey-400)' }}>Total:</span> <strong style={{ color: 'var(--teal)' }}>${Number(order.total).toFixed(2)}</strong>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--silver-light)', textTransform: 'capitalize' }}>
                      <span style={{ color: 'var(--grey-400)' }}>Method:</span> {order.fulfillment_method === 'agent_pickup' ? 'Agent Pickup' : 'Delivery'}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--silver-light)', textTransform: 'uppercase' }}>
                      <span style={{ color: 'var(--grey-400)' }}>Payment:</span> {order.payment_method === 'cashapp' ? 'Cash App' : order.payment_method === 'apple_pay' ? 'Apple Pay' : order.payment_method}
                    </div>
                  </div>

                  {order.tracking_number && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--silver-light)', marginTop: 'var(--space-2)', display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                      <div>
                        <span style={{ color: 'var(--grey-400)' }}>Tracking:</span> <strong style={{ color: 'var(--teal)' }}>{order.tracking_number}</strong>
                      </div>
                      {order.label_url && (
                        <button 
                          onClick={() => window.open(order.label_url!, '_blank')}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '2px 8px', fontSize: '0.7rem', background: 'rgba(0,196,188,0.1)', border: '1px solid var(--teal)', color: 'var(--teal)' }}
                        >
                          Print PDF Label
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 'var(--space-3)' }}>
                  <span className={`badge ${
                    order.status === 'cancelled' ? 'badge-red' :
                    order.status.startsWith('approved_') || order.status === 'delivered' || order.status === 'shipped' ? 'badge-teal' :
                    'badge-silver'
                  }`} style={{ fontSize: '0.7rem' }}>
                    {order.status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                  </span>

                  {canApprove && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', alignItems: 'flex-end' }}>
                      {order.fulfillment_method === 'ship' && (
                        <input
                          type="text"
                          placeholder="Tracking # (USPS/UPS)"
                          className="form-input"
                          value={trackingNumbers[order.id] || ''}
                          onChange={(e) => setTrackingNumbers(prev => ({ ...prev, [order.id]: e.target.value }))}
                          style={{ padding: '6px 10px', fontSize: '0.75rem', height: 32, width: 220 }}
                        />
                      )}
                      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        <button
                          onClick={() => handleUpdateOrderStatus(order.id, 'cancelled')}
                          className="btn btn-secondary btn-sm"
                          style={{ border: '1px solid var(--red)', color: 'var(--red)', fontSize: '0.75rem' }}
                          disabled={loadingOrderId === order.id}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleUpdateOrderStatus(
                            order.id,
                            order.fulfillment_method === 'agent_pickup' ? 'approved_pickup' : 'approved_ship'
                          )}
                          className="btn btn-primary btn-sm"
                          style={{ fontSize: '0.75rem' }}
                          disabled={loadingOrderId === order.id || buyingLabelId === order.id}
                        >
                          {loadingOrderId === order.id ? 'Processing...' : 'Approve Offline Payment'}
                        </button>
                        {order.fulfillment_method === 'ship' && (
                          <button
                            onClick={() => handleBuyShippingLabel(order.id)}
                            className="btn btn-secondary btn-sm"
                            style={{ border: '1px solid var(--teal)', color: 'var(--teal)', fontSize: '0.75rem', background: 'rgba(0,196,188,0.1)' }}
                            disabled={loadingOrderId === order.id || buyingLabelId === order.id}
                          >
                            {buyingLabelId === order.id ? 'Generating...' : 'Buy USPS Label (Shippo)'}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: 'var(--space-10) 0', opacity: 0.6, background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: '1px dashed rgba(255,255,255,0.1)' }}>
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--teal)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ display: 'block', margin: '0 auto var(--space-3)' }}
          >
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
          </svg>
          <h4 style={{ color: 'var(--silver)' }}>No Referred Orders Found</h4>
          <p style={{ fontSize: '0.78rem', color: 'var(--grey-400)', margin: 0 }}>Client Transaction Registrations Will Sync Dynamically To This Dashboard Panel.</p>
        </div>
      )}
    </div>
  );
}
