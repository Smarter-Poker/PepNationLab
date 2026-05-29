'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface RmaItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_amount: number;
  condition_received: string | null;
}

interface Rma {
  id: string;
  order_id: string;
  status: string;
  reason_category: string;
  reason_details: string;
  requested_resolution: string;
  return_label_url: string | null;
  return_tracking_number: string | null;
  return_label_purchased_at: string | null;
  received_at: string | null;
  inspected_at: string | null;
  restock_decision: string | null;
  resolution_type: string | null;
  resolved_at: string | null;
  rejected_reason: string | null;
  created_at: string;
  rma_items: RmaItem[];
  order: { id: string; total: number; status: string } | null;
  requester: { full_name: string | null; email: string | null; username: string | null } | null;
}

const STATUS_LABELS: Record<string, string> = {
  requested: 'Requested',
  approved: 'Approved',
  label_sent: 'Label Sent',
  in_transit: 'In Transit',
  received: 'Received',
  inspected: 'Inspected',
  resolved: 'Resolved',
  rejected: 'Rejected',
};

export default function AgentRmaList() {
  const [rmas, setRmas] = useState<Rma[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const url = statusFilter ? `/api/agent/rma?status=${statusFilter}` : '/api/agent/rma';
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed To Load Returns');
      setRmas(data.rmas || []);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function patch(id: string, body: Record<string, any>, successMsg: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/agent/rma/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action Failed');
      toast.success(successMsg);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function approve(id: string) {
    await patch(id, { action: 'approve' }, 'Return Approved');
  }

  async function reject(id: string) {
    const reason = window.prompt('Reason For Rejection (Required)');
    if (!reason) return;
    await patch(id, { action: 'reject', rejected_reason: reason }, 'Return Rejected');
  }

  async function purchaseLabel(id: string) {
    if (!confirm('Purchase A Return Shipping Label? Your Shippo Account Will Be Charged.')) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/agent/rma/${id}/return-label`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Label Purchase Failed');
      toast.success('Return Label Purchased');
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function markReceived(id: string) {
    await patch(id, { action: 'mark_received' }, 'Marked Received');
  }

  async function markInspected(id: string) {
    const notes = window.prompt('Inspection Notes (Optional)') || '';
    const decision = window.prompt('Restock Decision: restock | dispose | quarantine | vendor_return', 'restock');
    if (!decision || !['restock', 'dispose', 'quarantine', 'vendor_return'].includes(decision)) {
      toast.error('Invalid Restock Decision');
      return;
    }
    await patch(id, {
      action: 'mark_inspected',
      inspection_notes: notes || null,
      restock_decision: decision,
    }, 'Inspection Recorded');
  }

  async function resolve(id: string, orderTotal: number) {
    const type = window.prompt('Resolution Type: refund_full | refund_partial | store_credit_full | store_credit_partial | replacement_sent | no_action', 'refund_full');
    if (!type) return;
    let refundAmount: number | undefined;
    let refundType: string | undefined;
    if (type.startsWith('refund_') || type.startsWith('store_credit_')) {
      const amountStr = window.prompt('Refund Amount (USD)', String(orderTotal));
      const parsed = Number(amountStr);
      if (!parsed || parsed <= 0) {
        toast.error('Invalid Amount');
        return;
      }
      refundAmount = parsed;
      refundType = type.startsWith('store_credit_') ? 'store_credit' : 'original_payment';
    }
    await patch(id, {
      action: 'resolve',
      resolution_type: type,
      refund_amount: refundAmount,
      refund_type: refundType,
      reason: 'RMA Resolution',
    }, 'Return Resolved');
  }

  if (loading) return <p style={{ color: 'var(--silver)' }}>Loading Returns...</p>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
        <h2 style={{ color: 'var(--white)', fontFamily: 'var(--font-brand)' }}>Return Requests</h2>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input"
          style={{ maxWidth: 220 }}
        >
          <option value="">All Statuses</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {rmas.length === 0 ? (
        <p style={{ color: 'var(--silver)' }}>No Return Requests To Show.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {rmas.map((rma) => (
            <div key={rma.id} className="card-glass" style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 'var(--space-3)', alignItems: 'start' }}>
                <div>
                  <div style={{ color: 'var(--white)', fontWeight: 700 }}>
                    Return #{rma.id.slice(0, 8).toUpperCase()} &middot; Order #{rma.order_id.slice(0, 8).toUpperCase()}
                  </div>
                  <div style={{ color: 'var(--silver)', fontSize: '0.88rem', marginTop: 4 }}>
                    {rma.requester?.full_name || rma.requester?.email || 'Buyer'} &middot; {rma.reason_category.replace(/_/g, ' ')}
                  </div>
                  <div style={{ color: 'var(--grey-400)', fontSize: '0.82rem', marginTop: 4 }}>
                    Filed {new Date(rma.created_at).toLocaleString()}
                  </div>
                </div>
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: 999,
                    background: 'var(--teal)',
                    color: 'var(--black)',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                  }}
                >
                  {STATUS_LABELS[rma.status] || rma.status}
                </span>
              </div>

              <div style={{ marginTop: 'var(--space-2)', color: 'var(--silver)', fontSize: '0.88rem' }}>
                {rma.reason_details}
              </div>

              <div style={{ marginTop: 'var(--space-2)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {rma.rma_items?.map((it) => (
                  <div key={it.id} style={{ color: 'var(--silver)', fontSize: '0.85rem' }}>
                    {it.product_name} &middot; Qty {it.quantity} &middot; ${(Number(it.unit_amount) * Number(it.quantity)).toFixed(2)}
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                {rma.status === 'requested' && (
                  <>
                    <button className="btn-primary" disabled={busyId === rma.id} onClick={() => approve(rma.id)}>Approve</button>
                    <button className="btn-danger" disabled={busyId === rma.id} onClick={() => reject(rma.id)}>Reject</button>
                  </>
                )}
                {rma.status === 'approved' && !rma.return_label_url && (
                  <button className="btn-primary" disabled={busyId === rma.id} onClick={() => purchaseLabel(rma.id)}>Purchase Return Label</button>
                )}
                {(rma.status === 'approved' || rma.status === 'label_sent' || rma.status === 'in_transit') && (
                  <button className="btn-secondary" disabled={busyId === rma.id} onClick={() => markReceived(rma.id)}>Mark Received</button>
                )}
                {rma.status === 'received' && (
                  <button className="btn-secondary" disabled={busyId === rma.id} onClick={() => markInspected(rma.id)}>Mark Inspected</button>
                )}
                {['inspected', 'received', 'approved'].includes(rma.status) && (
                  <button className="btn-primary" disabled={busyId === rma.id} onClick={() => resolve(rma.id, Number(rma.order?.total || 0))}>Resolve</button>
                )}
                {rma.return_label_url && (
                  <a className="btn-secondary" href={rma.return_label_url} target="_blank" rel="noopener noreferrer">View Return Label</a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
