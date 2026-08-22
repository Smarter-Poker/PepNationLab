'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { money, fmtDate, statusLabel } from './format';
import { paymentMethodLabel } from '@/lib/payment-method-labels';
import { walletErrorMessage } from './error-messages';

export default function StatementDetailModal({
  statementId, onClose, targetType = 'statement',
}: { statementId: string; onClose: () => void; targetType?: 'statement' | 'agent_invoice' }) {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    try {
      if (targetType === 'agent_invoice') {
        // Sub-agent invoices live in a different table + endpoint than weekly
        // statements. Fetch the invoice detail and normalize it into the same
        // shape the render below expects ({ statement, orders[].line_items }).
        const res = await fetch(`/api/agent/super-agent/invoices/${statementId}`, { cache: 'no-store' });
        const j = await res.json();
        if (!res.ok) throw new Error();
        const inv = j.invoice || {};
        setData({
          statement: {
            week_start: inv.week_start,
            total_cogs: inv.total_cogs,
            total_shipping: inv.total_shipping,
            total_owed: inv.total_owed,
            status: inv.status,
            due_date: inv.due_date,
            paid_at: inv.paid_at,
            payment_method: inv.payment_method,
          },
          orders: (j.lineItems ?? []).length
            ? [{
                order_id: 'invoice-lines',
                buyer_name: 'Invoice Line Items',
                order_created_at: inv.week_start,
                total: inv.total_owed,
                line_items: (j.lineItems ?? []).map((li: any) => ({
                  product_name: li.product,
                  quantity: li.qty,
                  line_total: li.lineTotal,
                })),
              }]
            : [],
        });
        return;
      }
      const res = await fetch(`/api/agent/wallet/statements/${statementId}`, { cache: 'no-store' });
      const j = await res.json();
      if (!res.ok) throw new Error();
      setData(j);
    } catch {
      setErr('Could Not Load Detail');
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [statementId]);

  const stmt = data?.statement;
  const disputed = !!stmt?.disputed_at;
  const paid = stmt?.status === 'paid';

  async function submitDispute() {
    if (reason.trim().length < 3) { toast.error('Please Add A Brief Reason'); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/agent/wallet/statements/${statementId}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'failed');
      toast.success('Dispute Submitted');
      setDisputeOpen(false);
      setReason('');
      load();
    } catch (e: any) {
      toast.error(walletErrorMessage(e, 'Could Not File That Dispute. Please Try Again.'));
    } finally {
      setSubmitting(false);
    }
  }

  const cell = (label: string, value: React.ReactNode, color = 'var(--white)') => (
    <div>
      <div style={{ color: 'var(--grey-400)', fontSize: '0.72rem' }}>{label}</div>
      <div style={{ color, fontWeight: 700 }}>{value}</div>
    </div>
  );

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
      zIndex: 9998, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: 'calc(60px + var(--safe-top, 0px)) 12px 12px',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--grey-900)', borderRadius: 14, padding: 18,
        width: '100%', maxWidth: 720, maxHeight: '85dvh', overflowY: 'auto',
        border: '1px solid rgba(255,255,255,0.1)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ color: 'var(--white)', fontSize: '1.2rem', margin: 0 }}>{targetType === 'agent_invoice' ? 'Invoice Detail' : 'Statement Detail'}</h2>
          <button onClick={onClose} aria-label="Close" style={{
            background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--white)',
            width: 44, height: 44, borderRadius: 22, cursor: 'pointer', fontSize: '1rem',
          }}>Close</button>
        </div>

        {err && <p style={{ color: 'var(--red)' }}>{err}</p>}
        {!data && !err && <p style={{ color: 'var(--grey-400)' }}>Loading...</p>}

        {stmt && (
          <>
            <div style={{
              padding: 12, borderRadius: 10, background: 'rgba(255,255,255,0.03)',
              marginBottom: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10,
            }}>
              {cell('Week', `Week Of ${fmtDate(stmt.week_start)}`)}
              {cell('COGS', money(Number(stmt.total_cogs || 0)))}
              {cell('Shipping', money(Number(stmt.total_shipping || 0)))}
              {cell('Owed', money(Number(stmt.total_owed || 0)), 'var(--teal)')}
              {cell('Status', statusLabel(stmt.status), paid ? '#2ed573' : 'var(--white)')}
              {stmt.due_date && cell('Due', fmtDate(stmt.due_date))}
              {stmt.paid_at && cell('Paid', fmtDate(stmt.paid_at), '#2ed573')}
              {stmt.payment_method && cell('Method', paymentMethodLabel(stmt.payment_method))}
            </div>

            {disputed && (
              <div style={{
                padding: 12, borderRadius: 10, marginBottom: 14,
                background: 'rgba(229,62,62,0.1)', border: '1px solid rgba(229,62,62,0.3)',
              }}>
                <div style={{ color: '#ff6b6b', fontWeight: 700, fontSize: '0.85rem' }}>
                  Disputed {fmtDate(stmt.disputed_at)}
                </div>
                {stmt.dispute_reason && (
                  <div style={{ color: 'var(--grey-300)', fontSize: '0.82rem', marginTop: 4 }}>{stmt.dispute_reason}</div>
                )}
              </div>
            )}

            <h3 style={{ color: 'var(--white)', fontSize: '0.95rem', margin: '12px 0 8px' }}>Orders In This Statement</h3>
            <p style={{ color: 'var(--grey-500)', fontSize: '0.76rem', margin: '0 0 8px' }}>
              Amounts Below Are What You Were Billed For Each Order. They Add Up To The Total Owed.
            </p>
            {(data.orders ?? []).length === 0 ? (
              <p style={{ color: 'var(--grey-500)' }}>No Orders Found.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.orders.map((o: any) => (
                  <details key={o.order_id} style={{
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: 8, padding: 10,
                  }}>
                    <summary style={{ cursor: 'pointer', color: 'var(--white)', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span>{o.buyer_name} - {fmtDate(o.order_created_at)}</span>
                      {/* What THIS bill charged for the order, not what the
                          customer paid. Showing the retail total here is why
                          the rows never summed to the amount owed. */}
                      <strong style={{ color: 'var(--teal)' }}>
                        {money(Number(o.billed_total ?? o.total ?? 0))}
                      </strong>
                    </summary>
                    <ul style={{ listStyle: 'none', padding: '10px 0 0', margin: 0, fontSize: '0.85rem' }}>
                      {(o.line_items ?? []).map((li: any, i: number) => (
                        <li key={i} style={{ color: 'var(--grey-300)', display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                          <span>{li.product_name} × {li.quantity}</span>
                          <span>
                            {money(Number(li.line_total || 0))}
                            {li.line_retail_total != null && Number(li.line_retail_total) > 0 && (
                              <span style={{ color: 'var(--grey-500)', marginLeft: 6, fontSize: '0.78rem' }}>
                                (Sold {money(Number(li.line_retail_total))})
                              </span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </details>
                ))}
              </div>
            )}

            {disputeOpen && !disputed && !paid && (
              <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: 'rgba(255,255,255,0.03)' }}>
                <label style={{ color: 'var(--grey-400)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Reason For Dispute
                </label>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="Describe What Looks Incorrect On This Statement"
                  style={{
                    width: '100%', marginTop: 6, padding: 12, borderRadius: 8, fontSize: '16px',
                    background: 'rgba(255,255,255,0.04)', color: 'var(--white)',
                    border: '1px solid rgba(255,255,255,0.1)', resize: 'vertical',
                  }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button onClick={() => { setDisputeOpen(false); setReason(''); }} disabled={submitting} style={{
                    flex: 1, padding: 12, borderRadius: 8, minHeight: 44,
                    background: 'rgba(255,255,255,0.05)', color: 'var(--white)',
                    border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontWeight: 700,
                  }}>Cancel</button>
                  <button onClick={submitDispute} disabled={submitting} style={{
                    flex: 2, padding: 12, borderRadius: 8, minHeight: 44,
                    background: '#E53E3E', color: '#fff', border: 'none',
                    cursor: submitting ? 'wait' : 'pointer', fontWeight: 800,
                  }}>{submitting ? 'Submitting...' : 'Submit Dispute'}</button>
                </div>
              </div>
            )}

            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              {targetType === 'statement' && !disputed && !paid && !disputeOpen ? (
                <button onClick={() => setDisputeOpen(true)} style={{
                  padding: '10px 16px', minHeight: 44, borderRadius: 8,
                  background: 'rgba(229,62,62,0.12)', color: '#ff6b6b',
                  border: '1px solid rgba(229,62,62,0.3)', cursor: 'pointer', fontWeight: 700,
                }}>Dispute Statement</button>
              ) : <span />}
              <button onClick={() => window.print()} style={{
                padding: '10px 16px', minHeight: 44, borderRadius: 8,
                background: 'rgba(255,255,255,0.05)', color: 'var(--white)',
                border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontWeight: 700,
              }}>Print / Save PDF</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
