'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import AgentManualOrder from './AgentManualOrder';
import { carrierInfo } from '@/lib/carrier';
import AgentPaymentProofs from './AgentPaymentProofs';

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
  discount_amount?: number | null;
  coupon_code?: string | null;
  created_at: string;
  buyer_name: string;
  buyer_email: string;
  tracking_number?: string | null;
  label_url?: string | null;
}

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_retail_price: number;
  unit_cost_price: number | null;
}

interface AgentOrdersProps {
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
}

const STATUS_LABEL: Record<string, string> = {
  pending_customer_payment: 'Pending Payment',
  agent_approval_pending: 'Agent Approval Pending',
  approved_ship: 'Approved Ship',
  approved_pickup: 'Approved Pickup',
  in_fulfillment: 'In Fulfillment',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const PAYMENT_LABEL: Record<string, string> = {
  zelle: 'Zelle',
  venmo: 'Venmo',
  cashapp: 'Cash App',
  apple_pay: 'Apple Pay',
};

function formatAddress(address: any): string {
  if (!address) return 'No Shipping Address Provided';
  if (typeof address === 'string') return address;
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
  const [buyingLabelId, setBuyingLabelId] = useState<string | null>(null);
  const [trackingNumbers, setTrackingNumbers] = useState<Record<string, string>>({});
  const [showManualOrder, setShowManualOrder] = useState(false);

  // Detail modal state
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [detailItems, setDetailItems] = useState<OrderItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

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
          `/api/agent/orders/items?orderId=${encodeURIComponent(detailOrder.id)}`
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
      const res = await fetch('/api/agent/orders/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, newStatus, tracking_number: tracking }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed To Transition Order.');
      }

      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? { ...o, status: newStatus, tracking_number: tracking || o.tracking_number }
            : o
        )
      );
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
        body: JSON.stringify({ orderId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed To Purchase Shipping Label.');
      }

      toast.success('Shipping Label Purchased Successfully');
      if (data.labelUrl) {
        window.open(data.labelUrl, '_blank');
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

  const detailSubtotal = detailItems.reduce(
    (sum, it) => sum + Number(it.unit_retail_price || 0) * Number(it.quantity || 0),
    0
  );

  return (
    <div className="card-metal" style={{ padding: 'var(--space-6)' }}>
      <h3
        style={{
          fontSize: '1.1rem',
          color: 'var(--white)',
          marginBottom: 'var(--space-4)',
          fontFamily: 'var(--font-brand)',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        Referred Order Ledger
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
            }
          }}
        />
      ) : orders.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {orders.map((order) => {
            const isPendingPayment = order.status === 'pending_customer_payment';
            const isPendingApproval = order.status === 'agent_approval_pending';
            const canApprove = isPendingPayment || isPendingApproval;

            return (
              <div
                key={order.id}
                onClick={() => setDetailOrder(order)}
                style={{
                  background: 'rgba(22, 34, 48, 0.4)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 'var(--space-5)',
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  alignItems: 'center',
                  gap: 'var(--space-4)',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer',
                }}
                className="message-card-hover"
              >
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-3)',
                      marginBottom: 'var(--space-2)',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.72rem',
                        color: 'var(--grey-400)',
                        fontFamily: 'var(--font-brand)',
                      }}
                    >
                      ID: {order.id}
                    </span>
                    <span
                      style={{
                        width: 4,
                        height: 4,
                        borderRadius: '50%',
                        background: 'rgba(255,255,255,0.2)',
                      }}
                    />
                    <span style={{ fontSize: '0.78rem', color: 'var(--silver)' }}>
                      {new Date(order.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <div style={{ marginBottom: 'var(--space-3)' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--white)' }}>
                      {order.buyer_name || 'Anonymous Scientist'}
                    </div>
                    <div
                      style={{
                        fontSize: '0.78rem',
                        color: 'var(--grey-400)',
                        fontFamily: 'var(--font-brand)',
                      }}
                    >
                      {order.buyer_email ? `@${order.buyer_email.split('@')[0]}` : ''}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--silver-light)' }}>
                      <span style={{ color: 'var(--grey-400)' }}>Total:</span>{' '}
                      <strong style={{ color: 'var(--teal)' }}>
                        ${Number(order.total).toFixed(2)}
                      </strong>
                    </div>
                    <div
                      style={{
                        fontSize: '0.8rem',
                        color: 'var(--silver-light)',
                        textTransform: 'capitalize',
                      }}
                    >
                      <span style={{ color: 'var(--grey-400)' }}>Method:</span>{' '}
                      {order.fulfillment_method === 'agent_pickup' ? 'Agent Pickup' : 'Delivery'}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--silver-light)' }}>
                      <span style={{ color: 'var(--grey-400)' }}>Payment:</span>{' '}
                      {PAYMENT_LABEL[order.payment_method] || order.payment_method}
                    </div>
                  </div>

                  {order.tracking_number && (
                    <div
                      style={{
                        fontSize: '0.8rem',
                        color: 'var(--silver-light)',
                        marginTop: 'var(--space-2)',
                        display: 'flex',
                        gap: 'var(--space-3)',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <span style={{ color: 'var(--grey-400)' }}>Tracking:</span>{' '}
                        <strong style={{ color: 'var(--teal)' }}>{order.tracking_number}</strong>
                      </div>
                      {order.label_url && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(order.label_url!, '_blank');
                          }}
                          className="btn btn-secondary btn-sm"
                          style={{
                            padding: '2px 8px',
                            fontSize: '0.7rem',
                            background: 'rgba(192,184,168,0.1)',
                            border: '1px solid var(--teal)',
                            color: 'var(--teal)',
                          }}
                        >
                          Print PDF Label
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    gap: 'var(--space-3)',
                  }}
                >
                  <span
                    className={`badge ${
                      order.status === 'cancelled'
                        ? 'badge-red'
                        : order.status.startsWith('approved_') ||
                          order.status === 'delivered' ||
                          order.status === 'shipped'
                        ? 'badge-teal'
                        : 'badge-silver'
                    }`}
                    style={{ fontSize: '0.7rem' }}
                  >
                    {STATUS_LABEL[order.status] ||
                      order.status
                        .split('_')
                        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                        .join(' ')}
                  </span>

                  {canApprove && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 'var(--space-2)',
                        alignItems: 'flex-end',
                      }}
                    >
                      {order.fulfillment_method === 'ship' && (
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
                          style={{ padding: '6px 10px', fontSize: '0.75rem', height: 32, width: 220 }}
                        />
                      )}
                      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        <button
                          onClick={() => handleUpdateOrderStatus(order.id, 'cancelled')}
                          className="btn btn-secondary btn-sm"
                          style={{
                            border: '1px solid var(--red)',
                            color: 'var(--red)',
                            fontSize: '0.75rem',
                          }}
                          disabled={loadingOrderId === order.id}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() =>
                            handleUpdateOrderStatus(
                              order.id,
                              order.fulfillment_method === 'agent_pickup'
                                ? 'approved_pickup'
                                : 'approved_ship'
                            )
                          }
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
                            style={{
                              border: '1px solid var(--teal)',
                              color: 'var(--teal)',
                              fontSize: '0.75rem',
                              background: 'rgba(192,184,168,0.1)',
                            }}
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
        <div
          style={{
            textAlign: 'center',
            padding: 'var(--space-10) 0',
            opacity: 0.6,
            background: 'rgba(255,255,255,0.02)',
            borderRadius: 'var(--radius-md)',
            border: '1px dashed rgba(255,255,255,0.1)',
          }}
        >
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
          <p style={{ fontSize: '0.78rem', color: 'var(--grey-400)', margin: 0 }}>
            Client Transaction Registrations Will Sync Dynamically To This Dashboard Panel.
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
            padding: 'var(--space-4)',
            backdropFilter: 'blur(6px)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="agent-order-modal card-metal"
            style={{
              width: '100%',
              maxWidth: 760,
              maxHeight: '92vh',
              overflowY: 'auto',
              padding: 'var(--space-6)',
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
                marginBottom: 'var(--space-5)',
                gap: 'var(--space-4)',
              }}
            >
              <div>
                <h2
                  style={{
                    fontSize: '1.2rem',
                    color: 'var(--white)',
                    marginBottom: 4,
                    fontFamily: 'var(--font-brand)',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                  }}
                >
                  Order Detail
                </h2>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--grey-400)',
                    fontFamily: 'var(--font-brand)',
                  }}
                >
                  ID: {detailOrder.id}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--grey-400)', marginTop: 4 }}>
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
                style={{ fontSize: '0.72rem' }}
              >
                {STATUS_LABEL[detailOrder.status] || detailOrder.status}
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 'var(--space-4)',
                marginBottom: 'var(--space-5)',
              }}
            >
              <div
                style={{
                  background: 'rgba(192,184,168,0.04)',
                  border: '1px solid rgba(192,184,168,0.12)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-4)',
                }}
              >
                <div
                  style={{
                    fontSize: '0.7rem',
                    color: 'var(--grey-400)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginBottom: 6,
                  }}
                >
                  Buyer
                </div>
                <div style={{ fontSize: '0.95rem', color: 'var(--white)', fontWeight: 600 }}>
                  {detailOrder.buyer_name || 'Anonymous Scientist'}
                </div>
                <div
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--silver)',
                    marginTop: 4,
                    wordBreak: 'break-all',
                  }}
                >
                  {detailOrder.buyer_email || 'No Email Provided'}
                </div>
              </div>
              <div
                style={{
                  background: 'rgba(192,184,168,0.04)',
                  border: '1px solid rgba(192,184,168,0.12)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-4)',
                }}
              >
                <div
                  style={{
                    fontSize: '0.7rem',
                    color: 'var(--grey-400)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginBottom: 6,
                  }}
                >
                  Shipping Address
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--silver)' }}>
                  {formatAddress(detailOrder.shipping_address)}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 'var(--space-5)' }}>
              <div
                style={{
                  fontSize: '0.78rem',
                  color: 'var(--grey-400)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: 'var(--space-3)',
                }}
              >
                Line Items
              </div>
              {detailLoading ? (
                <div
                  style={{
                    padding: 'var(--space-4)',
                    textAlign: 'center',
                    color: 'var(--silver)',
                  }}
                >
                  Loading Line Items...
                </div>
              ) : detailError ? (
                <div className="disclaimer-warning" style={{ padding: 'var(--space-3)' }}>
                  <p style={{ color: 'var(--red)', fontSize: '0.82rem' }}>{detailError}</p>
                </div>
              ) : detailItems.length === 0 ? (
                <p style={{ color: 'var(--grey-400)', fontSize: '0.85rem' }}>
                  No Line Items Found For This Order.
                </p>
              ) : (
                <table
                  style={{
                    width: '100%',
                    fontSize: '0.85rem',
                    color: 'var(--silver)',
                    borderCollapse: 'collapse',
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        color: 'var(--grey-400)',
                        borderBottom: '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      <th style={{ textAlign: 'left', padding: '8px 6px' }}>Product</th>
                      <th style={{ textAlign: 'right', padding: '8px 6px' }}>Quantity</th>
                      <th style={{ textAlign: 'right', padding: '8px 6px' }}>Unit Price</th>
                      <th style={{ textAlign: 'right', padding: '8px 6px' }}>Line Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailItems.map((item) => {
                      const unit = Number(item.unit_retail_price || 0);
                      const qty = Number(item.quantity || 0);
                      return (
                        <tr
                          key={item.id}
                          style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                        >
                          <td style={{ padding: '8px 6px' }}>{item.product_name}</td>
                          <td style={{ textAlign: 'right', padding: '8px 6px' }}>{qty}</td>
                          <td style={{ textAlign: 'right', padding: '8px 6px' }}>
                            ${unit.toFixed(2)}
                          </td>
                          <td
                            style={{
                              textAlign: 'right',
                              padding: '8px 6px',
                              color: 'var(--teal)',
                            }}
                          >
                            ${(unit * qty).toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 'var(--space-4)',
                marginBottom: 'var(--space-5)',
              }}
            >
              <div
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-4)',
                }}
              >
                <div
                  style={{
                    fontSize: '0.7rem',
                    color: 'var(--grey-400)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginBottom: 6,
                  }}
                >
                  Payment Method
                </div>
                <div style={{ color: 'var(--silver)' }}>
                  {PAYMENT_LABEL[detailOrder.payment_method] || detailOrder.payment_method}
                </div>

                {detailOrder.tracking_number && (() => {
                  const ci = carrierInfo(detailOrder.tracking_number);
                  return (
                    <>
                      <div
                        style={{
                          fontSize: '0.7rem',
                          color: 'var(--grey-400)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          marginTop: 'var(--space-3)',
                          marginBottom: 6,
                        }}
                      >
                        Tracking Number
                      </div>
                      <div
                        style={{
                          color: 'var(--teal)',
                          fontWeight: 600,
                          wordBreak: 'break-all',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--space-2)',
                          flexWrap: 'wrap',
                        }}
                      >
                        <span>{detailOrder.tracking_number}</span>
                        {ci.carrier !== 'Unknown' && (
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              color: 'var(--white)',
                              background: 'var(--teal)',
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-full)',
                              letterSpacing: '0.05em',
                            }}
                          >
                            {ci.carrier}
                          </span>
                        )}
                      </div>
                      {ci.trackingUrl && (
                        <a
                          href={ci.trackingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-block',
                            marginTop: 6,
                            fontSize: '0.78rem',
                            color: 'var(--teal)',
                            textDecoration: 'underline',
                          }}
                        >
                          Track With {ci.carrier}
                        </a>
                      )}
                    </>
                  );
                })()}

                {detailOrder.label_url && (
                  <a
                    href={detailOrder.label_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary btn-sm"
                    style={{
                      marginTop: 'var(--space-3)',
                      display: 'inline-block',
                      fontSize: '0.78rem',
                    }}
                  >
                    Open Shipping Label
                  </a>
                )}

                <div
                  style={{
                    fontSize: '0.7rem',
                    color: 'var(--grey-400)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginTop: 'var(--space-4)',
                    marginBottom: 6,
                  }}
                >
                  Payment Proofs
                </div>
                <AgentPaymentProofs orderId={detailOrder.id} />
              </div>

              <div
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-4)',
                }}
              >
                <div
                  style={{
                    fontSize: '0.7rem',
                    color: 'var(--grey-400)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginBottom: 'var(--space-3)',
                  }}
                >
                  Totals
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.85rem',
                    color: 'var(--silver)',
                    marginBottom: 4,
                  }}
                >
                  <span>Subtotal</span>
                  <span>${Number(detailOrder.subtotal || detailSubtotal).toFixed(2)}</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.85rem',
                    color: 'var(--silver)',
                    marginBottom: 4,
                  }}
                >
                  <span>Shipping</span>
                  <span>${Number(detailOrder.shipping_cost || 0).toFixed(2)}</span>
                </div>
                {detailOrder.discount_amount != null && Number(detailOrder.discount_amount) > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.85rem',
                      color: 'var(--silver)',
                      marginBottom: 4,
                    }}
                  >
                    <span>
                      Discount{detailOrder.coupon_code ? ` (${detailOrder.coupon_code})` : ''}
                    </span>
                    <span style={{ color: 'var(--red)' }}>
                      -${Number(detailOrder.discount_amount).toFixed(2)}
                    </span>
                  </div>
                )}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '1rem',
                    color: 'var(--white)',
                    fontWeight: 700,
                    marginTop: 'var(--space-2)',
                    borderTop: '1px solid rgba(255,255,255,0.08)',
                    paddingTop: 'var(--space-2)',
                  }}
                >
                  <span>Total</span>
                  <span style={{ color: 'var(--teal)' }}>${Number(detailOrder.total).toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div
              className="agent-order-modal-actions"
              style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDetailOrder(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => window.print()}
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
  );
}
