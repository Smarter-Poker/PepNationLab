'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
const PwaIosInstructions = dynamic(() => import('@/components/PwaIosInstructions'), { ssr: false });

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface RelatedApp {
  id?: string;
  platform?: string;
  url?: string;
}
interface NavigatorWithRelated extends Navigator {
  getInstalledRelatedApps?: () => Promise<RelatedApp[]>;
}

const DISMISS_KEY = 'pnl_pwa_install_dismissed_at'; // persistent "Not Now" timestamp
const INSTALLED_KEY = 'pnl_pwa_installed'; // persistent: we've confirmed it's installed
const DELAY_MS = 30_000;
// After "Not Now", stay quiet for this long before the banner is eligible
// again. Persisted in localStorage so it survives closing the tab -- the old
// sessionStorage flag re-armed on every fresh visit, which read as "keeps
// popping up over and over" even after dismissing.
const DISMISS_COOLDOWN_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

// True if a "Not Now" was recorded within the cooldown window.
function dismissedRecently(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return at > 0 && Date.now() - at < DISMISS_COOLDOWN_MS;
  } catch {
    return false;
  }
}

// Is the page currently running as the installed app (standalone/full-screen)?
function isRunningAsApp(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    window.matchMedia?.('(display-mode: window-controls-overlay)').matches === true ||
    // iOS Safari home-screen apps
    ('standalone' in window.navigator && (window.navigator as unknown as { standalone?: boolean }).standalone === true)
  );
}

export default function PwaInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [iosVisible, setIosVisible] = useState(false);
  const [showIosModal, setShowIosModal] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1) Already running as the installed app -> never prompt; remember it.
    if (isRunningAsApp()) {
      try { localStorage.setItem(INSTALLED_KEY, '1'); } catch { /* ignore */ }
      return;
    }
    // 2) We've previously confirmed it's installed on this device/profile.
    try { if (localStorage.getItem(INSTALLED_KEY) === '1') return; } catch { /* ignore */ }
    // 3) Dismissed recently (persists across visits, not just the session).
    if (dismissedRecently()) return;

    let cancelled = false;
    let timer = 0;

    const markInstalled = () => {
      cancelled = true;
      window.clearTimeout(timer);
      setVisible(false);
      setDeferred(null);
      try { localStorage.setItem(INSTALLED_KEY, '1'); } catch { /* ignore */ }
    };

    function onBeforeInstall(e: Event) {
      // Chrome/Edge fire this ONLY when the app is installable and NOT already
      // installed -- the primary "not installed" signal. Arm the timed prompt
      // only once we have it, so the card can never show without a real install
      // offer behind it.
      e.preventDefault();
      if (cancelled) return;
      setDeferred(e as BeforeInstallPromptEvent);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => { if (!cancelled) setVisible(true); }, DELAY_MS);
    }

    function onInstalled() {
      // Installed during this session -> hide immediately, never nag again.
      markInstalled();
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    // 4) Explicit installed-app probe (Chrome/Android). Catches the case where
    // the PWA is installed but the browser still fired beforeinstallprompt.
    const nav = window.navigator as NavigatorWithRelated;
    if (typeof nav.getInstalledRelatedApps === 'function') {
      nav.getInstalledRelatedApps()
        .then((apps) => {
          if (cancelled) return;
          if (Array.isArray(apps) && apps.length > 0) markInstalled();
        })
        .catch(() => { /* unsupported / rejected -> rely on the other signals */ });
    }

    // iOS: no beforeinstallprompt, but we can still show a manual-install banner
    // after the same 30-second delay if the user hasn't dismissed it recently.
    const ua = navigator.userAgent || '';
    const maxTouch = (navigator as unknown as { maxTouchPoints?: number }).maxTouchPoints || 0;
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && maxTouch > 1);
    const isSafari = /WebKit/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
    if (isIOS && isSafari && !cancelled) {
      timer = window.setTimeout(() => { if (!cancelled) setIosVisible(true); }, DELAY_MS);
    }

    return () => {
      cancelled = true;
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
      window.clearTimeout(timer);
    };
  }, []);

  // iOS banner (no deferred event available)
  if (iosVisible && !showIosModal) {
    return (
      <>
        <div
          role="dialog"
          aria-label="Install Pep Nation Lab On Your iPhone"
          style={{
            position: 'fixed',
            bottom: 'calc(max(16px, env(safe-area-inset-bottom)) + 8px)',
            right: 'max(16px, env(safe-area-inset-right))',
            left: 'auto',
            zIndex: 9999,
            maxWidth: 'min(320px, calc(100vw - 32px))',
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
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
              <polyline points="16 6 12 2 8 6"/>
              <line x1="12" y1="2" x2="12" y2="15"/>
            </svg>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Add Pep Nation Lab To Your Home Screen</div>
              <div style={{ color: '#A8B4C0', fontSize: '0.78rem', lineHeight: 1.4 }}>
                Tap below to see how — it only takes 3 quick steps.
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => { setIosVisible(false); setShowIosModal(true); }}
                  style={{
                    background: '#00C4BC', color: '#050A0F',
                    border: 'none', borderRadius: '0.4rem',
                    padding: '0.4rem 0.9rem', fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: '0.78rem',
                  }}
                >
                  Show Me How
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIosVisible(false);
                    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
                  }}
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
      </>
    );
  }

  if (showIosModal) {
    return <PwaIosInstructions onClose={() => {
      setShowIosModal(false);
      try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
    }} />;
  }

  if (!visible || !deferred) return null;

  async function handleInstall() {
    if (!deferred) return;
    setBusy(true);
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice?.outcome === 'accepted') {
        // Never offer install again on this device/profile once accepted.
        // (The 'appinstalled' listener also covers this; this is immediate.)
        try { localStorage.setItem(INSTALLED_KEY, '1'); } catch { /* ignore */ }
      }
    } catch {
      // ignore - Safari/Firefox may not implement prompt.
    } finally {
      setBusy(false);
      setVisible(false);
      setDeferred(null);
      try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
    }
  }

  function handleDismiss() {
    setVisible(false);
    setDeferred(null);
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
  }

  return (
    <div
      role="dialog"
      aria-label="Install Pep Nation Lab As An App"
      style={{
        position: 'fixed',
        // R25: lift above iPhone home indicator + always 16px clear of right edge
        // on 320px viewports (iPhone SE 1st gen) so the dialog never touches an edge.
        bottom: 'calc(max(16px, env(safe-area-inset-bottom)) + 8px)',
        right: 'max(16px, env(safe-area-inset-right))',
        left: 'auto',
        zIndex: 9999,
        maxWidth: 'min(320px, calc(100vw - 32px))',
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
