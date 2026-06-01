'use client';

import { useEffect, useState } from 'react';

const money = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(Number(n) || 0);

export default function StatementDetailModal({
  statementId, onClose,
}: { statementId: string; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/agent/wallet/statements/${statementId}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(setData)
      .catch(() => setErr('Could Not Load Detail'));
  }, [statementId]);

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
          <h2 style={{ color: 'var(--white)', fontSize: '1.2rem', margin: 0 }}>Statement Detail</h2>
          <button onClick={onClose} aria-label="Close" style={{
            background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--white)',
            width: 44, height: 44, borderRadius: 22, cursor: 'pointer', fontSize: '1rem',
          }}>Close</button>
        </div>

        {err && <p style={{ color: 'var(--red)' }}>{err}</p>}
        {!data && !err && <p style={{ color: 'var(--grey-400)' }}>Loading...</p>}

        {data?.statement && (
          <>
            <div style={{
              padding: 12, borderRadius: 10, background: 'rgba(255,255,255,0.03)',
              marginBottom: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10,
            }}>
              <div>
                <div style={{ color: 'var(--grey-400)', fontSize: '0.72rem' }}>Week</div>
                <div style={{ color: 'var(--white)', fontWeight: 700 }}>{data.statement.week_start}</div>
              </div>
              <div>
                <div style={{ color: 'var(--grey-400)', fontSize: '0.72rem' }}>COGS</div>
                <div style={{ color: 'var(--white)', fontWeight: 700 }}>{money(Number(data.statement.total_cogs || 0))}</div>
              </div>
              <div>
                <div style={{ color: 'var(--grey-400)', fontSize: '0.72rem' }}>Shipping</div>
                <div style={{ color: 'var(--white)', fontWeight: 700 }}>{money(Number(data.statement.total_shipping || 0))}</div>
              </div>
              <div>
                <div style={{ color: 'var(--grey-400)', fontSize: '0.72rem' }}>Owed</div>
                <div style={{ color: 'var(--teal)', fontWeight: 800 }}>{money(Number(data.statement.total_owed || 0))}</div>
              </div>
            </div>

            <h3 style={{ color: 'var(--white)', fontSize: '0.95rem', margin: '12px 0 8px' }}>Orders In This Statement</h3>
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
                      <span>{o.buyer_name} — {new Date(o.order_created_at).toLocaleDateString()}</span>
                      <strong style={{ color: 'var(--teal)' }}>{money(Number(o.total || 0))}</strong>
                    </summary>
                    <ul style={{ listStyle: 'none', padding: '10px 0 0', margin: 0, fontSize: '0.85rem' }}>
                      {(o.line_items ?? []).map((li: any, i: number) => (
                        <li key={i} style={{ color: 'var(--grey-300)', display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                          <span>{li.product_name} × {li.quantity}</span>
                          <span>{money(Number(li.line_total || 0))}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                ))}
              </div>
            )}

            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
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
