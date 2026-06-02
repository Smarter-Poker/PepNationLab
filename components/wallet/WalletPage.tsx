'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import PayNowSheet from './PayNowSheet';
import StatementDetailModal from './StatementDetailModal';
import CommissionsTab from './CommissionsTab';
import ReceiptVault from './ReceiptVault';
import CreditIncreaseForm from './CreditIncreaseForm';

const money = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(Number(n) || 0);

type Tab = 'overview' | 'statements' | 'commissions' | 'receipts' | 'settings';

export default function WalletPage({
  userId, role, isSuperAgent,
}: { userId: string; role: string; isSuperAgent: boolean }) {
  const [tab, setTab] = useState<Tab>('overview');
  const [summary, setSummary] = useState<any>(null);
  const [statements, setStatements] = useState<any[]>([]);
  const [payOpen, setPayOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [creditOpen, setCreditOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const [sumRes, stmtRes] = await Promise.all([
        fetch('/api/agent/wallet/summary', { cache: 'no-store' }),
        fetch('/api/agent/statements', { cache: 'no-store' }),
      ]);
      if (sumRes.ok) setSummary(await sumRes.json());
      if (stmtRes.ok) {
        const j = await stmtRes.json();
        setStatements(j.statements ?? j.data ?? []);
      }
    } catch (e: any) {
      toast.error('Could Not Load Wallet');
    } finally { setLoading(false); }
  }

  useEffect(() => { refresh(); }, []);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'statements', label: 'Statements' },
    { id: 'commissions', label: 'Commissions' },
    { id: 'receipts', label: 'Receipts' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <div style={{ paddingTop: 'calc(var(--nav-offset, 60px) + 12px)', paddingRight: 12, paddingBottom: 12, paddingLeft: 12, minHeight: '100dvh', background: 'var(--black)' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <header>
          <h1 style={{ fontSize: '1.6rem', color: 'var(--white)', margin: 0, fontFamily: 'var(--font-brand)' }}>Wallet</h1>
          <p style={{ color: 'var(--grey-400)', fontSize: '0.88rem', margin: '4px 0 0' }}>
            Your Balance, Statements, And Payouts
          </p>
        </header>

        {/* HERO */}
        <section className="card-metal" style={{ padding: 18, borderRadius: 14 }}>
          {loading || !summary ? (
            <div style={{ color: 'var(--grey-400)' }}>Loading...</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {summary.primaryLabel}
                </div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--white)' }}>{money(summary.primary)}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Owed This Week
                </div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: summary.owedThisWeek > 0 ? 'var(--teal)' : 'var(--grey-500)' }}>
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
                  {summary.nextStatementDate ? new Date(summary.nextStatementDate).toLocaleDateString() : '—'}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ACTION BAR */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
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
        </div>

        {/* TAB STRIP */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 1 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
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
          <section className="card-glass" style={{ padding: 16, borderRadius: 12 }}>
            <h3 style={{ color: 'var(--white)', marginTop: 0, fontSize: '1rem' }}>Open Statements</h3>
            {(summary?.openStatements ?? []).length === 0 ? (
              <p style={{ color: 'var(--grey-500)', fontSize: '0.9rem' }}>No Open Statements.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {summary.openStatements.map((s: any) => (
                  <li key={s.id}>
                    <button onClick={() => setDetailId(s.id)} style={{
                      width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 14px', background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10,
                      color: 'var(--white)', cursor: 'pointer', minHeight: 44,
                    }}>
                      <span>Week Of {s.week_start}</span>
                      <strong style={{ color: 'var(--teal)' }}>{money(Number(s.total_owed || 0))}</strong>
                    </button>
                  </li>
                ))}
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
                        <td style={{ padding: '10px 8px', color: 'var(--white)' }}>{s.week_start}</td>
                        <td style={{ padding: '10px 8px', color: 'var(--white)', textAlign: 'right' }}>{money(Number(s.total_cogs || 0))}</td>
                        <td style={{ padding: '10px 8px', color: 'var(--white)', textAlign: 'right' }}>{money(Number(s.total_shipping || 0))}</td>
                        <td style={{ padding: '10px 8px', color: 'var(--teal)', textAlign: 'right', fontWeight: 700 }}>{money(Number(s.total_owed || 0))}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                          <span style={{
                            padding: '4px 10px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 700,
                            textTransform: 'uppercase',
                            background: s.status === 'paid' ? 'rgba(46,213,115,0.2)' : 'rgba(255,71,87,0.2)',
                            color: s.status === 'paid' ? '#2ed573' : '#ff4757',
                          }}>{s.status}</span>
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
        {tab === 'settings' && (
          <section className="card-glass" style={{ padding: 16, borderRadius: 12 }}>
            <h3 style={{ color: 'var(--white)', marginTop: 0 }}>Settings</h3>
            <p style={{ color: 'var(--grey-400)' }}>Payment Handle Editor And Auto-Pay Toggle Live On The Account Page.</p>
            <a href="/account/settings" style={{ color: 'var(--teal)', fontWeight: 700 }}>Open Account Settings →</a>
          </section>
        )}
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
