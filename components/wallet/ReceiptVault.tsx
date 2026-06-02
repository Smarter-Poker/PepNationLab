'use client';

import { useEffect, useState } from 'react';

export default function ReceiptVault() {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    fetch('/api/agent/wallet/receipts?limit=100', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(setData)
      .catch(() => setData({ receipts: [] }));
  }, []);
  if (!data) return <div style={{ color: 'var(--grey-400)', padding: 16 }}>Loading...</div>;
  return (
    <section className="card-glass" style={{ padding: 16, borderRadius: 12 }}>
      <h3 style={{ color: 'var(--white)', marginTop: 0 }}>Receipt Vault</h3>
      <p style={{ color: 'var(--grey-400)', fontSize: '0.82rem' }}>{(data.count ?? data.receipts.length)} Payment Proofs Across All Orders.</p>
      {data.receipts.length === 0 ? (
        <p style={{ color: 'var(--grey-500)' }}>No Receipts Yet.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
          {data.receipts.map((r: any) => (
            <div key={r.id} style={{
              background: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ color: 'var(--white)', fontSize: '0.82rem', fontWeight: 700, wordBreak: 'break-word' }}>
                {r.storage_key?.split('/').pop() || 'Receipt'}
              </div>
              <div style={{ color: 'var(--grey-500)', fontSize: '0.68rem' }}>{r.mime_type || ''}</div>
              <div style={{ color: 'var(--grey-400)', fontSize: '0.72rem', marginTop: 4 }}>
                {r.uploaded_at ? new Date(r.uploaded_at).toLocaleDateString() : ''}
              </div>
              <div style={{ color: 'var(--grey-500)', fontSize: '0.7rem', wordBreak: 'break-word', marginTop: 2 }}>
                Order: {String(r.order_id ?? '').slice(0, 8)}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
