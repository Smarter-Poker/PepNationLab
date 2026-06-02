'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { money, fmtDate, statusLabel } from './format';

const HANDLES = ['zelle', 'venmo', 'cashapp', 'apple_pay'] as const;
type Handle = (typeof HANDLES)[number];

export default function WalletSettings() {
  const [enabled, setEnabled] = useState(false);
  const [handle, setHandle] = useState<Handle>('zelle');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [apRes, ciRes] = await Promise.all([
          fetch('/api/agent/wallet/auto-pay', { cache: 'no-store' }),
          fetch('/api/agent/wallet/credit-increase', { cache: 'no-store' }),
        ]);
        if (apRes.ok) {
          const j = await apRes.json();
          setEnabled(!!j.enabled);
          if (j.handle && HANDLES.includes(j.handle)) setHandle(j.handle);
        }
        if (ciRes.ok) {
          const j = await ciRes.json();
          setRequests(Array.isArray(j.requests) ? j.requests : []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save(next: { enabled?: boolean; handle?: Handle }) {
    const body = { enabled: next.enabled ?? enabled, handle: next.handle ?? handle };
    setSaving(true);
    // Optimistic
    if (next.enabled !== undefined) setEnabled(next.enabled);
    if (next.handle !== undefined) setHandle(next.handle);
    try {
      const res = await fetch('/api/agent/wallet/auto-pay', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      toast.success('Saved');
    } catch {
      toast.error('Could Not Save');
      // Revert
      if (next.enabled !== undefined) setEnabled(!next.enabled);
    } finally {
      setSaving(false);
    }
  }

  const statusColor = (s: string) =>
    s === 'approved' ? '#2ed573' : s === 'denied' ? '#ff4757' : '#ffb800';

  return (
    <section className="card-glass" style={{ padding: 16, borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <h3 style={{ color: 'var(--white)', marginTop: 0, marginBottom: 4 }}>Auto-Pay</h3>
        <p style={{ color: 'var(--grey-400)', fontSize: '0.82rem', margin: '0 0 12px' }}>
          When Enabled And Your Prepaid Balance Covers A Statement, It Is Paid Automatically Before The Due Date.
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={loading || saving}
          onClick={() => save({ enabled: !enabled })}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 10, background: 'none', border: 'none',
            cursor: loading || saving ? 'wait' : 'pointer', padding: 0, minHeight: 44,
          }}
        >
          <span style={{
            width: 46, height: 26, borderRadius: 13, padding: 3, transition: 'background 0.15s',
            background: enabled ? 'var(--teal)' : 'rgba(255,255,255,0.15)', display: 'inline-flex',
            justifyContent: enabled ? 'flex-end' : 'flex-start',
          }}>
            <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', display: 'block' }} />
          </span>
          <span style={{ color: 'var(--white)', fontWeight: 700, fontSize: '0.9rem' }}>
            {loading ? 'Loading...' : enabled ? 'Auto-Pay On' : 'Auto-Pay Off'}
          </span>
        </button>
      </div>

      <div>
        <h4 style={{ color: 'var(--white)', fontSize: '0.9rem', margin: '0 0 4px' }}>Preferred Payout Handle</h4>
        <p style={{ color: 'var(--grey-400)', fontSize: '0.8rem', margin: '0 0 10px' }}>
          Used To Pre-Select Your Method On The Pay Now Screen.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, maxWidth: 360 }}>
          {HANDLES.map(h => (
            <button key={h} type="button" disabled={saving} onClick={() => save({ handle: h })}
              style={{
                padding: '12px', borderRadius: 8, minHeight: 44,
                background: handle === h ? 'var(--teal)' : 'rgba(255,255,255,0.04)',
                color: handle === h ? 'var(--black)' : 'var(--white)',
                border: `1px solid ${handle === h ? 'var(--teal)' : 'rgba(255,255,255,0.1)'}`,
                cursor: saving ? 'wait' : 'pointer', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.82rem',
              }}>
              {h.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h4 style={{ color: 'var(--white)', fontSize: '0.9rem', margin: '0 0 8px' }}>Credit Increase Requests</h4>
        {requests.length === 0 ? (
          <p style={{ color: 'var(--grey-500)', fontSize: '0.85rem', margin: 0 }}>No Requests Yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {requests.map((r: any) => (
              <li key={r.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
                padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, fontSize: '0.84rem',
              }}>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ color: 'var(--white)' }}>
                    {money(Number(r.current_limit || 0))} → {money(Number(r.requested_limit || 0))}
                  </span>
                  <span style={{ color: 'var(--grey-500)', fontSize: '0.72rem' }}>{fmtDate(r.created_at)}</span>
                </span>
                <span style={{ color: statusColor(r.status), fontWeight: 700, fontSize: '0.76rem', textTransform: 'uppercase' }}>
                  {statusLabel(r.status)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <a href="/account/settings" style={{ color: 'var(--teal)', fontWeight: 700, fontSize: '0.85rem' }}>
        Open Full Account Settings →
      </a>
    </section>
  );
}
