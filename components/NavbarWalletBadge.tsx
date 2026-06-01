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

  const linkHref = data.role === 'admin'
    ? '/admin'
    : '/wallet';

  return (
    <Link
      href={linkHref}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        textDecoration: 'none',
        transition: 'transform 0.2s',
      }}
      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
      title="View Wallet & Accounting"
    >
      <img src="/nav-icons/wallet-icon.png" alt="Wallet" width={84} height={84} style={{ display: 'block' }} />
    </Link>
  );
}
