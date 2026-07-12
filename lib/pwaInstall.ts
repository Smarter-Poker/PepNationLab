'use client';

/**
 * Shared PWA install helper.
 *
 * Captures the Chrome/Edge/Android `beforeinstallprompt` event once at the
 * module level so any UI - the timed auto-prompt card AND the manual
 * "Download Pep Nation App" menu item - can trigger the native install on
 * demand and reflect install state. iOS Safari exposes no install API, so
 * callers fall back to on-screen "Add To Home Screen" instructions there.
 *
 * Detection is per device/browser (localStorage + display-mode + the platform
 * event), so desktop and mobile are tracked independently and correctly.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const INSTALLED_KEY = 'pnl_pwa_installed';

let deferred: BeforeInstallPromptEvent | null = null;
const subscribers = new Set<() => void>();

function notify() {
  subscribers.forEach((fn) => { try { fn(); } catch { /* ignore */ } });
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Chrome/Edge/Android fire this ONLY when installable and NOT already
    // installed. Stash it so a manual tap can install later.
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    try { localStorage.setItem(INSTALLED_KEY, '1'); } catch { /* ignore */ }
    notify();
  });
}

/** Subscribe to install-availability changes. Returns an unsubscribe fn. */
export function subscribeInstallState(fn: () => void): () => void {
  subscribers.add(fn);
  return () => { subscribers.delete(fn); };
}

/** The page is running as the installed app (standalone / iOS home-screen). */
export function isRunningAsApp(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    window.matchMedia?.('(display-mode: window-controls-overlay)').matches === true ||
    ('standalone' in window.navigator && (window.navigator as unknown as { standalone?: boolean }).standalone === true)
  );
}

/** We've previously confirmed the app is installed on this device/profile. */
export function isKnownInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  if (isRunningAsApp()) return true;
  try { return localStorage.getItem(INSTALLED_KEY) === '1'; } catch { return false; }
}

/** iOS Safari - no beforeinstallprompt; install is manual via the Share sheet. */
export function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const maxTouch = (navigator as unknown as { maxTouchPoints?: number }).maxTouchPoints || 0;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && maxTouch > 1);
  const isSafari = /WebKit/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return isIOS && isSafari;
}

export type InstallResult = 'accepted' | 'dismissed' | 'unavailable' | 'ios-instructions' | 'already-installed';

/** Trigger the native install where possible; report what happened. */
export async function triggerInstall(): Promise<InstallResult> {
  if (isRunningAsApp()) return 'already-installed';
  if (deferred) {
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      deferred = null;
      if (choice.outcome === 'accepted') {
        try { localStorage.setItem(INSTALLED_KEY, '1'); } catch { /* ignore */ }
      }
      notify();
      return choice.outcome;
    } catch {
      return 'unavailable';
    }
  }
  if (isIosSafari()) return 'ios-instructions';
  return 'unavailable';
}
