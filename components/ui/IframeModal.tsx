'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useModalA11y } from '@/lib/useModalA11y';
import { trackResearchEvent } from '@/lib/research-track';

interface IframeModalProps {
  url: string;
  title?: string;
  onClose: () => void;
}

export default function IframeModal({ url, title, onClose }: IframeModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    // Prevent scrolling on the body when modal is open
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    // Engagement analytics: which external citations (PubMed, FDA, DrugBank)
    // actually get opened. Host only, fire-and-forget, never blocks the modal.
    try {
      trackResearchEvent('external_doc_open', { url_host: new URL(url).hostname });
    } catch { /* invalid URL - skip analytics */ }
    return () => {
      document.body.style.overflow = originalStyle;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // DEVICE BACK BUTTON / SWIPE-BACK CLOSES THE VIEWER.
  //
  // This viewer is a portal overlay, not a route, so on mobile the phone's
  // back gesture had nothing to do with it: Android's back button and iOS
  // swipe-back either navigated the whole site away or (with the iframe
  // swallowing the gesture) appeared to do nothing at all. A COA opened from
  // a product or an order became a dead end - "no true back button" - and the
  // only escape was killing the tab.
  //
  // Pushing one history entry on open makes the OS back control mean exactly
  // what the user expects: pop this entry, close the viewer, land back on the
  // page you came from with its scroll position intact. Closing via the
  // header button / Escape / swipe-down consumes that entry itself (history
  // .back()) so we never leave a stray entry behind that would require a
  // second back press to leave the page.
  const closingRef = React.useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const STATE = { pnlIframeModal: true };
    window.history.pushState(STATE, '');
    const onPopState = () => {
      // Our entry was popped by a back gesture: close without re-consuming.
      closingRef.current = true;
      onClose();
    };
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
      // Closed by button/Escape/swipe rather than by the back gesture: remove
      // the entry we added so the user's next back press leaves the page.
      if (!closingRef.current && typeof window !== 'undefined') {
        const st = window.history.state as { pnlIframeModal?: boolean } | null;
        if (st?.pnlIframeModal) window.history.back();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A11y: initial focus on the Back button, Tab trap inside the viewer, and
  // focus restored to the triggering element on close (WCAG 2.1.2, 2.4.3).
  const dialogRef = useModalA11y<HTMLDivElement>(true, { onClose });

  const isExternal = url.startsWith('http://') || url.startsWith('https://');

  const domain = useMemo(() => {
    if (!isExternal) return 'pepnationlab.com';
    try {
      const hostname = new URL(url).hostname;
      // Our Supabase storage bucket is our own content — always show our brand domain.
      if (hostname.endsWith('.supabase.co')) return 'pepnationlab.com';
      return hostname;
    } catch {
      return 'pepnationlab.com';
    }
  }, [url, isExternal]);

  const modalContent = (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 100 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.2}
        onDragEnd={(e, info) => {
          if (info.offset.y > 100) onClose();
        }}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title || 'External Link Viewer'}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100dvh',
          zIndex: 999999, // Max z-index to stay above everything
          backgroundColor: 'rgba(0, 0, 0, 0.95)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes pn-progress {
            0% { width: 0%; opacity: 1; }
            80% { width: 85%; opacity: 1; }
            100% { width: 85%; opacity: 0.7; }
          }
          @keyframes pn-shimmer {
            0% { background-position: -1000px 0; }
            100% { background-position: 1000px 0; }
          }
          /* Narrow phones: drop the domain label and the "Open Original"
             wording so the Back button can never be pushed off screen. */
          @media (max-width: 520px) {
            .pnl-iframe-domain { display: none; }
            .pnl-iframe-open-label { display: none; }
          }
        `}} />

        {/* Modal Header. flexShrink:0 + safe-area padding: on a phone the
            header previously shared flex space with the iframe and could be
            squeezed to nothing (or slide under the notch), leaving the viewer
            with no visible way out. */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            padding: 'max(12px, env(safe-area-inset-top, 0px)) 16px 12px',
            backgroundColor: '#020617', // Solid dark color for header
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={onClose}
              aria-label="Close External Link Viewer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                // 44px min target: the old 6px-padded pill was under the
                // accessible tap size on a phone, so "Back" often missed.
                padding: '10px 18px',
                minHeight: 44,
                flexShrink: 0,
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: 'var(--white, #FFFFFF)',
                borderRadius: '999px',
                fontSize: '0.9rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'background-color 0.2s',
              }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)')}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)')}
            >
              ← Back
            </button>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: 0 }}>
              {title && (
                <div style={{ color: '#FFFFFF', fontSize: '0.95rem', fontWeight: 600, maxWidth: '400px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {title}
                </div>
              )}
              {/* Domain is context, not an action - it is the first thing to
                  give up horizontal space on a narrow screen so Back and
                  Open Original always stay reachable. */}
              <div className="pnl-iframe-domain" style={{ color: '#A8B4C0', fontSize: title ? '0.75rem' : '0.9rem', fontWeight: 600, maxWidth: '400px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {domain}
              </div>
            </div>

            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open Original In A New Tab"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 14px',
                minHeight: 44,
                flexShrink: 0,
                backgroundColor: '#00C4BC',
                color: '#020617',
                borderRadius: '999px',
                fontSize: '0.85rem',
                fontWeight: 700,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                transition: 'opacity 0.2s',
              }}
              onMouseOver={(e) => (e.currentTarget.style.opacity = '0.9')}
              onMouseOut={(e) => (e.currentTarget.style.opacity = '1')}
            >
              <span className="pnl-iframe-open-label">Open Original</span> <ExternalLink size={14} />
            </a>
          </div>
        </div>

        {/* Loading Progress Bar */}
        {loading && (
          <div style={{ height: '3px', width: '100%', background: 'transparent' }}>
            <div style={{
              height: '100%',
              background: '#00C4BC',
              animation: 'pn-progress 10s cubic-bezier(0.1, 0.8, 0.3, 1) forwards'
            }} />
          </div>
        )}

        {/* Iframe Container */}
        <div style={{ flex: 1, backgroundColor: '#FFFFFF', position: 'relative' }}>
          
          {loading && (
            <div style={{ position: 'absolute', top: 40, left: 0, right: 0, display: 'flex', flexDirection: 'column', gap: 16, padding: '0 max(5vw, 40px)', maxWidth: 800, margin: '0 auto' }}>
              <div style={{ height: 40, width: '80%', background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)', backgroundSize: '1000px 100%', animation: 'pn-shimmer 2s infinite linear', borderRadius: 4, marginBottom: 20 }} />
              {[...Array(8)].map((_, i) => (
                <div key={i} style={{ height: 16, width: i === 7 ? '60%' : '100%', background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)', backgroundSize: '1000px 100%', animation: 'pn-shimmer 2s infinite linear', borderRadius: 4 }} />
              ))}
            </div>
          )}

          {error && (
             <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#333' }}>
               <AlertTriangle size={48} color="#FF6B6B" style={{ marginBottom: 16 }} />
               <h3 style={{ margin: '0 0 8px 0' }}>Failed To Load Document</h3>
               <p style={{ margin: 0, color: '#666' }}>The Publisher May Be Blocking Embedded Viewers.</p>
               <a href={url} target="_blank" rel="noopener noreferrer" style={{ marginTop: 16, display: 'inline-block', background: '#00C4BC', color: '#000', padding: '8px 16px', borderRadius: 4, textDecoration: 'none', fontWeight: 'bold' }}>Open In New Tab</a>
             </div>
          )}

          <iframe
            src={isExternal ? '/api/proxy?url=' + encodeURIComponent(url) : url}
            style={{ width: '100%', height: '100%', border: 'none', display: 'block', opacity: loading ? 0 : 1, transition: 'opacity 0.3s ease' }}
            referrerPolicy="origin-when-cross-origin"
            onLoad={() => setLoading(false)}
            onError={() => { setLoading(false); setError(true); }}
            title={isExternal ? "External Link Viewer" : "Internal Viewer"}
            /* SECURITY: NO allow-same-origin for external. The iframe src is our own
               /api/proxy origin, so allow-same-origin would let proxied
               third-party HTML read our storage and call our APIs with the
               user's cookies. Internal links are trusted and need same-origin. */
            /* allow-modals is required for window.print(). Without it Chrome
               refuses with "Ignored call to 'print()'. The document is
               sandboxed, and the 'allow-modals' keyword is not set." - which is
               why the Print button inside a printable invoice did nothing at
               all, silently (PrintButton swallows the throw). Granted only to
               INTERNAL documents; proxied third-party HTML must not be able to
               open blocking modals. */
            sandbox={`allow-scripts allow-popups allow-forms allow-popups-to-escape-sandbox${!isExternal ? ' allow-same-origin allow-modals' : ''}`}
          />
        </div>
      </motion.div>
    </AnimatePresence>
  );

  // Need to ensure we only run createPortal on the client
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);
  
  if (!mounted) return null;
  return createPortal(modalContent, document.body);
}
