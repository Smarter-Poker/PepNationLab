'use client';

/**
 * InAppBrowser - a full-screen in-app overlay that opens external URLs inside an
 * <iframe> so the user is NEVER redirected away from pepnationlab.com. Built
 * natively for PepNationLab (no Smarter.Poker imports, per the platform's
 * zero-cross-contamination rule).
 *
 * Two ways to open it:
 *  1. Programmatically:  const { open } = useInAppBrowser(); open(url, title)
 *  2. Declaratively:     any <a data-inapp="1" href="https://..."> is intercepted
 *     on plain left-click (cmd/ctrl/middle-click still open a normal new tab, and
 *     keyboard/accessibility fall back to the real href).
 *
 * Embedding reality: some sources (PubMed, FDA, DrugBank) send X-Frame-Options
 * DENY and refuse to render in a frame. We cannot detect that cross-origin, so
 * after a short grace period we surface an in-overlay fallback panel (title +
 * selectable URL + Copy Link) - still without ever redirecting the user away.
 *
 * Research-Use-Only platform. Title Case on all user-facing text. No emojis.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

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
    // Safe no-op fallback so a stray call never throws outside the provider.
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

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function InAppBrowserProvider({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<InAppTarget | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const [copied, setCopied] = useState(false);
  const graceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = useCallback(() => {
    setTarget(null);
    setLoaded(false);
    setShowFallback(false);
    setCopied(false);
    if (graceTimer.current) clearTimeout(graceTimer.current);
  }, []);

  const open = useCallback((url: string, title?: string) => {
    const normalized = normalizeUrl(url);
    if (!normalized) return;
    setLoaded(false);
    setShowFallback(false);
    setCopied(false);
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

  // Escape to close + body scroll lock while open.
  useEffect(() => {
    if (!target) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Grace period: if the frame hasn't reported a load, assume it may be
    // embedding-blocked and reveal the fallback panel.
    graceTimer.current = setTimeout(() => setShowFallback(true), 3500);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      if (graceTimer.current) clearTimeout(graceTimer.current);
    };
  }, [target, close]);

  const ctxValue = useMemo(() => ({ open, close }), [open, close]);

  return (
    <InAppBrowserContext.Provider value={ctxValue}>
      {children}
      {target && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Embedded Source: ${target.title || hostOf(target.url)}`}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100050,
            background: '#050A0F',
            display: 'flex',
            flexDirection: 'column',
            paddingTop: 'env(safe-area-inset-top, 0px)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
        >
          {/* Top bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 14px',
              borderBottom: '1px solid rgba(255,255,255,0.10)',
              background: 'linear-gradient(180deg, #0F1923 0%, #0A1018 100%)',
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.16)',
                borderRadius: '10px',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '0.85rem',
                padding: '8px 14px',
                cursor: 'pointer',
                minHeight: '40px',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Back
            </button>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {target.title || hostOf(target.url)}
              </div>
              <div
                style={{
                  color: '#A8B4C0',
                  fontSize: '0.72rem',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {hostOf(target.url)}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (navigator?.clipboard?.writeText) {
                  navigator.clipboard.writeText(target.url).then(
                    () => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1800);
                    },
                    () => {},
                  );
                }
              }}
              style={{
                background: 'rgba(0,196,188,0.12)',
                border: '1px solid rgba(0,196,188,0.45)',
                borderRadius: '10px',
                color: '#00C4BC',
                fontWeight: 700,
                fontSize: '0.8rem',
                padding: '8px 14px',
                cursor: 'pointer',
                minHeight: '40px',
                flexShrink: 0,
              }}
            >
              {copied ? 'Copied' : 'Copy Link'}
            </button>
          </div>

          {/* Frame + fallback */}
          <div style={{ position: 'relative', flex: 1, minHeight: 0, background: '#0A1018' }}>
            <iframe
              key={target.url}
              src={target.url}
              title={target.title || hostOf(target.url)}
              onLoad={() => {
                setLoaded(true);
                setShowFallback(false);
                if (graceTimer.current) clearTimeout(graceTimer.current);
              }}
              referrerPolicy="no-referrer"
              sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                border: 'none',
                background: '#FFFFFF',
              }}
            />
            {!loaded && showFallback && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '14px',
                  padding: '24px',
                  textAlign: 'center',
                  background: '#0A1018',
                }}
              >
                <div style={{ color: '#FFFFFF', fontWeight: 800, fontSize: '1.05rem' }}>
                  This Source Blocks Embedding
                </div>
                <p style={{ color: '#A8B4C0', fontSize: '0.9rem', maxWidth: '440px', lineHeight: 1.6, margin: 0 }}>
                  Some Sites (Such As Government And Journal Databases) Do Not Allow Their Pages To Be Shown Inside
                  Another Site. Copy The Link Below To Open It In Your Own Browser Tab When You Choose.
                </p>
                <code
                  style={{
                    display: 'block',
                    maxWidth: '100%',
                    overflowWrap: 'anywhere',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.14)',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    color: '#D0DAE4',
                    fontSize: '0.82rem',
                  }}
                >
                  {target.url}
                </code>
              </div>
            )}
          </div>
        </div>
      )}
    </InAppBrowserContext.Provider>
  );
}
