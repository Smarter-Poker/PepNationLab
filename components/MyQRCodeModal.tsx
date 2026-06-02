'use client';

/**
 * MyQRCodeModal — premium brushed-nickel restyle.
 *
 * Visual layer: matches the existing platform "metal" aesthetic
 * (.metal-frame + .metal-content + .metal-text + .metal-embossed-panel)
 * used across AdminAgents, AgentBundles, AdminAnalytics, etc.
 *
 * Event-bubble defenses retained from prior fix:
 *   1. `readyToClose` flag — backdrop close handler is a no-op for the first
 *      120ms after open so the click that opened cannot immediately close it.
 *   2. e.target === e.currentTarget check on the backdrop.
 *   3. All inner controls stopPropagation to prevent bubble-close.
 *   4. SSR-safe `mounted` flag before createPortal.
 *   5. Escape key closes.
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import QRCodeGenerator from './QRCodeGenerator';

type QRPayload = {
  url: string;
  slug: string;
  displayName?: string;
  qrCodeData?: string | null;
  primaryColor?: string;
  isInvite: boolean;
  referCode?: string | null;
  roleLabel: string;
  description: string;
};

export default function MyQRCodeModal({
  open,
  onClose,
}: { open: boolean; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<QRPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [readyToClose, setReadyToClose] = useState(false);
  const lastOpenRef = useRef(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) {
      lastOpenRef.current = false;
      setReadyToClose(false);
      return;
    }
    if (lastOpenRef.current) return;
    lastOpenRef.current = true;
    setData(null);
    setErr(null);
    setReadyToClose(false);
    const armId = setTimeout(() => setReadyToClose(true), 120);

    fetch('/api/agent/my-qr', { cache: 'no-store' })
      .then(async r => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.message || `Could Not Load QR (HTTP ${r.status})`);
        return j;
      })
      .then(setData)
      .catch(e => setErr(e?.message || 'Could Not Load QR'));

    return () => clearTimeout(armId);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!mounted || !open || typeof document === 'undefined') return null;

  function attemptBackdropClose(e: React.MouseEvent) {
    if (!readyToClose) return;
    if (e.target !== e.currentTarget) return;
    onClose();
  }

  function downloadQR(e: React.MouseEvent) {
    e.stopPropagation();
    const container = document.querySelector('[data-qr-container]');
    const canvas = container?.querySelector('canvas') as HTMLCanvasElement | null;
    const img = container?.querySelector('img') as HTMLImageElement | null;
    let dataUrl: string | null = null;
    if (canvas) dataUrl = canvas.toDataURL('image/png');
    else if (img?.src) dataUrl = img.src;
    if (!dataUrl) { toast.error('QR Not Ready Yet'); return; }
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `pepnationlab-${data?.slug ?? 'qr'}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.success('QR Downloaded');
  }

  async function shareQR(e: React.MouseEvent) {
    e.stopPropagation();
    if (!data?.url) return;
    const shareData: ShareData = {
      title: 'Pep Nation Lab',
      text: data.isInvite ? 'Join Pep Nation Lab through my invite:' : 'Visit my Pep Nation Lab storefront:',
      url: data.url,
    };
    try {
      const container = document.querySelector('[data-qr-container]');
      const canvas = container?.querySelector('canvas') as HTMLCanvasElement | null;
      if (canvas && typeof navigator.share === 'function') {
        const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png'));
        if (blob) {
          const file = new File([blob], `pepnationlab-${data.slug}.png`, { type: 'image/png' });
          if ((navigator as any).canShare?.({ files: [file] })) {
            await (navigator as any).share({ ...shareData, files: [file] });
            return;
          }
        }
      }
      if (navigator.share) { await navigator.share(shareData); return; }
    } catch {/* fall through */}
    try {
      await navigator.clipboard.writeText(data.url);
      toast.success('Link Copied To Clipboard');
    } catch {
      toast.error('Sharing Not Supported');
    }
  }

  async function copyUrl(e: React.MouseEvent) {
    e.stopPropagation();
    if (!data?.url) return;
    try {
      await navigator.clipboard.writeText(data.url);
      toast.success('Link Copied');
    } catch {
      toast.error('Could Not Copy');
    }
  }

  // ---- Style helpers -----------------------------------------------------
  // Brushed-nickel button skin (matches .metal-frame outer ring + inset highlights).
  const nickelButton: React.CSSProperties = {
    padding: '14px 12px',
    borderRadius: 12,
    minHeight: 52,
    cursor: 'pointer',
    fontWeight: 800,
    fontSize: '0.82rem',
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    color: '#0F1923',
    border: 'none',
    background: 'linear-gradient(180deg, #DCD3C3 0%, #B3A992 100%)',
    boxShadow:
      '0 0 0 1.5px #8a847c, ' +
      'inset 0 1px 0 rgba(255,255,255,0.55), ' +
      'inset 0 -1px 0 rgba(0,0,0,0.35), ' +
      '0 4px 12px rgba(0,0,0,0.45)',
  };

  const ghostButton: React.CSSProperties = {
    padding: '14px 12px',
    borderRadius: 12,
    minHeight: 52,
    cursor: 'pointer',
    fontWeight: 800,
    fontSize: '0.82rem',
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    color: '#FFFFFF',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
    border: '1px solid rgba(255,255,255,0.12)',
    boxShadow:
      'inset 0 1px 0 rgba(255,255,255,0.08), ' +
      'inset 0 -1px 0 rgba(0,0,0,0.4), ' +
      '0 2px 8px rgba(0,0,0,0.3)',
  };

  return createPortal(
    <div
      data-qr-modal-root
      role="dialog"
      aria-modal="true"
      aria-label="My QR Code"
      onClick={attemptBackdropClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 999999,
        background: 'radial-gradient(ellipse at center, rgba(15,25,35,0.92) 0%, rgba(5,10,15,0.98) 100%)',
        backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 'max(24px, env(safe-area-inset-top)) 16px max(24px, env(safe-area-inset-bottom)) 16px',
      }}
    >
      {/* X close button — nickel pill, top-right */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        aria-label="Close"
        style={{
          position: 'absolute', top: 'max(20px, env(safe-area-inset-top))', right: 20,
          width: 44, height: 44, borderRadius: '50%', cursor: 'pointer', padding: 0,
          background: 'linear-gradient(145deg, #c8c2b8 0%, #8a847c 50%, #a09890 100%)',
          border: 'none',
          color: '#0F1923',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow:
            '0 0 0 1.5px #5e5852, ' +
            'inset 0 1px 0 rgba(255,255,255,0.6), ' +
            'inset 0 -1px 0 rgba(0,0,0,0.4), ' +
            '0 6px 18px rgba(0,0,0,0.5)',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="6" y1="18" x2="18" y2="6" />
        </svg>
      </button>

      {/* Brushed-nickel frame wrapper */}
      <div
        className="metal-frame"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 460, width: '100%', maxHeight: '92dvh', overflow: 'hidden' }}
      >
        <div className="metal-content" style={{
          padding: '28px 24px',
          maxHeight: 'calc(92dvh - 6px)',
          overflowY: 'auto',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18,
        }}>
          {/* Title — gradient metal text */}
          <h2
            className="metal-text"
            style={{
              fontSize: '1.4rem', fontWeight: 800, margin: 0, textAlign: 'center',
              fontFamily: 'var(--font-brand)', letterSpacing: '0.04em',
            }}
          >
            {data?.roleLabel || 'My QR Code'}
          </h2>

          {err && (
            <p style={{
              color: '#E53E3E', textAlign: 'center', fontSize: '0.88rem', margin: 0,
              padding: '10px 14px', borderRadius: 10,
              background: 'rgba(229,62,62,0.08)',
              border: '1px solid rgba(229,62,62,0.3)',
              width: '100%',
            }}>{err}</p>
          )}

          {!data && !err && (
            <div style={{
              width: 264, height: 264, borderRadius: 18,
              background: 'linear-gradient(145deg, #c8c2b8 0%, #a09890 30%, #8a847c 50%, #a09890 70%, #c8c2b8 100%)',
              padding: 3,
              boxShadow: '0 8px 30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.35)',
            }}>
              <div style={{
                width: '100%', height: '100%', borderRadius: 15, background: '#FFFFFF',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#162230', fontSize: '0.85rem', fontWeight: 700,
              }}>
                Loading...
              </div>
            </div>
          )}

          {data && (
            <>
              {/* Brushed-silver QR mount (frame + white inner) */}
              <div
                data-qr-container
                style={{
                  background: 'linear-gradient(145deg, #c8c2b8 0%, #a09890 30%, #8a847c 50%, #a09890 70%, #c8c2b8 100%)',
                  padding: 3,
                  borderRadius: 18,
                  boxShadow:
                    '0 8px 30px rgba(0,0,0,0.5), ' +
                    'inset 0 1px 0 rgba(255,255,255,0.35), ' +
                    'inset 0 -1px 0 rgba(0,0,0,0.4)',
                }}
              >
                <div style={{
                  background: '#FFFFFF',
                  padding: 16,
                  borderRadius: 15,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <QRCodeGenerator
                    url={data.url}
                    qrCodeData={data.qrCodeData ?? null}
                    size={240}
                    fgColor={data.primaryColor ?? '#0F1923'}
                    bgColor="#FFFFFF"
                  />
                </div>
              </div>

              {/* Description */}
              <p style={{
                color: '#A8B4C0', fontSize: '0.88rem', lineHeight: 1.5, margin: 0,
                textAlign: 'center', maxWidth: 360, fontWeight: 500,
              }}>
                {data.description}
              </p>

              {/* URL — embossed inset panel */}
              <div className="metal-embossed-panel" style={{
                padding: '10px 14px',
                fontSize: '0.78rem',
                color: '#D0DAE4',
                wordBreak: 'break-all',
                textAlign: 'center',
                fontFamily: 'monospace',
                width: '100%',
              }}>
                {data.url}
              </div>

              {/* Action buttons — Download (nickel) + Share + Copy (ghost) */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 10, width: '100%', marginTop: 4,
              }}>
                <button type="button" onClick={downloadQR} style={nickelButton}>Download</button>
                <button type="button" onClick={shareQR} style={ghostButton}>Share</button>
                <button type="button" onClick={copyUrl} style={ghostButton}>Copy Link</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
