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
        // Ignore - the icon stays a working link regardless of the snapshot.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Always route every role - admins included - to the unified /wallet page.
  // Admins have prepaid_balance like everyone else (seeded $100k) and need the
  // same Send/Spend/Activity view; sending them to /admin instead hid the
  // wallet entirely. The snapshot fetch above just primes the SWR; the actual
  // link target no longer branches on role.
  const linkHref = '/wallet';

  return (
    <Link
      href={linkHref}
      aria-label="Open Wallet"
      title="View Wallet & Accounting"
      className="hover-scale-105"
      style={{
        display: 'flex',
        alignItems: 'center',
        background: 'none',
        flexShrink: 0,
        position: 'relative',
        left: -8,
        padding: 4
      }}
    >
      <img src="/nav-icons/wallet-icon.png" alt="Wallet" width={84} height={84} style={{ display: 'block' }} />
    </Link>
  );
}
