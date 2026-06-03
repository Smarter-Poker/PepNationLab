'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { fmtDate } from './format';

export default function ReceiptVault() {
  const [data, setData] = useState<any>(null);
  const [opening, setOpening] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/agent/wallet/receipts?limit=100', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(setData)
      .catch(() => setData({ receipts: [] }));
  }, []);

  async function open(id: string) {
    setOpening(id);
    try {
      const res = await fetch(`/api/agent/wallet/receipts/${id}`, { cache: 'no-store' });
      const j = await res.json();
      if (!res.ok || !j.url) throw new Error(j.error || 'failed');
      window.open(j.url, '_blank', 'noopener,noreferrer');
    } catch {
      toast.error('Could Not Open Receipt');
    } finally {
      setOpening(null);
    }
  }

  if (!data) return <div style={{ color: 'var(--grey-400)', padding: 16 }}>Loading...</div>;

  return (
    <section className="glass-panel" style={{ padding: 16, borderRadius: 12 }}>
      <h3 style={{ color: 'var(--white)', marginTop: 0 }}>Receipt Vault</h3>
      <p style={{ color: 'var(--grey-400)', fontSize: '0.82rem' }}>{(data.count ?? data.receipts.length)} Payment Proofs Across All Orders.</p>
      {data.receipts.length === 0 ? (
        <p style={{ color: 'var(--grey-500)' }}>No Receipts Yet.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
          {data.receipts.map((r: any) => (
            <button
              key={r.id}
              type="button"
              onClick={() => open(r.id)}
              disabled={opening === r.id}
              title="Open Receipt"
              style={{
                textAlign: 'left', background: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.06)', cursor: opening === r.id ? 'wait' : 'pointer',
                color: 'inherit', font: 'inherit', minHeight: 44,
              }}
            >
              <div style={{ color: 'var(--white)', fontSize: '0.82rem', fontWeight: 700, wordBreak: 'break-word' }}>
                {r.storage_key?.split('/').pop() || 'Receipt'}
              </div>
              <div style={{ color: 'var(--grey-500)', fontSize: '0.68rem' }}>{r.mime_type || ''}</div>
              <div style={{ color: 'var(--grey-400)', fontSize: '0.72rem', marginTop: 4 }}>
                {r.uploaded_at ? fmtDate(r.uploaded_at) : ''}
              </div>
              <div style={{ color: 'var(--grey-500)', fontSize: '0.7rem', wordBreak: 'break-word', marginTop: 2 }}>
                Order: {String(r.order_id ?? '').slice(0, 8)}
              </div>
              <div style={{ color: 'var(--teal)', fontSize: '0.72rem', fontWeight: 700, marginTop: 6 }}>
                {opening === r.id ? 'Opening...' : 'Open / Download'}
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
