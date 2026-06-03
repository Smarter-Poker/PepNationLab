'use client';

import { useState } from 'react';
import { toast } from 'sonner';

interface Props {
  targetId: string;
  targetName?: string;
  initiallyFrozen: boolean;
  initialReason?: string | null;
  onChanged?: (next: { frozen: boolean; reason?: string | null }) => void;
}

/**
 * Drop-in freeze / unfreeze toggle for any downline row. The component
 * posts to /api/agent/freeze; the RPC enforces that the caller is an
 * admin or a transitive ancestor of the target. Frozen accounts can
 * still log in and view — but every order approval refuses (the
 * approve route walks the chain and returns 423 on the first frozen
 * tier).
 */
export default function AgentFreezeToggle({
  targetId, targetName, initiallyFrozen, initialReason, onChanged,
}: Props) {
  const [frozen, setFrozen] = useState(initiallyFrozen);
  const [reason, setReason] = useState<string | null>(initialReason ?? null);
  const [working, setWorking] = useState(false);
  const [askingFreeze, setAskingFreeze] = useState(false);
  const [pendingReason, setPendingReason] = useState('');

  async function doFreeze() {
    setWorking(true);
    try {
      const res = await fetch('/api/agent/freeze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_id: targetId, reason: pendingReason.trim() || 'Account Frozen By Upline' }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'freeze_failed');
      setFrozen(true);
      setReason(pendingReason.trim() || 'Account Frozen By Upline');
      setAskingFreeze(false);
      setPendingReason('');
      toast.success(`${targetName || 'Account'} Frozen — Downline Cannot Transact Until Unfrozen`);
      onChanged?.({ frozen: true, reason: pendingReason.trim() || 'Account Frozen By Upline' });
    } catch (e: any) {
      toast.error('Freeze Failed: ' + (e.message || 'Unknown'));
    } finally {
      setWorking(false);
    }
  }

  async function doUnfreeze() {
    if (!window.confirm(`Unfreeze ${targetName || 'this account'}? Their downline will be able to transact again.`)) return;
    setWorking(true);
    try {
      const res = await fetch('/api/agent/freeze', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_id: targetId }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'unfreeze_failed');
      setFrozen(false);
      setReason(null);
      toast.success(`${targetName || 'Account'} Unfrozen — Transactions Resumed`);
      onChanged?.({ frozen: false, reason: null });
    } catch (e: any) {
      toast.error('Unfreeze Failed: ' + (e.message || 'Unknown'));
    } finally {
      setWorking(false);
    }
  }

  if (askingFreeze) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 8, padding: 12,
        background: 'rgba(229,62,62,0.10)', border: '1px solid rgba(229,62,62,0.35)', borderRadius: 8,
      }}>
        <div style={{ color: 'var(--white)', fontSize: '0.88rem', fontWeight: 700 }}>
          Freeze {targetName || 'This Account'}?
        </div>
        <div style={{ color: 'var(--grey-400)', fontSize: '0.78rem' }}>
          They Can Still Log In. Order Approval Will Refuse Until You Unfreeze.
        </div>
        <input
          type="text"
          value={pendingReason}
          onChange={(e) => setPendingReason(e.target.value)}
          placeholder="Reason (e.g. Unpaid Invoice — Week Of Aug 4)"
          maxLength={500}
          style={{
            padding: '10px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(0,0,0,0.25)', color: 'var(--white)', fontSize: '0.88rem',
          }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setAskingFreeze(false); setPendingReason(''); }} disabled={working}
            style={{
              flex: 1, padding: '10px 12px', borderRadius: 6, minHeight: 40,
              background: 'rgba(255,255,255,0.05)', color: 'var(--white)',
              border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem',
            }}>
            Cancel
          </button>
          <button onClick={doFreeze} disabled={working}
            style={{
              flex: 1, padding: '10px 12px', borderRadius: 6, minHeight: 40,
              background: '#E53E3E', color: '#fff', border: 'none',
              cursor: working ? 'wait' : 'pointer', fontWeight: 800, fontSize: '0.85rem',
            }}>
            {working ? 'Freezing...' : 'Confirm Freeze'}
          </button>
        </div>
      </div>
    );
  }

  if (frozen) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{
          alignSelf: 'flex-start', padding: '4px 10px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 800,
          background: 'rgba(229,62,62,0.20)', color: '#ff6b6b', letterSpacing: '0.04em',
        }}>
          TRANSACTIONS FROZEN
        </span>
        {reason && (
          <span style={{ color: 'var(--grey-500)', fontSize: '0.78rem' }}>
            Reason: {reason}
          </span>
        )}
        <button onClick={doUnfreeze} disabled={working}
          style={{
            alignSelf: 'flex-start', padding: '8px 14px', borderRadius: 6, minHeight: 36,
            background: 'var(--teal)', color: 'var(--black)', border: 'none',
            cursor: working ? 'wait' : 'pointer', fontWeight: 800, fontSize: '0.82rem',
          }}>
          {working ? 'Unfreezing...' : 'Unfreeze Transactions'}
        </button>
      </div>
    );
  }

  return (
    <button onClick={() => setAskingFreeze(true)} disabled={working}
      style={{
        alignSelf: 'flex-start', padding: '8px 14px', borderRadius: 6, minHeight: 36,
        background: 'rgba(229,62,62,0.10)', color: '#ff6b6b',
        border: '1px solid rgba(229,62,62,0.35)',
        cursor: working ? 'wait' : 'pointer', fontWeight: 700, fontSize: '0.82rem',
      }}>
      Freeze Transactions
    </button>
  );
}
