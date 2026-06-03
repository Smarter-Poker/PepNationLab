'use client';

import { useEffect, useState } from 'react';

const money = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format((Number(cents) || 0) / 100);

export default function SubAgentRollupTable({ preset }: { preset: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/agent/sales/sub-agent-rollup?range=${preset}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(j => setRows(j.rows ?? []))
      .catch(async r => {
        if (r?.status === 403) setErr('hidden');
        else setErr('Could Not Load');
      });
  }, [preset]);

  if (err === 'hidden') return null;
  if (err) return null;
  if (rows.length === 0) return null;

  return (
    <div className="glass-panel" style={{ padding: 14, borderRadius: 12 }}>
      <h3 style={{ color: 'var(--white)', fontSize: '0.95rem', margin: '0 0 8px' }}>Sub-Agent Rollup</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <th style={{ textAlign: 'left', padding: 8, color: 'var(--silver)' }}>Sub Agent</th>
            <th style={{ textAlign: 'right', padding: 8, color: 'var(--silver)' }}>Orders</th>
            <th style={{ textAlign: 'right', padding: 8, color: 'var(--silver)' }}>Revenue</th>
            <th style={{ textAlign: 'right', padding: 8, color: 'var(--teal)' }}>Profit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.sub_agent_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <td style={{ padding: '10px 8px', color: 'var(--white)' }}>{r.name}</td>
              <td style={{ padding: '10px 8px', color: 'var(--white)', textAlign: 'right' }}>{r.orders_count}</td>
              <td style={{ padding: '10px 8px', color: 'var(--white)', textAlign: 'right' }}>{money(r.revenue_cents)}</td>
              <td style={{ padding: '10px 8px', color: 'var(--teal)', textAlign: 'right', fontWeight: 700 }}>{money(r.profit_cents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
