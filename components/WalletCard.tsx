'use client';

import { useEffect, useState } from 'react';

/**
 * Lab Wallet — unified balance + transaction history card.
 *
 * Renders for ANY role from the single GET /api/wallet snapshot. Researchers see
 * their store-credit "Lab Wallet" balance; agents / super-agents / sub-agents see
 * their prepaid wallet plus their credit line. The full merged transaction history
 * is shown beneath the balances.
 */

interface WalletTxn {
  id: string;
  ledger: 'wallet' | 'credit';
  type: string;
  signedAmount: number;
  balanceAfter: number | null;
  description: string;
  createdAt: string;
}

interface WalletSnapshot {
  role: string;
  accountType: string | null;
  primaryLedger: 'credit' | 'wallet';
  storeCredit: number;
  prepaidBalance: number;
  creditLimit: number | null;
  creditUsed: number;
  creditAvailable: number | null;
  transactions: WalletTxn[];
}

const money = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n) || 0);

function prettyType(t: string): string {
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function WalletCard() {
  const [data, setData] = useState<WalletSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/wallet', { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed To Load Wallet');
        if (!cancelled) setData(json);
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Failed To Load Wallet');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="metal-frame" style={{ textAlign: 'center', color: 'var(--silver)' }}>
        <div className="metal-content" style={{ padding: 'var(--space-8)' }}>
          Loading Your Lab Wallet...
        </div>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="metal-frame" style={{ color: 'var(--red)' }}>
        <div className="metal-content" style={{ padding: 'var(--space-6)' }}>
          {error || 'Wallet Unavailable.'}
        </div>
      </div>
    );
  }

  const isResearcher = data.role === 'researcher';
  // Show the credit line whenever a limit exists — agents on credit frequently
  // have a null account_type, so gating strictly on 'credit' hid the whole line
  // and left the wallet looking empty ($0 prepaid, nothing else).
  const hasCreditLine = data.creditLimit != null && data.creditLimit > 0;
  // Hero balance: researchers show store credit; credit-line agents show their
  // available credit (real spending power); everyone else shows prepaid balance.
  const primaryBalance = isResearcher
    ? data.storeCredit
    : hasCreditLine
    ? (data.creditAvailable ?? 0)
    : data.prepaidBalance;
  const primaryLabel = isResearcher
    ? 'Lab Wallet Credit'
    : hasCreditLine
    ? 'Available Credit'
    : 'Prepaid Balance';
  // Show the secondary balance only when it carries a value worth surfacing.
  const showSecondary = isResearcher
    ? data.prepaidBalance > 0
    : data.storeCredit > 0;
  const usedPct =
    hasCreditLine && data.creditLimit && data.creditLimit > 0
      ? Math.min(100, Math.round((data.creditUsed / data.creditLimit) * 100))
      : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      {/* Balance hero */}
      <div className="metal-frame">
        <div
          className="metal-content"
          style={{
            padding: 'var(--space-6)',
            background: 'linear-gradient(180deg, #0d1822 0%, #0a1119 100%)',
          }}
        >
          <div
          style={{
            fontSize: '0.72rem',
            color: 'var(--teal)',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            fontWeight: 700,
            marginBottom: 'var(--space-2)',
          }}
        >
          Lab Wallet
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--grey-400)', marginBottom: 4 }}>{primaryLabel}</div>
            <div
              style={{
                fontSize: '2.6rem',
                fontWeight: 800,
                color: 'var(--teal)',
                fontFamily: 'var(--font-brand)',
                lineHeight: 1,
                textShadow: '0 0 18px rgba(0,196,188,0.25)',
              }}
            >
              {money(primaryBalance)}
            </div>
          </div>
          {showSecondary && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--grey-400)', marginBottom: 4 }}>
                {isResearcher ? 'Prepaid Balance' : 'Store Credit'}
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--silver)', fontFamily: 'var(--font-brand)' }}>
                {money(isResearcher ? data.prepaidBalance : data.storeCredit)}
              </div>
            </div>
          )}
        </div>

        {/* Credit line */}
        {hasCreditLine && (
          <div style={{ marginTop: 'var(--space-5)', paddingTop: 'var(--space-4)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 6 }}>
              <span style={{ color: 'var(--grey-400)' }}>Credit Line</span>
              <span style={{ color: 'var(--silver)', fontWeight: 600 }}>
                {money(data.creditAvailable ?? 0)} Available <span style={{ color: 'var(--grey-500)' }}>Of {money(data.creditLimit ?? 0)}</span>
              </span>
            </div>
            <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 999, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${usedPct}%`,
                  borderRadius: 999,
                  background: usedPct > 85 ? 'var(--red)' : 'linear-gradient(90deg, #00C4BC, #00E5FF)',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--grey-500)', marginTop: 6 }}>
              {money(data.creditUsed)} Used This Cycle
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Transaction history */}
      <div className="metal-frame">
        <div className="metal-content" style={{ padding: 'var(--space-6)' }}>
          <h3
          style={{
            fontSize: '0.82rem',
            color: 'var(--silver)',
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            marginBottom: 'var(--space-4)',
          }}
        >
          Transaction History
        </h3>
        {data.transactions.length === 0 ? (
          <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--grey-400)', fontSize: '0.88rem' }}>
            No Wallet Activity Yet. Credits, Deposits, And Order Charges Will Appear Here.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {data.transactions.map((t) => {
              const positive = t.signedAmount >= 0;
              return (
                <div
                  key={t.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    padding: '12px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.9rem', color: 'var(--white)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.description}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--grey-500)', marginTop: 2 }}>
                      {new Date(t.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      <span style={{ margin: '0 6px', color: 'rgba(255,255,255,0.15)' }}>|</span>
                      <span
                        style={{
                          color: t.ledger === 'credit' ? 'var(--teal)' : 'var(--grey-400)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {t.ledger === 'credit' ? 'Credit' : 'Wallet'} / {prettyType(t.type)}
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: positive ? '#68D391' : '#FC8181', fontFamily: 'var(--font-brand)' }}>
                      {positive ? '+' : '-'}
                      {money(Math.abs(t.signedAmount))}
                    </div>
                    {t.balanceAfter != null && (
                      <div style={{ fontSize: '0.68rem', color: 'var(--grey-500)', marginTop: 2 }}>
                        Bal {money(t.balanceAfter)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
