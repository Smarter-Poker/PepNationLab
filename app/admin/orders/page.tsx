'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import Pagination from '@/components/Pagination';
import { exportCSV, downloadCSV } from '@/lib/export';

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
  is_wholesale_restock: boolean | null;
  buyer_name: string | null;
  buyer_email: string | null;
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

type BulkAction =
  | 'approve_ship'
  | 'approve_pickup'
  | 'mark_shipped'
  | 'mark_delivered'
  | 'cancel'
  | 'generate_labels';

function AdminOrdersPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') ?? '');
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') ?? 'agent_approval_pending');
  const [dateFrom, setDateFrom] = useState<string>(searchParams.get('from') ?? '');
  const [dateTo, setDateTo] = useState<string>(searchParams.get('to') ?? '');
  const [wholesaleOnly, setWholesaleOnly] = useState<boolean>(searchParams.get('wholesale') === '1');
  const [page, setPage] = useState(1);

  // Selected Order details
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // Processing form fields
  const [trackingNumber, setTrackingNumber] = useState('');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkRunning, setBulkRunning] = useState(false);

  // User Auth
  const [userRole, setUserRole] = useState<string>('');

  // Cancel modal state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  function openCancelModal() {
    if (!selectedOrder) return;
    setCancelReason('');
    setShowCancelModal(true);
  }

  async function submitCancel() {
    if (!selectedOrder) return;
    if (!cancelReason.trim()) {
      toast.error('Reason Is Required');
      return;
    }
    setCancelSubmitting(true);
    try {
      const res = await fetch(`/api/admin/orders/${selectedOrder.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // All sales are final — no refund_type param. The API always uses 'none'.
        body: JSON.stringify({ reason: cancelReason.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Cancel Failed');
      toast.success('Order Cancelled');
      setShowCancelModal(false);
      setSelectedOrder((prev) => prev ? ({ ...prev, status: 'cancelled' as any }) : null);
      await fetchOrders();
    } catch (e: any) {
      toast.error(e.message || 'Cancel Failed');
    } finally {
      setCancelSubmitting(false);
    }
  }

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

  function toggleId(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkAction(action: BulkAction) {
    if (selectedIds.size === 0 || bulkRunning) return;
    const ids = Array.from(selectedIds);
    const labelMap: Record<BulkAction, string> = {
      approve_ship: 'Approving (Ship)',
      approve_pickup: 'Approving (Pickup)',
      mark_shipped: 'Marking Shipped',
      mark_delivered: 'Marking Delivered',
      cancel: 'Cancelling',
      generate_labels: 'Generating Labels',
    };
    if (action === 'cancel' && !confirm(`Cancel ${ids.length} Order(s)? This Cannot Be Undone.`)) return;

    setBulkRunning(true);
    const progressToast = toast.loading(`${labelMap[action]} ${ids.length} Order(s)...`);
    try {
      const res = await fetch('/api/admin/orders/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, action }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Bulk Action Failed', { id: progressToast });
        return;
      }
      const succeeded = json.succeeded ?? 0;
      const failedCount = (json.failed ?? []).length;
      if (failedCount === 0) {
        toast.success(`${labelMap[action]}: ${succeeded} Of ${ids.length} Succeeded.`, { id: progressToast });
      } else {
        toast.warning(`${labelMap[action]}: ${succeeded} Succeeded, ${failedCount} Failed.`, { id: progressToast });
        // Show first 5 failures for quick triage.
        for (const f of (json.failed as Array<{ id: string; reason: string }>).slice(0, 5)) {
          toast.error(`${f.id.slice(0, 8)}: ${f.reason}`);
        }
      }

      if (action === 'generate_labels' && Array.isArray(json.labels)) {
        // Open each label PDF in a new tab with a small gap between opens so
        // browsers don't treat the burst as a popup attack.
        for (let i = 0; i < json.labels.length; i++) {
          const url = json.labels[i].label_url;
          setTimeout(() => {
            window.open(url, '_blank', 'noopener,noreferrer');
          }, i * 250);
        }
      }

      setSelectedIds(new Set());
      await fetchOrders();
    } catch (err: any) {
      toast.error(err.message || 'Bulk Action Failed', { id: progressToast });
    } finally {
      setBulkRunning(false);
    }
  }

  // Persist filter state to URL params so refresh + share-URL works.
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
    if (dateFrom) params.set('from', dateFrom);
    if (dateTo) params.set('to', dateTo);
    if (wholesaleOnly) params.set('wholesale', '1');
    const qs = params.toString();
    const url = qs ? `/admin/orders?${qs}` : '/admin/orders';
    router.replace(url, { scroll: false });
  }, [searchQuery, statusFilter, dateFrom, dateTo, wholesaleOnly, router]);

  // Filters & Search
  const filteredOrders = useMemo(() => {
    const fromMs = dateFrom ? new Date(dateFrom).getTime() : null;
    // end-of-day for "to" so YYYY-MM-DD matches the whole day
    const toMs = dateTo ? new Date(dateTo).getTime() + 86399999 : null;
    return orders.filter(order => {
      if (statusFilter !== 'all' && order.status !== statusFilter) return false;
      if (wholesaleOnly && !order.is_wholesale_restock) return false;
      const createdMs = new Date(order.created_at).getTime();
      if (fromMs !== null && createdMs < fromMs) return false;
      if (toMs !== null && createdMs > toMs) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const name = (order.profiles?.full_name || order.buyer_name || '').toLowerCase();
        const email = (order.profiles?.email || order.buyer_email || '').toLowerCase();
        const orderId = order.id.toLowerCase();
        const tracking = (order.tracking_number || '').toLowerCase();
        if (!(name.includes(q) || email.includes(q) || orderId.includes(q) || tracking.includes(q))) return false;
      }
      return true;
    });
  }, [orders, statusFilter, wholesaleOnly, dateFrom, dateTo, searchQuery]);

  // Pagination: slice filtered set to the current page window
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedOrders = filteredOrders.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Reset to page 1 when filter or search changes
  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, dateFrom, dateTo, wholesaleOnly]);

  function resetFilters() {
    setSearchQuery('');
    setStatusFilter('all');
    setDateFrom('');
    setDateTo('');
    setWholesaleOnly(false);
  }

  return (
    <div style={{ padding: 'var(--space-8)' }}>
      {/* Header */}
      <div style={{ marginBottom: 'var(--space-8)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', marginBottom: 'var(--space-2)' }}>
            Order Fulfillment Center
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--grey-400)' }}>
            Process Payments, Approve Logistics, Input Shipping Tracking, And Manage Fulfillment States
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={filteredOrders.length === 0}
          onClick={() => {
            const rows = filteredOrders.map((o) => ({
              id: o.id,
              created_at: new Date(o.created_at).toISOString(),
              buyer: o.profiles?.full_name || o.profiles?.email || '',
              status: STATUS_LABELS[o.status] ?? o.status,
              fulfillment: o.fulfillment_method || '',
              payment_method: o.payment_method || '',
              subtotal: Number(o.subtotal ?? 0).toFixed(2),
              shipping_cost: Number(o.shipping_cost ?? 0).toFixed(2),
              discount: Number(o.discount_amount ?? 0).toFixed(2),
              coupon: o.coupon_code || '',
              total: Number(o.total ?? 0).toFixed(2),
              tracking_number: o.tracking_number || '',
            }));
            const csv = exportCSV(rows, [
              { key: 'id', label: 'Order ID' },
              { key: 'created_at', label: 'Date' },
              { key: 'buyer', label: 'Buyer' },
              { key: 'status', label: 'Status' },
              { key: 'fulfillment', label: 'Fulfillment' },
              { key: 'payment_method', label: 'Payment Method' },
              { key: 'subtotal', label: 'Subtotal' },
              { key: 'shipping_cost', label: 'Shipping' },
              { key: 'discount', label: 'Discount' },
              { key: 'coupon', label: 'Coupon' },
              { key: 'total', label: 'Total' },
              { key: 'tracking_number', label: 'Tracking' },
            ]);
            downloadCSV(`admin_orders_${new Date().toISOString().slice(0, 10)}.csv`, csv);
          }}
        >
          Export CSV
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: 'var(--space-6)', alignItems: 'start' }}>
        {/* Left Side: Order List, Filter & Search */}
        <div>
          {/* Controls */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'var(--space-3)',
              marginBottom: 'var(--space-6)',
              alignItems: 'flex-end',
              padding: 'var(--space-4)',
              background: 'var(--surface-1)',
              border: 'var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <div style={{ flex: '2 1 240px', minWidth: 180 }}>
              <label className="form-label" style={{ fontSize: '0.7rem' }}>Search</label>
              <input
                type="text"
                className="form-input"
                placeholder="Buyer Name, Email, Order ID, Tracking..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            <div style={{ flex: '1 1 160px', minWidth: 140 }}>
              <label className="form-label" style={{ fontSize: '0.7rem' }}>Status</label>
              <select
                className="form-input"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="pending_customer_payment">Pending Customer Payment</option>
                <option value="agent_approval_pending">Agent Approval Pending</option>
                <option value="approved_ship">Approved Ship</option>
                <option value="approved_pickup">Approved Pickup</option>
                <option value="in_fulfillment">In Fulfillment</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div style={{ flex: '1 1 130px', minWidth: 120 }}>
              <label className="form-label" style={{ fontSize: '0.7rem' }}>From Date</label>
              <input
                type="date"
                className="form-input"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
              />
            </div>

            <div style={{ flex: '1 1 130px', minWidth: 120 }}>
              <label className="form-label" style={{ fontSize: '0.7rem' }}>To Date</label>
              <input
                type="date"
                className="form-input"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
              />
            </div>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: '0.78rem',
                color: 'var(--silver)',
                cursor: 'pointer',
                padding: 'var(--space-2) var(--space-3)',
                background: 'var(--surface-2)',
                border: 'var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                whiteSpace: 'nowrap',
              }}
            >
              <input
                type="checkbox"
                checked={wholesaleOnly}
                onChange={e => setWholesaleOnly(e.target.checked)}
                style={{ accentColor: 'var(--teal)' }}
              />
              Wholesale Only
            </label>

            <button
              type="button"
              onClick={resetFilters}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.78rem' }}
            >
              Reset
            </button>
          </div>

          {/* Sticky Bulk Action Bar (visible when selection is non-empty) */}
          {selectedIds.size > 0 && (
            <div
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 5,
                marginBottom: 'var(--space-4)',
                padding: 'var(--space-3) var(--space-4)',
                background: 'var(--surface-2)',
                border: '1px solid var(--teal)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 'var(--space-3)',
                boxShadow: 'var(--shadow-teal-sm)',
              }}
            >
              <span style={{ fontSize: '0.85rem', color: 'var(--white)', fontWeight: 600 }}>
                {selectedIds.size} Selected
              </span>
              <button
                type="button"
                onClick={() => handleBulkAction('approve_ship')}
                disabled={bulkRunning}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.78rem' }}
              >
                Approve (Ship)
              </button>
              <button
                type="button"
                onClick={() => handleBulkAction('approve_pickup')}
                disabled={bulkRunning}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.78rem' }}
              >
                Approve (Pickup)
              </button>
              <button
                type="button"
                onClick={() => handleBulkAction('mark_shipped')}
                disabled={bulkRunning}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.78rem' }}
              >
                Mark Shipped
              </button>
              <button
                type="button"
                onClick={() => handleBulkAction('mark_delivered')}
                disabled={bulkRunning}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.78rem' }}
              >
                Mark Delivered
              </button>
              <button
                type="button"
                onClick={() => handleBulkAction('generate_labels')}
                disabled={bulkRunning}
                className="btn btn-primary btn-sm"
                style={{ fontSize: '0.78rem' }}
              >
                Generate Labels
              </button>
              <button
                type="button"
                onClick={() => handleBulkAction('cancel')}
                disabled={bulkRunning}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.78rem', borderColor: 'var(--red)', color: 'var(--red)' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                disabled={bulkRunning}
                style={{
                  marginLeft: 'auto',
                  background: 'none',
                  border: 'none',
                  color: 'var(--grey-400)',
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                  textDecoration: 'underline',
                }}
              >
                Clear Selection
              </button>
            </div>
          )}

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
              {/* Master "Select All On Page" */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  padding: '4px var(--space-2)',
                  fontSize: '0.78rem',
                  color: 'var(--grey-400)',
                }}
              >
                <input
                  type="checkbox"
                  checked={
                    paginatedOrders.length > 0
                    && paginatedOrders.every((o) => selectedIds.has(o.id))
                  }
                  onChange={(e) => {
                    setSelectedIds((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) {
                        for (const o of paginatedOrders) next.add(o.id);
                      } else {
                        for (const o of paginatedOrders) next.delete(o.id);
                      }
                      return next;
                    });
                  }}
                  aria-label="Select All On Page"
                />
                <span>Select All On Page</span>
              </div>
              {paginatedOrders.map(order => (
                <div
                  key={order.id}
                  className="card-metal"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-4)',
                    width: '100%',
                    cursor: 'pointer',
                    background: selectedOrder?.id === order.id ? 'rgba(192,184,168,0.04)' : 'var(--surface-1)',
                    borderColor: selectedOrder?.id === order.id ? 'var(--teal)' : 'rgba(255,255,255,0.06)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(order.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggleId(order.id);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Select Order ${order.id.slice(0, 8)}`}
                    style={{ accentColor: 'var(--teal)', flexShrink: 0 }}
                  />
                <button
                  onClick={() => setSelectedOrder(order)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    width: '100%',
                    textAlign: 'left',
                    background: 'transparent',
                    border: 'none',
                    color: 'inherit',
                    padding: 0,
                    cursor: 'pointer',
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
                </div>
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
                        onClick={openCancelModal}
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
      {/* Cancel Modal */}
      {showCancelModal && selectedOrder && (
        <div
          onClick={() => !cancelSubmitting && setShowCancelModal(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 'var(--space-4)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card-metal"
            style={{ padding: 'var(--space-6)', maxWidth: 480, width: '100%' }}
          >
            <h2 style={{ fontSize: '1.1rem', marginBottom: 'var(--space-2)' }}>Cancel Order</h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--grey-400)', marginBottom: 'var(--space-4)' }}>
              Order Total ${Number(selectedOrder.total).toFixed(2)}. All Sales Are Final — This Action Cannot Be Undone.
            </p>

            <div className="form-group" style={{ marginBottom: 'var(--space-5)' }}>
              <label className="form-label">Reason</label>
              <textarea
                className="form-input"
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Researcher Request, Payment Failed, Inventory Issue..."
              />
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowCancelModal(false)} disabled={cancelSubmitting}>
                Keep Order
              </button>
              <button className="btn btn-primary" onClick={submitCancel} disabled={cancelSubmitting} style={{ background: 'var(--red)', borderColor: 'var(--red)' }}>
                {cancelSubmitting ? 'Cancelling...' : 'Cancel Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default function AdminOrdersPage() {
  return (
    <Suspense fallback={
      <div style={{ padding: 'var(--space-8)' }}>
        <p style={{ fontSize: '0.85rem', color: 'var(--grey-400)' }}>Loading Orders...</p>
      </div>
    }>
      <AdminOrdersPageInner />
    </Suspense>
  );
}
