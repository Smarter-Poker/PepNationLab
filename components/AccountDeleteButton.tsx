'use client';

import { useState } from 'react';
import { toast } from 'sonner';

/**
 * Account deletion 2026-07-29.
 * Two-step confirm: click -> type-to-confirm card -> POST /api/agent/delete-account.
 * The server RPC does the real authorization (admin, or transitive upline ancestor)
 * and performs a reversible soft delete that keeps all order + financial history.
 */
export default function AccountDeleteButton({
  targetId,
  targetName,
  kind = 'agent',
  compact = false,
  onDeleted,
}: {
  targetId: string;
  targetName?: string | null;
  kind?: 'agent' | 'researcher';
  compact?: boolean;
  onDeleted?: () => void;
}) {
  const [asking, setAsking] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [reason, setReason] = useState('');
  const [working, setWorking] = useState(false);

  const label = kind === 'researcher' ? 'Delete Researcher' : 'Delete Agent';
  const noun = kind === 'researcher' ? 'Researcher' : 'Agent';
  const ready = confirmText.trim().toUpperCase() === 'DELETE';

  async function doDelete() {
    if (!ready || working) return;
    setWorking(true);
    try {
      const res = await fetch('/api/agent/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_id: targetId, reason: reason.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json?.error || `Could Not Delete This ${noun}.`);
        setWorking(false);
        return;
      }

      const successMsg = json?.result?.already_deleted
        ? `${noun} Was Already Deleted.`
        : `✓ ${targetName ? `"${targetName}"` : noun} Successfully Deleted`;

      // Reset component state immediately so it's clean
      setAsking(false);
      setConfirmText('');
      setReason('');
      setWorking(false);

      // Fire toast — Toaster is in root layout (z-index 9999999), survives any modal unmount
      toast.success(successMsg, { duration: 5000 });

      // Give the toast 100ms to commit to Sonner's portal, then trigger the parent close
      setTimeout(() => {
        onDeleted?.();
      }, 100);
    } catch {
      toast.error('Network Error. Please Try Again.');
      setWorking(false);
    }
  }

  if (asking) {
    return (
      <div
        style={{
          background: 'rgba(229,62,62,0.10)',
          border: '1px solid rgba(229,62,62,0.35)',
          borderRadius: 8,
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          maxWidth: 460,
        }}
      >
        <div style={{ fontWeight: 700, color: '#ff6b6b', fontSize: '0.85rem' }}>
          Delete {targetName ? `"${targetName}"` : `This ${noun}`}?
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--grey-400)', lineHeight: 1.5 }}>
          This Removes The Account From All Lists And Blocks Login Immediately. Their Username,
          Email And Referral Code Are Released For Re-Use. Order And Payment History Is Kept For
          Your Records. Any Agents Or Researchers Beneath Them Are Automatically Moved To The Main
          Admin Account, So Nothing Is Ever Lost. An Admin Can Restore The Account If This Was A Mistake.
        </div>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (Optional)"
          maxLength={500}
          style={{
            padding: '8px 10px',
            borderRadius: 6,
            background: 'rgba(0,0,0,0.25)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'var(--white)',
            fontSize: '0.82rem',
          }}
        />
        <input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder='Type DELETE To Confirm'
          autoComplete="off"
          style={{
            padding: '8px 10px',
            borderRadius: 6,
            background: 'rgba(0,0,0,0.25)',
            border: `1px solid ${ready ? 'rgba(229,62,62,0.55)' : 'rgba(255,255,255,0.12)'}`,
            color: 'var(--white)',
            fontSize: '0.82rem',
            letterSpacing: '0.05em',
          }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => {
              setAsking(false);
              setConfirmText('');
              setReason('');
            }}
            disabled={working}
            style={{
              padding: '8px 14px',
              borderRadius: 6,
              minHeight: 36,
              background: 'none',
              color: 'var(--grey-300)',
              border: '1px solid rgba(255,255,255,0.18)',
              cursor: working ? 'wait' : 'pointer',
              fontWeight: 600,
              fontSize: '0.82rem',
            }}
          >
            Cancel
          </button>
          <button
            onClick={doDelete}
            disabled={working || !ready}
            style={{
              padding: '8px 14px',
              borderRadius: 6,
              minHeight: 36,
              background: ready ? '#E53E3E' : 'rgba(229,62,62,0.18)',
              color: ready ? '#fff' : 'rgba(255,107,107,0.6)',
              border: '1px solid rgba(229,62,62,0.45)',
              cursor: working ? 'wait' : ready ? 'pointer' : 'not-allowed',
              fontWeight: 700,
              fontSize: '0.82rem',
            }}
          >
            {working ? 'Deleting…' : `Delete ${noun}`}
          </button>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <button
        onClick={() => setAsking(true)}
        disabled={working}
        style={{
          fontSize: '0.75rem',
          padding: '5px 12px',
          borderRadius: 6,
          border: '1px solid rgba(229,62,62,0.3)',
          background: 'none',
          color: 'var(--red)',
          cursor: working ? 'wait' : 'pointer',
          fontWeight: 600,
        }}
      >
        {label}
      </button>
    );
  }

  return (
    <button
      onClick={() => setAsking(true)}
      disabled={working}
      style={{
        alignSelf: 'flex-start',
        padding: '8px 14px',
        borderRadius: 6,
        minHeight: 36,
        background: 'rgba(229,62,62,0.10)',
        color: '#ff6b6b',
        border: '1px solid rgba(229,62,62,0.35)',
        cursor: working ? 'wait' : 'pointer',
        fontWeight: 700,
        fontSize: '0.82rem',
      }}
    >
      {label}
    </button>
  );
}
