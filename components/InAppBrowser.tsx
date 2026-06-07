'use client';

/**
 * InAppBrowser - a global overlay that intercepts external URLs to ensure
 * they open inside the app without redirecting the user.
 * 
 * Re-implemented to wrap the ultra-premium IframeModal component which implements
 * the Omega Protocol proxy fetching, z-index overriding, and loading states.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import IframeModal from './ui/IframeModal';

interface InAppTarget {
  url: string;
  title?: string;
}

interface InAppBrowserContextValue {
  open: (url: string, title?: string) => void;
  close: () => void;
}

const InAppBrowserContext = createContext<InAppBrowserContextValue | null>(null);

export function useInAppBrowser(): InAppBrowserContextValue {
  const ctx = useContext(InAppBrowserContext);
  if (!ctx) {
    return { open: () => {}, close: () => {} };
  }
  return ctx;
}

function normalizeUrl(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function InAppBrowserProvider({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<InAppTarget | null>(null);

  const close = useCallback(() => {
    setTarget(null);
  }, []);

  const open = useCallback((url: string, title?: string) => {
    const normalized = normalizeUrl(url);
    if (!normalized) return;
    setTarget({ url: normalized, title });
  }, []);

  // Intercept plain left-clicks on any <a data-inapp="1">.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented) return;
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const el = (e.target as HTMLElement | null)?.closest('a[data-inapp="1"]') as
        | HTMLAnchorElement
        | null;
      if (!el) return;
      const href = el.getAttribute('href') || '';
      if (!href) return;
      e.preventDefault();
      open(href, el.getAttribute('data-inapp-title') || el.textContent || undefined);
    }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [open]);

  // Also accept a global custom event for non-anchor triggers.
  useEffect(() => {
    function onEvent(e: Event) {
      const detail = (e as CustomEvent).detail as InAppTarget | undefined;
      if (detail?.url) open(detail.url, detail.title);
    }
    window.addEventListener('pnl:open-in-app', onEvent as EventListener);
    return () => window.removeEventListener('pnl:open-in-app', onEvent as EventListener);
  }, [open]);

  const ctxValue = useMemo(() => ({ open, close }), [open, close]);

  return (
    <InAppBrowserContext.Provider value={ctxValue}>
      {children}
      {target && (
        <IframeModal
          url={target.url}
          title={target.title}
          onClose={close}
        />
      )}
    </InAppBrowserContext.Provider>
  );
}
