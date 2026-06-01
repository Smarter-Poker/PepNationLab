'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface WalletSnapshot {
  role: string;
  accountType: string | null;
  primaryLedger: 'credit' | 'wallet';
  storeCredit: number;
  prepaidBalance: number;
  creditLimit: number | null;
  creditUsed: number;
  creditAvailable: number | null;
}

const money = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n) || 0);

export default function NavbarWalletBadge() {
  const [data, setData] = useState<WalletSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/wallet', { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        if (!cancelled) setData(json);
      } catch (e) {
        // Ignore errors for badge
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) {
    return (
      <div style={{ width: 80, height: 24, borderRadius: 12, background: 'var(--surface-2)' }} className="skeleton" />
    );
  }

  const isResearcher = data.role === 'researcher';
  const primaryBalance = isResearcher ? data.storeCredit : data.prepaidBalance;

  // NOTE: the tab value must be URL-encoded — the raw "Sales & Accounting"
  // contains an "&" that otherwise terminates the query string, leaving the
  // dashboard with an invalid tab and a blank panel (the wallet never renders).
  const linkHref = data.role === 'admin'
    ? '/admin'
    : isResearcher
    ? `/dashboard?tab=${encodeURIComponent('wallet')}`
    : `/dashboard/agent?tab=${encodeURIComponent('Sales & Accounting')}`;

  return (
    <Link
      href={linkHref}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        background: 'rgba(0,196,188,0.1)',
        border: '1px solid rgba(0,196,188,0.3)',
        padding: '4px 10px',
        borderRadius: '999px',
        textDecoration: 'none',
        color: 'var(--teal)',
        fontWeight: 700,
        fontSize: '0.85rem',
        fontFamily: 'var(--font-brand)',
        transition: 'transform 0.2s',
      }}
      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
      title="View Wallet & Accounting"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"></path>
        <path d="M4 6v12c0 1.1.9 2 2 2h14v-4"></path>
        <path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z"></path>
      </svg>
      {money(primaryBalance)}
    </Link>
  );
}
