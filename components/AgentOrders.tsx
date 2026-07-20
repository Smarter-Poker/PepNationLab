'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import AgentManualOrder from './AgentManualOrder';
import { carrierInfo } from '@/lib/carrier';
import AgentPaymentProofs from './AgentPaymentProofs';
import { paymentMethodLabel } from '@/lib/payment-method-labels';
import IframeLink from '@/components/ui/IframeLink';
import IframeModal from '@/components/ui/IframeModal';
import OrderStageTimeline from '@/components/OrderStageTimeline';

export interface ShippingAddress {
  line1?: string;
  street?: string;
  line2?: string;
  city?: string;
  state?: string;
  zip?: string;
  postal_code?: string;
  country?: string;
}
interface Order {
  id: string;
  buyer_id: string;
  status: string;
  fulfillment_method: string;
  payment_method: string;
  shipping_address: ShippingAddress | null;
  shipping_cost: number;
  subtotal: number;
  total: number;
  discount_amount?: number | null;
  coupon_code?: string | null;
  created_at: string;
  buyer_name: string;
  buyer_email: string;
  tracking_number?: string | null;
  label_url?: string | null;
  agent_id?: string;
  is_sub_agent_order?: boolean;
  profit?: number;
  is_downline_order?: boolean;
  downline_agent_id?: string | null;
  downline_agent_name?: string | null;
}

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_retail_price: number;
  unit_cost_price: number | null;
  stackData?: {
    isPreBlended: boolean;
    components: string[];
  };
}

interface AgentOrdersProps {
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
}

const STATUS_LABEL: Record<string, string> = {
  pending_customer_payment: 'Pending Payment',
  agent_approval_pending: 'Agent Approval Pending',
  admin_approval_pending: 'Awaiting Admin Approval',
  approved_ship: 'Approved Ship',
  approved_pickup: 'Approved Pickup',
  in_fulfillment: 'In Fulfillment',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};


function formatAddress(address: ShippingAddress | null): string {
  if (!address) return 'No Shipping Address Provided';
  const parts = [
    address.street || address.line1,
    address.line2,
    address.city,
    [address.state, address.zip || address.postal_code].filter(Boolean).join(' '),
    address.country,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : 'No Shipping Address Provided';
}

export default function AgentOrders({ orders, setOrders }: AgentOrdersProps) {
  const [loadingOrderId, setLoadingOrderId] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [buyingLabelId, setBuyingLabelId] = useState<string | null>(null);
  const [labelModalUrl, setLabelModalUrl] = useState<string | null>(null);
  const [trackingNumbers, setTrackingNumbers] = useState<Record<string, string>>({});
  const [showManualOrder, setShowManualOrder] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Pagination Logic
  const PAGE_SIZE = 25;
  const totalPages = Math.ceil(orders.length / PAGE_SIZE);
  const safeCurrentPage = Math.max(1, Math.min(currentPage, totalPages || 1));
  const paginatedOrders = orders.slice((safeCurrentPage - 1) * PAGE_SIZE, safeCurrentPage * PAGE_SIZE);

  // Detail modal state
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [detailItems, setDetailItems] = useState<OrderItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  // Keep detailOrder synchronized with the parent orders array so the modal updates optimistically
  // or when WebSockets push new status changes (e.g. customer pays while modal is open).
  useEffect(() => {
    if (detailOrder) {
      const updatedOrder = orders.find(o => o.id === detailOrder.id);
      if (updatedOrder && (
        updatedOrder.status !== detailOrder.status ||
        updatedOrder.created_at !== detailOrder.created_at
      )) {
        setDetailOrder(updatedOrder);
      }
    }
  }, [orders, detailOrder]);

  useEffect(() => {
    if (!detailOrder) {
      setDetailItems([]);
      setDetailError('');
      return;
    }
    let cancelled = false;
    (async () => {
      setDetailLoading(true);
      setDetailError('');
      try {
        const res = await fetch(
          `/api/agent/orders/items?orderId=${encodeURIComponent(detailOrder.id)}&t=${Date.now()}`
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed To Load Line Items');
        if (!cancelled) setDetailItems(json.data ?? []);
      } catch (err: any) {
        if (!cancelled) setDetailError(err.message || 'Failed To Load Line Items');
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [detailOrder]);

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    setLoadingOrderId(orderId);
    try {
      const tracking = trackingNumbers[orderId] || null;
      const idemKey = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const res = await fetch('/api/agent/orders/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Lets the server's withIdempotency guard dedupe a double-click or
          // network retry of the same approval.
          'Idempotency-Key': idemKey,
        },
        body: JSON.stringify({ orderId, newStatus, tracking_number: tracking }),
      });

      const data = await res.json().catch(() => ({} as { error?: string; status?: string }));
      if (!res.ok) {
        throw new Error(data.error || 'Failed To Transition Order.');
      }

      // The server frequently lands on a DIFFERENT terminal status than the
      // one requested (sub-agent approvals demote to agent_approval_pending,
      // prepaid accounts to admin_approval_pending, failed credit charges
      // back to admin review). Reflect the ACTUAL status, not the wish.
      const serverStatus = (data as { status?: string }).status || newStatus;
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? { ...o, status: serverStatus, tracking_number: tracking || o.tracking_number }
            : o
        )
      );
      toast.success(`Order Status Shifted To ${STATUS_LABEL[serverStatus] ?? serverStatus.replace(/_/g, ' ').split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}`);
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
        body: JSON.stringify({ orderId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed To Purchase Shipping Label.');
      }

      toast.success('Shipping Label Purchased Successfully');
      if (data.labelUrl) {
        setLabelModalUrl(data.labelUrl);
      }

      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                status: 'shipped',
                tracking_number: data.trackingNumber,
                label_url: data.labelUrl,
              }
            : o
        )
      );
    } catch (err: any) {
      toast.error(err.message ?? 'An Error Occurred Purchasing Shipping Label.');
    } finally {
      setBuyingLabelId(null);
    }
  };

  const handleMarkPaid = async (orderId: string) => {
    setLoadingOrderId(orderId);
    try {
      const res = await fetch('/api/agent/orders/mark-paid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed To Mark Order As Paid.');
      }

      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? { ...o, status: data.newStatus }
            : o
        )
      );
      toast.success('Order Marked As Paid!');
    } catch (err: any) {
      toast.error(err.message ?? 'An Error Occurred Marking Order As Paid.');
    } finally {
      setLoadingOrderId(null);
    }
  };

  const detailSubtotal = detailItems.reduce(
    (sum, it) => sum + Number(it.unit_retail_price || 0) * Number(it.quantity || 0),
    0
  );

  return (
    <div className="glass-panel" style={{ marginBottom: 'var(--space-6)' }}>
      {labelModalUrl && (
        <IframeModal url={labelModalUrl} title="Shipping Label" onClose={() => setLabelModalUrl(null)} />
      )}
      <div className="">
      <h3
        className="metal-text"
        style={{
          fontSize: '1.25rem',
          marginBottom: 'var(--space-6)',
          fontFamily: 'var(--font-brand)',
        }}
      >
        Completed Sales & Profit
      </h3>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 'var(--space-6)',
        }}
      >
        <p style={{ color: 'var(--grey-400)', fontSize: '0.85rem', maxWidth: 600 }}>
          Manage Orders Registered By Your Clients. Click A Row To Open The Detail View. Coordinate
          Cash Settlements Offline And Release For System Fulfillment.
        </p>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => setShowManualOrder(!showManualOrder)}
        >
          {showManualOrder ? 'View Order Ledger' : 'Create Manual Order'}
        </button>
      </div>

      {showManualOrder ? (
        <AgentManualOrder
          onOrderCreated={(newOrder) => {
            setShowManualOrder(false);
            if (newOrder) {
              setOrders([newOrder, ...orders]);
              setCurrentPage(1); // Jump to page 1 to see the new order
            }
          }}
        />
      ) : orders.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {paginatedOrders.map((order) => {
            const isPendingPayment = order.status === 'pending_customer_payment';
            const isPendingApproval = order.status === 'agent_approval_pending';
            
            let canApprove = false;
            let approveText = 'Approve Order';

            if (order.is_sub_agent_order) {
              if (isPendingApproval) {
                canApprove = true;
                approveText = 'Approve Sub-Agent Order';
              }
            } else {
              if (isPendingPayment || isPendingApproval) {
                canApprove = true;
              }
            }

            return (
              <div
                key={order.id}
                onClick={() => setDetailOrder(order)}
                style={{
                  padding: '3px', // Thick brushed nickel border
                  borderRadius: '18px',
                  background: 'linear-gradient(145deg, #c8c2b8 0%, #a09890 30%, #8a847c 50%, #a09890 70%, #c8c2b8 100%)',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.4)',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  marginBottom: '16px',
                }}
                className="message-card-hover hover-lift"
              >
                <div style={{
                  background: 'linear-gradient(180deg, #1a1f2e 0%, #141820 40%, #111520 100%)',
                  borderRadius: '15px',
                  padding: '24px',
                  boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.6)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  height: '100%',
                }}>
                {/* Header row: Order ID, Date, and Status */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{ 
                        fontSize: '1.2rem', 
                        fontWeight: 800,
                        background: 'linear-gradient(90deg, #FFFFFF 0%, #A8B4C0 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        textShadow: '0 2px 10px rgba(255,255,255,0.1)'
                      }}>
                        {order.is_sub_agent_order || order.is_downline_order
                          ? (order.downline_agent_name ? `Downline Order - ${order.downline_agent_name}` : `Sub-Agent Order #${order.id.slice(0, 8).toUpperCase()}`)
                          : `Order #${order.id.slice(0, 8).toUpperCase()}`}
                      </span>
                      <span style={{ fontSize: '0.85rem', color: 'var(--grey-400)', fontWeight: 600 }}>
                        &bull;
                      </span>
                      <span style={{ fontSize: '0.85rem', color: 'var(--grey-400)', fontWeight: 500 }}>
                        {new Date(order.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ 
                        fontSize: '0.8rem', 
                        color: 'var(--teal)', 
                        fontFamily: 'monospace', 
                        letterSpacing: '0.05em',
                        background: 'rgba(0,196,188,0.1)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        border: '1px solid rgba(0,196,188,0.2)'
                      }}>
                        ID: {order.id}
                      </span>
                    </div>
                  </div>
                  <span
                    style={{ 
                      fontSize: '0.85rem', 
                      padding: '6px 14px', 
                      fontWeight: 800, 
                      borderRadius: '8px',
                      background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), 0 2px 10px rgba(0,0,0,0.3)',
                      textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                      backdropFilter: 'blur(8px)',
                      color: order.status === 'cancelled' ? '#fc8181' : order.status.startsWith('approved_') || order.status === 'delivered' || order.status === 'shipped' ? '#00E5FF' : '#E2E8F0',
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase'
                    }}
                  >
                    {STATUS_LABEL[order.status] || order.status.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                  </span>
                </div>

                {/* Main Content Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginTop: '8px' }}>
                  
                  {/* Buyer Info */}
                  <div style={{ 
                    background: 'var(--bg-metal-dark)', 
                    padding: '16px 20px', 
                    borderRadius: '12px', 
                    borderTop: '1px solid rgba(0,0,0,0.8)',
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                    borderLeft: '1px solid rgba(0,0,0,0.5)',
                    borderRight: '1px solid rgba(255,255,255,0.03)',
                    boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.9)'
                  }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px', fontWeight: 600 }}>Buyer</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--white)' }}>
                      {order.buyer_name || 'Anonymous Researcher'}
                    </div>
                    <div style={{ fontSize: '0.9rem', color: 'var(--teal)', marginTop: '4px', fontWeight: 500 }}>
                      {order.buyer_email || 'No Email Provided'}
                    </div>
                  </div>

                  {/* Order Details */}
                  <div style={{ 
                    background: 'var(--bg-metal-dark)', 
                    padding: '16px 20px', 
                    borderRadius: '12px', 
                    borderTop: '1px solid rgba(0,0,0,0.8)',
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                    borderLeft: '1px solid rgba(0,0,0,0.5)',
                    borderRight: '1px solid rgba(255,255,255,0.03)',
                    boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.9)'
                  }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px', fontWeight: 600 }}>Details</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.9rem', color: 'var(--silver)' }}>Method</span>
                      <span style={{ fontSize: '0.9rem', color: 'var(--white)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {order.fulfillment_method === 'agent_pickup' ? (
                          <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg> Agent Pickup</>
                        ) : (
                          <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg> Delivery</>
                        )}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.9rem', color: 'var(--silver)' }}>Payment</span>
                      <span style={{ fontSize: '0.9rem', color: 'var(--white)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>
                        {paymentMethodLabel(order.payment_method)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <span style={{ fontSize: '0.95rem', color: 'var(--silver)' }}>Total</span>
                      <strong style={{ fontSize: '1.1rem', color: 'var(--teal)' }}>
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(order.total) || 0)}
                      </strong>
                    </div>
                    {typeof order.profit === 'number' && (
                      <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--grey-400)', fontWeight: 600 }}>
                        {order.is_downline_order ? 'Your Profit On This Sale' : 'Your Profit'}:{' '}
                        <span style={{ color: '#48BB78', fontWeight: 700 }}>
                          ${order.profit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* Tracking / Fulfillment */}
                  {order.tracking_number && (
                    <div style={{ background: 'rgba(0,196,188,0.06)', padding: '16px 20px', borderRadius: '12px', border: '1px solid rgba(0,196,188,0.2)' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px', fontWeight: 700 }}>Tracking</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--white)', fontFamily: 'monospace', marginBottom: '12px', wordBreak: 'break-all' }}>
                        {order.tracking_number}
                      </div>
                      {order.label_url && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setLabelModalUrl(order.label_url!);
                          }}
                          className="btn btn-secondary"
                          style={{
                            padding: '8px 16px',
                            fontSize: '0.85rem',
                            background: 'rgba(0,196,188,0.15)',
                            border: '1px solid var(--teal)',
                            color: 'var(--teal)',
                            width: '100%',
                            display: 'flex',
                            justifyContent: 'center',
                            fontWeight: 600
                          }}
                        >
                          Print PDF Label
                        </button>
                      )}
                    </div>
                  )}

                </div>

                {/* Actions row */}
                {canApprove && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      marginTop: '8px',
                      paddingTop: '20px',
                      borderTop: '1px solid rgba(255,255,255,0.06)',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '12px',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                    }}
                  >
                    {order.fulfillment_method === 'ship' && isPendingApproval && (
                      <input
                        type="text"
                        placeholder="Tracking Number (USPS/UPS)"
                        className="form-input"
                        value={trackingNumbers[order.id] || ''}
                        onChange={(e) =>
                          setTrackingNumbers((prev) => ({
                            ...prev,
                            [order.id]: e.target.value,
                          }))
                        }
                        style={{ padding: '10px 16px', fontSize: '0.95rem', height: 44, width: '100%', maxWidth: 300, borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}
                      />
                    )}
                    
                      {confirmCancelId === order.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.85rem', color: '#FFAAAA', fontWeight: 600 }}>Confirm Cancel?</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleUpdateOrderStatus(order.id, 'cancelled'); setConfirmCancelId(null); }}
                            className="btn btn-secondary"
                            style={{
                              border: 'none',
                              color: '#FFAAAA',
                              background: 'linear-gradient(180deg, #5C1E1E 0%, #3B1111 100%)',
                              fontSize: '0.85rem',
                              padding: '8px 16px',
                              fontWeight: 700,
                              borderRadius: '8px',
                            }}
                            disabled={loadingOrderId === order.id}
                          >
                            Yes, Cancel
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirmCancelId(null); }}
                            className="btn btn-ghost"
                            style={{ fontSize: '0.85rem', padding: '8px 14px', borderRadius: '8px' }}
                          >
                            Keep
                          </button>
                        </div>
                      ) : (
                        <button
                        onClick={(e) => { e.stopPropagation(); setConfirmCancelId(order.id); }}
                        className="btn btn-secondary"
                        style={{
                          border: 'none',
                          color: '#FFAAAA',
                          background: 'linear-gradient(180deg, #5C1E1E 0%, #3B1111 100%)',
                          fontSize: '0.9rem',
                          padding: '10px 20px',
                          fontWeight: 700,
                          borderRadius: '10px',
                          boxShadow: '0 4px 15px rgba(252, 129, 129, 0.2), inset 0 1px 0 rgba(255,160,160,0.2), inset 0 -2px 0 rgba(0,0,0,0.4)',
                          textShadow: '0 1px 2px rgba(0,0,0,0.6)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                        disabled={loadingOrderId === order.id}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        Cancel
                      </button>
                      )}
                    
                    {isPendingPayment && !order.is_sub_agent_order && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleMarkPaid(order.id); }}
                        className="btn btn-primary pulse-primary"
                        style={{ 
                          fontSize: '0.9rem', 
                          padding: '10px 24px', 
                          fontWeight: 700,
                          background: 'linear-gradient(180deg, #DCD3C3 0%, #B3A992 100%)',
                          color: '#0A1018',
                          border: 'none',
                          borderRadius: '10px',
                          textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                        disabled={loadingOrderId === order.id || buyingLabelId === order.id}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        {loadingOrderId === order.id ? 'Processing...' : 'Mark As Paid'}
                      </button>
                    )}
                    
                    {canApprove && (
                      <button
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          handleUpdateOrderStatus(order.id, order.fulfillment_method === 'agent_pickup' ? 'approved_pickup' : 'approved_ship'); 
                        }}
                        className="btn btn-primary pulse-primary"
                        style={{
                          fontSize: '0.9rem',
                          padding: '10px 24px',
                          fontWeight: 700,
                          background: 'linear-gradient(180deg, #DCD3C3 0%, #B3A992 100%)',
                          color: '#0A1018',
                          border: 'none',
                          borderRadius: '10px',
                          textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                        disabled={loadingOrderId === order.id}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        {loadingOrderId === order.id ? 'Approving...' : approveText}
                      </button>
                    )}

                    {/* Buy-label removed: agents no longer purchase labels before
                        the admin-approval gate. After an admin releases the order to
                        approved_ship, the label is auto-enqueued (shipping_enqueue_label_job)
                        and drained by the label-jobs cron, or bought by admin/shipping. */}
                  </div>
                )}
              </div>
            </div>
            );
          })}
          
          {totalPages > 1 && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 'var(--space-4)',
              padding: '12px 24px',
              borderRadius: '16px',
              background: 'linear-gradient(145deg, #c8c2b8 0%, #a09890 30%, #8a847c 50%, #a09890 70%, #c8c2b8 100%)',
              boxShadow: '0 8px 30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.4)'
            }}>
              <div style={{
                background: 'linear-gradient(180deg, #1a1f2e 0%, #141820 40%, #111520 100%)',
                borderRadius: '12px',
                padding: '8px',
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.6)'
              }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={safeCurrentPage === 1}
                  style={{
                    opacity: safeCurrentPage === 1 ? 0.5 : 1,
                    cursor: safeCurrentPage === 1 ? 'not-allowed' : 'pointer'
                  }}
                >
                  &larr; Previous
                </button>
                <div style={{
                  color: 'var(--white)',
                  fontFamily: 'var(--font-brand)',
                  fontSize: '0.9rem',
                  letterSpacing: '0.05em'
                }}>
                  Page {safeCurrentPage} Of {totalPages}
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={safeCurrentPage === totalPages}
                  style={{
                    opacity: safeCurrentPage === totalPages ? 0.5 : 1,
                    cursor: safeCurrentPage === totalPages ? 'not-allowed' : 'pointer'
                  }}
                >
                  Next &rarr;
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
            <div style={{ 
              textAlign: 'center', 
              padding: '80px 20px', 
              color: 'var(--grey-400)',
              background: 'linear-gradient(180deg, rgba(11,15,22,0.5) 0%, rgba(18,24,34,0.5) 100%)',
              borderRadius: '21px',
              border: '1px solid rgba(255,255,255,0.03)',
              boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.5)'
            }}>
              <div style={{ 
                marginBottom: 20, 
                display: 'flex', 
                justifyContent: 'center', 
                filter: 'drop-shadow(0 0 20px rgba(0, 196, 188, 0.4))'
              }}>
                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="url(#teal-glow-grad)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                  <defs>
                    <linearGradient id="teal-glow-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#00E5FF" />
                      <stop offset="100%" stopColor="#00C4BC" />
                    </linearGradient>
                  </defs>
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                  <line x1="12" y1="22.08" x2="12" y2="12"/>
                </svg>
              </div>
              <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '1.2rem', fontWeight: 800, marginBottom: 8, letterSpacing: '0.05em' }}>No Pending Ledgers</div>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem', maxWidth: 400, margin: '0 auto', lineHeight: 1.5 }}>
                Orders Registered By Your Clients Will Appear Here For You To Fulfill And Manage.
              </p>
            </div>
      )}

      {/* Order Detail Modal */}
      {detailOrder && (
        <div
          onClick={() => setDetailOrder(null)}
          className="agent-order-modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 'max(var(--space-6), env(safe-area-inset-top, 0px)) var(--space-6) max(var(--space-6), env(safe-area-inset-bottom, 0px))',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="agent-order-modal glass-panel"
            style={{
              width: '100%',
              maxWidth: 820,
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: 'var(--space-8)',
              background: 'linear-gradient(180deg, #162230 0%, #0d1520 100%)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
              borderRadius: '24px',
            }}
          >
            <div
              className="print-only-header"
              style={{ display: 'none', marginBottom: 'var(--space-4)' }}
            >
              <h2 style={{ fontSize: '1.4rem', color: '#000' }}>PepNationLab Packing Slip</h2>
              <p style={{ fontSize: '0.85rem', color: '#333' }}>Order {detailOrder.id}</p>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 'var(--space-6)',
                gap: 'var(--space-4)',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                paddingBottom: 'var(--space-4)'
              }}
            >
              <div>
                <h2
                  style={{
                    fontSize: '1.4rem',
                    color: 'var(--white)',
                    marginBottom: 8,
                    fontFamily: 'var(--font-brand)',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    fontWeight: 800
                  }}
                >
                  Order Detail
                </h2>
                <div
                  style={{
                    fontSize: '0.9rem',
                    color: 'var(--grey-400)',
                    fontFamily: 'monospace',
                    marginBottom: 4
                  }}
                >
                  ID: {detailOrder.id}
                </div>
                <div style={{ fontSize: '0.9rem', color: 'var(--grey-400)' }}>
                  Placed {new Date(detailOrder.created_at).toLocaleString()}
                </div>
              </div>
              <span
                className={`badge ${
                  detailOrder.status === 'cancelled'
                    ? 'badge-red'
                    : detailOrder.status.startsWith('approved_') ||
                      detailOrder.status === 'delivered' ||
                      detailOrder.status === 'shipped'
                    ? 'badge-teal'
                    : 'badge-silver'
                }`}
                style={{ fontSize: '0.85rem', padding: '6px 14px', borderRadius: '8px', fontWeight: 700 }}
              >
                {STATUS_LABEL[detailOrder.status] || detailOrder.status.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
              </span>
            </div>

            {/* Order Progress Timeline (B3) */}
            <div
              style={{
                marginBottom: 'var(--space-6)',
                padding: 'var(--space-5)',
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: '16px',
              }}
            >
              <OrderStageTimeline
                status={detailOrder.status}
                fulfillmentMethod={detailOrder.fulfillment_method}
                trackingNumber={detailOrder.tracking_number}
                createdAt={detailOrder.created_at}
              />
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 'var(--space-5)',
                marginBottom: 'var(--space-6)',
              }}
            >
              <div
                style={{
                  background: 'rgba(0,0,0,0.2)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: '16px',
                  padding: 'var(--space-5)',
                }}
              >
                <div
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--grey-400)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    marginBottom: 8,
                    fontWeight: 700
                  }}
                >
                  Buyer
                </div>
                <div style={{ fontSize: '1.1rem', color: 'var(--white)', fontWeight: 700 }}>
                  {detailOrder.buyer_name || 'Anonymous Researcher'}
                </div>
                <div
                  style={{
                    fontSize: '0.9rem',
                    color: 'var(--teal)',
                    marginTop: 6,
                    wordBreak: 'break-all',
                    fontWeight: 500
                  }}
                >
                  {detailOrder.buyer_email || 'No Email Provided'}
                </div>
              </div>
              <div
                style={{
                  background: 'rgba(0,0,0,0.2)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: '16px',
                  padding: 'var(--space-5)',
                }}
              >
                <div
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--grey-400)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    marginBottom: 8,
                    fontWeight: 700
                  }}
                >
                  Shipping Address
                </div>
                <div style={{ fontSize: '0.95rem', color: 'var(--silver)', lineHeight: 1.5 }}>
                  {formatAddress(detailOrder.shipping_address)}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 'var(--space-6)' }}>
              <div
                style={{
                  fontSize: '0.85rem',
                  color: 'var(--teal)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom: 'var(--space-4)',
                  fontWeight: 700
                }}
              >
                Line Items
              </div>
              {detailLoading ? (
                <div
                  style={{
                    padding: 'var(--space-6)',
                    textAlign: 'center',
                    color: 'var(--silver)',
                    background: 'rgba(0,0,0,0.1)',
                    borderRadius: '12px'
                  }}
                >
                  Loading Line Items...
                </div>
              ) : detailError ? (
                <div className="disclaimer-warning" style={{ padding: 'var(--space-4)', borderRadius: '12px' }}>
                  <p style={{ color: 'var(--red)', fontSize: '0.9rem', margin: 0, fontWeight: 500 }}>{detailError}</p>
                </div>
              ) : detailItems.length === 0 ? (
                <div style={{ padding: 'var(--space-4)', background: 'rgba(0,0,0,0.1)', borderRadius: '12px' }}>
                  <p style={{ color: 'var(--grey-400)', fontSize: '0.95rem', margin: 0, textAlign: 'center' }}>
                    No Line Items Found For This Order.
                  </p>
                </div>
              ) : (
                <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <table
                    style={{
                      width: '100%',
                      fontSize: '0.95rem',
                      color: 'var(--silver)',
                      borderCollapse: 'collapse',
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          color: 'var(--grey-400)',
                          background: 'rgba(0,0,0,0.2)',
                          borderBottom: '1px solid rgba(255,255,255,0.06)',
                        }}
                      >
                        <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 600 }}>Product</th>
                        <th style={{ textAlign: 'center', padding: '12px 16px', fontWeight: 600 }}>Quantity</th>
                        <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 600 }}>Unit Price</th>
                        <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 600 }}>Line Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailItems.map((item, idx) => {
                        const unit = Number(item.unit_retail_price || 0);
                        const qty = Number(item.quantity || 0);
                        return (
                          <tr
                            key={item.id}
                            style={{ borderBottom: idx < detailItems.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}
                          >
                            <td style={{ padding: '12px 16px', color: 'var(--white)', fontWeight: 500 }}>
                              <div>{item.product_name}</div>
                              {item.stackData && (
                                <div style={{ fontSize: '0.8rem', color: 'var(--silver)', marginTop: '4px' }}>
                                  {item.stackData.isPreBlended ? (
                                    <span style={{ color: 'var(--teal)' }}>(Pre-Blended Stack - One Peptide Vial)</span>
                                  ) : (
                                    <div>
                                      <span style={{ color: 'var(--brand-yellow)', fontWeight: 600 }}>Includes Vials:</span> {item.stackData.components.join(', ')}
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                            <td style={{ textAlign: 'center', padding: '12px 16px' }}>{qty}</td>
                            <td style={{ textAlign: 'right', padding: '12px 16px' }}>
                              {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(unit) || 0)}
                            </td>
                            <td
                              style={{
                                textAlign: 'right',
                                padding: '12px 16px',
                                color: 'var(--teal)',
                                fontWeight: 600
                              }}
                            >
                              {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(unit * qty) || 0)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 'var(--space-5)',
                marginBottom: 'var(--space-6)',
              }}
            >
              <div
                style={{
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: '16px',
                  padding: 'var(--space-5)',
                  border: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <div
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--grey-400)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    marginBottom: 10,
                    fontWeight: 700
                  }}
                >
                  Payment Method
                </div>
                <div style={{ color: 'var(--white)', fontSize: '1rem', fontWeight: 600 }}>
                  {paymentMethodLabel(detailOrder.payment_method)}
                </div>

                {detailOrder.tracking_number && (() => {
                  const ci = carrierInfo(detailOrder.tracking_number);
                  return (
                    <>
                      <div
                        style={{
                          fontSize: '0.8rem',
                          color: 'var(--grey-400)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                          marginTop: 'var(--space-4)',
                          marginBottom: 8,
                          fontWeight: 700
                        }}
                      >
                        Tracking Number
                      </div>
                      <div
                        style={{
                          color: 'var(--teal)',
                          fontWeight: 700,
                          fontSize: '1rem',
                          wordBreak: 'break-all',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--space-3)',
                          flexWrap: 'wrap',
                        }}
                      >
                        <span>{detailOrder.tracking_number}</span>
                        {ci.carrier !== 'Unknown' && (
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              color: 'var(--white)',
                              background: 'var(--teal)',
                              padding: '4px 10px',
                              borderRadius: 'var(--radius-full)',
                              letterSpacing: '0.05em',
                            }}
                          >
                            {ci.carrier}
                          </span>
                        )}
                      </div>
                      {ci.trackingUrl && (
                        <IframeLink
                          href={ci.trackingUrl}
                          style={{
                            display: 'inline-block',
                            marginTop: 10,
                            fontSize: '0.9rem',
                            color: 'var(--teal)',
                            textDecoration: 'underline',
                            fontWeight: 600
                          }}
                        >
                          Track With {ci.carrier}
                        </IframeLink>
                      )}
                    </>
                  );
                })()}

                {detailOrder.label_url && (
                  <IframeLink
                    href={detailOrder.label_url}
                    className="btn btn-secondary"
                    style={{
                      marginTop: 'var(--space-4)',
                      display: 'inline-block',
                      fontSize: '0.85rem',
                      padding: '8px 16px',
                      fontWeight: 600
                    }}
                  >
                    View Shipping Label
                  </IframeLink>
                )}

                <div
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--grey-400)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    marginTop: 'var(--space-5)',
                    marginBottom: 10,
                    fontWeight: 700
                  }}
                >
                  Payment Proofs
                </div>
                <AgentPaymentProofs orderId={detailOrder.id} />
              </div>

              <div
                style={{
                  background: 'rgba(0,196,188,0.05)',
                  borderRadius: '16px',
                  padding: 'var(--space-5)',
                  border: '1px solid rgba(0,196,188,0.15)',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <div
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--teal)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    marginBottom: 'var(--space-4)',
                    fontWeight: 700
                  }}
                >
                  Totals
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.95rem',
                    color: 'var(--silver)',
                    marginBottom: 8,
                  }}
                >
                  <span>Subtotal</span>
                  <span>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(detailOrder.subtotal || detailSubtotal) || 0)}</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.95rem',
                    color: 'var(--silver)',
                    marginBottom: 8,
                  }}
                >
                  <span>Shipping</span>
                  <span>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(detailOrder.shipping_cost || 0))}</span>
                </div>
                {detailOrder.discount_amount != null && Number(detailOrder.discount_amount) > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.95rem',
                      color: 'var(--silver)',
                      marginBottom: 8,
                    }}
                  >
                    <span>
                      Discount{detailOrder.coupon_code ? ` (${detailOrder.coupon_code})` : ''}
                    </span>
                    <span style={{ color: 'var(--red)', fontWeight: 600 }}>
                      -{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(detailOrder.discount_amount) || 0)}
                    </span>
                  </div>
                )}
                <div style={{ flex: 1 }} />
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '1.2rem',
                    color: 'var(--white)',
                    fontWeight: 800,
                    marginTop: 'var(--space-3)',
                    borderTop: '1px solid rgba(0,196,188,0.2)',
                    paddingTop: 'var(--space-4)',
                  }}
                >
                  <span>Total</span>
                  <span style={{ color: 'var(--teal)', fontSize: '1.4rem' }}>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(detailOrder.total) || 0)}</span>
                </div>
              </div>
            </div>

            <div
              className="agent-order-modal-actions"
              style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDetailOrder(null)}
                style={{ padding: '10px 24px', fontSize: '0.95rem', fontWeight: 600 }}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => window.print()}
                style={{ padding: '10px 24px', fontSize: '0.95rem', fontWeight: 600 }}
              >
                Print Packing Slip
              </button>
            </div>
          </div>

          <style>{`
            @media print {
              body * { visibility: hidden !important; }
              .agent-order-modal, .agent-order-modal * { visibility: visible !important; }
              .agent-order-modal {
                position: absolute !important;
                top: 0 !important;
                left: 0 !important;
                width: 100% !important;
                max-width: 100% !important;
                max-height: none !important;
                background: #fff !important;
                color: #000 !important;
                box-shadow: none !important;
                border: none !important;
              }
              .agent-order-modal, .agent-order-modal h2, .agent-order-modal h3, .agent-order-modal div, .agent-order-modal span, .agent-order-modal td, .agent-order-modal th, .agent-order-modal p, .agent-order-modal a {
                color: #000 !important;
                background: #fff !important;
              }
              .agent-order-modal-overlay {
                background: #fff !important;
                backdrop-filter: none !important;
                position: static !important;
                padding: 0 !important;
              }
              .agent-order-modal-actions, .agent-order-modal .badge {
                display: none !important;
              }
              .print-only-header {
                display: block !important;
              }
            }
          `}</style>
        </div>
      )}
      </div>
    </div>
  );
}
