"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import Pagination from "@/components/Pagination";
import { exportCSV, downloadCSV } from "@/lib/export";
import { paymentMethodLabel, type PaymentMethodSlug } from "@/lib/payment-method-labels";
import IframeModal from "@/components/ui/IframeModal";
import { getRealEmail, getOrderEmail } from '@/lib/profile-utils';

const PAGE_SIZE = 25;

interface BuyerProfile {
  full_name: string | null;
  email: string;
  contact_email: string | null;
  phone: string | null;
}

interface Order {
  id: string;
  buyer_id: string;
  agent_id: string | null;
  status:
    | "pending_customer_payment"
    | "agent_approval_pending"
    | "admin_approval_pending"
    | "approved_ship"
    | "approved_pickup"
    | "in_fulfillment"
    | "shipped"
    | "delivered"
    | "cancelled";
  fulfillment_method: "ship" | "agent_pickup" | null;
  payment_method: PaymentMethodSlug | string;
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
  agent?: {
    parent?: {
      full_name: string | null;
    } | null;
  } | null;
}

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_retail_price: number;
  unit_cost_price: number;
  unit_super_agent_cost?: number;
  unit_size?: string | null;
  unit_measure?: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  pending_customer_payment: "Pending Payment",
  agent_approval_pending: "Agent Approval Pending",
  admin_approval_pending: "Admin Approval Pending",
  approved_ship: "Approved - Ship",
  approved_pickup: "Approved - Pickup",
  in_fulfillment: "In Fulfillment",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<string, string> = {
  pending_customer_payment: "var(--red)",
  agent_approval_pending: "#00E5FF",
  admin_approval_pending: "var(--red)",
  approved_ship: "#00E5FF",
  approved_pickup: "#00E5FF",
  in_fulfillment: "var(--teal)",
  shipped: "var(--teal)",
  delivered: "#68D391",
  cancelled: "var(--grey-400)",
};

type BulkAction =
  | "approve_ship"
  | "approve_pickup"
  | "mark_shipped"
  | "mark_delivered"
  | "cancel"
  | "generate_labels";

function AdminOrdersPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") ?? "");
  const [statusFilter, setStatusFilter] = useState<string>(
    searchParams.get("status") ?? "all",
  );
  const [dateFrom, setDateFrom] = useState<string>(
    searchParams.get("from") ?? "",
  );
  const [dateTo, setDateTo] = useState<string>(searchParams.get("to") ?? "");
  const [wholesaleOnly, setWholesaleOnly] = useState<boolean>(
    searchParams.get("wholesale") === "1",
  );
  const [page, setPage] = useState(1);

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const [trackingNumber, setTrackingNumber] = useState("");
  const [approvalNotes, setApprovalNotes] = useState("");
  const [processing, setProcessing] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkRunning, setBulkRunning] = useState(false);

  const [userRole, setUserRole] = useState<string>("");

  const [labelModalUrl, setLabelModalUrl] = useState<string | null>(null);

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  const [showBulkCancelConfirm, setShowBulkCancelConfirm] = useState(false);
  const [pendingBulkIds, setPendingBulkIds] = useState<string[]>([]);

  function openCancelModal() {
    if (!selectedOrder) return;
    setCancelReason("");
    setShowCancelModal(true);
  }

  async function submitCancel() {
    if (!selectedOrder) return;
    if (!cancelReason.trim()) {
      toast.error("Reason Is Required");
      return;
    }
    setCancelSubmitting(true);
    try {
      const res = await fetch(`/api/admin/orders/${selectedOrder.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Cancel Failed");
      toast.success("Order Cancelled");
      setShowCancelModal(false);
      setSelectedOrder((prev) =>
        prev ? { ...prev, status: "cancelled" as any } : null,
      );
      await fetchOrders();
    } catch (e: any) {
      toast.error(e.message || "Cancel Failed");
    } finally {
      setCancelSubmitting(false);
    }
  }

  useEffect(() => {
    fetchOrders();
    checkRole();
  }, []);

  async function checkRole() {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
        if (data) setUserRole(data.role);
      }
    } catch (err) {
      // non-fatal - default to empty role
    }
  }

  useEffect(() => {
    if (selectedOrder) {
      fetchOrderItems(selectedOrder.id);
      setTrackingNumber(selectedOrder.tracking_number || "");
      setApprovalNotes(selectedOrder.agent_approval_notes || "");
    } else {
      setItems([]);
    }
  }, [selectedOrder]);

  async function fetchOrders() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/orders");
      const json = await res.json();
      if (res.ok) {
        setOrders(json.data || []);
      } else {
        setError(json.error || "Failed To Load Orders");
      }
    } catch (err: any) {
      setError(err.message || "An Error Occurred While Fetching Orders");
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
      } else {
        toast.error(json.error || 'Failed To Load Order Items.');
      }
    } catch (err) {
      toast.error('Failed To Load Order Items. Check Your Connection.');
    } finally {
      setLoadingItems(false);
    }
  }

  function printOrderReceipt() {
    if (!selectedOrder) return;
    const addr = selectedOrder.shipping_address;
    const orderDate = new Date(selectedOrder.created_at).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
    const statusLabel = STATUS_LABELS[selectedOrder.status] ?? selectedOrder.status;

    const itemRows = items.map((item) => {
      const dosage = item.unit_size ? `${item.unit_size}${item.unit_measure || 'mg'}` : '';
      const lineTotal = (item.unit_retail_price * item.quantity).toFixed(2);
      return `
        <tr>
          <td style="padding:8px 4px;border-bottom:1px solid #e5e7eb;">
            <strong>${item.product_name}</strong>${dosage ? `<span style="color:#0891b2;font-weight:700;margin-left:6px;">${dosage}</span>` : ''}
          </td>
          <td style="padding:8px 4px;border-bottom:1px solid #e5e7eb;text-align:center;">${item.quantity}</td>
          <td style="padding:8px 4px;border-bottom:1px solid #e5e7eb;text-align:right;">$${item.unit_retail_price.toFixed(2)}</td>
          <td style="padding:8px 4px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">$${lineTotal}</td>
        </tr>`;
    }).join('');

    const shippingBlock = addr ? `
      <div style="margin-top:20px;padding:14px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
        <div style="font-size:11px;font-weight:700;color:#6b7280;letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px;">Ship To</div>
        ${addr.fullName ? `<div style="font-weight:600;">${addr.fullName}</div>` : ''}
        <div>${addr.street || ''}</div>
        ${addr.suite ? `<div>${addr.suite}</div>` : ''}
        <div>${addr.city || ''}, ${addr.state || ''} ${addr.zip || ''}</div>
      </div>` : '';

    const discountRow = Number(selectedOrder.discount_amount) > 0 ? `
      <tr>
        <td colspan="3" style="padding:4px 0;text-align:right;color:#16a34a;">Coupon Discount${selectedOrder.coupon_code ? ` (${selectedOrder.coupon_code})` : ''}</td>
        <td style="padding:4px 0;text-align:right;color:#16a34a;">-$${Number(selectedOrder.discount_amount).toFixed(2)}</td>
      </tr>` : '';

    const trackingRow = selectedOrder.tracking_number ? `
      <div style="margin-top:16px;padding:12px;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;font-size:12px;">
        <span style="font-weight:700;color:#166534;">Tracking #:</span> ${selectedOrder.tracking_number}
      </div>` : '';

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>PepNation Lab — Order Receipt #${selectedOrder.id.slice(0, 8).toUpperCase()}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 13px; color: #111827; background: #fff; padding: 32px; }
    @media print {
      body { padding: 16px; }
      .no-print { display: none !important; }
    }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 2px solid #111827; }
    .logo { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; color: #111827; }
    .logo span { color: #0891b2; }
    .order-meta { text-align: right; font-size: 11px; color: #6b7280; }
    .order-meta strong { display: block; font-size: 15px; color: #111827; margin-bottom: 4px; }
    .section-label { font-size: 11px; font-weight: 700; color: #6b7280; letter-spacing: .08em; text-transform: uppercase; margin-bottom: 8px; margin-top: 20px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    thead th { font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: .06em; padding: 6px 4px; border-bottom: 2px solid #e5e7eb; }
    thead th:first-child { text-align: left; }
    thead th:not(:first-child) { text-align: right; }
    thead th:nth-child(2) { text-align: center; }
    .totals-table td { padding: 4px 0; }
    .total-row { font-size: 15px; font-weight: 800; color: #0891b2; border-top: 2px solid #111827; }
    .total-row td { padding-top: 10px; }
    .status-badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; background: #cffafe; color: #0891b2; }
    .footer { margin-top: 36px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center; }
    .print-btn { margin-bottom: 24px; padding: 10px 24px; background: #0891b2; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 700; cursor: pointer; }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom:20px;">
    <button class="print-btn" onclick="window.print()">🖨️ Print / Save PDF</button>
  </div>
  <div class="header">
    <div>
      <div class="logo">Pep<span>Nation</span>Lab</div>
      <div style="font-size:11px;color:#6b7280;margin-top:4px;">pepnationlab.com</div>
    </div>
    <div class="order-meta">
      <strong>Order Receipt</strong>
      Order #${selectedOrder.id.slice(0, 8).toUpperCase()}<br>
      Date: ${orderDate}<br>
      <span class="status-badge" style="margin-top:4px;display:inline-block;">${statusLabel}</span>
    </div>
  </div>

  <div style="display:flex;gap:32px;">
    <div style="flex:1;">
      <div class="section-label">Buyer Information</div>
      <div style="font-weight:600;">${selectedOrder.buyer_name || selectedOrder.profiles?.full_name || '—'}</div>
      <div style="color:#6b7280;">${getOrderEmail(selectedOrder) || '—'}</div>
    </div>
    <div style="flex:1;">
      <div class="section-label">Payment</div>
      <div>${paymentMethodLabel(selectedOrder.payment_method as PaymentMethodSlug)}</div>
    </div>
  </div>

  ${shippingBlock}

  <div class="section-label" style="margin-top:24px;">Items Ordered</div>
  <table>
    <thead>
      <tr>
        <th>Product</th>
        <th style="text-align:center;">Qty</th>
        <th style="text-align:right;">Unit Price</th>
        <th style="text-align:right;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <table class="totals-table" style="margin-top:12px;">
    <tbody>
      <tr>
        <td colspan="3" style="text-align:right;color:#6b7280;">Subtotal</td>
        <td style="text-align:right;">$${Number(selectedOrder.subtotal).toFixed(2)}</td>
      </tr>
      ${discountRow}
      <tr>
        <td colspan="3" style="text-align:right;color:#6b7280;">Shipping</td>
        <td style="text-align:right;">$${Number(selectedOrder.shipping_cost).toFixed(2)}</td>
      </tr>
      <tr class="total-row">
        <td colspan="3" style="text-align:right;">Total</td>
        <td style="text-align:right;">$${Number(selectedOrder.total).toFixed(2)}</td>
      </tr>
    </tbody>
  </table>

  ${trackingRow}

  <div class="footer">
    PepNationLab &bull; Internal Fulfillment Receipt &bull; Printed ${new Date().toLocaleString()}
  </div>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=780,height=900,scrollbars=yes');
    if (!win) { toast.error('Pop-up blocked — please allow pop-ups for this page.'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
  }

  async function handleStatusTransition(nextStatus: string) {
    if (!selectedOrder) return;
    setProcessing(true);

    try {
      const payload: any = {
        id: selectedOrder.id,
        status: nextStatus,
        tracking_number: nextStatus === "shipped" ? trackingNumber : undefined,
        agent_approval_notes: approvalNotes || undefined,
      };

      const res = await fetch("/api/admin/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (res.ok) {
        await fetchOrders();
        setSelectedOrder((prev) =>
          prev
            ? {
                ...prev,
                status: nextStatus as any,
                tracking_number:
                  nextStatus === "shipped"
                    ? trackingNumber
                    : prev.tracking_number,
                agent_approval_notes:
                  approvalNotes || prev.agent_approval_notes,
              }
            : null,
        );
      } else {
        toast.error(json.error || "Failed To Update Order Status");
      }
    } catch (err: any) {
      toast.error(err.message || "Error Processing Transition");
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
      approve_ship: "Approving (Ship)",
      approve_pickup: "Approving (Pickup)",
      mark_shipped: "Marking Shipped",
      mark_delivered: "Marking Delivered",
      cancel: "Cancelling",
      generate_labels: "Generating Labels",
    };
    if (action === "cancel") {
      setPendingBulkIds(ids);
      setShowBulkCancelConfirm(true);
      return;
    }

    // Confirm the actions that spend money or are irreversible. generate_labels
    // buys a real (billable) EasyPost label per order; mark_delivered is a
    // terminal state with no undo. A mis-click on a large selection would
    // otherwise purchase dozens of labels or terminally close dozens of orders.
    if (action === "generate_labels" || action === "mark_delivered") {
      const confirmMsg =
        action === "generate_labels"
          ? `Purchase Shipping Labels For ${ids.length} Order(s)? This Spends Real Money, One Billable Label Per Order.`
          : `Mark ${ids.length} Order(s) Delivered? This Is A Final State And Cannot Be Undone.`;
      if (typeof window !== "undefined" && !window.confirm(confirmMsg)) {
        return;
      }
    }

    setBulkRunning(true);
    const progressToast = toast.loading(
      `${labelMap[action]} ${ids.length} Order(s)...`,
    );
    try {
      const res = await fetch("/api/admin/orders/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Bulk Action Failed", { id: progressToast });
        return;
      }
      const succeeded = json.succeeded ?? 0;
      const failedCount = (json.failed ?? []).length;
      if (failedCount === 0) {
        toast.success(
          `${labelMap[action]}: ${succeeded} Of ${ids.length} Succeeded.`,
          { id: progressToast },
        );
      } else {
        toast.warning(
          `${labelMap[action]}: ${succeeded} Succeeded, ${failedCount} Failed.`,
          { id: progressToast },
        );
        for (const f of (
          json.failed as Array<{ id: string; reason: string }>
        ).slice(0, 5)) {
          toast.error(`${f.id.slice(0, 8)}: ${f.reason}`);
        }
      }

      if (action === "generate_labels" && Array.isArray(json.labels) && json.labels.length > 0) {
        setLabelModalUrl(json.labels[0].label_url);
      }

      setSelectedIds(new Set());
      await fetchOrders();
    } catch (err: any) {
      toast.error(err.message || "Bulk Action Failed", { id: progressToast });
    } finally {
      setBulkRunning(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("q", searchQuery);
    if (statusFilter && statusFilter !== "all")
      params.set("status", statusFilter);
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    if (wholesaleOnly) params.set("wholesale", "1");
    const qs = params.toString();
    const url = qs ? `/admin/orders?${qs}` : "/admin/orders";
    router.replace(url, { scroll: false });
  }, [searchQuery, statusFilter, dateFrom, dateTo, wholesaleOnly, router]);

  const filteredOrders = useMemo(() => {
    const fromMs = dateFrom ? new Date(dateFrom).getTime() : null;
    const toMs = dateTo ? new Date(dateTo).getTime() + 86399999 : null;
    return orders.filter((order) => {
      if (statusFilter !== "all" && order.status !== statusFilter) return false;
      if (wholesaleOnly && !order.is_wholesale_restock) return false;
      const createdMs = new Date(order.created_at).getTime();
      if (fromMs !== null && createdMs < fromMs) return false;
      if (toMs !== null && createdMs > toMs) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const name = (
          order.profiles?.full_name ||
          order.buyer_name ||
          ""
        ).toLowerCase();
        const email = (
          (getOrderEmail(order) || '') ||
          ""
        ).toLowerCase();
        const orderId = order.id.toLowerCase();
        const tracking = (order.tracking_number || "").toLowerCase();
        if (
          !(
            name.includes(q) ||
            email.includes(q) ||
            orderId.includes(q) ||
            tracking.includes(q)
          )
        )
          return false;
      }
      return true;
    });
  }, [orders, statusFilter, wholesaleOnly, dateFrom, dateTo, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedOrders = filteredOrders.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, dateFrom, dateTo, wholesaleOnly]);

  function resetFilters() {
    setSearchQuery("");
    setStatusFilter("all");
    setDateFrom("");
    setDateTo("");
    setWholesaleOnly(false);
  }

  function shiftWeek(direction: 1 | -1) {
    const fromDate = dateFrom ? new Date(dateFrom) : new Date();
    const toDate = dateTo ? new Date(dateTo) : new Date(fromDate.getTime() + 6 * 86400000);
    
    // Add direction * 7 days
    fromDate.setDate(fromDate.getDate() + direction * 7);
    toDate.setDate(toDate.getDate() + direction * 7);

    setDateFrom(fromDate.toISOString().slice(0, 10));
    setDateTo(toDate.toISOString().slice(0, 10));
  }

  return (
    <div style={{ padding: "var(--space-8)" }}>
      {labelModalUrl && (
        <IframeModal url={labelModalUrl} title="Shipping Label" onClose={() => setLabelModalUrl(null)} />
      )}
      {/* Header */}
      <div
        style={{
          marginBottom: "var(--space-8)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "var(--space-4)",
        }}
      >
        <div>
          <h1 className="animated-gradient-text" style={{ fontSize: "1.6rem", marginBottom: "var(--space-2)" }}>
            Order Fulfillment Center
          </h1>
          <p style={{ fontSize: "0.85rem", color: "var(--grey-400)" }}>
            Process Payments, Approve Logistics, Input Shipping Tracking, And
            Manage Fulfillment States
          </p>
        </div>
        <button
          type="button"
          className="btn-silver"
          style={{ padding: "6px 12px", fontSize: "0.75rem" }}
          disabled={filteredOrders.length === 0}
          onClick={() => {
            const rows = filteredOrders.map((o) => ({
              id: o.id,
              created_at: new Date(o.created_at).toISOString(),
              buyer: o.profiles?.full_name || o.buyer_name || getOrderEmail(o) || "",
              status: STATUS_LABELS[o.status] ?? o.status,
              fulfillment: o.fulfillment_method || "",
              payment_method: o.payment_method || "",
              subtotal: Number(o.subtotal ?? 0).toFixed(2),
              shipping_cost: Number(o.shipping_cost ?? 0).toFixed(2),
              discount: Number(o.discount_amount ?? 0).toFixed(2),
              coupon: o.coupon_code || "",
              total: Number(o.total ?? 0).toFixed(2),
              tracking_number: o.tracking_number || "",
            }));
            const csv = exportCSV(rows, [
              { key: "id", label: "Order ID" },
              { key: "created_at", label: "Date" },
              { key: "buyer", label: "Buyer" },
              { key: "status", label: "Status" },
              { key: "fulfillment", label: "Fulfillment" },
              { key: "payment_method", label: "Payment Method" },
              { key: "subtotal", label: "Subtotal" },
              { key: "shipping_cost", label: "Shipping" },
              { key: "discount", label: "Discount" },
              { key: "coupon", label: "Coupon" },
              { key: "total", label: "Total" },
              { key: "tracking_number", label: "Tracking" },
            ]);
            downloadCSV(
              `admin_orders_${new Date().toISOString().slice(0, 10)}.csv`,
              csv,
            );
          }}
        >
          Export CSV
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
          gap: "var(--space-6)",
          alignItems: "start",
        }}
      >
        {/* Left Side: Order List, Filter & Search */}
        <div>
          {/* Controls */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "var(--space-3)",
              marginBottom: "var(--space-6)",
              alignItems: "flex-end",
              padding: "var(--space-4)",
              background: "var(--surface-1)",
              border: "var(--border-subtle)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <div style={{ flex: "2 1 240px", minWidth: 180 }}>
              <label className="form-label" style={{ fontSize: "0.7rem" }}>
                Search
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="Buyer Name, Email, Order ID, Tracking..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div style={{ flex: "1 1 160px", minWidth: 140 }}>
              <label className="form-label" style={{ fontSize: "0.7rem" }}>
                Status
              </label>
              <select
                className="form-input"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="pending_customer_payment">
                  Pending Customer Payment
                </option>
                <option value="agent_approval_pending">
                  Agent Approval Pending
                </option>
                <option value="admin_approval_pending">
                  Admin Approval Pending
                </option>
                <option value="approved_ship">Approved Ship</option>
                <option value="approved_pickup">Approved Pickup</option>
                <option value="in_fulfillment">In Fulfillment</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div style={{ flex: "1 1 130px", minWidth: 120 }}>
              <label className="form-label" style={{ fontSize: "0.7rem" }}>
                From Date
              </label>
              <input
                type="date"
                className="form-input"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div style={{ flex: "1 1 130px", minWidth: 120 }}>
              <label className="form-label" style={{ fontSize: "0.7rem" }}>
                To Date
              </label>
              <input
                type="date"
                className="form-input"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>

            <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
              <button
                className="btn btn-outline"
                style={{ padding: "0.4rem 0.6rem", fontSize: "0.8rem", height: "38px" }}
                onClick={() => shiftWeek(-1)}
                title="Previous 7 Days"
              >
                &larr; Prev Week
              </button>
              <button
                className="btn btn-outline"
                style={{ padding: "0.4rem 0.6rem", fontSize: "0.8rem", height: "38px" }}
                onClick={() => shiftWeek(1)}
                title="Next 7 Days"
              >
                Next Week &rarr;
              </button>
            </div>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: "0.78rem",
                color: "var(--silver)",
                cursor: "pointer",
                padding: "var(--space-2) var(--space-3)",
                background: "var(--surface-2)",
                border: "var(--border-subtle)",
                borderRadius: "var(--radius-sm)",
                whiteSpace: "nowrap",
              }}
            >
              <input
                type="checkbox"
                checked={wholesaleOnly}
                onChange={(e) => setWholesaleOnly(e.target.checked)}
                style={{ accentColor: "var(--teal)" }}
              />
              Wholesale Only
            </label>

            <button
              type="button"
              onClick={resetFilters}
              className="btn-silver"
              style={{ padding: "6px 12px", fontSize: "0.78rem" }}
            >
              Reset
            </button>
          </div>

          {/* Sticky Bulk Action Bar */}
          {selectedIds.size > 0 && (
            <div
              className="glass-header"
              style={{
                position: "sticky",
                top: 0,
                zIndex: 5,
                marginBottom: "var(--space-4)",
                padding: "var(--space-3) var(--space-4)",
                background: "var(--surface-2)",
                border: "1px solid var(--teal)",
                borderRadius: "var(--radius-md)",
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: "var(--space-3)",
                boxShadow: "var(--shadow-teal-sm)",
              }}
            >
              <span
                style={{
                  fontSize: "0.85rem",
                  color: "var(--white)",
                  fontWeight: 600,
                }}
              >
                {selectedIds.size} Selected
              </span>
              <button
                type="button"
                onClick={() => handleBulkAction("approve_ship")}
                disabled={bulkRunning}
                className="btn-silver"
                style={{ padding: "6px 12px", fontSize: "0.78rem" }}
              >
                Approve (Ship)
              </button>
              <button
                type="button"
                onClick={() => handleBulkAction("approve_pickup")}
                disabled={bulkRunning}
                className="btn-silver"
                style={{ padding: "6px 12px", fontSize: "0.78rem" }}
              >
                Approve (Pickup)
              </button>
              <button
                type="button"
                onClick={() => handleBulkAction("mark_shipped")}
                disabled={bulkRunning}
                className="btn-silver"
                style={{ padding: "6px 12px", fontSize: "0.78rem" }}
              >
                Mark Shipped
              </button>
              <button
                type="button"
                onClick={() => handleBulkAction("mark_delivered")}
                disabled={bulkRunning}
                className="btn-silver"
                style={{ padding: "6px 12px", fontSize: "0.78rem" }}
              >
                Mark Delivered
              </button>
              <button
                type="button"
                onClick={() => handleBulkAction("generate_labels")}
                disabled={bulkRunning}
                className="btn-neon-cyan"
                style={{ padding: "6px 12px", fontSize: "0.78rem" }}
              >
                Generate Labels
              </button>
              <button
                type="button"
                onClick={() => handleBulkAction("cancel")}
                disabled={bulkRunning}
                className="btn-silver"
                style={{
                  padding: "6px 12px",
                  fontSize: "0.78rem",
                  borderColor: "var(--red)",
                  color: "var(--red)",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                disabled={bulkRunning}
                style={{
                  marginLeft: "auto",
                  background: "none",
                  border: "none",
                  color: "var(--grey-400)",
                  cursor: "pointer",
                  fontSize: "0.78rem",
                  textDecoration: "underline",
                }}
              >
                Clear Selection
              </button>
            </div>
          )}

          {/* Table list */}
          {loading ? (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                padding: "var(--space-12)",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  border: "2px solid var(--teal)",
                  borderTopColor: "transparent",
                  animation: "spin 0.8s linear infinite",
                }}
              />
            </div>
          ) : error ? (
            <div
              className="disclaimer-warning"
              style={{ padding: "var(--space-6)" }}
            >
              <p style={{ color: "var(--red)", fontSize: "0.9rem" }}>{error}</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="glass-panel">
              <div
                className=""
                style={{ textAlign: "center", padding: "var(--space-12) 0" }}
              >
                <p style={{ color: "var(--grey-400)", fontSize: "0.85rem" }}>
                  No Orders Found
                </p>
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-3)",
              }}
            >
              {/* Master Select All On Page */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                  padding: "4px var(--space-2)",
                  fontSize: "0.78rem",
                  color: "var(--grey-400)",
                }}
              >
                <input
                  type="checkbox"
                  checked={
                    paginatedOrders.length > 0 &&
                    paginatedOrders.every((o) => selectedIds.has(o.id))
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
              {paginatedOrders.map((order) => (
                <div
                  key={order.id}
                  className="glass-panel hover-lift stagger-fade-in"
                  style={{
                    width: "100%",
                    cursor: "pointer",
                    borderColor:
                      selectedOrder?.id === order.id
                        ? "var(--teal)"
                        : undefined,
                  }}
                >
                  <div
                    className=""
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-3)",
                      padding: "var(--space-4)",
                      background:
                        selectedOrder?.id === order.id
                          ? "rgba(192,184,168,0.04)"
                          : undefined,
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
                      style={{ accentColor: "var(--teal)", flexShrink: 0 }}
                    />
                    <button
                      onClick={() => setSelectedOrder(order)}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        width: "100%",
                        textAlign: "left",
                        background: "transparent",
                        border: "none",
                        color: "inherit",
                        padding: 0,
                        cursor: "pointer",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "var(--space-2)",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "0.85rem",
                              fontWeight: 600,
                              color: "var(--silver)",
                            }}
                          >
                            {order.profiles?.full_name ||
                              order.buyer_name ||
                              "Anonymous Researcher"}
                          </span>
                          <span
                            style={{
                              fontSize: "0.72rem",
                              color: "var(--grey-500)",
                            }}
                          >
                            #{order.id.slice(0, 8)}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: "0.76rem",
                            color: "var(--grey-400)",
                            marginTop: 4,
                          }}
                        >
                          {new Date(order.created_at).toLocaleDateString()} &bull;{" "}
                          {paymentMethodLabel(order.payment_method)} &bull; $
                          {Number(order.total).toFixed(2)}
                        </div>
                      </div>

                      <span
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          color: STATUS_COLORS[order.status],
                          background: `${STATUS_COLORS[order.status]}12`,
                          border: `1px solid ${STATUS_COLORS[order.status]}30`,
                          padding: "2px var(--space-2)",
                          borderRadius: "var(--radius-sm)",
                          textTransform: "capitalize",
                        }}
                      >
                        {STATUS_LABELS[order.status] || order.status}
                      </span>
                    </button>
                  </div>
                </div>
              ))}
              <Pagination
                page={safePage}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            </div>
          )}
        </div>

        {/* Right Side: Order Detail Drawer */}
        <div>
          {selectedOrder ? (
            <div
              className="glass-panel hover-lift"
              style={{ position: "sticky", top: "var(--space-6)", zIndex: 10 }}
            >
              <div
                className=""
                style={{ padding: "var(--space-6)" }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "var(--space-5)",
                  }}
                >
                  <div>
                    <h3 style={{ fontSize: "1rem" }}>Order Details</h3>
                    <span
                      style={{ fontSize: "0.72rem", color: "var(--grey-500)" }}
                    >
                      ID: {selectedOrder.id}
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedOrder(null)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--grey-400)",
                      cursor: "pointer",
                      display: "flex",
                    }}
                    aria-label="Close Order Details"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>

                {/* Status Header */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "var(--space-3)",
                    background: "var(--surface-2)",
                    borderRadius: "var(--radius-md)",
                    border: "var(--border-subtle)",
                    marginBottom: "var(--space-5)",
                  }}
                >
                  <span
                    style={{ fontSize: "0.8rem", color: "var(--grey-400)" }}
                  >
                    Fulfillment Status
                  </span>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      color: STATUS_COLORS[selectedOrder.status],
                      textTransform: "capitalize",
                    }}
                  >
                    {STATUS_LABELS[selectedOrder.status] ||
                      selectedOrder.status}
                  </span>
                </div>

                {/* Customer details */}
                <div style={{ marginBottom: "var(--space-5)" }}>
                  <h4
                    style={{
                      fontSize: "0.82rem",
                      color: "var(--silver)",
                      marginBottom: "var(--space-2)",
                    }}
                  >
                    Buyer Information
                  </h4>
                  <div
                    style={{
                      fontSize: "0.8rem",
                      color: "var(--grey-400)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                    }}
                  >
                    <div>
                      Name: {selectedOrder.profiles?.full_name || selectedOrder.buyer_name || "Anonymous"}
                    </div>
                    <div>
                      Email: {getOrderEmail(selectedOrder) || "-"}
                    </div>
                    {selectedOrder.profiles?.phone && (
                      <div>Phone: {selectedOrder.profiles?.phone}</div>
                    )}
                  </div>
                </div>

                {/* Payment Details */}
                <div style={{ marginBottom: "var(--space-5)" }}>
                  <h4
                    style={{
                      fontSize: "0.82rem",
                      color: "var(--silver)",
                      marginBottom: "var(--space-2)",
                    }}
                  >
                    Payment Log
                  </h4>
                  <div style={{ fontSize: "0.8rem", color: "var(--grey-400)" }}>
                    Method:{" "}
                    <span style={{ textTransform: "none" }}>
                      {paymentMethodLabel(selectedOrder.payment_method)}
                    </span>
                  </div>
                </div>

                {/* Shipping Address */}
                {selectedOrder.fulfillment_method === "ship" &&
                  selectedOrder.shipping_address && (
                    <div style={{ marginBottom: "var(--space-5)" }}>
                      <h4
                        style={{
                          fontSize: "0.82rem",
                          color: "var(--silver)",
                          marginBottom: "var(--space-2)",
                        }}
                      >
                        Shipping Address
                      </h4>
                      <div
                        style={{
                          fontSize: "0.8rem",
                          color: "var(--grey-400)",
                          display: "flex",
                          flexDirection: "column",
                          gap: 2,
                        }}
                      >
                        {selectedOrder.shipping_address?.fullName && (
                          <div>{selectedOrder.shipping_address?.fullName}</div>
                        )}
                        <div>{selectedOrder.shipping_address?.street || ""}</div>
                        {selectedOrder.shipping_address?.suite && (
                          <div>{selectedOrder.shipping_address?.suite}</div>
                        )}
                        <div>
                          {selectedOrder.shipping_address?.city || ""},{" "}
                          {selectedOrder.shipping_address?.state || ""}{" "}
                          {selectedOrder.shipping_address?.zip || ""}
                        </div>
                      </div>
                    </div>
                  )}

                {/* Order Items */}
                <div style={{ marginBottom: "var(--space-6)" }}>
                  <h4
                    style={{
                      fontSize: "0.82rem",
                      color: "var(--silver)",
                      marginBottom: "var(--space-3)",
                    }}
                  >
                    Items Summary
                  </h4>
                  {loadingItems ? (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        padding: "var(--space-4)",
                      }}
                    >
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          border: "2px solid var(--teal)",
                          borderTopColor: "transparent",
                          animation: "spin 0.8s linear infinite",
                        }}
                      />
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "var(--space-2)",
                      }}
                    >
                      {items.map((item) => (
                        <div
                          key={item.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: "0.78rem",
                            padding: "4px 0",
                            }}
                        >
                          <div style={{ color: "var(--grey-300)" }}>
                            {item.product_name}
                            {item.unit_size && (
                              <span
                                style={{
                                  color: "var(--teal)",
                                  fontWeight: 700,
                                  marginLeft: 4,
                                  fontSize: "0.75rem",
                                }}
                              >
                                {item.unit_size}{item.unit_measure || "mg"}
                              </span>
                            )}{" "}
                            <span style={{ color: "var(--silver)", opacity: 0.7 }}>
                              x{item.quantity}
                            </span>
                          </div>
                          <div
                            style={{ color: "var(--silver)", fontWeight: 600 }}
                          >
                            $
                            {(item.unit_retail_price * item.quantity).toFixed(
                              2,
                            )}
                          </div>
                        </div>
                      ))}
                      {/* Totals */}
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                          marginTop: "var(--space-3)",
                          paddingTop: "var(--space-3)",
                          }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: "0.78rem",
                            color: "var(--grey-400)",
                          }}
                        >
                          <span>Subtotal</span>
                          <span>
                            ${Number(selectedOrder.subtotal).toFixed(2)}
                          </span>
                        </div>
                        {Number(selectedOrder.discount_amount) > 0 && (
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: "0.78rem",
                              color: "#68D391",
                            }}
                          >
                            <span>
                              Coupon Discount
                              {selectedOrder.coupon_code
                                ? ` (${selectedOrder.coupon_code})`
                                : ""}
                            </span>
                            <span>
                              -$
                              {Number(selectedOrder.discount_amount).toFixed(2)}
                            </span>
                          </div>
                        )}
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: "0.78rem",
                            color: "var(--grey-400)",
                          }}
                        >
                          <span>Shipping Cost</span>
                          <span>
                            ${Number(selectedOrder.shipping_cost).toFixed(2)}
                          </span>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: "0.86rem",
                            color: "var(--teal)",
                            fontWeight: 700,
                            marginTop: 2,
                          }}
                        >
                          <span>Total Cost</span>
                          <span>${Number(selectedOrder.total).toFixed(2)}</span>
                        </div>

                        {userRole === "admin" && (
                          <div style={{
                            marginTop: "1rem",
                            paddingTop: "0.5rem",
                            borderTop: "1px dashed var(--border)",
                            display: "flex",
                            flexDirection: "column",
                            gap: "6px"
                          }}>
                            {(() => {
                              let agentProfit = 0;
                              let superAgentProfit = 0;
                              let owedToPepNation = 0;
                              let shippingToPepNation = 0;

                              if (!selectedOrder.agent_id) {
                                owedToPepNation = Number(selectedOrder.total || 0);
                              } else {
                                shippingToPepNation = Number(selectedOrder.shipping_cost || 0);
                                owedToPepNation = shippingToPepNation;
                                items.forEach(item => {
                                  const baseCost = item.unit_super_agent_cost && item.unit_super_agent_cost > 0 
                                    ? item.unit_super_agent_cost 
                                    : item.unit_cost_price;
                                  
                                  owedToPepNation += baseCost * item.quantity;
                                  superAgentProfit += (item.unit_cost_price - baseCost) * item.quantity;
                                  agentProfit += (item.unit_retail_price - item.unit_cost_price) * item.quantity;
                                });
                                agentProfit -= Number(selectedOrder.discount_amount || 0);
                              }

                              return (
                                <>
                                  {selectedOrder.agent_id && (
                                    <>
                                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.86rem", color: "var(--silver)" }}>
                                        <span>Agent Profit</span>
                                        <span>${agentProfit.toFixed(2)}</span>
                                      </div>
                                      {selectedOrder.agent?.parent?.full_name ? (
                                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.86rem", color: "var(--green)", fontWeight: 700 }}>
                                          <span>Owed To {selectedOrder.agent.parent.full_name}</span>
                                          <span>${superAgentProfit.toFixed(2)}</span>
                                        </div>
                                      ) : (
                                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.86rem", color: "var(--silver)" }}>
                                          <span>Super Agent Profit</span>
                                          <span>${superAgentProfit.toFixed(2)}</span>
                                        </div>
                                      )}
                                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.86rem", color: "var(--silver)", marginTop: "4px" }}>
                                        <span>Owed To PepNation (Wholesale)</span>
                                        <span>${(owedToPepNation - shippingToPepNation).toFixed(2)}</span>
                                      </div>
                                      {shippingToPepNation > 0 && (
                                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.86rem", color: "var(--silver)" }}>
                                          <span>Owed To PepNation (Shipping)</span>
                                          <span>${shippingToPepNation.toFixed(2)}</span>
                                        </div>
                                      )}
                                    </>
                                  )}
                                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.86rem", color: "var(--green)", fontWeight: 700, borderTop: selectedOrder.agent_id ? "1px solid var(--border)" : "none", paddingTop: selectedOrder.agent_id ? "6px" : "0", marginTop: selectedOrder.agent_id ? "4px" : "0" }}>
                                    <span>{selectedOrder.agent_id ? 'Total Owed To PepNation' : 'Owed To PepNation'}</span>
                                    <span>${owedToPepNation.toFixed(2)}</span>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons Panel */}
                <div
                  style={{
                    paddingTop: "var(--space-5)",
                  }}
                >
                  <h4
                    style={{
                      fontSize: "0.82rem",
                      color: "var(--silver)",
                      marginBottom: "var(--space-4)",
                    }}
                  >
                    Logistics Processing
                  </h4>

                  {processing ? (
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: "50%",
                          border: "2px solid var(--teal)",
                          borderTopColor: "transparent",
                          animation: "spin 0.8s linear infinite",
                        }}
                      />
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "var(--space-3)",
                      }}
                    >
                      {/* Print Receipt — always visible */}
                      <button
                        onClick={printOrderReceipt}
                        disabled={loadingItems}
                        style={{
                          width: "100%",
                          justifyContent: "center",
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "10px 16px",
                          borderRadius: "var(--radius-md)",
                          border: "1px solid var(--silver)",
                          background: "transparent",
                          color: "var(--silver)",
                          fontSize: "0.82rem",
                          fontWeight: 600,
                          cursor: loadingItems ? "not-allowed" : "pointer",
                          opacity: loadingItems ? 0.5 : 1,
                          letterSpacing: "0.02em",
                        }}
                      >
                        🖨️ Print Receipt
                      </button>
                      {selectedOrder.status === "pending_customer_payment" &&
                        userRole !== "shipping" && (
                          <button
                            onClick={() =>
                              handleStatusTransition(
                                selectedOrder.fulfillment_method ===
                                  "agent_pickup"
                                  ? "approved_pickup"
                                  : "approved_ship",
                              )
                            }
                            className="btn-neon-cyan"
                            style={{ width: "100%", justifyContent: "center" }}
                          >
                            Approve Payment & Confirm Order
                          </button>
                        )}

                      {selectedOrder.status === "agent_approval_pending" &&
                        userRole !== "shipping" && (
                          <>
                            <div
                              className="form-group"
                              style={{ marginBottom: "var(--space-2)" }}
                            >
                              <label className="form-label">
                                Internal Approval Notes
                              </label>
                              <input
                                type="text"
                                className="form-input"
                                placeholder="Add Approval Context..."
                                value={approvalNotes}
                                onChange={(e) =>
                                  setApprovalNotes(e.target.value)
                                }
                              />
                            </div>
                            <button
                              onClick={() =>
                                handleStatusTransition(
                                  selectedOrder.fulfillment_method ===
                                    "agent_pickup"
                                    ? "approved_pickup"
                                    : "approved_ship",
                                )
                              }
                              className="btn-neon-cyan"
                              style={{
                                width: "100%",
                                justifyContent: "center",
                              }}
                            >
                              Override & Force Approve Order
                            </button>
                          </>
                        )}

                      {selectedOrder.status === "admin_approval_pending" &&
                        userRole !== "shipping" && (
                          <>
                            <div
                              className="form-group"
                              style={{ marginBottom: "var(--space-2)" }}
                            >
                              <label className="form-label">
                                Admin Release Notes
                              </label>
                              <input
                                type="text"
                                className="form-input"
                                placeholder="Add Release Context..."
                                value={approvalNotes}
                                onChange={(e) =>
                                  setApprovalNotes(e.target.value)
                                }
                              />
                            </div>
                            <button
                              onClick={() =>
                                handleStatusTransition(
                                  selectedOrder.fulfillment_method ===
                                    "agent_pickup"
                                    ? "approved_pickup"
                                    : "approved_ship",
                                )
                              }
                              className="btn-neon-cyan"
                              style={{
                                width: "100%",
                                justifyContent: "center",
                              }}
                            >
                              {selectedOrder.fulfillment_method ===
                              "agent_pickup"
                                ? "Approve & Release To Pickup"
                                : "Approve & Release To Shipping"}
                            </button>
                          </>
                        )}

                      {(selectedOrder.status === "approved_ship" ||
                        selectedOrder.status === "approved_pickup") && (
                        <button
                          onClick={() =>
                            handleStatusTransition("in_fulfillment")
                          }
                          className="btn-neon-cyan"
                          style={{ width: "100%", justifyContent: "center" }}
                        >
                          Initiate Store Fulfillment
                        </button>
                      )}

                      {selectedOrder.status === "in_fulfillment" && (
                        <>
                          {selectedOrder.fulfillment_method === "ship" && (
                            <div
                              className="form-group"
                              style={{ marginBottom: "var(--space-2)" }}
                            >
                              <label className="form-label">
                                Carrier Tracking Number
                              </label>
                              <input
                                type="text"
                                className="form-input"
                                placeholder="E.g. USPS 9400..."
                                value={trackingNumber}
                                onChange={(e) =>
                                  setTrackingNumber(e.target.value)
                                }
                                required
                              />
                            </div>
                          )}
                          <button
                            onClick={() => handleStatusTransition("shipped")}
                            className="btn-neon-cyan"
                            style={{ width: "100%", justifyContent: "center" }}
                            disabled={
                              selectedOrder.fulfillment_method === "ship" &&
                              !trackingNumber
                            }
                          >
                            Mark Order Shipped
                          </button>
                        </>
                      )}

                      {selectedOrder.status === "shipped" && (
                        <button
                          onClick={() => handleStatusTransition("delivered")}
                          className="btn-neon-cyan"
                          style={{
                            width: "100%",
                            justifyContent: "center",
                            background: "#68D391",
                            borderColor: "#68D391",
                            color: "#fff",
                          }}
                        >
                          Mark Order Delivered
                        </button>
                      )}

                      {selectedOrder.tracking_number && (
                        <div
                          style={{
                            padding: "var(--space-3)",
                            background: "var(--surface-1)",
                            borderRadius: "var(--radius-md)",
                            border: "var(--border-subtle)",
                            fontSize: "0.78rem",
                            color: "var(--grey-400)",
                            wordBreak: "break-all",
                          }}
                        >
                          Carrier Tracking:{" "}
                          <span
                            style={{ color: "var(--silver)", fontWeight: 600 }}
                          >
                            {selectedOrder.tracking_number}
                          </span>
                        </div>
                      )}

                      {selectedOrder.status !== "cancelled" &&
                        selectedOrder.status !== "delivered" &&
                        userRole !== "shipping" && (
                          <button
                            onClick={openCancelModal}
                            className="btn-silver"
                            style={{
                              width: "100%",
                              justifyContent: "center",
                              borderColor: "var(--red)",
                              color: "var(--red)",
                            }}
                          >
                            Cancel Order
                          </button>
                        )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-panel">
              <div
                className=""
                style={{
                  padding: "var(--space-6)",
                  textAlign: "center",
                  color: "var(--grey-400)",
                  fontSize: "0.85rem",
                }}
              >
                Select An Order From The List To View Details And Access
                Processing Controls.
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Cancel Modal */}
      {showCancelModal && selectedOrder && (
        <div
          onClick={() => !cancelSubmitting && setShowCancelModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "var(--space-4)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="glass-panel"
            style={{ maxWidth: 480, width: "100%" }}
          >
            <div
              className=""
              style={{ padding: "var(--space-6)" }}
            >
              <h2
                className="metal-text"
                style={{
                  fontSize: "1.25rem",
                  color: "#fff",
                  marginBottom: "var(--space-2)",
                }}
              >
                Cancel Order
              </h2>
              <p
                style={{
                  fontSize: "0.78rem",
                  color: "var(--grey-400)",
                  marginBottom: "var(--space-4)",
                }}
              >
                Order Total ${Number(selectedOrder.total).toFixed(2)}. All Sales
                Are Final - This Action Cannot Be Undone.
              </p>

              <div
                className="form-group"
                style={{ marginBottom: "var(--space-5)" }}
              >
                <label className="form-label">Reason</label>
                <textarea
                  className="form-input"
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Researcher Request, Payment Failed, Inventory Issue..."
                />
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "var(--space-3)",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  className="btn-silver"
                  onClick={() => setShowCancelModal(false)}
                  disabled={cancelSubmitting}
                >
                  Keep Order
                </button>
                <button
                  className="btn-neon-cyan"
                  onClick={submitCancel}
                  disabled={cancelSubmitting}
                  style={{
                    background: "var(--red)",
                    borderColor: "var(--red)",
                  }}
                >
                  {cancelSubmitting ? "Cancelling..." : "Cancel Order"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showBulkCancelConfirm && (
        <div
          onClick={() => setShowBulkCancelConfirm(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "var(--space-4)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="glass-panel"
            style={{ maxWidth: 420, width: "100%" }}
          >
            <div style={{ padding: "var(--space-6)" }}>
              <h2
                className="metal-text"
                style={{
                  fontSize: "1.25rem",
                  color: "#fff",
                  marginBottom: "var(--space-2)",
                }}
              >
                Cancel {pendingBulkIds.length} Order(s)?
              </h2>
              <p
                style={{
                  fontSize: "0.78rem",
                  color: "var(--grey-400)",
                  marginBottom: "var(--space-5)",
                }}
              >
                This Action Cannot Be Undone.
              </p>
              <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    setShowBulkCancelConfirm(false);
                    setPendingBulkIds([]);
                  }}
                >
                  Keep Orders
                </button>
                <button
                  type="button"
                  className="btn-danger"
                  style={{ background: "var(--red)", borderColor: "var(--red)" }}
                  onClick={async () => {
                    setShowBulkCancelConfirm(false);
                    setBulkRunning(true);
                    const progressToast = toast.loading(
                      `Cancelling ${pendingBulkIds.length} Order(s)...`,
                    );
                    try {
                      const res = await fetch("/api/admin/orders/bulk", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "cancel", ids: pendingBulkIds, reason: "Bulk Cancellation" }),
                      });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error || "Bulk Cancel Failed");
                      toast.dismiss(progressToast);
                      toast.success(`Cancelled ${data.processed ?? pendingBulkIds.length} Order(s)`);
                      setSelectedIds(new Set());
                      setPendingBulkIds([]);
                      await fetchOrders();
                    } catch (err: any) {
                      toast.dismiss(progressToast);
                      toast.error(err.message || "Bulk Cancel Failed");
                    } finally {
                      setBulkRunning(false);
                    }
                  }}
                >
                  Cancel Orders
                </button>
              </div>
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
    <Suspense
      fallback={
        <div style={{ padding: "var(--space-8)" }}>
          <p style={{ fontSize: "0.85rem", color: "var(--grey-400)" }}>
            Loading Orders...
          </p>
        </div>
      }
    >
      <AdminOrdersPageInner />
    </Suspense>
  );
}
