'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

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
  requester: { full_name: string | null; email: string | null; username: string | null } | null;
  orders: { id: string; agent_id: string | null; total: number; status: string } | { id: string; agent_id: string | null; total: number; status: string }[] | null;
}

const STATUS_OPTIONS = [
  'requested', 'approved', 'label_sent', 'in_transit', 'received', 'inspected', 'resolved', 'rejected',
];

export default function AdminRmaClient() {
  const [rmas, setRmas] = useState<Rma[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (statusFilter) qs.set('status', statusFilter);
      if (from) qs.set('from', from);
      if (to) qs.set('to', to);
      const res = await fetch(`/api/admin/rma?${qs.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed To Load Returns');
      setRmas(data.rmas || []);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function override(id: string, updates: Record<string, any>, successMsg: string) {
    setBusyId(id);
    try {
      const res = await fetch('/api/admin/rma', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
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

  function pickOrder(rma: Rma): { id: string; agent_id: string | null; total: number; status: string } | null {
    if (!rma.orders) return null;
    return Array.isArray(rma.orders) ? rma.orders[0] : rma.orders;
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
        <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}</option>)}
        </select>
        <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="From" />
        <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} placeholder="To" />
        <button className="btn-primary" onClick={load}>Apply Filters</button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--silver)' }}>Loading...</p>
      ) : rmas.length === 0 ? (
        <p style={{ color: 'var(--silver)' }}>No Returns Found.</p>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--white)', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.04)', textAlign: 'left' }}>
                <th style={{ padding: 'var(--space-2)' }}>Return</th>
                <th style={{ padding: 'var(--space-2)' }}>Order</th>
                <th style={{ padding: 'var(--space-2)' }}>Buyer</th>
                <th style={{ padding: 'var(--space-2)' }}>Status</th>
                <th style={{ padding: 'var(--space-2)' }}>Filed</th>
                <th style={{ padding: 'var(--space-2)' }}>Override</th>
              </tr>
            </thead>
            <tbody>
              {rmas.map((r) => {
                const o = pickOrder(r);
                return (
                  <tr key={r.id} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <td style={{ padding: 'var(--space-2)' }}>#{r.id.slice(0, 8).toUpperCase()}</td>
                    <td style={{ padding: 'var(--space-2)' }}>#{r.order_id.slice(0, 8).toUpperCase()}{o && <> &middot; ${Number(o.total).toFixed(2)}</>}</td>
                    <td style={{ padding: 'var(--space-2)' }}>{r.requester?.full_name || r.requester?.email || r.requester?.username || 'Unknown'}</td>
                    <td style={{ padding: 'var(--space-2)' }}>{r.status}</td>
                    <td style={{ padding: 'var(--space-2)' }}>{new Date(r.created_at).toLocaleDateString()}</td>
                    <td style={{ padding: 'var(--space-2)' }}>
                      <select
                        className="input"
                        value={r.status}
                        disabled={busyId === r.id}
                        onChange={(e) => override(r.id, { status: e.target.value }, 'Status Updated')}
                      >
                        {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
