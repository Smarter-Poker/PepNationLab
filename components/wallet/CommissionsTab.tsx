'use client';

import { useEffect, useState } from 'react';

const money = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(Number(n) || 0);

export default function CommissionsTab() {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    fetch('/api/agent/wallet/commissions', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(setData)
      .catch(() => setData({ pending: [], settled: [], totals: { pending: 0, settled: 0 } }));
  }, []);

  if (!data) return <div style={{ color: 'var(--grey-400)', padding: 16 }}>Loading...</div>;

  const fmtDollars = (n: number) => money(Number(n) || 0);

  return (
    <section className="card-glass" style={{ padding: 16, borderRadius: 12 }}>
      <h3 style={{ color: 'var(--white)', marginTop: 0 }}>Commissions Earned</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 16 }}>
        <div style={{ padding: 12, background: 'rgba(255,184,0,0.08)', borderRadius: 8 }}>
          <div style={{ color: 'var(--grey-400)', fontSize: '0.72rem' }}>Pending</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffb800' }}>{fmtDollars(data.totals.pending)}</div>
        </div>
        <div style={{ padding: 12, background: 'rgba(46,213,115,0.08)', borderRadius: 8 }}>
          <div style={{ color: 'var(--grey-400)', fontSize: '0.72rem' }}>Settled</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#2ed573' }}>{fmtDollars(data.totals.settled)}</div>
        </div>
      </div>

      <h4 style={{ color: 'var(--white)', fontSize: '0.85rem', margin: '12px 0 6px' }}>Pending</h4>
      {data.pending.length === 0 ? (
        <p style={{ color: 'var(--grey-500)', fontSize: '0.85rem' }}>None.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {data.pending.slice(0, 50).map((r: any) => (
            <li key={r.id} style={{
              display: 'flex', justifyContent: 'space-between', padding: '8px 10px',
              background: 'rgba(255,255,255,0.03)', borderRadius: 6, color: 'var(--white)', fontSize: '0.85rem',
            }}>
              <span>{r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}</span>
              <span>{fmtDollars(Number(r.commission_amount ?? 0))}</span>
            </li>
          ))}
        </ul>
      )}

      <h4 style={{ color: 'var(--white)', fontSize: '0.85rem', margin: '18px 0 6px' }}>Settled</h4>
      {data.settled.length === 0 ? (
        <p style={{ color: 'var(--grey-500)', fontSize: '0.85rem' }}>None Yet.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {data.settled.slice(0, 50).map((r: any) => (
            <li key={r.id} style={{
              display: 'flex', justifyContent: 'space-between', padding: '8px 10px',
              background: 'rgba(46,213,115,0.05)', borderRadius: 6, color: 'var(--white)', fontSize: '0.85rem',
            }}>
              <span>{r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}</span>
              <span>{fmtDollars(Number(r.commission_amount ?? 0))}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
