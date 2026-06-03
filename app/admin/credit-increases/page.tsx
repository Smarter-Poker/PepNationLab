'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

const money = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(Number(n) || 0);

const fmtDate = (s: string | null) => {
  if (!s) return '—';
  const d = new Date(s);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

type Req = {
  id: string;
  agent_id: string;
  agent_name: string;
  agent_email: string;
  account_type: string | null;
  current_limit: number;
  requested_limit: number;
  reason: string;
  status: string;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string;
  live_limit: number | null;
};

const STATUS_COLOR: Record<string, string> = { pending: '#ffb800', approved: '#2ed573', denied: '#ff4757', withdrawn: 'var(--grey-500)' };

export default function AdminCreditIncreasesPage() {
  const [reqs, setReqs] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/admin/credit-increases', { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const j = await res.json();
      setReqs(Array.isArray(j.requests) ? j.requests : []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function decide(r: Req, decision: 'approved' | 'denied') {
    setBusyId(r.id);
    try {
      const res = await fetch('/api/admin/credit-increases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: r.id, decision, note: (notes[r.id] || '').trim() || undefined }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'failed');
      toast.success(decision === 'approved' ? `Approved — New Limit ${money(j.result?.new_limit || r.requested_limit)}` : 'Request Denied');
      load();
    } catch (e: any) {
      toast.error(e.message || 'Failed');
    } finally {
      setBusyId(null);
    }
  }

  const pendingCount = reqs.filter((r) => r.status === 'pending').length;

  return (
    <div style={{ padding: '20px 16px', maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', color: 'var(--white)', margin: 0, fontFamily: 'var(--font-brand)' }}>Credit Increase Requests</h1>
      <p style={{ color: 'var(--grey-400)', fontSize: '0.88rem', margin: '4px 0 18px' }}>
        {pendingCount > 0 ? `${pendingCount} Pending Review.` : 'No Pending Requests.'} Approving Raises The Agent's Credit Limit Immediately.
      </p>

      {error ? (
        <div style={{ color: '#ff6b6b' }}>Could Not Load Requests. <button onClick={load} style={{ color: 'var(--teal)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Retry</button></div>
      ) : loading ? (
        <p style={{ color: 'var(--grey-500)' }}>Loading...</p>
      ) : reqs.length === 0 ? (
        <p style={{ color: 'var(--grey-500)' }}>No Credit Increase Requests Yet.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {reqs.map((r) => {
            const pending = r.status === 'pending';
            return (
              <li key={r.id} className="card-metal" style={{ padding: 16, borderRadius: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ color: 'var(--white)', fontWeight: 700 }}>{r.agent_name}</div>
                    <div style={{ color: 'var(--grey-500)', fontSize: '0.76rem' }}>{r.agent_email} · {fmtDate(r.created_at)}</div>
                  </div>
                  <span style={{ color: STATUS_COLOR[r.status] || 'var(--grey-400)', fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase' }}>
                    {r.status}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 16, margin: '12px 0', fontSize: '0.9rem', flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--silver)' }}>Current: <strong style={{ color: 'var(--white)' }}>{money(r.current_limit)}</strong></span>
                  <span style={{ color: 'var(--silver)' }}>Requested: <strong style={{ color: 'var(--teal)' }}>{money(r.requested_limit)}</strong></span>
                </div>

                {r.reason && (
                  <div style={{ color: 'var(--grey-300)', fontSize: '0.85rem', background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 10, marginBottom: 12 }}>
                    {r.reason}
                  </div>
                )}

                {pending ? (
                  <>
                    <input
                      value={notes[r.id] || ''}
                      onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                      placeholder="Decision Note (Optional)"
                      maxLength={500}
                      style={{ width: '100%', padding: 10, borderRadius: 8, marginBottom: 10, fontSize: 16,
                        background: 'rgba(255,255,255,0.04)', color: 'var(--white)', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => decide(r, 'approved')} disabled={busyId === r.id} style={{
                        flex: 2, padding: '12px', borderRadius: 8, minHeight: 44, border: 'none', fontWeight: 800,
                        background: 'var(--teal)', color: 'var(--black)', cursor: busyId === r.id ? 'wait' : 'pointer',
                      }}>{busyId === r.id ? 'Saving...' : `Approve ${money(r.requested_limit)}`}</button>
                      <button onClick={() => decide(r, 'denied')} disabled={busyId === r.id} style={{
                        flex: 1, padding: '12px', borderRadius: 8, minHeight: 44, fontWeight: 800,
                        background: 'rgba(229,62,62,0.12)', color: '#ff6b6b', border: '1px solid rgba(229,62,62,0.3)',
                        cursor: busyId === r.id ? 'wait' : 'pointer',
                      }}>Deny</button>
                    </div>
                  </>
                ) : (
                  <div style={{ color: 'var(--grey-500)', fontSize: '0.8rem' }}>
                    Decided {fmtDate(r.decided_at)}{r.decision_note ? ` · ${r.decision_note}` : ''}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
