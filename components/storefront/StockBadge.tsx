import React from 'react';
import Image from 'next/image';

export type StockState =
  | { kind: 'in_stock_local' }
  | { kind: 'in_stock_shipping' }
  | { kind: 'low_stock'; count: number }
  | { kind: 'backorder'; days: number }
  | { kind: 'out_of_stock' };

export function computeStockState(
  agentCount: number,
  masterInventory: number,
  threshold: number,
  backorderDays: number
): StockState {
  if (agentCount > threshold) return { kind: 'in_stock_local' };
  if (agentCount > 0) return { kind: 'low_stock', count: agentCount };
  if (masterInventory > 0) return { kind: 'in_stock_shipping' };
  if (backorderDays > 0) return { kind: 'backorder', days: backorderDays };
  return { kind: 'out_of_stock' };
}

export function StockBadge({ state }: { state: StockState }) {
  if (state.kind === 'in_stock_local') {
    return (
      <div style={{ display: 'flex', width: '100%', margin: '0' }}>
        <Image 
          src="/images/ui/instock-banner.png" 
          alt="In Stock (Same-Day Pickup)" 
          width={400} 
          height={60} 
          style={{ width: '100%', height: 'auto', objectFit: 'contain', display: 'block' }} 
          unoptimized 
        />
      </div>
    );
  }

  let bg = 'rgba(192,184,168,0.15)';
  let fg = '#C0B8A8';
  let border = 'rgba(192,184,168,0.40)';
  let label = 'In Stock';
  let badgeSrc = '/images/badges/badge_in_stock.png';
  
  if (state.kind === 'in_stock_shipping') {
    bg = 'rgba(102,126,234,0.15)';
    fg = '#667EEA';
    border = 'rgba(102,126,234,0.40)';
    label = 'In Stock (Needs Shipping)';
    badgeSrc = '/images/badges/badge_in_stock.png';
  } else if (state.kind === 'low_stock') {
    bg = 'rgba(246,173,85,0.15)';
    fg = '#00E5FF';
    border = 'rgba(246,173,85,0.40)';
    label = `Only ${state.count} Left`;
    badgeSrc = '/images/badges/badge_low_stock.png';
  } else if (state.kind === 'backorder') {
    bg = 'rgba(168,180,192,0.15)';
    fg = '#A8B4C0';
    border = 'rgba(168,180,192,0.40)';
    label = 'Not Available for Same-Day';
    badgeSrc = '/images/badges/badge_out_of_stock.png';
  } else if (state.kind === 'out_of_stock') {
    bg = 'rgba(229,62,62,0.15)';
    fg = '#E53E3E';
    border = 'rgba(229,62,62,0.40)';
    label = 'Out Of Stock';
    badgeSrc = '/images/badges/badge_out_of_stock.png';
  }
  return (
    <span
      className="stock-badge"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: '0.65rem',
        fontWeight: 800,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        padding: '2px 8px 2px 2px',
        borderRadius: 9999,
        background: bg,
        color: fg,
        border: `1px solid ${border}`,
        backdropFilter: 'blur(4px)',
        whiteSpace: 'nowrap',
      }}
    >
      <Image src={badgeSrc} alt={label} width={22} height={22} style={{ height: 22, width: 'auto', objectFit: 'contain' }} unoptimized />
      {label}
    </span>
  );
}
