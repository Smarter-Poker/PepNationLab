'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { money, fmtDate } from './format';
import { walletErrorMessage } from './error-messages';

/**
 * "Did you receive this payment?"
 *
 * Bills a downline says they have paid, waiting on THIS user to confirm the
 * money actually arrived. Nothing settles until they do: the payer's credit
 * line stays consumed and this account's wallet is not credited.
 *
 * Before this existed, pay_invoice credited the payee's spendable balance on
 * the payer's word alone - so an agent could self-declare a payment and their
 * upline's wallet grew with no money having moved.
 */

type Awaiting = {
  id: string;
  target_type: 'statement' | 'agent_invoice';
  agent_id: string;
  payer_name: string;
  week_start: string;
  week_end: string;
  total_owed: number | string;
  payment_method: string | null;
  payment_submitted_at: string | null;
  proof_url: string | null;
};

export default function PaymentsToConfirm({ onChanged }: { onChanged?: () => void }) {
  const [rows, setRows] = useState<Awaiting[] | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/agent/wallet/confirm-payment', { cache: 'no-store' });
      if (!res.ok) { setState('error'); return; }
      const j = await res.json();
      setRows(Array.isArray(j?.awaiting) ? j.awaiting : []);
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function decide(row: Awaiting, approve: boolean) {
    if (!approve) {
      const note = window.prompt('Why was this payment not confirmed? (optional)') ?? undefined;
      await send(row, false, note);
      return;
    }
    await send(row, true);
  }

  async function send(row: Awaiting, approve: boolean, note?: string) {
    setBusyId(row.id);
    try {
      const res = await fetch('/api/agent/wallet/confirm-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_type: row.target_type,
          target_id: row.id,
          approve,
          note,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || 'confirm_failed');
      setRows((prev) => (prev ?? []).filter((r) => r.id !== row.id));
      toast.success(approve ? 'Payment Confirmed - Bill Settled' : 'Marked As Not Received');
      onChanged?.();
    } catch (e) {
      toast.error(walletErrorMessage(e, 'Could Not Record That. Please Try Again.'));
    } finally {
      setBusyId(null);
    }
  }

  if (state === 'loading') return null;
  if (state === 'error') {
    return (
      <section className="glass-panel" style={{ padding: 16, borderRadius: 12 }}>
        <h3 style={{ color: 'var(--white)', marginTop: 0 }}>Payments To Confirm</h3>
        <p style={{ color: 'var(--grey-400)', fontSize: '0.85rem', margin: 0 }}>
          Could Not Load Payments Awaiting Your Confirmation.
        </p>
      </section>
    );
  }
  // Nothing waiting is the normal state - stay out of the way.
  if (!rows || rows.length === 0) return null;

  return (
    <section className="glass-panel" style={{ padding: 16, borderRadius: 12, borderColor: '#F6AD5540' }}>
      <h3 style={{ color: '#F6AD55', marginTop: 0, marginBottom: 4 }}>
        Payments To Confirm ({rows.length})
      </h3>
      <p style={{ color: 'var(--grey-500)', fontSize: '0.8rem', margin: '0 0 14px' }}>
        These Bills Are Marked Paid By The Sender But Are Not Settled Yet. Check The
        Proof, Then Confirm Only If The Money Actually Arrived.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map((r) => (
          <div key={`${r.target_type}-${r.id}`} style={{
            padding: 12, borderRadius: 10, background: 'rgba(255,255,255,0.03)',
            display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: 'var(--white)', fontWeight: 700, fontSize: '0.95rem' }}>
                {r.payer_name} &middot; {money(Number(r.total_owed || 0))}
              </div>
              <div style={{ color: 'var(--grey-400)', fontSize: '0.76rem', marginTop: 2 }}>
                Week Of {fmtDate(r.week_start)}
                {r.payment_submitted_at ? ` · Submitted ${fmtDate(r.payment_submitted_at)}` : ''}
              </div>
              {r.proof_url ? (
                <a
                  href={r.proof_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--teal)', fontSize: '0.78rem', fontWeight: 700, textDecoration: 'none' }}
                >
                  View Proof
                </a>
              ) : (
                <span style={{ color: 'var(--grey-500)', fontSize: '0.78rem' }}>No Proof Attached</span>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                disabled={busyId === r.id}
                onClick={() => decide(r, true)}
                style={{
                  minHeight: 44, padding: '0 16px', borderRadius: 8, cursor: 'pointer',
                  background: 'var(--teal)', color: 'var(--black)', border: 'none', fontWeight: 800, fontSize: '0.82rem',
                }}
              >
                Yes, Received
              </button>
              <button
                type="button"
                disabled={busyId === r.id}
                onClick={() => decide(r, false)}
                style={{
                  minHeight: 44, padding: '0 16px', borderRadius: 8, cursor: 'pointer',
                  background: 'transparent', color: 'var(--grey-300)',
                  border: '1px solid rgba(255,255,255,0.18)', fontWeight: 700, fontSize: '0.82rem',
                }}
              >
                Not Received
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
