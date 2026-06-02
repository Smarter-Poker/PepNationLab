'use client';

import { ArrowUp, ArrowDown } from 'lucide-react';

const money = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
    .format((Number(cents) || 0) / 100);

function Delta({ d }: { d: number | null }) {
  if (d === null || !isFinite(d)) return <span style={{ color: 'var(--grey-500)', fontSize: '0.75rem' }}>—</span>;
  const up = d >= 0;
  const color = up ? '#2ed573' : '#ff4757';
  return (
    <span style={{ color, fontSize: '0.78rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      {up ? <ArrowUp size={12} aria-hidden /> : <ArrowDown size={12} aria-hidden />} {Math.abs(d).toFixed(1)}%
    </span>
  );
}

export default function SalesKPIStrip({ data }: { data: any }) {
  if (!data) return null;
  const c = data.current ?? {};
  const d = data.deltas ?? {};
  const tiles = [
    { label: 'Revenue', value: money(c.revenue_cents), delta: d.revenue },
    { label: 'Profit', value: money(c.profit_cents), delta: d.profit },
    { label: 'Orders', value: String(c.orders_count ?? 0), delta: d.orders },
    { label: 'Avg Order', value: money(c.aov_cents), delta: d.aov },
    { label: 'New Researchers', value: String(c.new_researchers ?? 0), delta: d.newResearchers },
    { label: 'Cancelled', value: String(c.cancelled_count ?? 0), delta: null },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
      {tiles.map(t => (
        <div key={t.label} className="metal-frame">
          <div className="metal-content" style={{ padding: 12 }}>
            <div style={{ color: 'var(--grey-400)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t.label}</div>
            <div style={{ color: 'var(--white)', fontSize: '1.4rem', fontWeight: 800, marginTop: 2 }}>{t.value}</div>
            <div style={{ marginTop: 4 }}><Delta d={t.delta ?? null} /></div>
          </div>
        </div>
      ))}
    </div>
  );
}
