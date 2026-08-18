'use client';

import { useEffect, useState, useCallback } from 'react';

const money = (n: number) =>
  `$${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Date-only strings (YYYY-MM-DD) are pinned to local midnight so they don't
// slip a day in negative-offset timezones, mirroring WalletPage's fmtDate.
const fmtDate = (s: string | null | undefined): string => {
  if (!s) return '-';
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00` : s;
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? s
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

function weekCloseText(weekEndsAtIso: string, now: number): string {
  const end = new Date(weekEndsAtIso).getTime();
  const diff = end - now;
  if (isNaN(end) || diff <= 0) {
    return 'Sales Week Closed - Invoices Generate Monday Morning';
  }
  const weekday = new Date(weekEndsAtIso).toLocaleDateString('en-US', {
    weekday: 'long',
    timeZone: 'America/Chicago',
  });
  const dayMs = 24 * 60 * 60 * 1000;
  const hourMs = 60 * 60 * 1000;
  const days = Math.floor(diff / dayMs);
  const hours = Math.floor((diff % dayMs) / hourMs);
  return `Sales Week Closes ${weekday} 11:59 PM CT - ${days}d ${hours}h Left`;
}

type UnconfirmedPayment = { orderId: string; shortId: string; total: number; createdAt: string };

type Downline = {
  id: string;
  fullName: string | null;
  accountType: 'prepaid' | 'credit';
  prepaidBalance: number;
  creditUsed: number;
  creditLimit: number;
  openInvoiceTotal: number;
  openInvoiceCount: number;
  oldestOpenWeekStart: string | null;
  currentWeekOrderCount: number;
  currentWeekOrderTotal: number;
  unconfirmedPayments: UnconfirmedPayment[];
};

export default function DownlineBalances() {
  const [downlines, setDownlines] = useState<Downline[] | null>(null);
  const [weekEndsAtIso, setWeekEndsAtIso] = useState<string | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());
  const [confirmingIds, setConfirmingIds] = useState<Record<string, boolean>>({});
  const [confirmErrors, setConfirmErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/agent/downline-balances', { cache: 'no-store' });
        if (!res.ok) return;
        const j = await res.json();
        if (cancelled) return;
        const list: Downline[] = Array.isArray(j?.downlines) ? j.downlines : [];
        if (list.length === 0) return;
        setDownlines(list);
        setWeekEndsAtIso(typeof j?.weekEndsAtIso === 'string' ? j.weekEndsAtIso : null);
      } catch {
        // Network or parse failure - component stays hidden.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  const confirmPayment = useCallback(async (downlineId: string, orderId: string) => {
    setConfirmingIds((prev) => ({ ...prev, [orderId]: true }));
    setConfirmErrors((prev) => {
      const next = { ...prev };
      delete next[orderId];
      return next;
    });
    try {
      const res = await fetch('/api/agent/orders/confirm-downline-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      if (!res.ok) {
        let msg = 'Could Not Confirm Payment';
        try {
          const j = await res.json();
          if (j?.error) msg = j.error;
        } catch {
          // keep default message
        }
        setConfirmErrors((prev) => ({ ...prev, [orderId]: msg }));
        return;
      }
      setDownlines((prev) =>
        prev
          ? prev.map((d) =>
              d.id === downlineId
                ? { ...d, unconfirmedPayments: d.unconfirmedPayments.filter((p) => p.orderId !== orderId) }
                : d,
            )
          : prev,
      );
    } catch {
      setConfirmErrors((prev) => ({ ...prev, [orderId]: 'Network Error - Try Again' }));
    } finally {
      setConfirmingIds((prev) => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
    }
  }, []);

  if (!downlines || downlines.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <h2 style={{ color: 'var(--white)', margin: 0, fontSize: '1.1rem', fontFamily: 'var(--font-brand)' }}>
          Downline Balances
        </h2>
        {weekEndsAtIso && (
          <p style={{ color: 'var(--grey-400)', fontSize: '0.82rem', margin: '4px 0 0' }}>
            {weekCloseText(weekEndsAtIso, now)}
          </p>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {downlines.map((d) => {
          const isPrepaid = d.accountType === 'prepaid';
          const util = d.creditLimit > 0 ? Math.min(100, (d.creditUsed / d.creditLimit) * 100) : 0;
          const utilHigh = d.creditLimit > 0 && d.creditUsed / d.creditLimit >= 0.8;
          const pillStyle = isPrepaid
            ? { background: 'rgba(0,196,188,0.14)', color: 'var(--teal)' }
            : { background: 'rgba(255,184,0,0.18)', color: '#ffb800' };

          return (
            <section
              key={d.id}
              className="glass-panel"
              style={{ padding: 16, borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 8 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <strong style={{ color: 'var(--white)', fontSize: '0.95rem' }}>{d.fullName || 'Agent'}</strong>
                <span
                  style={{
                    padding: '2px 8px', borderRadius: 6, fontSize: '0.68rem', fontWeight: 800,
                    letterSpacing: '0.04em', ...pillStyle,
                  }}
                >
                  {isPrepaid ? 'Prepaid' : 'Credit'}
                </span>
              </div>

              {isPrepaid ? (
                <div style={{ color: 'var(--silver)', fontSize: '0.88rem' }}>
                  Prepaid Balance: <strong style={{ color: 'var(--teal)' }}>{money(d.prepaidBalance)}</strong>
                </div>
              ) : (
                <div>
                  <div style={{ color: 'var(--silver)', fontSize: '0.88rem' }}>
                    Credit Used:{' '}
                    <strong style={{ color: utilHigh ? '#ff6b6b' : 'var(--teal)' }}>{money(d.creditUsed)}</strong> Of{' '}
                    {money(d.creditLimit)}
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginTop: 6 }}>
                    <div
                      style={{
                        height: '100%', width: `${util}%`,
                        background: utilHigh ? '#ff6b6b' : 'var(--teal)', borderRadius: 3,
                      }}
                    />
                  </div>
                </div>
              )}

              <div style={{ color: 'var(--grey-400)', fontSize: '0.82rem' }}>
                This Week: {d.currentWeekOrderCount} Orders / {money(d.currentWeekOrderTotal)}
              </div>

              {!isPrepaid && d.openInvoiceCount > 0 && (
                <div style={{ color: '#ff6b6b', fontSize: '0.82rem' }}>
                  <div>
                    Open Invoices: {money(d.openInvoiceTotal)} ({d.openInvoiceCount})
                  </div>
                  {d.oldestOpenWeekStart && <div>Oldest: Week Of {fmtDate(d.oldestOpenWeekStart)}</div>}
                </div>
              )}

              {isPrepaid && d.unconfirmedPayments.length > 0 && (
                <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ color: 'var(--grey-400)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Awaiting Your Payment Confirmation
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {d.unconfirmedPayments.map((p) => {
                      const isConfirming = !!confirmingIds[p.orderId];
                      const err = confirmErrors[p.orderId];
                      return (
                        <li
                          key={p.orderId}
                          style={{
                            display: 'flex', flexDirection: 'column', gap: 4,
                            padding: '8px 10px', background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                            <span style={{ color: 'var(--white)', fontSize: '0.84rem' }}>
                              Order #{p.shortId} - {money(p.total)} - {new Date(p.createdAt).toLocaleDateString()}
                            </span>
                            <button
                              type="button"
                              disabled={isConfirming}
                              onClick={() => confirmPayment(d.id, p.orderId)}
                              style={{
                                background: 'var(--teal)', color: 'var(--black)', border: 'none',
                                padding: '8px 14px', borderRadius: 8, fontWeight: 800, fontSize: '0.76rem',
                                cursor: isConfirming ? 'not-allowed' : 'pointer', opacity: isConfirming ? 0.6 : 1,
                                minHeight: 36, whiteSpace: 'nowrap',
                              }}
                            >
                              {isConfirming ? 'Confirming...' : 'Did You Receive Payment? Confirm'}
                            </button>
                          </div>
                          {err && <span style={{ color: '#ff6b6b', fontSize: '0.72rem' }}>{err}</span>}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
