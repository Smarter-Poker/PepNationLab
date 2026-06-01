'use client';

import { useEffect, useState } from 'react';

export default function AutoInsightsCallouts() {
  const [data, setData] = useState<any[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch('/api/agent/sales/insights-v2', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(j => setData(j.insights ?? []))
      .catch(() => setData([]));
  }, []);

  const visible = data.filter(i => !hidden.has(i.id));
  if (visible.length === 0) return null;

  const color = (k: string) => k === 'restock' ? '#ffb800' : k === 'dormant' ? '#ff4757' : k === 'goal' ? '#2ed573' : 'var(--teal)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {visible.map((i: any) => (
        <div key={i.id} style={{
          padding: '10px 14px',
          background: 'rgba(255,255,255,0.04)',
          borderLeft: `3px solid ${color(i.kind)}`,
          borderRadius: 8, display: 'flex', justifyContent: 'space-between', gap: 12,
        }}>
          <div>
            <div style={{ color: 'var(--white)', fontWeight: 700, fontSize: '0.88rem' }}>{i.title}</div>
            <div style={{ color: 'var(--grey-300)', fontSize: '0.82rem' }}>{i.body}</div>
          </div>
          <button onClick={() => setHidden(h => new Set([...h, i.id]))} aria-label="Dismiss"
            style={{
              background: 'transparent', border: 'none', color: 'var(--grey-500)',
              cursor: 'pointer', fontSize: '1.1rem', padding: 6, minHeight: 44, minWidth: 44,
            }}>Dismiss</button>
        </div>
      ))}
    </div>
  );
}
