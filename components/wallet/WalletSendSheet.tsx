'use client';

import { useState } from 'react';
import { toast } from 'sonner';

/**
 * Send Funds sheet. Posts to /api/credits/send, which atomically debits the
 * sender's wallet (or bills a credit-line agent's credit line) and credits the
 * recipient's wallet, recording a transaction on both sides. The API gates this
 * to admin / super-agent / agent / sub-agent and to the sender's own network.
 */
export default function WalletSendSheet({
  onClose,
  onSent,
}: {
  onClose: () => void;
  onSent: () => void;
}) {
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = Math.round((Number(amount) || 0) * 100) / 100;
    if (!recipient.trim()) { toast.error('Enter A Recipient Email Or Username.'); return; }
    if (!Number.isFinite(amt) || amt <= 0) { toast.error('Enter An Amount Greater Than $0.'); return; }

    setBusy(true);
    try {
      const res = await fetch('/api/credits/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ recipientEmail: recipient.trim(), amount: amt, note: note.trim() || undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed To Send Funds.');
      toast.success(`Sent $${amt.toFixed(2)} To ${json?.recipient?.name || recipient.trim()}.`);
      onSent();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed To Send Funds.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(5,10,15,0.7)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card-metal"
        style={{ width: '100%', maxWidth: 440, padding: 'var(--space-5)', borderRadius: 14 }}
      >
        <h2 style={{ marginTop: 0, color: 'var(--white)', fontSize: '1.15rem', fontFamily: 'var(--font-brand)' }}>
          Send Funds
        </h2>
        <p style={{ color: 'var(--silver)', fontSize: '0.85rem', lineHeight: 1.5, marginTop: 0 }}>
          Funds Are Deducted From Your Wallet (Or Billed To Your Credit Line) And Added To The Recipient's Wallet. Both Sides Get A Transaction Record.
        </p>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="send-recipient">Recipient Email Or Username</label>
            <input
              id="send-recipient"
              type="text"
              className="form-input"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              autoComplete="off"
              placeholder="Someone In Your Network"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="send-amount">Amount (USD)</label>
            <input
              id="send-amount"
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              className="form-input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="25.00"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="send-note">Note (Optional)</label>
            <input
              id="send-note"
              type="text"
              className="form-input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              placeholder="e.g. Referral Bonus"
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Sending...' : 'Send Funds'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
