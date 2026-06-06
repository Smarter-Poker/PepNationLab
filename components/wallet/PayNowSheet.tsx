'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { money, fmtDate } from './format';

const HANDLES = ['zelle', 'venmo', 'cashapp', 'apple_pay'] as const;
type Handle = (typeof HANDLES)[number];

type StatementLike = {
  id: string;
  week_start?: string;
  total_owed?: number | string;
  target_type?: 'statement' | 'agent_invoice';
};

export default function PayNowSheet({
  openStatements, preferredHandle, onClose, onPaid,
}: {
  openStatements: StatementLike[];
  preferredHandle: string;
  onClose: () => void;
  onPaid: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string>(openStatements[0]?.id ?? '');
  const [handle, setHandle] = useState<Handle>((preferredHandle as Handle) || 'zelle');
  const [submitting, setSubmitting] = useState(false);

  const stmt = openStatements.find((s) => s.id === selectedId) ?? openStatements[0];

  async function submit() {
    if (!stmt) return;
    setSubmitting(true);
    try {
      // Invoice v2 - send target_type so the unified pay_invoice RPC routes
      // both weekly_statements and agent_invoices correctly. Defaults to
      // 'statement' when not present so older callers still work.
      const targetType = stmt.target_type ?? 'statement';
      const res = await fetch('/api/agent/wallet/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_type: targetType,
          target_id: stmt.id,
          // Backward compat - older /api/agent/wallet/pay versions still
          // expect statement_id; harmless when the v2 route ignores it.
          statement_id: targetType === 'statement' ? stmt.id : undefined,
          handle,
          amount: Number(stmt.total_owed || 0),
          proof_id: null,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'pay_failed');
      toast.success('Marked Paid - Recipient Wallet Topped Off');
      onPaid();
    } catch (e: any) {
      toast.error('Pay Failed: ' + (e.message || 'Unknown'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
      zIndex: 9999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 12,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--grey-900)', borderRadius: 16, padding: 18, width: '100%', maxWidth: 480,
        border: '1px solid rgba(255,255,255,0.1)', maxHeight: '85dvh', overflowY: 'auto',
      }}>
        <h2 style={{ color: 'var(--white)', fontSize: '1.2rem', margin: '0 0 12px' }}>Pay Invoice</h2>

        {!stmt ? (
          <p style={{ color: 'var(--grey-500)' }}>No Open Invoices.</p>
        ) : (
          <>
            <div style={{ marginBottom: 14 }}>
              <label style={{ color: 'var(--grey-400)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Invoice
              </label>
              <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
                style={{
                  width: '100%', padding: '12px', marginTop: 4, borderRadius: 8,
                  background: 'rgba(255,255,255,0.04)', color: 'var(--white)',
                  border: '1px solid rgba(255,255,255,0.1)', fontSize: '16px',
                }}>
                {openStatements.map((s) => (
                  <option key={s.id} value={s.id}>
                    Week Of {fmtDate(s.week_start)} - {money(Number(s.total_owed || 0))}
                    {s.target_type === 'agent_invoice' ? ' (Super Agent Invoice)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ color: 'var(--grey-400)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Payment Handle
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 4 }}>
                {HANDLES.map(h => (
                  <button key={h} type="button" onClick={() => setHandle(h)}
                    style={{
                      padding: '12px', borderRadius: 8, minHeight: 44,
                      background: handle === h ? 'var(--teal)' : 'rgba(255,255,255,0.04)',
                      color: handle === h ? 'var(--black)' : 'var(--white)',
                      border: `1px solid ${handle === h ? 'var(--teal)' : 'rgba(255,255,255,0.1)'}`,
                      cursor: 'pointer', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.82rem',
                    }}>
                    {h.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 18, padding: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
              <div style={{ color: 'var(--grey-400)', fontSize: '0.78rem' }}>Amount</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--teal)' }}>{money(Number(stmt.total_owed || 0))}</div>
              <p style={{ color: 'var(--grey-500)', fontSize: '0.75rem', margin: '6px 0 0' }}>
                Amount Is Server-Verified. Mismatch Will Reject The Payment.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onClose} disabled={submitting} style={{
                flex: 1, padding: '14px', borderRadius: 8, minHeight: 44,
                background: 'rgba(255,255,255,0.05)', color: 'var(--white)',
                border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontWeight: 700,
              }}>Cancel</button>
              <button onClick={submit} disabled={submitting} style={{
                flex: 2, padding: '14px', borderRadius: 8, minHeight: 44,
                background: 'var(--teal)', color: 'var(--black)', border: 'none',
                cursor: submitting ? 'wait' : 'pointer', fontWeight: 800,
              }}>{submitting ? 'Processing...' : 'Confirm Payment'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
