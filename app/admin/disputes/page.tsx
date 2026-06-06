'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

const money = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(Number(n) || 0);

const fmtDate = (s: string | null) => {
  if (!s) return '-';
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00` : s;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

type Dispute = {
  id: string;
  agent_id: string;
  agent_name: string;
  agent_email: string;
  week_start: string;
  total_owed: number;
  status: string;
  disputed_at: string | null;
  dispute_reason: string | null;
  dispute_resolved_at: string | null;
  dispute_resolution: string | null;
  resolved: boolean;
};

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/admin/disputes', { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const j = await res.json();
      setDisputes(Array.isArray(j.disputes) ? j.disputes : []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function resolve(d: Dispute) {
    setBusyId(d.id);
    try {
      const res = await fetch('/api/admin/disputes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statementId: d.id, note: (notes[d.id] || '').trim() || undefined }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'failed');
      toast.success('Dispute Resolved');
      load();
    } catch (e: any) {
      toast.error(e.message || 'Failed');
    } finally {
      setBusyId(null);
    }
  }

  const openCount = disputes.filter((d) => !d.resolved).length;

  return (
    <div style={{ padding: '20px 16px', maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', color: 'var(--white)', margin: 0, fontFamily: 'var(--font-brand)' }}>Statement Disputes</h1>
      <p style={{ color: 'var(--grey-400)', fontSize: '0.88rem', margin: '4px 0 18px' }}>
        {openCount > 0 ? `${openCount} Open Dispute${openCount === 1 ? '' : 's'} Awaiting Review.` : 'No Open Disputes.'}
      </p>

      {error ? (
        <div style={{ color: '#ff6b6b' }}>Could Not Load Disputes. <button onClick={load} style={{ color: 'var(--teal)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Retry</button></div>
      ) : loading ? (
        <p style={{ color: 'var(--grey-500)' }}>Loading...</p>
      ) : disputes.length === 0 ? (
        <p style={{ color: 'var(--grey-500)' }}>No Disputes Filed.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {disputes.map((d) => (
            <li key={d.id} className="glass-panel" style={{
              padding: 16, borderRadius: 12,
              border: d.resolved ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(229,62,62,0.35)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ color: 'var(--white)', fontWeight: 700 }}>{d.agent_name} · Week Of {fmtDate(d.week_start)}</div>
                  <div style={{ color: 'var(--grey-500)', fontSize: '0.76rem' }}>
                    {d.agent_email} · Owed {money(d.total_owed)} · Disputed {fmtDate(d.disputed_at)}
                  </div>
                </div>
                <span style={{ color: d.resolved ? '#2ed573' : '#ff6b6b', fontWeight: 800, fontSize: '0.76rem', textTransform: 'uppercase' }}>
                  {d.resolved ? 'Resolved' : 'Open'}
                </span>
              </div>

              {d.dispute_reason && (
                <div style={{ color: 'var(--grey-300)', fontSize: '0.85rem', background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 10, margin: '12px 0' }}>
                  {d.dispute_reason}
                </div>
              )}

              {d.resolved ? (
                <div style={{ color: 'var(--grey-500)', fontSize: '0.8rem' }}>
                  Resolved {fmtDate(d.dispute_resolved_at)}{d.dispute_resolution && d.dispute_resolution !== 'resolved' ? ` · ${d.dispute_resolution}` : ''}
                </div>
              ) : (
                <>
                  <input
                    value={notes[d.id] || ''}
                    onChange={(e) => setNotes((n) => ({ ...n, [d.id]: e.target.value }))}
                    placeholder="Resolution Note (Optional)"
                    maxLength={1000}
                    style={{ width: '100%', padding: 10, borderRadius: 8, margin: '6px 0 10px', fontSize: 16,
                      background: 'rgba(255,255,255,0.04)', color: 'var(--white)', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                  <button onClick={() => resolve(d)} disabled={busyId === d.id} style={{
                    padding: '11px 18px', borderRadius: 8, minHeight: 44, border: 'none', fontWeight: 800,
                    background: 'var(--teal)', color: 'var(--black)', cursor: busyId === d.id ? 'wait' : 'pointer',
                  }}>{busyId === d.id ? 'Resolving...' : 'Mark Resolved'}</button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
