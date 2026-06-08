'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function PWAEnforcer() {
  const [needsInstall, setNeedsInstall] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const supabase = createClient();

    // Read the locally-cached session (getSession, no network) instead of
    // getUser(). This is a client-side UI gate; the real security boundary is the
    // RLS-protected profile read below. Avoids a per-page /auth/v1/user request
    // (which also produced the benign "_getUser Failed to fetch" console noise).
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user;
      if (!user) {
        setLoading(false);
        return;
      }

      supabase
        .from('profiles')
        .select('role, pwa_dismissed')
        .eq('id', user.id)
        .single()
        .then(({ data: profile }) => {
          if (profile && ['super_agent', 'agent', 'sub_agent'].includes(profile.role)) {
            
            // Check global profile flag or local storage
            if (profile.pwa_dismissed || localStorage.getItem('pwa_enforcer_dismissed') === 'true') {
              // Ensure DB is in sync if local storage was true but DB wasn't
              if (!profile.pwa_dismissed && localStorage.getItem('pwa_enforcer_dismissed') === 'true') {
                 supabase.from('profiles').update({ pwa_dismissed: true }).eq('id', user.id).then();
              }
              setLoading(false);
              return;
            }

            // Check if running in standalone mode (PWA)
            const isStandalone =
              window.matchMedia?.('(display-mode: standalone)').matches ||
              ('standalone' in window.navigator && (window.navigator as any).standalone === true);

            if (isStandalone) {
              // They are using the app! Save to DB globally so they don't get bothered elsewhere
              supabase.from('profiles').update({ pwa_dismissed: true }).eq('id', user.id).then();
              localStorage.setItem('pwa_enforcer_dismissed', 'true');
              setLoading(false);
              return;
            }

            // Skip if on desktop (not a mobile device)
            const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
            if (!isMobile) {
              setLoading(false);
              return;
            }

            setNeedsInstall(true);
          }
          setLoading(false);
        });
    });
  }, []);

  if (loading || !needsInstall) return null;

  // Render a full-screen, un-dismissible blocking modal
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 999999, // Above everything
      background: '#0A1018',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-6)',
      textAlign: 'center',
    }}>
      <div style={{
        maxWidth: 400,
        width: '100%',
        background: '#0F1923',
        padding: 'var(--space-8)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid rgba(0, 196, 188, 0.3)',
        boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
      }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#00C4BC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 'var(--space-5)' }}>
          <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
          <line x1="12" y1="18" x2="12.01" y2="18" />
        </svg>

        <h1 style={{ fontSize: '1.4rem', color: 'var(--white)', marginBottom: 'var(--space-3)' }}>
          Agent App Required
        </h1>
        <p style={{ color: 'var(--grey-400)', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: 'var(--space-6)' }}>
          For security and optimal performance, Agent and Subagent accounts are required to run PepNationLab as a native mobile app.
        </p>

        <div style={{ textAlign: 'left', background: 'rgba(0,0,0,0.3)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--silver)', marginBottom: 'var(--space-2)', fontWeight: 600 }}>iOS / Safari</div>
          <ol style={{ paddingLeft: 'var(--space-4)', margin: 0, fontSize: '0.8rem', color: 'var(--grey-400)' }}>
            <li style={{ marginBottom: 4 }}>Tap the <strong>Share</strong> icon at the bottom of your screen.</li>
            <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
          </ol>
          
          <div style={{ fontSize: '0.85rem', color: 'var(--silver)', marginTop: 'var(--space-4)', marginBottom: 'var(--space-2)', fontWeight: 600 }}>Android / Chrome</div>
          <ol style={{ paddingLeft: 'var(--space-4)', margin: 0, fontSize: '0.8rem', color: 'var(--grey-400)' }}>
            <li style={{ marginBottom: 4 }}>Tap the <strong>Menu (3 dots)</strong> icon at the top right.</li>
            <li>Tap <strong>Add to Home screen</strong> or <strong>Install app</strong>.</li>
          </ol>
        </div>

        <button 
          onClick={async () => {
            localStorage.setItem('pwa_enforcer_dismissed', 'true');
            setNeedsInstall(false);
            const { data: { user } } = await createClient().auth.getUser();
            if (user) {
              await createClient().from('profiles').update({ pwa_dismissed: true }).eq('id', user.id);
            }
          }}
          style={{
            marginTop: 'var(--space-5)',
            background: 'none',
            border: 'none',
            color: 'var(--grey-500)',
            textDecoration: 'underline',
            cursor: 'pointer',
            fontSize: '0.85rem',
            transition: 'color 0.2s',
          }}
          onMouseOver={(e) => e.currentTarget.style.color = 'var(--silver)'}
          onMouseOut={(e) => e.currentTarget.style.color = 'var(--grey-500)'}
        >
          Dismiss / I've Already Installed It
        </button>
      </div>
    </div>
  );
}
