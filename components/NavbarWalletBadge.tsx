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
      } catch {
        // Ignore — the icon stays a working link regardless of the snapshot.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Always a clickable link, even before the snapshot loads, so tapping the
  // icon reliably opens the wallet. Admins land on their dashboard wallet.
  const linkHref = data?.role === 'admin' ? '/admin' : '/wallet';

  return (
    <Link
      href={linkHref}
      aria-label="Open Wallet"
      title="View Wallet & Accounting"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        textDecoration: 'none',
        transition: 'transform 0.2s',
      }}
      onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.05)')}
      onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
    >
      <img src="/nav-icons/wallet-icon.png" alt="Wallet" width={84} height={84} style={{ display: 'block' }} />
    </Link>
  );
}
