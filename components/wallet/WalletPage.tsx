'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import PayNowSheet from './PayNowSheet';
import StatementDetailModal from './StatementDetailModal';
import CommissionsTab from './CommissionsTab';
import ReceiptVault from './ReceiptVault';
import CreditIncreaseForm from './CreditIncreaseForm';
import WalletSettings from './WalletSettings';

const money = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(Number(n) || 0);

// Title Case status labels — the API returns raw enum text (e.g. pending_payment)
// which must never reach the UI per the platform Title Case rule.
const STATUS_LABEL: Record<string, string> = {
  paid: 'Paid',
  pending_payment: 'Pending Payment',
  open: 'Open',
  disputed: 'Disputed',
  cancelled: 'Cancelled',
};
const statusLabel = (s: string | null | undefined): string => {
  const k = (s || '').toLowerCase();
  return STATUS_LABEL[k] || k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || '—';
};

// Consistent, human-readable dates. Date-only strings (YYYY-MM-DD) are pinned to
// local midnight so they don't slip a day in negative-offset timezones.
const fmtDate = (s: string | null | undefined): string => {
  if (!s) return '—';
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00` : s;
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? s
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

type ActivityTxn = {
  id: string;
  ledger: 'wallet' | 'credit';
  type: string;
  signedAmount: number;
  balanceAfter: number | null;
  description: string;
  createdAt: string;
};

type Tab = 'overview' | 'activity' | 'statements' | 'commissions' | 'receipts' | 'settings';

export default function WalletPage({
  userId, role, isSuperAgent,
}: { userId: string; role: string; isSuperAgent: boolean }) {
  const [tab, setTab] = useState<Tab>('overview');
  const [summary, setSummary] = useState<any>(null);
  const [statements, setStatements] = useState<any[]>([]);
  const [activity, setActivity] = useState<ActivityTxn[]>([]);
  const [storeCredit, setStoreCredit] = useState<number>(0);
  const [payOpen, setPayOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [creditOpen, setCreditOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  async function refresh() {
    setLoading(true);
    setError(false);
    try {
      const [sumRes, stmtRes, walletRes] = await Promise.all([
        fetch('/api/agent/wallet/summary', { cache: 'no-store' }),
        fetch('/api/agent/statements', { cache: 'no-store' }),
        fetch('/api/wallet', { cache: 'no-store' }),
      ]);
      if (!sumRes.ok) throw new Error('summary');
      setSummary(await sumRes.json());
      if (stmtRes.ok) {
        const j = await stmtRes.json();
        setStatements(j.statements ?? j.data ?? []);
      }
      if (walletRes.ok) {
        const j = await walletRes.json();
        setActivity(Array.isArray(j.transactions) ? j.transactions : []);
        setStoreCredit(typeof j.storeCredit === 'number' ? j.storeCredit : 0);
      }
    } catch {
      setError(true);
      toast.error('Could Not Load Wallet');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  // A statement is overdue when it is still open/pending and its due date has passed.
  const now = Date.now();
  const overdue = (summary?.openStatements ?? []).some(
    (s: any) => s.due_date && new Date(s.due_date).getTime() < now && s.status !== 'paid'
  );

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'activity', label: 'Activity' },
    { id: 'statements', label: 'Statements' },
    { id: 'commissions', label: 'Commissions' },
    { id: 'receipts', label: 'Receipts' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <div style={{ paddingTop: 'calc(var(--nav-offset, 60px) + 12px)', paddingRight: 12, paddingBottom: 12, paddingLeft: 12, minHeight: '100dvh', background: 'var(--black)' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: '1.6rem', color: 'var(--white)', margin: 0, fontFamily: 'var(--font-brand)' }}>Wallet</h1>
            <p style={{ color: 'var(--grey-400)', fontSize: '0.88rem', margin: '4px 0 0' }}>
              Your Balance, Statements, And Payouts
            </p>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
              color: 'var(--silver)', padding: '8px 14px', borderRadius: 8, fontWeight: 700,
              fontSize: '0.8rem', cursor: loading ? 'not-allowed' : 'pointer', minHeight: 40, whiteSpace: 'nowrap',
            }}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </header>

        {/* HERO */}
        <section className="card-metal" style={{ padding: 18, borderRadius: 14 }}>
          {error ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ color: 'var(--white)', fontWeight: 700 }}>Could Not Load Your Wallet</div>
              <div style={{ color: 'var(--grey-400)', fontSize: '0.88rem' }}>
                Check Your Connection And Try Again.
              </div>
              <button
                type="button"
                onClick={refresh}
                className="btn"
                style={{ background: 'var(--teal)', color: 'var(--black)', padding: '10px 18px', borderRadius: 10, border: 'none', fontWeight: 800, minHeight: 44, cursor: 'pointer' }}
              >
                Retry
              </button>
            </div>
          ) : loading || !summary ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i}>
                  <div className="skeleton" style={{ height: 12, width: '60%', borderRadius: 4, marginBottom: 8 }} />
                  <div className="skeleton" style={{ height: 26, width: '80%', borderRadius: 6 }} />
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {summary.primaryLabel}
                </div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--white)' }}>{money(summary.primary)}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 6 }}>
                  Owed This Week
                  {overdue && (
                    <span style={{
                      padding: '2px 8px', borderRadius: 6, fontSize: '0.62rem', fontWeight: 800,
                      background: 'rgba(229,62,62,0.18)', color: '#ff6b6b', letterSpacing: '0.04em',
                    }}>
                      Overdue
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: overdue ? '#ff6b6b' : summary.owedThisWeek > 0 ? 'var(--teal)' : 'var(--grey-500)' }}>
                  {money(summary.owedThisWeek)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Forecast Next
                </div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--silver)' }}>
                  {money(summary.forecastNext || 0)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Next Statement
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--white)' }}>
                  {summary.nextStatementDate ? fmtDate(summary.nextStatementDate) : '—'}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ACTION BAR */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            disabled={!summary?.hasOpenStatement}
            onClick={() => setPayOpen(true)}
            className="btn"
            style={{
              background: summary?.hasOpenStatement ? 'var(--teal)' : 'rgba(255,255,255,0.05)',
              color: summary?.hasOpenStatement ? 'var(--black)' : 'var(--grey-500)',
              padding: '12px 18px', borderRadius: 10, border: 'none', fontWeight: 800, fontSize: '0.9rem',
              minHeight: 44, cursor: summary?.hasOpenStatement ? 'pointer' : 'not-allowed',
            }}
          >
            Pay Now
          </button>
          <button type="button" onClick={() => setCreditOpen(true)} className="btn-secondary"
            style={{ padding: '12px 18px', borderRadius: 10, minHeight: 44 }}>
            Request Credit Increase
          </button>
          {summary && !summary.hasOpenStatement && !loading && !error && (
            <span style={{ color: 'var(--grey-500)', fontSize: '0.82rem' }}>You Are All Paid Up.</span>
          )}
        </div>

        {/* TAB STRIP */}
        <div role="tablist" style={{ display: 'flex', gap: 6, overflowX: 'auto', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 1 }}>
          {tabs.map(t => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
              style={{
                background: 'none', border: 'none', color: tab === t.id ? 'var(--white)' : 'var(--grey-400)',
                padding: '10px 14px', cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem',
                borderBottom: tab === t.id ? '2px solid var(--teal)' : '2px solid transparent',
                whiteSpace: 'nowrap', minHeight: 44,
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* TABS */}
        {tab === 'overview' && (
          <>
          <section
            className="card-metal"
            style={{ padding: 16, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}
          >
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Store Credit Balance
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--teal)' }}>{money(storeCredit)}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--grey-500)', marginTop: 4 }}>
                Earned From Referrals. Applied Automatically At Checkout.
              </div>
            </div>
            <a
              href="/account/referrals"
              className="btn-secondary"
              style={{ padding: '10px 16px', borderRadius: 10, minHeight: 44, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}
            >
              Earn More Credit
            </a>
          </section>
          <section className="card-glass" style={{ padding: 16, borderRadius: 12 }}>
            <h3 style={{ color: 'var(--white)', marginTop: 0, fontSize: '1rem' }}>Open Statements</h3>
            {(summary?.openStatements ?? []).length === 0 ? (
              <p style={{ color: 'var(--grey-500)', fontSize: '0.9rem' }}>No Open Statements.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {summary.openStatements.map((s: any) => {
                  const isOverdue = s.due_date && new Date(s.due_date).getTime() < now && s.status !== 'paid';
                  return (
                    <li key={s.id}>
                      <button onClick={() => setDetailId(s.id)} style={{
                        width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '10px 14px', background: 'rgba(255,255,255,0.03)',
                        border: `1px solid ${isOverdue ? 'rgba(229,62,62,0.4)' : 'rgba(255,255,255,0.05)'}`, borderRadius: 10,
                        color: 'var(--white)', cursor: 'pointer', minHeight: 44,
                      }}>
                        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                          <span>Week Of {fmtDate(s.week_start)}</span>
                          <span style={{ fontSize: '0.72rem', color: isOverdue ? '#ff6b6b' : 'var(--grey-500)' }}>
                            {s.due_date ? `${isOverdue ? 'Was Due' : 'Due'} ${fmtDate(s.due_date)}` : 'Awaiting Payment'}
                          </span>
                        </span>
                        <strong style={{ color: isOverdue ? '#ff6b6b' : 'var(--teal)' }}>{money(Number(s.total_owed || 0))}</strong>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          </>
        )}

        {tab === 'activity' && (
          <section className="card-glass" style={{ padding: 16, borderRadius: 12 }}>
            <h3 style={{ color: 'var(--white)', marginTop: 0, fontSize: '1rem' }}>Recent Activity</h3>
            {loading ? (
              <p style={{ color: 'var(--grey-500)' }}>Loading...</p>
            ) : activity.length === 0 ? (
              <p style={{ color: 'var(--grey-500)', fontSize: '0.9rem' }}>No Activity Yet.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {activity.map((t) => {
                  const positive = t.signedAmount >= 0;
                  return (
                    <li key={t.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
                      padding: '10px 12px', background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10,
                    }}>
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                        <span style={{ color: 'var(--white)', fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.description}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.72rem', color: 'var(--grey-500)' }}>
                          <span style={{
                            padding: '1px 7px', borderRadius: 5, fontWeight: 700, letterSpacing: '0.03em',
                            background: t.ledger === 'credit' ? 'rgba(0,196,188,0.14)' : 'rgba(168,180,192,0.14)',
                            color: t.ledger === 'credit' ? 'var(--teal)' : 'var(--silver)',
                          }}>
                            {t.ledger === 'credit' ? 'Store Credit' : 'Wallet'}
                          </span>
                          <span>{fmtDate(t.createdAt)}</span>
                        </span>
                      </span>
                      <strong style={{ color: positive ? '#2ed573' : '#ff6b6b', fontSize: '0.92rem', whiteSpace: 'nowrap' }}>
                        {positive ? '+' : '-'}{money(Math.abs(t.signedAmount))}
                      </strong>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        {tab === 'statements' && (
          <section className="card-glass" style={{ padding: 16, borderRadius: 12 }}>
            <h3 style={{ color: 'var(--white)', marginTop: 0 }}>Statement History</h3>
            {statements.length === 0 ? (
              <p style={{ color: 'var(--grey-500)' }}>No Statements Yet.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      <th style={{ textAlign: 'left', padding: '8px', color: 'var(--silver)' }}>Week</th>
                      <th style={{ textAlign: 'right', padding: '8px', color: 'var(--silver)' }}>COGS</th>
                      <th style={{ textAlign: 'right', padding: '8px', color: 'var(--silver)' }}>Shipping</th>
                      <th style={{ textAlign: 'right', padding: '8px', color: 'var(--teal)' }}>Owed</th>
                      <th style={{ textAlign: 'center', padding: '8px', color: 'var(--silver)' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statements.slice(0, 24).map((s: any) => (
                      <tr key={s.id} onClick={() => setDetailId(s.id)}
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer' }}>
                        <td style={{ padding: '10px 8px', color: 'var(--white)' }}>{fmtDate(s.week_start)}</td>
                        <td style={{ padding: '10px 8px', color: 'var(--white)', textAlign: 'right' }}>{money(Number(s.total_cogs || 0))}</td>
                        <td style={{ padding: '10px 8px', color: 'var(--white)', textAlign: 'right' }}>{money(Number(s.total_shipping || 0))}</td>
                        <td style={{ padding: '10px 8px', color: 'var(--teal)', textAlign: 'right', fontWeight: 700 }}>{money(Number(s.total_owed || 0))}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                          <span style={{
                            padding: '4px 10px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 700,
                            background: s.status === 'paid' ? 'rgba(46,213,115,0.2)' : 'rgba(255,71,87,0.2)',
                            color: s.status === 'paid' ? '#2ed573' : '#ff4757',
                          }}>{statusLabel(s.status)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {tab === 'commissions' && <CommissionsTab />}
        {tab === 'receipts' && <ReceiptVault />}
        {tab === 'settings' && <WalletSettings />}
      </div>

      {payOpen && (
        <PayNowSheet
          openStatements={summary?.openStatements ?? []}
          preferredHandle={summary?.preferredHandle ?? ''}
          onClose={() => setPayOpen(false)}
          onPaid={() => { setPayOpen(false); refresh(); }}
        />
      )}
      {detailId && <StatementDetailModal statementId={detailId} onClose={() => setDetailId(null)} />}
      {creditOpen && (
        <CreditIncreaseForm
          currentLimit={summary?.creditLimit ?? 0}
          onClose={() => setCreditOpen(false)}
          onSubmitted={() => { setCreditOpen(false); toast.success('Request Submitted'); }}
        />
      )}
    </div>
  );
}
