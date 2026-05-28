'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import Pagination from '@/components/Pagination';

const PAGE_SIZE = 25;

interface BuyerProfile {
  full_name: string | null;
  email: string;
  phone: string | null;
}

interface Order {
  id: string;
  buyer_id: string;
  agent_id: string | null;
  status:
    | 'pending_customer_payment'
    | 'agent_approval_pending'
    | 'approved_ship'
    | 'approved_pickup'
    | 'in_fulfillment'
    | 'shipped'
    | 'delivered'
    | 'cancelled';
  fulfillment_method: 'ship' | 'agent_pickup' | null;
  payment_method: 'zelle' | 'cashapp' | 'venmo' | 'apple_pay';
  shipping_address: any;
  shipping_cost: number;
  subtotal: number;
  discount_amount: number | null;
  coupon_code: string | null;
  total: number;
  tracking_number: string | null;
  agent_approved_at: string | null;
  agent_approval_notes: string | null;
  created_at: string;
  profiles: BuyerProfile | null;
}

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_retail_price: number;
  unit_cost_price: number;
}

const STATUS_LABELS: Record<string, string> = {
  pending_customer_payment: 'Pending Payment',
  agent_approval_pending:   'Agent Approval Pending',
  approved_ship:            'Approved — Ship',
  approved_pickup:          'Approved — Pickup',
  in_fulfillment:           'In Fulfillment',
  shipped:                  'Shipped',
  delivered:                'Delivered',
  cancelled:                'Cancelled',
};

const STATUS_COLORS: Record<string, string> = {
  pending_customer_payment: 'var(--red)',
  agent_approval_pending:   '#F6AD55',
  approved_ship:            '#F6AD55',
  approved_pickup:          '#F6AD55',
  in_fulfillment:           'var(--teal)',
  shipped:                  'var(--teal)',
  delivered:                '#68D391',
  cancelled:                'var(--grey-400)',
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);

  // Selected Order details
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // Processing form fields
  const [trackingNumber, setTrackingNumber] = useState('');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  // User Auth
  const [userRole, setUserRole] = useState<string>('');

  useEffect(() => {
    fetchOrders();
    checkRole();
  }, []);

  async function checkRole() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (data) setUserRole(data.role);
    }
  }

  useEffect(() => {
    if (selectedOrder) {
      fetchOrderItems(selectedOrder.id);
      setTrackingNumber(selectedOrder.tracking_number || '');
      setApprovalNotes(selectedOrder.agent_approval_notes || '');
    } else {
      setItems([]);
    }
  }, [selectedOrder]);

  async function fetchOrders() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/orders');
      const json = await res.json();
      if (res.ok) {
        setOrders(json.data || []);
      } else {
        setError(json.error || 'Failed To Load Orders');
      }
    } catch (err: any) {
      setError(err.message || 'An Error Occurred While Fetching Orders');
    } finally {
      setLoading(false);
    }
  }

  async function fetchOrderItems(orderId: string) {
    setLoadingItems(true);
    try {
      const res = await fetch(`/api/admin/orders/items?orderId=${orderId}`);
      const json = await res.json();
      if (res.ok) {
        setItems(json.data || []);
      }
    } catch (err) {
      console.error('Failed to load items', err);
    } finally {
      setLoadingItems(false);
    }
  }

  async function handleStatusTransition(nextStatus: string) {
    if (!selectedOrder) return;
    setProcessing(true);

    try {
      const payload: any = {
        id: selectedOrder.id,
        status: nextStatus,
        tracking_number: nextStatus === 'shipped' ? trackingNumber : undefined,
        agent_approval_notes: approvalNotes || undefined,
      };

      const res = await fetch('/api/admin/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (res.ok) {
        // Refresh live lists
        await fetchOrders();
        // Update selected view
        setSelectedOrder(prev => prev ? { 
          ...prev, 
          status: nextStatus as any, 
          tracking_number: nextStatus === 'shipped' ? trackingNumber : prev.tracking_number,
          agent_approval_notes: approvalNotes || prev.agent_approval_notes
        } : null);
      } else {
        toast.error(json.error || 'Failed To Update Order Status');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error Processing Transition');
    } finally {
      setProcessing(false);
    }
  }

  // Filters & Search
  const filteredOrders = orders.filter(order => {
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    if (!matchesStatus) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const name = (order.profiles?.full_name || '').toLowerCase();
      const email = (order.profiles?.email || '').toLowerCase();
      const orderId = order.id.toLowerCase();
      return name.includes(q) || email.includes(q) || orderId.includes(q);
    }

    return true;
  });

  // Pagination: slice filtered set to the current page window
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedOrders = filteredOrders.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Reset to page 1 when filter or search changes
  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter]);

  return (
    <div style={{ padding: 'var(--space-8)' }}>
      {/* Header */}
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h1 style={{ fontSize: '1.6rem', marginBottom: 'var(--space-2)' }}>
          Order Fulfillment Center
        </h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--grey-400)' }}>
          Process Payments, Approve Logistics, Input Shipping Tracking, And Manage Fulfillment States
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 'var(--space-8)', alignItems: 'start' }}>
        {/* Left Side: Order List, Filter & Search */}
        <div>
          {/* Controls */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-4)',
            marginBottom: 'var(--space-6)',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            {/* Status Filter Tabs */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {[
                { id: 'all', label: 'All Orders' },
                { id: 'pending_customer_payment', label: 'Pending Payment' },
                { id: 'agent_approval_pending', label: 'Pending Approval' },
                { id: 'in_fulfillment', label: 'In Fulfillment' },
                { id: 'shipped', label: 'Shipped' },
              ].map(filter => (
                <button
                  key={filter.id}
                  onClick={() => setStatusFilter(filter.id)}
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: statusFilter === filter.id ? '#fff' : 'var(--grey-400)',
                    background: statusFilter === filter.id ? 'var(--teal)' : 'var(--black-2)',
                    border: statusFilter === filter.id ? 'none' : 'var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                  }}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div style={{ width: '100%', maxWidth: 260 }}>
              <input
                type="text"
                className="form-input"
                placeholder="Search Buyer Or Order ID..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Table list */}
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid var(--teal)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : error ? (
            <div className="disclaimer-warning" style={{ padding: 'var(--space-6)' }}>
              <p style={{ color: 'var(--red)', fontSize: '0.9rem' }}>{error}</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="card-metal" style={{ textAlign: 'center', padding: 'var(--space-12) 0' }}>
              <p style={{ color: 'var(--grey-400)', fontSize: '0.85rem' }}>No Orders Found</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {paginatedOrders.map(order => (
                <button
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className="card-metal"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: 'var(--space-4)',
                    width: '100%',
                    textAlign: 'left',
                    cursor: 'pointer',
                    background: selectedOrder?.id === order.id ? 'rgba(0,196,188,0.04)' : 'var(--surface-1)',
                    borderColor: selectedOrder?.id === order.id ? 'var(--teal)' : 'rgba(255,255,255,0.06)',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--silver)' }}>
                        {order.profiles?.full_name || 'Anonymous Researcher'}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--grey-500)' }}>
                        #{order.id.slice(0, 8)}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--grey-400)', marginTop: 4 }}>
                      {new Date(order.created_at).toLocaleDateString()} • {order.payment_method?.toUpperCase() ?? 'N/A'} • ${Number(order.total).toFixed(2)}
                    </div>
                  </div>

                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: STATUS_COLORS[order.status],
                    background: `${STATUS_COLORS[order.status]}12`,
                    border: `1px solid ${STATUS_COLORS[order.status]}30`,
                    padding: '2px var(--space-2)',
                    borderRadius: 'var(--radius-sm)',
                    textTransform: 'capitalize'
                  }}>
                    {STATUS_LABELS[order.status] || order.status}
                  </span>
                </button>
              ))}
              <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} />
            </div>
          )}
        </div>

        {/* Right Side: Order Detail Drawer */}
        <div>
          {selectedOrder ? (
            <div className="card-metal" style={{ padding: 'var(--space-6)', position: 'sticky', top: 'var(--space-6)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-5)' }}>
                <div>
                  <h3 style={{ fontSize: '1rem' }}>Order Details</h3>
                  <span style={{ fontSize: '0.72rem', color: 'var(--grey-500)' }}>ID: {selectedOrder.id}</span>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  style={{ background: 'none', border: 'none', color: 'var(--grey-400)', cursor: 'pointer', display: 'flex' }}
                  aria-label="Close Order Details"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Status Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: 'var(--space-3)',
                background: 'var(--surface-2)',
                borderRadius: 'var(--radius-md)',
                border: 'var(--border-subtle)',
                marginBottom: 'var(--space-5)'
              }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--grey-400)' }}>Fulfillment Status</span>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: STATUS_COLORS[selectedOrder.status],
                  textTransform: 'capitalize'
                }}>
                  {STATUS_LABELS[selectedOrder.status] || selectedOrder.status}
                </span>
              </div>

              {/* Customer details */}
              <div style={{ marginBottom: 'var(--space-5)' }}>
                <h4 style={{ fontSize: '0.82rem', color: 'var(--silver)', marginBottom: 'var(--space-2)' }}>Buyer Information</h4>
                <div style={{ fontSize: '0.8rem', color: 'var(--grey-400)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div>Name: {selectedOrder.profiles?.full_name || 'Anonymous'}</div>
                  <div>Username: @{selectedOrder.profiles?.email?.split('@')[0] ?? '—'}</div>
                  {selectedOrder.profiles?.phone && <div>Phone: {selectedOrder.profiles?.phone}</div>}
                </div>
              </div>

              {/* Payment Details */}
              <div style={{ marginBottom: 'var(--space-5)' }}>
                <h4 style={{ fontSize: '0.82rem', color: 'var(--silver)', marginBottom: 'var(--space-2)' }}>Payment Log</h4>
                <div style={{ fontSize: '0.8rem', color: 'var(--grey-400)' }}>
                  Method: <span style={{ textTransform: 'capitalize' }}>{selectedOrder.payment_method}</span>
                </div>
              </div>

              {/* Shipping Address */}
              {selectedOrder.fulfillment_method === 'ship' && selectedOrder.shipping_address && (
                <div style={{ marginBottom: 'var(--space-5)' }}>
                  <h4 style={{ fontSize: '0.82rem', color: 'var(--silver)', marginBottom: 'var(--space-2)' }}>Shipping Address</h4>
                  <div style={{ fontSize: '0.8rem', color: 'var(--grey-400)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {selectedOrder.shipping_address.fullName && <div>{selectedOrder.shipping_address.fullName}</div>}
                    <div>{selectedOrder.shipping_address.street}</div>
                    {selectedOrder.shipping_address.suite && <div>{selectedOrder.shipping_address.suite}</div>}
                    <div>
                      {selectedOrder.shipping_address.city}, {selectedOrder.shipping_address.state} {selectedOrder.shipping_address.zip}
                    </div>
                  </div>
                </div>
              )}

              {/* Order Items */}
              <div style={{ marginBottom: 'var(--space-6)' }}>
                <h4 style={{ fontSize: '0.82rem', color: 'var(--silver)', marginBottom: 'var(--space-3)' }}>Items Summary</h4>
                {loadingItems ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-4)' }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid var(--teal)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    {items.map(item => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <div style={{ color: 'var(--grey-300)' }}>
                          {item.product_name} <span style={{ color: 'var(--teal)' }}>x{item.quantity}</span>
                        </div>
                        <div style={{ color: 'var(--silver)', fontWeight: 600 }}>
                          ${(item.unit_retail_price * item.quantity).toFixed(2)}
                        </div>
                      </div>
                    ))}
                    {/* Totals */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--grey-400)' }}>
                        <span>Subtotal</span>
                        <span>${Number(selectedOrder.subtotal).toFixed(2)}</span>
                      </div>
                      {Number(selectedOrder.discount_amount) > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#68D391' }}>
                          <span>Coupon Discount{selectedOrder.coupon_code ? ` (${selectedOrder.coupon_code})` : ''}</span>
                          <span>-${Number(selectedOrder.discount_amount).toFixed(2)}</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--grey-400)' }}>
                        <span>Shipping Cost</span>
                        <span>${Number(selectedOrder.shipping_cost).toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem', color: 'var(--teal)', fontWeight: 700, marginTop: 2 }}>
                        <span>Total Cost</span>
                        <span>${Number(selectedOrder.total).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons Panel */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 'var(--space-5)' }}>
                <h4 style={{ fontSize: '0.82rem', color: 'var(--silver)', marginBottom: 'var(--space-4)' }}>Logistics Processing</h4>

                {processing ? (
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--teal)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    {selectedOrder.status === 'pending_customer_payment' && userRole !== 'shipping' && (
                      <button
                        onClick={() => handleStatusTransition(selectedOrder.fulfillment_method === 'agent_pickup' ? 'approved_pickup' : 'approved_ship')}
                        className="btn btn-primary"
                        style={{ width: '100%', justifyContent: 'center' }}
                      >
                        Approve Payment & Confirm Order
                      </button>
                    )}

                    {selectedOrder.status === 'agent_approval_pending' && userRole !== 'shipping' && (
                      <>
                        <div className="form-group" style={{ marginBottom: 'var(--space-2)' }}>
                          <label className="form-label">Internal Approval Notes</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Add Approval Context..."
                            value={approvalNotes}
                            onChange={e => setApprovalNotes(e.target.value)}
                          />
                        </div>
                        <button
                          onClick={() => handleStatusTransition(selectedOrder.fulfillment_method === 'agent_pickup' ? 'approved_pickup' : 'approved_ship')}
                          className="btn btn-primary"
                          style={{ width: '100%', justifyContent: 'center' }}
                        >
                          Override & Force Approve Order
                        </button>
                      </>
                    )}

                    {(selectedOrder.status === 'approved_ship' || selectedOrder.status === 'approved_pickup') && (
                      <button
                        onClick={() => handleStatusTransition('in_fulfillment')}
                        className="btn btn-primary"
                        style={{ width: '100%', justifyContent: 'center' }}
                      >
                        Initiate Store Fulfillment
                      </button>
                    )}

                    {selectedOrder.status === 'in_fulfillment' && (
                      <>
                        {selectedOrder.fulfillment_method === 'ship' && (
                          <div className="form-group" style={{ marginBottom: 'var(--space-2)' }}>
                            <label className="form-label">Carrier Tracking Number</label>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="E.g. USPS 9400..."
                              value={trackingNumber}
                              onChange={e => setTrackingNumber(e.target.value)}
                              required
                            />
                          </div>
                        )}
                        <button
                          onClick={() => handleStatusTransition('shipped')}
                          className="btn btn-primary"
                          style={{ width: '100%', justifyContent: 'center' }}
                          disabled={selectedOrder.fulfillment_method === 'ship' && !trackingNumber}
                        >
                          Mark Order Shipped
                        </button>
                      </>
                    )}

                    {selectedOrder.status === 'shipped' && (
                      <button
                        onClick={() => handleStatusTransition('delivered')}
                        className="btn btn-primary"
                        style={{ width: '100%', justifyContent: 'center', background: '#68D391', borderColor: '#68D391', color: '#fff' }}
                      >
                        Mark Order Delivered
                      </button>
                    )}

                    {/* Tracking details display */}
                    {selectedOrder.tracking_number && (
                      <div style={{
                        padding: 'var(--space-3)',
                        background: 'var(--surface-1)',
                        borderRadius: 'var(--radius-md)',
                        border: 'var(--border-subtle)',
                        fontSize: '0.78rem',
                        color: 'var(--grey-400)',
                        wordBreak: 'break-all'
                      }}>
                        Carrier Tracking: <span style={{ color: 'var(--silver)', fontWeight: 600 }}>{selectedOrder.tracking_number}</span>
                      </div>
                    )}

                    {/* Cancellation (available for any status except cancelled/delivered) */}
                    {selectedOrder.status !== 'cancelled' && selectedOrder.status !== 'delivered' && userRole !== 'shipping' && (
                      <button
                        onClick={() => {
                          if (confirm('Are You Sure You Want To Cancel This Order? This Action Cannot Be Undone.')) {
                            handleStatusTransition('cancelled');
                          }
                        }}
                        className="btn btn-secondary"
                        style={{ width: '100%', justifyContent: 'center', borderColor: 'var(--red)', color: 'var(--red)' }}
                      >
                        Cancel Order
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="card-metal" style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--grey-400)', fontSize: '0.85rem' }}>
              Select An Order From The List To View Details And Access Processing Controls.
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
