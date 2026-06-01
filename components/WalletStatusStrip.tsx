'use client';

/**
 * WalletStatusStrip — Round 24
 * --------------------------------------------------------------
 * A one-line at-a-glance row that replaces the full WalletCard inside
 * the Sales tab. Shows: Balance · Owed This Week · Pay Now deep-link.
 *
 * The full Wallet surface lives at /wallet (route added in Round 24).
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';

type WalletSummary = {
  primaryLabel: string;
  primary: number;
  owedThisWeek: number;
  hasOpenStatement: boolean;
};

function money(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);
}

export default function WalletStatusStrip() {
  const [data, setData] = useState<WalletSummary | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let on = true;
    fetch('/api/agent/wallet/summary', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(d => {
        if (!on) return;
        setData(d);
      })
      .catch(() => on && setErr(true));
    return () => {
      on = false;
    };
  }, []);

  if (err) return null;
  if (!data) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          borderRadius: 10,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.06)',
          color: 'var(--grey-500)',
          fontSize: '0.85rem',
        }}
      >
        Loading Wallet Snapshot...
      </div>
    );
  }

  return (
    <Link
      href="/wallet"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--space-4)',
        padding: '12px 16px',
        borderRadius: 12,
        background: 'linear-gradient(135deg, rgba(192,184,168,0.08), rgba(255,255,255,0.02))',
        border: '1px solid rgba(192,184,168,0.18)',
        textDecoration: 'none',
        color: 'var(--white)',
        boxShadow: '0 0 0 1px rgba(0,0,0,0.2)',
      }}
    >
      <div style={{ display: 'flex', gap: 'var(--space-6)', flexWrap: 'wrap', alignItems: 'baseline' }}>
        <span style={{ display: 'inline-flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {data.primaryLabel}
          </span>
          <strong style={{ fontSize: '1.05rem', color: 'var(--white)' }}>{money(data.primary)}</strong>
        </span>
        <span style={{ color: 'var(--grey-500)' }}>·</span>
        <span style={{ display: 'inline-flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Owed This Week
          </span>
          <strong style={{ fontSize: '1.05rem', color: data.owedThisWeek > 0 ? 'var(--white)' : 'var(--grey-500)' }}>
            {money(data.owedThisWeek)}
          </strong>
        </span>
      </div>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 14px',
          borderRadius: 8,
          background: data.hasOpenStatement ? 'var(--teal)' : 'rgba(255,255,255,0.05)',
          color: data.hasOpenStatement ? 'var(--black)' : 'var(--grey-300)',
          fontWeight: 700,
          fontSize: '0.82rem',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        {data.hasOpenStatement ? 'Pay Now' : 'Open Wallet'}
        <span aria-hidden>→</span>
      </span>
    </Link>
  );
}
