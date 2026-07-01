'use client';

import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import AgentManualOrder from './AgentManualOrder';
import AgentPaymentProofs from './AgentPaymentProofs';
import IframeModal from '@/components/IframeModal';

const STATUS_LABEL: Record<string, string> = {
  pending_customer_payment: 'Pending Customer Payment',
  agent_approval_pending: 'Pending Approval',
  approved_ship: 'Approved — Ship',
  approved_pickup: 'Approved — Pickup',
  in_fulfillment: 'In Fulfillment',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const PAGE_SIZE = 25;

function carrierInfo(trackingNumber: string | null | undefined): { label: string; url: string } | null {
  if (!trackingNumber) return null;
  const t = trackingNumber.trim().toUpperCase();
  if (/^1Z/i.test(t)) return { label: 'UPS', url: `https://www.ups.com/track?tracknum=${encodeURIComponent(t)}` };
  if (/^(94|93|92|94)[0-9]{18,}/.test(t) || /^[0-9]{20,22}$/.test(t))
    return { label: 'USPS', url: `https://tools.usps.com/go/TrackConfirmAction?qtc_tLabels1=${encodeURIComponent(t)}` };
  if (/^[0-9]{12,15}$/.test(t) || /^6129[0-9]+$/.test(t))
    return { label: 'FedEx', url: `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(t)}` };
  if (/^JD/i.test(t))
    return { label: 'DHL', url: `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${encodeURIComponent(t)}` };
  return { label: 'Track', url: `https://www.google.com/search?q=${encodeURIComponent(t)}+tracking` };
}

function paymentMethodLabel(method: string | null | undefined): string {
  if (!method) return 'Unknown';
  switch (method) {
    case 'zelle': return 'Zelle';
    case 'cashapp': return 'Cash App';
    case 'venmo': return 'Venmo';
    case 'apple_cash': return 'Apple Cash';
    default: return method.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

function IframeLink({ href, children, style }: { href: string; children: React.ReactNode; style?: React.CSSProperties }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, ...style }}>
        {children}
      </button>
      {open && <IframeModal url={href} onClose={() => setOpen(false)} />}
    </>
  );
}

function formatAddress(address: any): string {
  if (!address) return 'Not Provided';
  if (typeof address === 'string') {
    try {
      const parsed = JSON.parse(address);
      return formatAddress(parsed);
    } catch {
      return address;
    }
  }
  if (typeof address === 'object') {
    const { fullName, street, suite, city, state, zip } = address;
    const parts = [fullName, street, suite, [city, state, zip].filter(Boolean).join(' ')].filter(Boolean);
    return parts.join(', ');
  }
  return String(address);
}

export default function AgentOrders({ agentId }: { agentId?: string }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailOrder, setDetailOrder] = useState<any | null>(null);
  const [detailItems, setDetailItems] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showManualOrder, setShowManualOrder] = useState(false);
  const [labelModalUrl, setLabelModalUrl] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Action loading states
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);
  const [buyingLabelId, setBuyingLabelId] = useState<string | null>(null);
  const [fulfillmentMode, setFulfillmentMode] = useState<'ship' | 'pickup'>('ship');

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const safeCurrentPage = Math.max(1, Math.min(currentPage, totalPages || 1));

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(safeCurrentPage),
        limit: String(PAGE_SIZE),
      });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      const res = await fetch(`/api/agent/orders?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed To Fetch Orders');
      setOrders(json.data || []);
      setTotalCount(json.total || 0);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, [safeCurrentPage, statusFilter]);

  // Sync detailOrder with updated orders list
  useEffect(() => {
    if (detailOrder) {
      const updated = orders.find((o) => o.id === detailOrder.id);
      if (updated) setDetailOrder(updated);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  const openDetail = async (order: any) => {
    setDetailOrder(order);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/agent/orders/items?orderId=${order.id}`);
      const json = await res.json();
      if (res.ok) setDetailItems(json.data || []);
    } catch {
      // non-critical
    } finally {
      setDetailLoading(false);
    }
  };

  const handleApprove = async (orderId: string, mode: 'ship' | 'pickup') => {
    setApprovingId(orderId);
    try {
      const res = await fetch('/api/agent/orders/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, fulfillmentMode: mode }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed To Approve Order');
      toast.success(mode === 'pickup' ? 'Order Approved For Pickup' : 'Order Approved For Shipping');
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || 'Failed To Approve Order');
    } finally {
      setApprovingId(null);
    }
  };

  const handleMarkPaid = async (orderId: string) => {
    setMarkingPaidId(orderId);
    try {
      const res = await fetch('/api/agent/orders/mark-paid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed To Mark Order As Paid');
      toast.success('Order Marked As Paid');
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || 'Failed To Mark Order As Paid');
    } finally {
      setMarkingPaidId(null);
    }
  };

  const handleBuyLabel = async (orderId: string) => {
    setBuyingLabelId(orderId);
    try {
      const res = await fetch('/api/agent/shipping/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed To Purchase Label');
      toast.success('Shipping Label Purchased');
      if (json.label_url) setLabelModalUrl(json.label_url);
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || 'Failed To Purchase Label');
    } finally {
      setBuyingLabelId(null);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchOrders();
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading && orders.length === 0) return <div style={{ color: 'var(--silver)' }}>Loading Orders...</div>;
  if (error) return <div style={{ color: 'var(--red)' }}>Error: {error}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div className="glass-panel stagger-fade-in" style={{ padding: 'var(--space-6)', borderRadius: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-brand)', color: 'var(--white)', fontWeight: 800, margin: 0 }}>Order Manager</h2>
            <p style={{ color: 'var(--grey-400)', fontSize: '0.85rem', marginTop: 4 }}>{totalCount} Order{totalCount !== 1 ? 's' : ''} Total</p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <button className="btn-neon-cyan" onClick={() => setShowManualOrder(true)}>Create Manual Order</button>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: 'var(--space-2)', flex: 1, minWidth: 200 }}>
            <input
              type="text"
              className="form-input"
              placeholder="Search By Order ID Or Buyer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ flex: 1, margin: 0, fontSize: '0.85rem' }}
            />
            <button type="submit" className="btn-silver" style={{ fontSize: '0.85rem' }}>Search</button>
          </form>
          <select
            className="form-input"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            style={{ margin: 0, fontSize: '0.85rem', minWidth: 180 }}
          >
            <option value="all">All Statuses</option>
            {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>

        {/* Orders Table */}
        {orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-8)', opacity: 0.5 }}>No Orders Found.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {orders.map((order) => {
              const canApprove = order.status === 'agent_approval_pending' ||
                (order.is_sub_agent_order && order.status === 'agent_approval_pending');
              const tracking = order.tracking_number;
              const carrier = carrierInfo(tracking);

              return (
                <div
                  key={order.id}
                  className="glass-panel hover-lift"
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, padding: 'var(--space-4)', cursor: 'pointer' }}
                  onClick={() => openDetail(order)}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 200px', minWidth: 0 }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Order ID</span>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#00E5FF', fontWeight: 700 }}>{order.id?.slice(0, 8)}...</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--grey-400)' }}>{new Date(order.created_at).toLocaleDateString()}</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Buyer</span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--white)', fontWeight: 600 }}>{order.buyer_name || order.profiles?.full_name || 'Unknown'}</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 100 }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Status</span>
                    <span style={{
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      color: order.status === 'delivered' ? '#00FF9D' :
                             order.status === 'cancelled' ? '#FFAAAA' :
                             order.status === 'shipped' ? 'var(--teal)' : 'var(--silver)'
                    }}>
                      {STATUS_LABEL[order.status] || order.status}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 80 }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Total</span>
                    <span style={{ color: 'var(--teal)', fontWeight: 800, fontFamily: 'monospace' }}>${Number(order.total || 0).toFixed(2)}</span>
                  </div>

                  <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
                    {canApprove && (
                      <>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <select
                            value={fulfillmentMode}
                            onChange={(e) => setFulfillmentMode(e.target.value as 'ship' | 'pickup')}
                            className="form-input"
                            style={{ margin: 0, fontSize: '0.75rem', padding: '4px 8px', minWidth: 90 }}
                          >
                            <option value="ship">Ship</option>
                            <option value="pickup">Pickup</option>
                          </select>
                          <button
                            className="btn-neon-cyan"
                            style={{ fontSize: '0.78rem', padding: '4px 12px' }}
                            onClick={() => handleApprove(order.id, fulfillmentMode)}
                            disabled={approvingId === order.id}
                          >
                            {approvingId === order.id ? 'Approving...' : 'Approve'}
                          </button>
                        </div>
                      </>
                    )}
                    {order.status === 'pending_customer_payment' && (
                      <button
                        className="btn-silver"
                        style={{ fontSize: '0.78rem', padding: '4px 12px' }}
                        onClick={() => handleMarkPaid(order.id)}
                        disabled={markingPaidId === order.id}
                      >
                        {markingPaidId === order.id ? 'Marking...' : 'Mark Paid'}
                      </button>
                    )}
                    {(order.status === 'approved_ship' || order.status === 'in_fulfillment') && !order.label_url && (
                      <button
                        className="btn-silver"
                        style={{ fontSize: '0.78rem', padding: '4px 12px' }}
                        onClick={() => handleBuyLabel(order.id)}
                        disabled={buyingLabelId === order.id}
                      >
                        {buyingLabelId === order.id ? 'Buying...' : 'Buy Label'}
                      </button>
                    )}
                    {order.label_url && (
                      <button
                        className="btn-silver"
                        style={{ fontSize: '0.78rem', padding: '4px 12px' }}
                        onClick={() => setLabelModalUrl(order.label_url)}
                      >
                        View Label
                      </button>
                    )}
                    {carrier && (
                      <IframeLink
                        href={carrier.url}
                        style={{ fontSize: '0.78rem', color: 'var(--teal)', textDecoration: 'underline', padding: '4px 0' }}
                      >
                        Track ({carrier.label})
                      </IframeLink>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 'var(--space-4)', flexWrap: 'wrap' }}>
            <button className="btn-silver" disabled={safeCurrentPage <= 1} onClick={() => setCurrentPage(1)} style={{ fontSize: '0.8rem' }}>First</button>
            <button className="btn-silver" disabled={safeCurrentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)} style={{ fontSize: '0.8rem' }}>Previous</button>
            <span style={{ color: 'var(--silver)', fontSize: '0.85rem', lineHeight: '32px' }}>Page {safeCurrentPage} Of {totalPages}</span>
            <button className="btn-silver" disabled={safeCurrentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)} style={{ fontSize: '0.8rem' }}>Next</button>
            <button className="btn-silver" disabled={safeCurrentPage >= totalPages} onClick={() => setCurrentPage(totalPages)} style={{ fontSize: '0.8rem' }}>Last</button>
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      {detailOrder && (
        <div
          style={{
            position: 'fixed',
            top: 0, right: 0, bottom: 0,
            width: 420,
            maxWidth: '100vw',
            background: 'var(--black-2)',
            borderLeft: '1px solid rgba(255,255,255,0.06)',
            zIndex: 500,
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '-8px 0 40px rgba(0,0,0,0.5)',
            overflowY: 'auto',
          }}
        >
          <div style={{ padding: 'var(--space-5)', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--white)', fontFamily: 'var(--font-brand)' }}>Order Details</h3>
            <button className="btn-silver" onClick={() => setDetailOrder(null)}>Close</button>
          </div>

          <div style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', flex: 1 }}>
            <div>
              <span style={{ fontSize: '0.72rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Order ID</span>
              <p style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: '#00E5FF', margin: '4px 0 0' }}>{detailOrder.id}</p>
            </div>

            <div>
              <span style={{ fontSize: '0.72rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</span>
              <p style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--teal)', margin: '4px 0 0' }}>{STATUS_LABEL[detailOrder.status] || detailOrder.status}</p>
            </div>

            <div>
              <span style={{ fontSize: '0.72rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Buyer</span>
              <p style={{ fontSize: '0.88rem', color: 'var(--white)', margin: '4px 0 0' }}>{detailOrder.buyer_name || detailOrder.profiles?.full_name || 'Unknown'}</p>
              {detailOrder.buyer_email && (
                <p style={{ fontSize: '0.78rem', color: 'var(--grey-400)', margin: '2px 0 0' }}>{detailOrder.buyer_email}</p>
              )}
            </div>

            <div>
              <span style={{ fontSize: '0.72rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Payment</span>
              <p style={{ fontSize: '0.88rem', color: 'var(--silver)', margin: '4px 0 0' }}>{paymentMethodLabel(detailOrder.payment_method)}</p>
            </div>

            {detailOrder.shipping_address && (
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Shipping Address</span>
                <p style={{ fontSize: '0.82rem', color: 'var(--silver)', margin: '4px 0 0', lineHeight: 1.5 }}>{formatAddress(detailOrder.shipping_address)}</p>
              </div>
            )}

            {detailLoading ? (
              <p style={{ color: 'var(--grey-400)', fontSize: '0.82rem' }}>Loading Items...</p>
            ) : detailItems.length > 0 ? (
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Line Items</span>
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {detailItems.map((item: any, i: number) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                      <span style={{ color: 'var(--silver)' }}>{item.product_name || item.name} × {item.quantity}</span>
                      <span style={{ color: 'var(--teal)', fontFamily: 'monospace' }}>${Number(item.unit_retail_price || 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', fontWeight: 700, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ color: 'var(--grey-400)' }}>Total</span>
              <span style={{ color: 'var(--teal)', fontFamily: 'monospace' }}>${Number(detailOrder.total || 0).toFixed(2)}</span>
            </div>

            {detailOrder.label_url && (
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Shipping Label</span>
                <div style={{ marginTop: 4 }}>
                  <button className="btn-silver" style={{ fontSize: '0.78rem' }} onClick={() => setLabelModalUrl(detailOrder.label_url)}>View Label</button>
                </div>
              </div>
            )}

            {detailOrder.tracking_number && (
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tracking</span>
                <p style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: 'var(--silver)', margin: '4px 0 0' }}>{detailOrder.tracking_number}</p>
                {(() => {
                  const c = carrierInfo(detailOrder.tracking_number);
                  if (!c) return null;
                  return (
                    <IframeLink href={c.url} style={{ fontSize: '0.78rem', color: 'var(--teal)', textDecoration: 'underline', marginTop: 4, display: 'block' }}>
                      Track With {c.label}
                    </IframeLink>
                  );
                })()}
              </div>
            )}

            <AgentPaymentProofs orderId={detailOrder.id} />

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(detailOrder.status === 'agent_approval_pending') && (
                <>
                  <button
                    className="btn-neon-cyan"
                    style={{ fontSize: '0.82rem' }}
                    onClick={() => handleApprove(detailOrder.id, 'ship')}
                    disabled={approvingId === detailOrder.id}
                  >
                    {approvingId === detailOrder.id ? 'Approving...' : 'Approve For Ship'}
                  </button>
                  <button
                    className="btn-silver"
                    style={{ fontSize: '0.82rem' }}
                    onClick={() => handleApprove(detailOrder.id, 'pickup')}
                    disabled={approvingId === detailOrder.id}
                  >
                    Approve For Pickup
                  </button>
                </>
              )}
              {detailOrder.status === 'pending_customer_payment' && (
                <button
                  className="btn-silver"
                  style={{ fontSize: '0.82rem' }}
                  onClick={() => handleMarkPaid(detailOrder.id)}
                  disabled={markingPaidId === detailOrder.id}
                >
                  {markingPaidId === detailOrder.id ? 'Marking...' : 'Mark Paid'}
                </button>
              )}
              {(detailOrder.status === 'approved_ship' || detailOrder.status === 'in_fulfillment') && !detailOrder.label_url && (
                <button
                  className="btn-silver"
                  style={{ fontSize: '0.82rem' }}
                  onClick={() => handleBuyLabel(detailOrder.id)}
                  disabled={buyingLabelId === detailOrder.id}
                >
                  {buyingLabelId === detailOrder.id ? 'Buying...' : 'Buy Shipping Label'}
                </button>
              )}
              <button className="btn-silver" style={{ fontSize: '0.82rem' }} onClick={handlePrint}>
                Print Packing Slip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Label IframeModal */}
      {labelModalUrl && <IframeModal url={labelModalUrl} onClose={() => setLabelModalUrl(null)} />}

      {/* Manual Order Modal */}
      {showManualOrder && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}>
          <div className="glass-panel" style={{ maxWidth: 700, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 'var(--space-6)', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
              <h3 style={{ margin: 0, color: 'var(--white)', fontFamily: 'var(--font-brand)' }}>Create Manual Order</h3>
              <button className="btn-silver" onClick={() => setShowManualOrder(false)}>Close</button>
            </div>
            <AgentManualOrder onSuccess={() => { setShowManualOrder(false); fetchOrders(); }} />
          </div>
        </div>
      )}

      <style>{`
        @media print {
          body > *:not(.print-slip) { display: none !important; }
          .print-slip { display: block !important; }
        }
      `}</style>
    </div>
  );
}
