'use client';

import { useEffect, useState } from 'react';
import Pagination from '@/components/Pagination';

const PAGE_SIZE = 25;

interface Commission {
  id: string;
  order_id: string;
  commission_rate: number;
  commission_amount: number | string;
  status: 'pending' | 'approved' | 'paid';
  created_at: string;
  approved_at: string | null;
  paid_at: string | null;
  orders?: {
    total: number | string;
    status: string;
    created_at: string;
    profiles?: { full_name: string | null } | null;
  } | null;
}

interface PayoutRecord {
  id: string;
  amount: number | string;
  payment_method: string;
  reference_number: string | null;
  notes: string | null;
  status: string;
  created_at: string;
}

interface CommissionsResponse {
  commissions: Commission[];
  payouts: PayoutRecord[];
  commissionRate: number;
  earnings: {
    allTime: number;
    thisMonth: number;
    lastMonth: number;
    pending: number;
    paid: number;
  };
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  paid: 'Paid',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'var(--grey-400)',
  approved: '#F6AD55',
  paid: '#68D391',
};

function fmtMoney(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return Number.isFinite(v) ? `$${v.toFixed(2)}` : '$0.00';
}

export default function AgentCommissions() {
  const [data, setData] = useState<CommissionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [commPage, setCommPage] = useState(1);
  const [payoutPage, setPayoutPage] = useState(1);

  useEffect(() => {
    void fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/agent/commissions');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed To Load Commissions');
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Failed To Load Commissions');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid var(--teal)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div className="disclaimer-warning" style={{ padding: 'var(--space-5)' }}>
        <p style={{ color: 'var(--red)', fontSize: '0.9rem' }}>{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const { earnings, commissionRate, commissions, payouts } = data;

  const commTotalPages = Math.max(1, Math.ceil(commissions.length / PAGE_SIZE));
  const commSafePage = Math.min(commPage, commTotalPages);
  const commPaginated = commissions.slice((commSafePage - 1) * PAGE_SIZE, commSafePage * PAGE_SIZE);

  const payoutTotalPages = Math.max(1, Math.ceil(payouts.length / PAGE_SIZE));
  const payoutSafePage = Math.min(payoutPage, payoutTotalPages);
  const payoutPaginated = payouts.slice((payoutSafePage - 1) * PAGE_SIZE, payoutSafePage * PAGE_SIZE);

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h2 style={{ fontSize: '1.4rem', fontFamily: 'var(--font-brand)', marginBottom: 'var(--space-2)', color: 'var(--white)' }}>
          Commissions & Earnings
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--grey-400)', margin: 0 }}>
          Track Commissions Earned On Every Order And Settled Payouts From The Admin Team.
        </p>
      </div>

      {/* Top Cards */}
      <div className="grid-4" style={{ marginBottom: 'var(--space-8)', gap: 'var(--space-4)' }}>
        {[
          { label: 'All-Time Earnings', value: fmtMoney(earnings.allTime), color: 'var(--teal)' },
          { label: 'This Month', value: fmtMoney(earnings.thisMonth), color: 'var(--silver)' },
          { label: 'Last Month', value: fmtMoney(earnings.lastMonth), color: 'var(--silver)' },
          { label: 'Awaiting Payout', value: fmtMoney(earnings.pending), color: '#F6AD55' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card-metal" style={{ padding: 'var(--space-5)' }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, fontFamily: 'var(--font-brand)', color, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--grey-400)', marginTop: 'var(--space-2)' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Commission Rate */}
      <div className="card-metal" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-8)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your Commission Rate</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'var(--font-brand)', color: 'var(--teal)', lineHeight: 1.1 }}>
              {Number(commissionRate).toFixed(2)}%
            </div>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--grey-400)', maxWidth: 320 }}>
            Contact Admin To Change Your Commission Rate. Admin Team Reviews Rate Updates On Request.
          </div>
        </div>
      </div>

      {/* Commissions List */}
      <h3 style={{ fontSize: '1.1rem', color: 'var(--white)', marginBottom: 'var(--space-4)', fontFamily: 'var(--font-brand)' }}>
        Commission History
      </h3>
      <div className="card-metal" style={{ padding: 0, overflow: 'hidden', marginBottom: 'var(--space-8)' }}>
        {commissions.length === 0 ? (
          <div style={{ padding: 'var(--space-10)', textAlign: 'center', color: 'var(--grey-400)', fontSize: '0.88rem' }}>
            No Commissions Earned Yet. Commissions Appear When Your Sales Are Recorded.
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'var(--surface-2)' }}>
                    {['Order', 'Date', 'Order Total', 'Rate', 'Commission', 'Status'].map((h, idx) => (
                      <th key={h} style={{
                        padding: 'var(--space-3) var(--space-4)',
                        textAlign: idx >= 2 && idx <= 4 ? 'right' : 'left',
                        fontSize: '0.72rem', fontWeight: 700, color: 'var(--grey-400)',
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {commPaginated.map((c) => {
                    const statusColor = STATUS_COLORS[c.status] ?? 'var(--grey-400)';
                    return (
                      <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--teal)' }}>
                          {c.order_id.slice(0, 8)}
                        </td>
                        <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: '0.82rem', color: 'var(--silver)' }}>
                          {new Date(c.orders?.created_at || c.created_at).toLocaleDateString()}
                        </td>
                        <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: '0.85rem', color: 'var(--silver)', textAlign: 'right', fontFamily: 'var(--font-brand)' }}>
                          {fmtMoney(c.orders?.total)}
                        </td>
                        <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: '0.82rem', color: 'var(--grey-400)', textAlign: 'right' }}>
                          {Number(c.commission_rate).toFixed(2)}%
                        </td>
                        <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: '0.9rem', fontWeight: 700, color: 'var(--teal)', textAlign: 'right', fontFamily: 'var(--font-brand)' }}>
                          {fmtMoney(c.commission_amount)}
                        </td>
                        <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                          <span style={{
                            fontSize: '0.7rem', fontWeight: 700, color: statusColor,
                            background: `${statusColor}15`, border: `1px solid ${statusColor}40`,
                            padding: '3px 10px', borderRadius: 'var(--radius-full)',
                          }}>
                            {STATUS_LABELS[c.status] ?? c.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {commissions.length > PAGE_SIZE && (
              <Pagination page={commSafePage} totalPages={commTotalPages} onPageChange={setCommPage} />
            )}
          </>
        )}
      </div>

      {/* Payouts */}
      <h3 style={{ fontSize: '1.1rem', color: 'var(--white)', marginBottom: 'var(--space-4)', fontFamily: 'var(--font-brand)' }}>
        Payout History
      </h3>
      <div className="card-metal" style={{ padding: 0, overflow: 'hidden' }}>
        {payouts.length === 0 ? (
          <div style={{ padding: 'var(--space-10)', textAlign: 'center', color: 'var(--grey-400)', fontSize: '0.88rem' }}>
            No Payouts Recorded Yet.
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'var(--surface-2)' }}>
                    {['Date', 'Amount', 'Method', 'Reference', 'Notes'].map((h, idx) => (
                      <th key={h} style={{
                        padding: 'var(--space-3) var(--space-4)',
                        textAlign: idx === 1 ? 'right' : 'left',
                        fontSize: '0.72rem', fontWeight: 700, color: 'var(--grey-400)',
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payoutPaginated.map((p) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: '0.82rem', color: 'var(--silver)' }}>
                        {new Date(p.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: '0.9rem', fontWeight: 700, color: 'var(--teal)', textAlign: 'right', fontFamily: 'var(--font-brand)' }}>
                        {fmtMoney(p.amount)}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: '0.82rem', color: 'var(--silver)' }}>
                        {p.payment_method
                          .split('_')
                          .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                          .join(' ')}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: '0.78rem', color: 'var(--grey-400)', fontFamily: 'monospace' }}>
                        {p.reference_number || '—'}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: '0.78rem', color: 'var(--grey-400)' }}>
                        {p.notes || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {payouts.length > PAGE_SIZE && (
              <Pagination page={payoutSafePage} totalPages={payoutTotalPages} onPageChange={setPayoutPage} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
