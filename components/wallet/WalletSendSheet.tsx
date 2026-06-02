'use client';

import { useState, useEffect } from 'react';
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
  const [recipientMode, setRecipientMode] = useState<'downline' | 'manual'>('downline');
  const [selectedDownlineId, setSelectedDownlineId] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const [downlines, setDownlines] = useState<any[]>([]);
  const [loadingDownlines, setLoadingDownlines] = useState(true);

  useEffect(() => {
    fetch('/api/agent/team/org-chart')
      .then(res => res.json())
      .then(json => {
        if (json && Array.isArray(json.nodes)) {
          // Flatten tree into a flat list of potential recipients
          const list: any[] = [];
          const traverse = (nodes: any[]) => {
            nodes.forEach(n => {
              list.push(n);
              if (n.children && n.children.length > 0) traverse(n.children);
            });
          };
          traverse(json.nodes);
          setDownlines(list);
          if (list.length > 0) {
            setSelectedDownlineId(list[0].id);
          } else {
            setRecipientMode('manual');
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoadingDownlines(false));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = Math.round((Number(amount) || 0) * 100) / 100;
    
    if (recipientMode === 'downline' && !selectedDownlineId) {
      toast.error('Please select a recipient from your network.');
      return;
    }
    if (recipientMode === 'manual' && !recipientEmail.trim()) {
      toast.error('Enter A Recipient Email Or Username.');
      return;
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error('Enter An Amount Greater Than $0.');
      return;
    }

    setBusy(true);
    try {
      const payload: any = { amount: amt, note: note.trim() || undefined };
      if (recipientMode === 'downline') {
        payload.recipientId = selectedDownlineId;
      } else {
        payload.recipientEmail = recipientEmail.trim();
      }

      const res = await fetch('/api/credits/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed To Send Funds.');
      toast.success(`Sent $${amt.toFixed(2)} To ${json?.recipient?.name || 'Recipient'}.`);
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
          Funds Are Deducted From Your Wallet (Or Billed To Your Credit Line) And Added To The Recipient's Wallet.
        </p>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
          
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label className="form-label" style={{ margin: 0 }}>Recipient</label>
              {downlines.length > 0 && (
                <button 
                  type="button" 
                  onClick={() => setRecipientMode(m => m === 'downline' ? 'manual' : 'downline')}
                  style={{ background: 'none', border: 'none', color: 'var(--teal)', fontSize: '0.75rem', cursor: 'pointer', padding: 0 }}
                >
                  {recipientMode === 'downline' ? 'Enter Email/Username Manually' : 'Select From Network'}
                </button>
              )}
            </div>

            {loadingDownlines ? (
              <div className="skeleton" style={{ height: 44, borderRadius: 8, width: '100%' }} />
            ) : recipientMode === 'downline' && downlines.length > 0 ? (
              <select
                className="form-input"
                value={selectedDownlineId}
                onChange={(e) => setSelectedDownlineId(e.target.value)}
                style={{ WebkitAppearance: 'none', appearance: 'none', cursor: 'pointer' }}
              >
                {downlines.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.full_name || d.username || d.email} ({d.role.replace('_', ' ')})
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="send-recipient"
                type="text"
                className="form-input"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                autoComplete="off"
                placeholder="Recipient Email Or Username"
              />
            )}
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
