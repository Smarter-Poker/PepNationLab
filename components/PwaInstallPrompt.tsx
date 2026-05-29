'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISS_KEY = 'pnl_pwa_install_dismissed';
const DELAY_MS = 30_000;

export default function PwaInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Hide entirely when already installed (running as PWA).
    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      // iOS Safari
      ('standalone' in window.navigator && (window.navigator as unknown as { standalone?: boolean }).standalone === true);
    if (isStandalone) return;

    // Respect the dismiss flag for the rest of the session.
    if (sessionStorage.getItem(DISMISS_KEY) === '1') return;

    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    const timer = window.setTimeout(() => {
      setVisible(true);
    }, DELAY_MS);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.clearTimeout(timer);
    };
  }, []);

  if (!visible || !deferred) return null;

  async function handleInstall() {
    if (!deferred) return;
    setBusy(true);
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } catch {
      // ignore — Safari/Firefox may not implement prompt.
    } finally {
      setBusy(false);
      setVisible(false);
      setDeferred(null);
      try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
    }
  }

  function handleDismiss() {
    setVisible(false);
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
  }

  return (
    <div
      role="dialog"
      aria-label="Install Pep Nation Lab As An App"
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 1000,
        maxWidth: 320,
        background: '#0F1923',
        border: '1px solid rgba(0,196,188,0.35)',
        borderRadius: '0.75rem',
        boxShadow: '0 10px 32px rgba(0,0,0,0.45)',
        color: '#FFFFFF',
        padding: '0.9rem 0.95rem',
        fontSize: '0.85rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'start', gap: '0.6rem' }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00C4BC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }}>
          <rect x="3" y="3" width="18" height="18" rx="3" ry="3" />
          <line x1="12" y1="8" x2="12" y2="16" />
          <polyline points="8 12 12 16 16 12" />
        </svg>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Install Pep Nation Lab As An App</div>
          <div style={{ color: '#A8B4C0', fontSize: '0.78rem', lineHeight: 1.4 }}>
            Add Pep Nation Lab To Your Home Screen For Fast One-Tap Access.
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button
              type="button"
              onClick={handleInstall}
              disabled={busy}
              style={{
                background: '#00C4BC', color: '#050A0F',
                border: 'none', borderRadius: '0.4rem',
                padding: '0.4rem 0.9rem', fontWeight: 700,
                cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1,
                fontSize: '0.78rem',
              }}
            >
              {busy ? 'Working...' : 'Install'}
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              style={{
                background: 'transparent', color: '#A8B4C0',
                border: '1px solid rgba(255,255,255,0.12)', borderRadius: '0.4rem',
                padding: '0.4rem 0.9rem', fontWeight: 600, cursor: 'pointer',
                fontSize: '0.78rem',
              }}
            >
              Not Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
