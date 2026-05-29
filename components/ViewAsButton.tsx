'use client';

import { useState } from 'react';
import { toast } from 'sonner';

interface ViewAsButtonProps {
  targetUserId: string;
  targetLabel?: string;
}

/**
 * Renders an admin-only "View As" button. POSTs to /api/admin/impersonate
 * and navigates to the dashboard the server tells us to.
 */
export default function ViewAsButton({ targetUserId, targetLabel }: ViewAsButtonProps) {
  const [busy, setBusy] = useState(false);

  const handle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/impersonate', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          target_user_id: targetUserId,
          reason: targetLabel ? `Admin View As ${targetLabel}` : 'Admin View As',
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json?.error ?? 'Failed To Start Session');
        setBusy(false);
        return;
      }
      const redirectTo = typeof json?.redirect_to === 'string' ? json.redirect_to : '/dashboard';
      window.location.href = redirectTo;
    } catch {
      toast.error('Network Error');
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handle}
      disabled={busy}
      className="btn btn-secondary"
      title="View As This User"
      style={{
        padding: 'var(--space-2) var(--space-3)',
        fontSize: '0.78rem',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        borderColor: 'var(--teal)',
        color: 'var(--teal)',
        opacity: busy ? 0.6 : 1,
        cursor: busy ? 'wait' : 'pointer',
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      {busy ? 'Starting' : 'View As'}
    </button>
  );
}
