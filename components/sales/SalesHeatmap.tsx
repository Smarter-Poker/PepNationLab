'use client';

import { useEffect, useState } from 'react';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function SalesHeatmap({ preset }: { preset: string }) {
  const [cells, setCells] = useState<any[]>([]);
  const [max, setMax] = useState(1);

  useEffect(() => {
    fetch(`/api/agent/sales/heatmap?range=${preset}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then((j: any) => {
        if (!j) return;
        setCells(j.cells ?? []);
        setMax(Math.max(1, ...(j.cells ?? []).map((c: any) => c.orders)));
      });
  }, [preset]);

  function color(orders: number) {
    if (orders === 0) return 'rgba(255,255,255,0.04)';
    const ratio = Math.min(1, orders / max);
    return `rgba(0, 196, 188, ${0.2 + ratio * 0.8})`;
  }

  return (
    <div className="glass-panel">
      <div className="" style={{ padding: 12 }}>
        <h3 style={{ color: 'var(--white)', fontSize: '0.95rem', margin: '0 0 8px' }}>Activity Heatmap</h3>
        <p style={{ color: 'var(--grey-400)', fontSize: '0.75rem', margin: '0 0 10px' }}>
          Orders By Day Of Week And Hour
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: '0.66rem', minWidth: 600 }}>
            <thead>
              <tr>
                <th></th>
                {Array.from({ length: 24 }).map((_, h) => (
                  <th key={h} style={{ color: 'var(--grey-500)', padding: '2px 1px', textAlign: 'center', minWidth: 16 }}>
                    {h % 6 === 0 ? h : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DOW.map((label, dow) => (
                <tr key={dow}>
                  <td style={{ color: 'var(--grey-400)', padding: '2px 6px', fontWeight: 700 }}>{label}</td>
                  {Array.from({ length: 24 }).map((_, h) => {
                    const cell = cells.find(c => c.dow === dow && c.hour === h);
                    const orders = cell?.orders ?? 0;
                    return (
                      <td key={h} title={`${DOW[dow]} ${h}:00 - ${orders} orders`}
                        style={{
                          width: 16, height: 16, background: color(orders), borderRadius: 2,
                          padding: 0, margin: 0, border: '1px solid rgba(0,0,0,0.2)',
                        }} />
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
