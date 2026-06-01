'use client';

import type { RangePreset } from '@/lib/sales-range';

const PRESETS: { id: RangePreset; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7 Days' },
  { id: '30d', label: '30 Days' },
  { id: 'mtd', label: 'MTD' },
  { id: 'qtd', label: 'QTD' },
  { id: 'ytd', label: 'YTD' },
];

export default function SalesFilterBar({
  preset, onChange,
}: { preset: RangePreset; onChange: (p: RangePreset) => void }) {
  return (
    <div style={{
      display: 'flex', gap: 6, overflowX: 'auto', padding: '4px 0',
      position: 'sticky', top: 'var(--nav-offset, 60px)', zIndex: 10,
      background: 'var(--black)',
    }}>
      {PRESETS.map(p => (
        <button key={p.id} onClick={() => onChange(p.id)}
          style={{
            padding: '8px 14px', borderRadius: 999, whiteSpace: 'nowrap',
            background: preset === p.id ? 'var(--teal)' : 'rgba(255,255,255,0.04)',
            color: preset === p.id ? 'var(--black)' : 'var(--grey-300)',
            border: '1px solid rgba(255,255,255,0.08)',
            fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', minHeight: 44,
          }}>
          {p.label}
        </button>
      ))}
    </div>
  );
}
