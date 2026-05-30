'use client';

import { useEffect, useState } from 'react';

const DISMISS_KEY = 'pnl_stale_browser_dismissed_v1';

export default function StaleBrowserBanner() {
  const [show, setShow] = useState(false);
  const [reason, setReason] = useState<string>('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(DISMISS_KEY) === 'true') return;

    const noSW = !('serviceWorker' in navigator);
    const noNotif = typeof Notification === 'undefined';
    const noFetch = typeof fetch === 'undefined';
    const noPushManager = typeof window.PushManager === 'undefined';

    const issues: string[] = [];
    if (noSW) issues.push('Service Worker');
    if (noNotif) issues.push('Notifications');
    if (noFetch) issues.push('Fetch');
    if (noPushManager) issues.push('Push Manager');

    if (issues.length > 0) {
      setReason(issues.join(', '));
      setShow(true);
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, 'true');
    } catch {
      /* ignore */
    }
    setShow(false);
  }

  if (!show) return null;

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        background: 'rgba(229, 62, 62, 0.92)',
        color: 'var(--white, #FFFFFF)',
        padding: '0.6rem 1rem',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        fontSize: '0.85rem',
        backdropFilter: 'blur(8px)',
      }}
    >
      <span>
        Your Browser Is Missing Required Features ({reason}). Please Update To The Latest Version Of Chrome, Safari, Firefox, Or Edge For Full Functionality.
      </span>
      <button
        onClick={dismiss}
        style={{
          background: 'transparent',
          color: 'var(--white, #FFFFFF)',
          border: '1px solid rgba(255,255,255,0.5)',
          borderRadius: '4px',
          padding: '0.25rem 0.75rem',
          cursor: 'pointer',
          fontSize: '0.8rem',
          fontWeight: 600,
        }}
        aria-label="Dismiss"
      >
        Dismiss
      </button>
    </div>
  );
}
