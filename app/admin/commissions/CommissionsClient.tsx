'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import Pagination from '@/components/Pagination';
import { exportCSV, downloadCSV } from '@/lib/export';

const PAGE_SIZE = 25;

interface Commission {
  id: string;
  agent_id: string;
  order_id: string;
  commission_rate: number;
  commission_amount: number | string;
  status: 'pending' | 'approved' | 'paid';
  created_at: string;
  approved_at: string | null;
  paid_at: string | null;
  profiles?: {
    full_name: string | null;
    email: string | null;
    username: string | null;
    commission_rate?: number | null;
  } | null;
  orders?: {
    total: number | string;
    status: string;
    created_at: string;
  } | null;
}

interface AgentSummary {
  agentId: string;
  name: string;
  pending: number;
  paid: number;
  total: number;
}

interface PayoutRecord {
  id: string;
  agent_id: string;
  amount: number | string;
  payment_method: string;
  reference_number: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  completed_at: string | null;
  profiles?: { full_name: string | null; email: string | null } | null;
}

interface Stats {
  pendingCount: number;
  pendingAmount: number;
  approvedCount: number;
  approvedAmount: number;
  paidCount: number;
  paidAmount: number;
  totalAll: number;
}

interface ApiResponse {
  commissions: Commission[];
  stats: Stats;
  agentSummary: AgentSummary[];
  payouts: PayoutRecord[];
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

const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: 'zelle', label: 'Zelle' },
  { value: 'venmo', label: 'Venmo' },
  { value: 'cashapp', label: 'Cash App' },
  { value: 'apple_pay', label: 'Apple Pay' },
  { value: 'bank', label: 'Bank Transfer' },
  { value: 'other', label: 'Other' },
];

function fmtMoney(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return Number.isFinite(v) ? `$${v.toFixed(2)}` : '$0.00';
}

export default function CommissionsClient() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'paid'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [commPage, setCommPage] = useState(1);
  const [payoutPage, setPayoutPage] = useState(1);
  const [tab, setTab] = useState<'agents' | 'detail'>('agents');

  // Payout Modal
  const [payoutAgent, setPayoutAgent] = useState<AgentSummary | null>(null);
  const [payMethod, setPayMethod] = useState('zelle');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [paying, setPaying] = useState(false);

  // Update Rate Modal
  const [rateAgent, setRateAgent] = useState<AgentSummary | null>(null);
  const [rateValue, setRateValue] = useState('');
  const [savingRate, setSavingRate] = useState(false);

  // Bulk approve
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    void fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/commissions');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed To Load Commissions');
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Failed To Load Commissions');
    } finally {
      setLoading(false);
    }
  }

  async function handleBulkApprove() {
    if (selectedIds.size === 0 || approving) return;
    setApproving(true);
    try {
      const res = await fetch('/api/admin/commissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', commissionIds: Array.from(selectedIds) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed To Approve');
      toast.success(`Approved ${json.approved} Commission(s)`);
      setSelectedIds(new Set());
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Approve Failed');
    } finally {
      setApproving(false);
    }
  }

  async function handlePayout(e: React.FormEvent) {
    e.preventDefault();
    if (!payoutAgent || paying) return;
    setPaying(true);
    try {
      const res = await fetch('/api/admin/commissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'payout',
          agentId: payoutAgent.agentId,
          paymentMethod: payMethod,
          referenceNumber: payRef || null,
          notes: payNotes || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed To Process Payout');
      toast.success(`Payout Recorded — ${json.commissionsMarkedPaid} Commission(s) Marked Paid`);
      setPayoutAgent(null);
      setPayMethod('zelle');
      setPayRef('');
      setPayNotes('');
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Payout Failed');
    } finally {
      setPaying(false);
    }
  }

  async function handleSaveRate(e: React.FormEvent) {
    e.preventDefault();
    if (!rateAgent || savingRate) return;
    const numeric = Number(rateValue);
    if (!Number.isFinite(numeric) || numeric < 0 || numeric > 100) {
      toast.error('Rate Must Be Between 0 And 100');
      return;
    }
    setSavingRate(true);
    try {
      const res = await fetch('/api/admin/commissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateRate',
          agentId: rateAgent.agentId,
          rate: numeric,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed To Update Rate');
      toast.success('Commission Rate Updated');
      setRateAgent(null);
      setRateValue('');
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Save Failed');
    } finally {
      setSavingRate(false);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filteredCommissions = useMemo(() => {
    if (!data) return [];
    if (filter === 'all') return data.commissions;
    return data.commissions.filter((c) => c.status === filter);
  }, [data, filter]);

  function handleExportCommissionsCSV() {
    if (!data || filteredCommissions.length === 0) return;
    const rows = filteredCommissions.map((c) => ({
      order_id: c.order_id,
      agent_name: c.profiles?.full_name || c.profiles?.email || 'Agent',
      created_at: new Date(c.created_at).toISOString().slice(0, 10),
      order_total: Number(c.orders?.total ?? 0).toFixed(2),
      commission_rate: Number(c.commission_rate).toFixed(2),
      commission_amount: Number(c.commission_amount).toFixed(2),
      status: STATUS_LABELS[c.status] ?? c.status,
    }));
    const csv = exportCSV(rows, [
      { key: 'order_id', label: 'Order ID' },
      { key: 'agent_name', label: 'Agent' },
      { key: 'created_at', label: 'Date' },
      { key: 'order_total', label: 'Order Total' },
      { key: 'commission_rate', label: 'Rate %' },
      { key: 'commission_amount', label: 'Commission Amount' },
      { key: 'status', label: 'Status' },
    ]);
    downloadCSV(`admin_commissions_${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  // Pagination slices
  const commTotalPages = Math.max(1, Math.ceil(filteredCommissions.length / PAGE_SIZE));
  const commSafePage = Math.min(commPage, commTotalPages);
  const commPaginated = filteredCommissions.slice((commSafePage - 1) * PAGE_SIZE, commSafePage * PAGE_SIZE);

  useEffect(() => {
    setCommPage(1);
  }, [filter]);

  if (loading) {
    return (
      <div style={{ padding: 'var(--space-12)', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid var(--teal)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: 'var(--space-8)' }}>
        <div className="disclaimer-warning" style={{ padding: 'var(--space-5)' }}>
          <p style={{ color: 'var(--red)' }}>{error || 'No Data Available'}</p>
        </div>
      </div>
    );
  }

  const { stats, agentSummary, payouts } = data;
  const payoutTotalPages = Math.max(1, Math.ceil(payouts.length / PAGE_SIZE));
  const payoutSafePage = Math.min(payoutPage, payoutTotalPages);
  const payoutPaginated = payouts.slice((payoutSafePage - 1) * PAGE_SIZE, payoutSafePage * PAGE_SIZE);

  return (
    <div style={{ padding: 'var(--space-8)' }}>
      {/* Header */}
      <div style={{ marginBottom: 'var(--space-8)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', marginBottom: 'var(--space-2)' }}>Commissions & Payouts</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--grey-400)' }}>
            Approve Pending Commissions, Issue Payouts To Agents, And Adjust Commission Rates.
          </p>
        </div>
        <button onClick={handleExportCommissionsCSV} className="btn btn-secondary btn-sm" disabled={filteredCommissions.length === 0}>
          Export CSV
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid-4" style={{ marginBottom: 'var(--space-8)', gap: 'var(--space-4)' }}>
        {[
          { label: `Pending (${stats.pendingCount})`, value: fmtMoney(stats.pendingAmount), color: 'var(--grey-400)' },
          { label: `Approved (${stats.approvedCount})`, value: fmtMoney(stats.approvedAmount), color: '#F6AD55' },
          { label: `Paid (${stats.paidCount})`, value: fmtMoney(stats.paidAmount), color: '#68D391' },
          { label: 'Total', value: fmtMoney(stats.totalAll), color: 'var(--teal)' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card-metal" style={{ padding: 'var(--space-5)' }}>
            <div style={{ fontSize: '1.7rem', fontWeight: 800, fontFamily: 'var(--font-brand)', color, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--grey-400)', marginTop: 'var(--space-2)' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 'var(--space-5)', background: 'var(--black-2)', padding: 4, borderRadius: 'var(--radius-md)', border: 'var(--border-subtle)', width: 'fit-content' }}>
        {[
          { id: 'agents' as const, label: 'Per-Agent Summary' },
          { id: 'detail' as const, label: 'Commissions Detail' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '6px 14px', fontSize: '0.82rem', fontWeight: 600,
              color: tab === t.id ? '#fff' : 'var(--grey-400)',
              background: tab === t.id ? 'var(--teal)' : 'transparent',
              border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* PER-AGENT TAB */}
      {tab === 'agents' && (
        <div className="card-metal" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <h3 style={{ fontSize: '0.95rem', color: 'var(--silver)' }}>Commissions By Agent</h3>
          </div>
          {agentSummary.length === 0 ? (
            <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--grey-400)' }}>
              No Commissions Recorded Yet.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'var(--surface-2)' }}>
                    {['Agent', 'Pending', 'Paid', 'Lifetime', 'Actions'].map((h, i) => (
                      <th key={h} style={{
                        padding: 'var(--space-3) var(--space-4)',
                        textAlign: i >= 1 && i <= 3 ? 'right' : 'left',
                        fontSize: '0.72rem', fontWeight: 700, color: 'var(--grey-400)',
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {agentSummary.map((a) => (
                    <tr key={a.agentId} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: '0.85rem', color: 'var(--silver)', fontWeight: 600 }}>
                        {a.name}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: '0.9rem', color: '#F6AD55', textAlign: 'right', fontFamily: 'var(--font-brand)' }}>
                        {fmtMoney(a.pending)}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: '0.9rem', color: '#68D391', textAlign: 'right', fontFamily: 'var(--font-brand)' }}>
                        {fmtMoney(a.paid)}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: '0.9rem', color: 'var(--teal)', textAlign: 'right', fontFamily: 'var(--font-brand)', fontWeight: 700 }}>
                        {fmtMoney(a.total)}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                          <button
                            onClick={() => { setPayoutAgent(a); setPayMethod('zelle'); setPayRef(''); setPayNotes(''); }}
                            className="btn btn-primary btn-sm"
                            disabled={a.pending <= 0}
                            style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                          >
                            Pay Out Now
                          </button>
                          <button
                            onClick={() => { setRateAgent(a); setRateValue('15'); }}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                          >
                            Update Rate
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* DETAIL TAB */}
      {tab === 'detail' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['all', 'pending', 'approved', 'paid'] as const).map((id) => (
                <button
                  key={id}
                  onClick={() => setFilter(id)}
                  style={{
                    padding: '6px 12px', fontSize: '0.78rem', fontWeight: 600,
                    color: filter === id ? '#fff' : 'var(--grey-400)',
                    background: filter === id ? 'var(--teal)' : 'var(--black-2)',
                    border: filter === id ? 'none' : 'var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                  }}
                >
                  {id === 'all' ? 'All' : (STATUS_LABELS[id] ?? id)}
                </button>
              ))}
            </div>
            {selectedIds.size > 0 && (
              <button
                onClick={handleBulkApprove}
                disabled={approving}
                className="btn btn-primary btn-sm"
              >
                {approving ? 'Approving...' : `Approve Selected (${selectedIds.size})`}
              </button>
            )}
          </div>

          <div className="card-metal" style={{ padding: 0, overflow: 'hidden' }}>
            {filteredCommissions.length === 0 ? (
              <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--grey-400)' }}>
                No Commissions In This Filter.
              </div>
            ) : (
              <>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'var(--surface-2)' }}>
                        <th style={{ padding: 'var(--space-3) var(--space-4)', width: 32 }} />
                        {['Order', 'Agent', 'Date', 'Order Total', 'Rate', 'Commission', 'Status'].map((h, i) => (
                          <th key={h} style={{
                            padding: 'var(--space-3) var(--space-4)',
                            textAlign: i >= 3 && i <= 5 ? 'right' : 'left',
                            fontSize: '0.72rem', fontWeight: 700, color: 'var(--grey-400)',
                            textTransform: 'uppercase', letterSpacing: '0.05em',
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {commPaginated.map((c) => {
                        const statusColor = STATUS_COLORS[c.status] ?? 'var(--grey-400)';
                        const checked = selectedIds.has(c.id);
                        return (
                          <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                              {c.status === 'pending' && (
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleSelect(c.id)}
                                  aria-label="Select Commission"
                                />
                              )}
                            </td>
                            <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--teal)' }}>
                              {c.order_id.slice(0, 8)}
                            </td>
                            <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: '0.82rem', color: 'var(--silver)' }}>
                              {c.profiles?.full_name || c.profiles?.email || 'Agent'}
                            </td>
                            <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: '0.82rem', color: 'var(--silver)' }}>
                              {new Date(c.created_at).toLocaleDateString()}
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
                {filteredCommissions.length > PAGE_SIZE && (
                  <Pagination page={commSafePage} totalPages={commTotalPages} onPageChange={setCommPage} />
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* Recent Payouts */}
      <h3 style={{ fontSize: '1.1rem', color: 'var(--white)', marginTop: 'var(--space-8)', marginBottom: 'var(--space-4)', fontFamily: 'var(--font-brand)' }}>
        Recent Payouts
      </h3>
      <div className="card-metal" style={{ padding: 0, overflow: 'hidden' }}>
        {payouts.length === 0 ? (
          <div style={{ padding: 'var(--space-10)', textAlign: 'center', color: 'var(--grey-400)' }}>
            No Payouts Recorded Yet.
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'var(--surface-2)' }}>
                    {['Date', 'Agent', 'Amount', 'Method', 'Reference', 'Notes'].map((h, i) => (
                      <th key={h} style={{
                        padding: 'var(--space-3) var(--space-4)',
                        textAlign: i === 2 ? 'right' : 'left',
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
                      <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: '0.82rem', color: 'var(--silver)' }}>
                        {p.profiles?.full_name || p.profiles?.email || 'Agent'}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: '0.9rem', fontWeight: 700, color: 'var(--teal)', textAlign: 'right', fontFamily: 'var(--font-brand)' }}>
                        {fmtMoney(p.amount)}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: '0.82rem', color: 'var(--silver)' }}>
                        {(PAYMENT_METHODS.find(m => m.value === p.payment_method)?.label) || p.payment_method}
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

      {/* Payout Modal */}
      {payoutAgent && (
        <div
          onClick={() => !paying && setPayoutAgent(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 'var(--space-4)',
          }}
        >
          <div onClick={(e) => e.stopPropagation()} className="card-metal" style={{ width: '100%', maxWidth: 440, padding: 'var(--space-6)' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: 'var(--space-2)' }}>Pay Out Commission</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--grey-400)', marginBottom: 'var(--space-6)' }}>
              Agent: <strong style={{ color: 'var(--white)' }}>{payoutAgent.name}</strong><br />
              Approved Commissions Total: <strong style={{ color: 'var(--teal)' }}>{fmtMoney(payoutAgent.pending)}</strong>
              <br />
              <span style={{ fontSize: '0.74rem', color: 'var(--grey-500)' }}>
                Note: Only Approved Commissions Are Paid Out. Pending Items Must Be Approved First.
              </span>
            </p>
            <form onSubmit={handlePayout}>
              <div className="form-group">
                <label className="form-label" htmlFor="pay-method">Payment Method</label>
                <select
                  id="pay-method"
                  className="form-input"
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  required
                >
                  {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="pay-ref">Reference Number</label>
                <input
                  id="pay-ref"
                  type="text"
                  className="form-input"
                  placeholder="Confirmation Number Or Transaction ID"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="pay-notes">Notes</label>
                <textarea
                  id="pay-notes"
                  className="form-input"
                  rows={2}
                  placeholder="Optional Notes"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setPayoutAgent(null)} disabled={paying}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={paying}>
                  {paying ? 'Processing...' : 'Confirm Payout'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Update Rate Modal */}
      {rateAgent && (
        <div
          onClick={() => !savingRate && setRateAgent(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 'var(--space-4)',
          }}
        >
          <div onClick={(e) => e.stopPropagation()} className="card-metal" style={{ width: '100%', maxWidth: 380, padding: 'var(--space-6)' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: 'var(--space-2)' }}>Update Commission Rate</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--grey-400)', marginBottom: 'var(--space-6)' }}>
              Agent: <strong style={{ color: 'var(--white)' }}>{rateAgent.name}</strong>
            </p>
            <form onSubmit={handleSaveRate}>
              <div className="form-group">
                <label className="form-label" htmlFor="rate-input">New Commission Rate (%)</label>
                <input
                  id="rate-input"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  className="form-input"
                  value={rateValue}
                  onChange={(e) => setRateValue(e.target.value)}
                  required
                />
                <p style={{ fontSize: '0.72rem', color: 'var(--grey-500)', marginTop: 4 }}>
                  Between 0 And 100. Applied To Future Orders Only.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setRateAgent(null)} disabled={savingRate}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={savingRate}>
                  {savingRate ? 'Saving...' : 'Save Rate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
