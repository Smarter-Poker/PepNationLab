'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Shown the FIRST time the storefront owner views their own storefront after
 * being promoted from researcher. The DB trigger seeds slug + display_name
 * from the agent's username and leaves agent_profiles.storefront_renamed_at
 * NULL until the agent personalizes it. The banner explains what happened
 * and lets the agent either keep the username-as-name or jump to settings
 * to change it. Either action clears the NULL flag so the banner does not
 * reappear.
 */
export default function StorefrontRenameBanner({
  agentId,
  currentName,
  settingsUrl,
}: {
  agentId: string;
  currentName: string;
  settingsUrl: string;
}) {
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);

  if (hidden) return null;

  async function keepName() {
    setBusy(true);
    try {
      // A same-value update to display_name fires the BEFORE-UPDATE trigger
      // only when the value actually changes — so to stamp renamed_at without
      // mutating the user-visible name, write a normalized whitespace-trimmed
      // version that the trigger compares as identical, then explicitly stamp
      // the timestamp via a direct column write under RLS.
      const supabase = createClient();
      await supabase
        .from('agent_profiles')
        .update({ storefront_renamed_at: new Date().toISOString() })
        .eq('id', agentId);
      setHidden(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        margin: '12px',
        padding: '14px 16px',
        borderRadius: 12,
        background:
          'linear-gradient(135deg, rgba(0, 196, 188, 0.12) 0%, rgba(0, 196, 188, 0.04) 100%)',
        border: '1px solid rgba(0, 196, 188, 0.45)',
        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.35)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span
          aria-hidden
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            borderRadius: 999,
            background: 'rgba(0, 196, 188, 0.25)',
            border: '1px solid rgba(0, 196, 188, 0.7)',
            color: 'var(--teal, #00C4BC)',
            fontWeight: 800,
            fontSize: '0.85rem',
          }}
        >
          i
        </span>
        <strong
          style={{
            fontFamily: 'var(--font-brand, inherit)',
            color: 'var(--white, #fff)',
            fontSize: '0.95rem',
            letterSpacing: '0.02em',
          }}
        >
          Welcome To Your Storefront
        </strong>
      </div>
      <p style={{ color: 'var(--silver, #C0B8A8)', fontSize: '0.86rem', margin: 0, lineHeight: 1.5 }}>
        Your Storefront Name Is Currently Your Username
        {currentName ? <> (&quot;<strong style={{ color: 'var(--teal, #00C4BC)' }}>{currentName}</strong>&quot;)</> : null}.
        Keep It As Is, Or Change It To Something Custom — You Can Update Your Display Name,
        Slug, Colors, And Logo Any Time From Storefront Settings.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <a
          href={settingsUrl}
          className="btn btn-primary"
          style={{
            minHeight: 38,
            padding: '8px 14px',
            fontSize: '0.82rem',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            textDecoration: 'none',
          }}
        >
          Open Storefront Settings
        </a>
        <button
          type="button"
          onClick={keepName}
          disabled={busy}
          className="btn btn-secondary"
          style={{
            minHeight: 38,
            padding: '8px 14px',
            fontSize: '0.82rem',
            fontWeight: 700,
          }}
        >
          {busy ? 'Saving…' : 'Keep My Username'}
        </button>
      </div>
    </div>
  );
}
