'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

const money = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(Number(n) || 0);

type Agent = {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  is_super_agent: boolean;
  account_type: 'credit' | 'prepaid' | null;
  prepaid_balance: number;
  credit_limit: number;
  credit_used: number;
  open_owed: number;
};

export default function AdminPaymentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/admin/payments', { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const j = await res.json();
      setAgents(Array.isArray(j.agents) ? j.agents : []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const selected = agents.find((a) => a.id === selectedId) || null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter((a) =>
      (a.full_name || '').toLowerCase().includes(q) || (a.email || '').toLowerCase().includes(q));
  }, [agents, query]);

  async function submit() {
    const amt = Math.round(Number(amount) * 100) / 100;
    if (!selected) { toast.error('Select An Agent'); return; }
    if (!Number.isFinite(amt) || amt <= 0) { toast.error('Enter An Amount Greater Than $0'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: selected.id, amount: amt, note: note.trim() || undefined }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'failed');
      const r = j.result || {};
      const paid = Number(r.statements_paid || 0);
      toast.success(paid > 0
        ? `Applied ${money(amt)}. ${paid} Statement${paid === 1 ? '' : 's'} Marked Paid In Full.`
        : `Applied ${money(amt)} To Account.`);
      setAmount('');
      setNote('');
      load();
    } catch (e: any) {
      toast.error('Payment Failed: ' + (e.message || 'Unknown'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ padding: '20px 16px', maxWidth: 1100, margin: '0 auto' }}>
      <h1 className="animated-gradient-text" style={{ fontSize: '1.5rem', margin: 0 }}>Agent Payments</h1>
      <p style={{ color: 'var(--grey-400)', fontSize: '0.88rem', margin: '4px 0 18px' }}>
        Record A Weekly Bill Payment Or Send Credit. Credit-Line Agents Have Their Balance Paid Down; Prepaid Agents Are Topped Up. A Full Payoff Marks Open Statements Paid In Full.
      </p>

      {error ? (
        <div style={{ color: '#ff6b6b' }}>Could Not Load Agents. <button onClick={load} style={{ color: 'var(--teal)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Retry</button></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) minmax(280px, 360px)', gap: 18, alignItems: 'start' }}>
          {/* Agent list */}
          <section className="glass-panel" style={{ padding: 14, borderRadius: 12 }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search By Name Or Email"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, marginBottom: 10, fontSize: 16,
                background: 'rgba(255,255,255,0.04)', color: 'var(--white)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
            {loading ? (
              <p style={{ color: 'var(--grey-500)' }}>Loading...</p>
            ) : filtered.length === 0 ? (
              <p style={{ color: 'var(--grey-500)' }}>No Agents Found.</p>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 520, overflowY: 'auto' }}>
                {filtered.map((a) => {
                  const active = a.id === selectedId;
                  const owes = a.account_type === 'credit' ? a.credit_used : a.open_owed;
                  return (
                    <li key={a.id}>
                      <button onClick={() => setSelectedId(a.id)} style={{
                        width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8, minHeight: 44, cursor: 'pointer',
                        background: active ? 'rgba(0,196,188,0.14)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${active ? 'var(--teal)' : 'rgba(255,255,255,0.06)'}`, color: 'var(--white)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
                      }}>
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                          <span style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {a.full_name || a.email}{a.is_super_agent ? ' · Super' : ''}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--grey-500)', textTransform: 'capitalize' }}>
                            {a.account_type || 'unset'}
                          </span>
                        </span>
                        <span style={{ fontSize: '0.8rem', color: owes > 0 ? '#ff6b6b' : 'var(--grey-500)', whiteSpace: 'nowrap' }}>
                          {a.account_type === 'credit' ? `Used ${money(owes)}` : owes > 0 ? `Owes ${money(owes)}` : money(a.prepaid_balance)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Payment panel */}
          <section className="glass-panel" style={{ padding: 16, borderRadius: 12, position: 'sticky', top: 76 }}>
            {!selected ? (
              <p style={{ color: 'var(--grey-500)', margin: 0 }}>Select An Agent To Record A Payment.</p>
            ) : (
              <>
                <h3 style={{ color: 'var(--white)', marginTop: 0, marginBottom: 10 }}>{selected.full_name || selected.email}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14, fontSize: '0.85rem' }}>
                  <Row label="Account Type" value={(selected.account_type || 'Unset')} cap />
                  {selected.account_type === 'credit' ? (
                    <>
                      <Row label="Credit Limit" value={money(selected.credit_limit)} />
                      <Row label="Credit Used" value={money(selected.credit_used)} danger={selected.credit_used > 0} />
                      <Row label="Available" value={money(Math.max(0, selected.credit_limit - selected.credit_used))} />
                    </>
                  ) : (
                    <Row label="Prepaid Balance" value={money(selected.prepaid_balance)} />
                  )}
                  <Row label="Open Statements" value={money(selected.open_owed)} danger={selected.open_owed > 0} />
                </div>

                <label style={{ display: 'block', marginBottom: 10 }}>
                  <span style={{ color: 'var(--grey-400)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Payment Amount</span>
                  <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00" className="form-input"
                    style={{ width: '100%', padding: 12, marginTop: 4, borderRadius: 8, fontSize: 16,
                      background: 'rgba(255,255,255,0.04)', color: 'var(--white)', border: '1px solid rgba(255,255,255,0.1)' }} />
                </label>
                {selected.account_type === 'credit' && selected.credit_used > 0 && (
                  <button type="button" onClick={() => setAmount(String(selected.credit_used))}
                    style={{ background: 'none', border: 'none', color: 'var(--teal)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, padding: 0, marginBottom: 10 }}>
                    Pay In Full ({money(selected.credit_used)})
                  </button>
                )}
                {selected.account_type !== 'credit' && selected.open_owed > 0 && (
                  <button type="button" onClick={() => setAmount(String(selected.open_owed))}
                    style={{ background: 'none', border: 'none', color: 'var(--teal)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, padding: 0, marginBottom: 10 }}>
                    Cover Open Statements ({money(selected.open_owed)})
                  </button>
                )}

                <label style={{ display: 'block', marginBottom: 14 }}>
                  <span style={{ color: 'var(--grey-400)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Note (Optional)</span>
                  <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200}
                    placeholder="Zelle Ref, Week Of, Etc."
                    style={{ width: '100%', padding: 12, marginTop: 4, borderRadius: 8, fontSize: 16,
                      background: 'rgba(255,255,255,0.04)', color: 'var(--white)', border: '1px solid rgba(255,255,255,0.1)' }} />
                </label>

                <button onClick={submit} disabled={submitting} className="btn-primary"
                  style={{ width: '100%', background: 'var(--teal)', color: 'var(--black)', border: 'none', padding: '13px',
                    borderRadius: 10, fontWeight: 800, minHeight: 46, cursor: submitting ? 'wait' : 'pointer' }}>
                  {submitting ? 'Recording...' : 'Record Payment'}
                </button>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, danger, cap }: { label: string; value: string; danger?: boolean; cap?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
      <span style={{ color: 'var(--grey-500)' }}>{label}</span>
      <span style={{ color: danger ? '#ff6b6b' : 'var(--white)', fontWeight: 700, textTransform: cap ? 'capitalize' : 'none' }}>{value}</span>
    </div>
  );
}
