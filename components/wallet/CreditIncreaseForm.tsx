'use client';

import { useState } from 'react';
import { toast } from 'sonner';

export default function CreditIncreaseForm({
  currentLimit, onClose, onSubmitted,
}: { currentLimit: number; onClose: () => void; onSubmitted: () => void }) {
  const [requested, setRequested] = useState<string>(String(Math.max(currentLimit + 500, 1000)));
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/agent/wallet/credit-increase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requested_limit: Number(requested),
          reason,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'failed');
      onSubmitted();
    } catch (e: any) {
      toast.error('Request Failed: ' + (e.message || 'Unknown'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
      zIndex: 9997, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12,
    }}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()} style={{
        background: 'var(--grey-900)', borderRadius: 14, padding: 20, width: '100%', maxWidth: 420,
        border: '1px solid rgba(255,255,255,0.1)',
      }}>
        <h2 style={{ color: 'var(--white)', fontSize: '1.2rem', margin: '0 0 6px' }}>Request Credit Increase</h2>
        <p style={{ color: 'var(--grey-400)', fontSize: '0.82rem', margin: '0 0 14px' }}>
          Current Limit: ${currentLimit.toFixed(2)}
        </p>
        <label style={{ display: 'block', marginBottom: 12 }}>
          <span style={{ color: 'var(--grey-400)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Requested Limit</span>
          <input type="number" min={currentLimit + 1} step="0.01" value={requested}
            onChange={e => setRequested(e.target.value)} required
            style={{
              width: '100%', padding: 12, marginTop: 4, borderRadius: 8, fontSize: '16px',
              background: 'rgba(255,255,255,0.04)', color: 'var(--white)',
              border: '1px solid rgba(255,255,255,0.1)',
            }} />
        </label>
        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ color: 'var(--grey-400)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Reason</span>
          <textarea required minLength={3} maxLength={500} value={reason} onChange={e => setReason(e.target.value)}
            rows={3} style={{
              width: '100%', padding: 12, marginTop: 4, borderRadius: 8, fontSize: '16px',
              background: 'rgba(255,255,255,0.04)', color: 'var(--white)',
              border: '1px solid rgba(255,255,255,0.1)', resize: 'vertical',
            }} placeholder="Higher Volume This Month" />
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={onClose} disabled={submitting} style={{
            flex: 1, padding: 14, borderRadius: 8, minHeight: 44,
            background: 'rgba(255,255,255,0.05)', color: 'var(--white)',
            border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontWeight: 700,
          }}>Cancel</button>
          <button type="submit" disabled={submitting} style={{
            flex: 2, padding: 14, borderRadius: 8, minHeight: 44,
            background: 'var(--teal)', color: 'var(--black)', border: 'none',
            cursor: submitting ? 'wait' : 'pointer', fontWeight: 800,
          }}>{submitting ? 'Submitting...' : 'Submit Request'}</button>
        </div>
      </form>
    </div>
  );
}
