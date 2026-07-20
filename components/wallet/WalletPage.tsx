'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import PayNowSheet from './PayNowSheet';
import StatementDetailModal from './StatementDetailModal';
import CommissionsTab from './CommissionsTab';
import ReceiptVault from './ReceiptVault';
import CreditIncreaseForm from './CreditIncreaseForm';
import WalletSettings from './WalletSettings';
import WalletSendSheet from './WalletSendSheet';
import IframeLink from '@/components/ui/IframeLink';
import DownlineBalances from './DownlineBalances';
import BackButton from '@/components/ui/BackButton';

const money = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(Number(n) || 0);

// Title Case status labels - the API returns raw enum text (e.g. pending_payment)
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
  return STATUS_LABEL[k] || k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || '-';
};

// Color-code statuses so the agent can scan history at a glance.
// paid=green, pending_payment=teal, open=yellow, disputed=orange,
// cancelled=grey. Anything else falls to neutral grey.
const statusColors = (s: string | null | undefined): { fg: string; bg: string } => {
  const k = (s || '').toLowerCase();
  if (k === 'paid')             return { fg: '#2ed573', bg: 'rgba(46,213,115,0.20)' };
  if (k === 'pending_payment')  return { fg: 'var(--teal)', bg: 'rgba(0,196,188,0.18)' };
  if (k === 'open')             return { fg: '#ffb800', bg: 'rgba(255,184,0,0.18)' };
  if (k === 'disputed')         return { fg: '#ff6b6b', bg: 'rgba(229,62,62,0.20)' };
  if (k === 'cancelled')        return { fg: 'var(--grey-500)', bg: 'rgba(168,180,192,0.15)' };
  return { fg: 'var(--silver)', bg: 'rgba(168,180,192,0.14)' };
};

// Consistent, human-readable dates. Date-only strings (YYYY-MM-DD) are pinned to
// local midnight so they don't slip a day in negative-offset timezones.
const fmtDate = (s: string | null | undefined): string => {
  if (!s) return '-';
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00` : s;
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? s
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// "Week Closes In Xh" countdown for the Invoices tab's own-account snapshot,
// derived the same way as DownlineBalances' weekCloseText but reduced to a
// single hours-remaining figure per the tab's compact card layout.
const weekClosesInLabel = (weekEndsAtIso: string | null, now: number): string => {
  if (!weekEndsAtIso) return '';
  const end = new Date(weekEndsAtIso).getTime();
  const diff = end - now;
  if (isNaN(end) || diff <= 0) return 'Week Closed - Invoices Generate Monday Morning';
  const hours = Math.max(1, Math.ceil(diff / (60 * 60 * 1000)));
  return `Week Closes In ${hours}h`;
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

type Tab = 'overview' | 'activity' | 'invoices' | 'statements' | 'commissions' | 'receipts' | 'settings';

type StatementRow = {
  id: string;
  week_start: string;
  week_end?: string;
  total_cogs?: number | string;
  total_shipping?: number | string;
  total_owed: number | string;
  status: string;
  due_date?: string | null;
  paid_at?: string | null;
  target_type: 'statement' | 'agent_invoice';
  bills_from?: 'admin' | 'super_agent';
};

// Own-account real-time snapshot returned in the `self` block of
// GET /api/agent/downline-balances - powers the Invoices tab's running totals.
type SelfSnapshot = {
  accountType: 'prepaid' | 'credit' | null;
  prepaidBalance: number;
  creditUsed: number;
  creditLimit: number;
  currentWeekOrderCount: number;
  currentWeekOrderTotal: number;
  openBillsTotal: number;
  openBillsCount: number;
};

export default function WalletPage({
  userId, role, isSuperAgent,
}: { userId: string; role: string; isSuperAgent: boolean }) {
  const [tab, setTab] = useState<Tab>('overview');
  const [summary, setSummary] = useState<any>(null);
  const [statements, setStatements] = useState<StatementRow[]>([]);
  const [activity, setActivity] = useState<ActivityTxn[]>([]);
  const [storeCredit, setStoreCredit] = useState<number>(0);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [sendOpen, setSendOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailType, setDetailType] = useState<'statement' | 'agent_invoice'>('statement');
  const [creditOpen, setCreditOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [self, setSelf] = useState<SelfSnapshot | null>(null);
  const [selfLoading, setSelfLoading] = useState(false);
  const [weekEndsAtIso, setWeekEndsAtIso] = useState<string | null>(null);
  const [tick, setTick] = useState<number>(() => Date.now());

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
        const prepaid = typeof j.prepaidBalance === 'number' ? j.prepaidBalance : 0;
        const availableCredit = typeof j.creditAvailable === 'number' ? j.creditAvailable : 0;
        setWalletBalance(prepaid + availableCredit);
      }
    } catch {
      setError(true);
      toast.error('Could Not Load Wallet');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  // Real-time own-account running totals for the Invoices tab - fetched once
  // per tab visit (not on every wallet-wide refresh) so the numbers stay
  // current whenever the agent checks the tab.
  useEffect(() => {
    if (tab !== 'invoices') return;
    let cancelled = false;
    (async () => {
      setSelfLoading(true);
      try {
        const res = await fetch('/api/agent/downline-balances', { cache: 'no-store' });
        if (!res.ok) return;
        const j = await res.json();
        if (cancelled) return;
        setSelf(j?.self ?? null);
        setWeekEndsAtIso(typeof j?.weekEndsAtIso === 'string' ? j.weekEndsAtIso : null);
      } catch {
        // Network or parse failure - the running totals card falls back to its empty state.
      } finally {
        if (!cancelled) setSelfLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab]);

  // Ticks the "Week Closes In Xh" countdown forward without re-fetching data.
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  // Open invoices = anything that isn't paid/cancelled AND has an actual balance.
  // $0 statements should never be shown as outstanding - they have nothing to pay.
  const openInvoices = useMemo(
    () => statements.filter((s) => s.status !== 'paid' && s.status !== 'cancelled' && Number(s.total_owed || 0) > 0),
    [statements],
  );
  const hasOpenStatement = openInvoices.length > 0;
  const hasCreditLine = (summary?.creditLimit ?? 0) > 0;
  const canSend = ['agent', 'super_agent', 'admin'].includes(role);

  // A statement is overdue when it is still open/pending and its due date has passed.
  const now = Date.now();
  const overdue = openInvoices.some(
    (s) => s.due_date && new Date(s.due_date).getTime() < now && s.status !== 'paid',
  );

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'activity', label: 'Activity' },
    { id: 'invoices', label: 'Invoices' },
    { id: 'statements', label: 'Statements' },
    { id: 'commissions', label: 'Commissions' },
    { id: 'receipts', label: 'Receipts' },
    { id: 'settings', label: 'Settings' },
  ];

  // The statements/invoices table is shown both as "Invoice History" on the
  // Statements tab and as "Bills To Pay" on the Invoices tab - one render
  // helper keeps the row logic in exactly one place.
  const renderStatementsSection = (heading: string) => (
    <section className="glass-panel" style={{ padding: 16, borderRadius: 12 }}>
      <h3 style={{ color: 'var(--white)', marginTop: 0 }}>{heading}</h3>
      {statements.length === 0 ? (
        <p style={{ color: 'var(--grey-500)' }}>No Invoices Yet.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <th style={{ textAlign: 'left',  padding: '8px', color: 'var(--silver)' }}>Week</th>
                <th style={{ textAlign: 'left',  padding: '8px', color: 'var(--silver)' }}>Bills From</th>
                <th style={{ textAlign: 'right', padding: '8px', color: 'var(--silver)' }}>COGS</th>
                <th style={{ textAlign: 'right', padding: '8px', color: 'var(--silver)' }}>Shipping</th>
                <th style={{ textAlign: 'right', padding: '8px', color: 'var(--teal)' }}>Owed</th>
                <th style={{ textAlign: 'center', padding: '8px', color: 'var(--silver)' }}>Status</th>
                <th style={{ textAlign: 'center', padding: '8px', color: 'var(--silver)' }}>Print</th>
              </tr>
            </thead>
            <tbody>
              {(statements || []).slice(0, 24).map((s) => {
                const colors = statusColors(s.status);
                const billsFromLabel = s.target_type === 'agent_invoice' ? 'Super Agent' : 'Admin';
                return (
                  <tr key={`${s.target_type}-${s.id}`}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td onClick={() => { setDetailId(s.id); setDetailType(s.target_type); }} style={{ padding: '10px 8px', color: 'var(--white)', cursor: 'pointer' }}>{fmtDate(s.week_start)}</td>
                    <td style={{ padding: '10px 8px', color: 'var(--grey-400)' }}>{billsFromLabel}</td>
                    <td style={{ padding: '10px 8px', color: 'var(--white)', textAlign: 'right' }}>{money(Number(s.total_cogs || 0))}</td>
                    <td style={{ padding: '10px 8px', color: 'var(--white)', textAlign: 'right' }}>{money(Number(s.total_shipping || 0))}</td>
                    <td style={{ padding: '10px 8px', color: 'var(--teal)', textAlign: 'right', fontWeight: 700 }}>{money(Number(s.total_owed || 0))}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                      <span style={{
                        padding: '4px 10px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 700,
                        background: colors.bg, color: colors.fg,
                      }}>{statusLabel(s.status)}</span>
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                      <IframeLink
                        href={`/wallet/print?type=${s.target_type}&id=${s.id}`}
                        style={{ color: 'var(--teal)', fontSize: '0.78rem', fontWeight: 700, textDecoration: 'none' }}
                      >
                        Print
                      </IframeLink>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );

  return (
    <div style={{ textTransform: 'capitalize', paddingTop: 'calc(var(--nav-offset, 60px) + var(--space-6))', paddingRight: 'var(--space-4)', paddingBottom: 'var(--space-8)', paddingLeft: 'var(--space-4)', minHeight: '100dvh' }}>
      <div className="glass-panel" style={{ maxWidth: 960, margin: '0 auto', width: '100%' }}>
        <div className="" style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ marginBottom: -8 }}>
            <BackButton label="Back To Dashboard" />
          </div>
          <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <h1 style={{ fontSize: '1.6rem', color: 'var(--white)', margin: 0, fontFamily: 'var(--font-brand)' }}>Wallet</h1>
              <p style={{ color: 'var(--grey-400)', fontSize: '0.88rem', margin: '4px 0 0' }}>
                Your Balance, Invoices, And Payouts
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
          <section className="glass-panel" style={{ padding: 18, borderRadius: 14 }}>
            {error ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ color: 'var(--white)', fontWeight: 700 }}>Could Not Load Your Wallet</div>
                <div style={{ color: 'var(--grey-400)', fontSize: '0.88rem' }}>Check Your Connection And Try Again.</div>
                <button type="button" onClick={refresh} className="btn"
                  style={{ background: 'var(--teal)', color: 'var(--black)', padding: '10px 18px', borderRadius: 10, border: 'none', fontWeight: 800, minHeight: 44, cursor: 'pointer' }}>
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
                  <div style={{ fontSize: '0.72rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Forecast Next</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--silver)' }}>{money(summary.forecastNext || 0)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Next Statement</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--white)' }}>
                    {summary.nextStatementDate ? fmtDate(summary.nextStatementDate) : '-'}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* ACTION BAR */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <button type="button" disabled={!hasOpenStatement} onClick={() => setPayOpen(true)} className="btn"
                style={{
                  background: hasOpenStatement ? 'var(--teal)' : 'rgba(255,255,255,0.05)',
                  color: hasOpenStatement ? 'var(--black)' : 'var(--grey-500)',
                  padding: '12px 18px', borderRadius: 10, border: 'none', fontWeight: 800, fontSize: '0.9rem',
                  minHeight: 44, cursor: hasOpenStatement ? 'pointer' : 'not-allowed',
                }}>
                Pay Now
              </button>
              {canSend && (
                <button type="button" onClick={() => setSendOpen(true)} className="btn btn-primary"
                  style={{ padding: '12px 18px', borderRadius: 10, minHeight: 44, whiteSpace: 'nowrap' }}>
                  Send Funds
                </button>
              )}
              <button type="button" disabled={!hasCreditLine} onClick={() => setCreditOpen(true)} className="btn-secondary"
                style={{
                  padding: '12px 18px', borderRadius: 10, minHeight: 44,
                  opacity: hasCreditLine ? 1 : 0.55,
                  cursor: hasCreditLine ? 'pointer' : 'not-allowed',
                }}>
                Request Credit Increase
              </button>
            </div>
            {summary && !loading && !error && (
              <div style={{ color: 'var(--grey-500)', fontSize: '0.78rem', display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {!hasOpenStatement && <span>You Are All Paid Up.</span>}
                {!hasCreditLine && <span>Credit Increase Available Once You Have An Active Credit Line.</span>}
              </div>
            )}
          </div>

          {/* TAB STRIP */}
          <div role="tablist" aria-label="Wallet Sections" style={{ display: 'flex', gap: 6, overflowX: 'auto', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 1 }}>
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
              <section className="glass-panel"
                style={{ padding: 16, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Wallet Balance</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--teal)' }}>{money(walletBalance)}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--grey-500)', marginTop: 4 }}>
                    Real Funds You Can Send Or Spend Across The Network.
                  </div>
                </div>
                {canSend && (
                  <button type="button" onClick={() => setSendOpen(true)} className="btn btn-primary"
                    style={{ padding: '10px 16px', borderRadius: 10, minHeight: 44, whiteSpace: 'nowrap' }}>
                    Send Funds
                  </button>
                )}
              </section>

              <section className="glass-panel" style={{ padding: 16, borderRadius: 12 }}>
                <h3 style={{ color: 'var(--white)', marginTop: 0, fontSize: '1rem' }}>Open Invoices</h3>
                {openInvoices.length === 0 ? (
                  <p style={{ color: 'var(--grey-500)', fontSize: '0.9rem' }}>No Open Invoices.</p>
                ) : (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(openInvoices || []).map((s) => {
                      const isOverdue = s.due_date && new Date(s.due_date).getTime() < now && s.status !== 'paid';
                      const billsFromLabel = s.target_type === 'agent_invoice' ? 'Super Agent' : 'Admin';
                      return (
                        <li key={`${s.target_type}-${s.id}`}>
                          <button onClick={() => { setDetailId(s.id); setDetailType(s.target_type); }} style={{
                            width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '10px 14px', background: 'rgba(255,255,255,0.03)',
                            border: `1px solid ${isOverdue ? 'rgba(229,62,62,0.4)' : 'rgba(255,255,255,0.05)'}`, borderRadius: 10,
                            color: 'var(--white)', cursor: 'pointer', minHeight: 44,
                          }}>
                            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                              <span>Week Of {fmtDate(s.week_start)} - {billsFromLabel}</span>
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
            <section className="glass-panel" style={{ padding: 16, borderRadius: 12 }}>
              <h3 style={{ color: 'var(--white)', marginTop: 0, fontSize: '1rem' }}>Recent Activity</h3>
              {loading ? (
                <p style={{ color: 'var(--grey-500)' }}>Loading...</p>
              ) : activity.length === 0 ? (
                <p style={{ color: 'var(--grey-500)', fontSize: '0.9rem' }}>No Activity Yet.</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(activity || []).map((t) => {
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

          {tab === 'invoices' && (
            <>
              <section className="glass-panel" style={{ padding: 16, borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <h3 style={{ color: 'var(--white)', margin: 0, fontSize: '1rem' }}>Your Running Totals</h3>
                  {weekEndsAtIso && (
                    <span style={{ color: 'var(--grey-400)', fontSize: '0.78rem' }}>
                      {weekClosesInLabel(weekEndsAtIso, tick)}
                    </span>
                  )}
                </div>
                {selfLoading && !self ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
                    {[0, 1, 2].map((i) => (
                      <div key={i}>
                        <div className="skeleton" style={{ height: 12, width: '60%', borderRadius: 4, marginBottom: 8 }} />
                        <div className="skeleton" style={{ height: 22, width: '80%', borderRadius: 6 }} />
                      </div>
                    ))}
                  </div>
                ) : self ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>This Week's Sales</div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--white)' }}>
                        {self.currentWeekOrderCount} Orders / {money(self.currentWeekOrderTotal)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Owed Upstream Right Now</div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: self.openBillsTotal > 0 ? '#ff6b6b' : 'var(--teal)' }}>
                        {money(self.openBillsTotal)}{' '}
                        <span style={{ fontSize: '0.78rem', color: 'var(--grey-500)', fontWeight: 600 }}>
                          ({self.openBillsCount} {self.openBillsCount === 1 ? 'Bill' : 'Bills'})
                        </span>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {self.accountType === 'prepaid' ? 'Prepaid Balance' : 'Credit Used'}
                      </div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--teal)' }}>
                        {self.accountType === 'prepaid' ? (
                          money(self.prepaidBalance)
                        ) : (
                          <>
                            {money(self.creditUsed)}{' '}
                            <span style={{ fontSize: '0.78rem', color: 'var(--grey-500)', fontWeight: 600 }}>Of {money(self.creditLimit)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p style={{ color: 'var(--grey-500)', fontSize: '0.9rem' }}>Could Not Load Your Running Totals.</p>
                )}
              </section>

              {renderStatementsSection('Bills To Pay')}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <h3 style={{ color: 'var(--white)', margin: 0, fontSize: '1rem' }}>Downline Snapshots</h3>
                <DownlineBalances />
              </div>
            </>
          )}

          {tab === 'statements' && renderStatementsSection('Invoice History')}

          {tab === 'commissions' && <CommissionsTab />}
          {tab === 'receipts' && <ReceiptVault />}
          {tab === 'settings' && <WalletSettings />}
        </div>
      </div>

      {payOpen && (
        <PayNowSheet
          openStatements={openInvoices}
          preferredHandle={summary?.preferredHandle ?? ''}
          onClose={() => setPayOpen(false)}
          onPaid={() => { setPayOpen(false); refresh(); }}
        />
      )}
      {detailId && <StatementDetailModal statementId={detailId} targetType={detailType} onClose={() => setDetailId(null)} />}
      {creditOpen && (
        <CreditIncreaseForm
          currentLimit={summary?.creditLimit ?? 0}
          onClose={() => setCreditOpen(false)}
          onSubmitted={() => { setCreditOpen(false); toast.success('Request Submitted'); }}
        />
      )}
      {sendOpen && canSend && (
        <WalletSendSheet onClose={() => setSendOpen(false)} onSent={refresh} />
      )}
    </div>
  );
}
