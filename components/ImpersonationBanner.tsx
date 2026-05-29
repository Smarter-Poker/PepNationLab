'use client';

import { useEffect, useState } from 'react';

type ActiveResponse =
  | { active: false }
  | { active: true; target_user_id: string; target_role: string; target_name: string | null };

export default function ImpersonationBanner() {
  const [state, setState] = useState<ActiveResponse>({ active: false });
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch('/api/admin/impersonate/active', {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        if (!res.ok) {
          if (alive) setState({ active: false });
          return;
        }
        const json = (await res.json()) as ActiveResponse;
        if (alive) setState(json);
      } catch {
        if (alive) setState({ active: false });
      }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (!state.active) return null;

  const handleEnd = async () => {
    setEnding(true);
    try {
      await fetch('/api/admin/impersonate', {
        method: 'DELETE',
        credentials: 'same-origin',
      });
    } finally {
      window.location.href = '/admin';
    }
  };

  const roleLabel = state.target_role
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
  const nameLabel = state.target_name ?? 'User';

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        background: 'linear-gradient(180deg, rgba(229,62,62,0.96) 0%, rgba(180,40,40,0.96) 100%)',
        color: '#ffffff',
        borderTop: '1px solid rgba(255,255,255,0.25)',
        boxShadow: '0 -4px 18px rgba(0,0,0,0.4)',
        padding: '10px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        fontSize: '0.85rem',
        fontWeight: 600,
        letterSpacing: '0.02em',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        You Are Viewing As {nameLabel} ({roleLabel})
      </span>
      <button
        type="button"
        onClick={handleEnd}
        disabled={ending}
        style={{
          background: '#ffffff',
          color: '#9b1c1c',
          border: 'none',
          borderRadius: 6,
          padding: '6px 14px',
          fontSize: '0.82rem',
          fontWeight: 700,
          cursor: ending ? 'not-allowed' : 'pointer',
          opacity: ending ? 0.7 : 1,
        }}
      >
        {ending ? 'Ending Session' : 'End Session'}
      </button>
    </div>
  );
}
