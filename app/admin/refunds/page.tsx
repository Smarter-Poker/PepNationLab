'use client';

import { useEffect, useState } from 'react';

interface RefundRow {
  id: string;
  order_id: string;
  amount: number | string;
  reason: string;
  refund_type: 'agent_balance' | 'store_credit' | 'original_payment' | 'admin_manual';
  status: 'pending' | 'completed' | 'failed' | 'reversed';
  approved_by: string | null;
  approved_at: string | null;
  completed_at: string | null;
  is_partial: boolean;
  notes: string | null;
  created_at: string;
}

const TYPE_LABELS: Record<string, string> = {
  agent_balance: 'Agent Balance',
  store_credit: 'Store Credit',
  original_payment: 'Original Payment',
  admin_manual: 'Admin Manual',
};

const STATUS_COLORS: Record<string, string> = {
  pending: '#F6AD55',
  completed: '#68D391',
  failed: 'var(--red)',
  reversed: 'var(--grey-400)',
};

export default function AdminRefundsPage() {
  const [rows, setRows] = useState<RefundRow[]>([]);
  const [approverNames, setApproverNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/refunds', { cache: 'no-store' });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || 'Failed To Load Refunds');
        }
        const json = await res.json();
        if (!cancelled) {
          setRows(json.data ?? []);
          setApproverNames(json.approverNames ?? {});
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Failed To Load Refunds');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ padding: 'var(--space-6)' }}>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: 'var(--space-2)' }}>Refunds</h1>
        <p style={{ color: 'var(--grey-400)', fontSize: '0.85rem' }}>
          Read-Only Audit Of The Last 100 Refund Events.
        </p>
      </div>

      {error && (
        <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)', borderColor: 'var(--red)' }}>
          <p style={{ color: 'var(--red)', fontSize: '0.85rem' }}>{error}</p>
        </div>
      )}

      {loading ? (
        <div className="card-metal" style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--grey-400)' }}>
          Loading Refunds...
        </div>
      ) : rows.length === 0 ? (
        <div className="card-metal" style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--grey-400)' }}>
          No Refunds Recorded Yet.
        </div>
      ) : (
        <div className="card-metal" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)', borderBottom: 'var(--border-subtle)' }}>
                  <th style={{ padding: 'var(--space-3)', textAlign: 'left', color: 'var(--silver)', fontWeight: 600 }}>Date</th>
                  <th style={{ padding: 'var(--space-3)', textAlign: 'left', color: 'var(--silver)', fontWeight: 600 }}>Order</th>
                  <th style={{ padding: 'var(--space-3)', textAlign: 'right', color: 'var(--silver)', fontWeight: 600 }}>Amount</th>
                  <th style={{ padding: 'var(--space-3)', textAlign: 'left', color: 'var(--silver)', fontWeight: 600 }}>Reason</th>
                  <th style={{ padding: 'var(--space-3)', textAlign: 'left', color: 'var(--silver)', fontWeight: 600 }}>Type</th>
                  <th style={{ padding: 'var(--space-3)', textAlign: 'left', color: 'var(--silver)', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: 'var(--space-3)', textAlign: 'left', color: 'var(--silver)', fontWeight: 600 }}>Approved By</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: 'var(--space-3)', color: 'var(--grey-400)' }}>
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td style={{ padding: 'var(--space-3)', color: 'var(--silver)', fontFamily: 'monospace' }}>
                      {r.order_id.slice(0, 8)}
                    </td>
                    <td style={{ padding: 'var(--space-3)', textAlign: 'right', color: 'var(--teal)', fontWeight: 600 }}>
                      ${Number(r.amount).toFixed(2)}
                      {r.is_partial && (
                        <span style={{ marginLeft: 6, fontSize: '0.68rem', color: 'var(--grey-500)' }}>
                          Partial
                        </span>
                      )}
                    </td>
                    <td style={{ padding: 'var(--space-3)', color: 'var(--grey-300)', maxWidth: 240, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.reason}
                    </td>
                    <td style={{ padding: 'var(--space-3)', color: 'var(--grey-300)' }}>
                      {TYPE_LABELS[r.refund_type] ?? r.refund_type}
                    </td>
                    <td style={{ padding: 'var(--space-3)', color: STATUS_COLORS[r.status] ?? 'var(--grey-400)', fontWeight: 600, textTransform: 'capitalize' }}>
                      {r.status}
                    </td>
                    <td style={{ padding: 'var(--space-3)', color: 'var(--grey-400)' }}>
                      {r.approved_by ? (approverNames[r.approved_by] ?? r.approved_by.slice(0, 8)) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
