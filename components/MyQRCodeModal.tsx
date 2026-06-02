'use client';

/**
 * MyQRCodeModal — R24 unified.
 *
 * Why it broke before:
 *   - The same click that opens the modal can re-fire on the modal's backdrop
 *     (React 19 portal event delegation), causing the modal to close on the
 *     same tick it opened, so it visually "does nothing".
 *
 * Defenses now in place:
 *   1. `readyToClose` flag — backdrop click handler is a no-op for the first
 *      120ms after open, so the open-click cannot accidentally close it.
 *   2. Explicit X close button (44x44 tap target) — the primary close UX.
 *   3. Escape key closes.
 *   4. `data-qr-modal-root` attribute so the trigger button can stopPropagation
 *      on clicks that aren't ours, without affecting nested buttons inside.
 *   5. Inline-only hex colors — never depend on CSS vars that might be missing.
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

  // Mount guard for SSR / hydration
  useEffect(() => { setMounted(true); }, []);

  // Open lifecycle: reset state + arm "ready to close" after a short delay so
  // the click that opened the modal cannot immediately close it via the backdrop.
  useEffect(() => {
    if (!open) {
      lastOpenRef.current = false;
      setReadyToClose(false);
      return;
    }
    if (lastOpenRef.current) return; // dedupe
    lastOpenRef.current = true;
    setData(null);
    setErr(null);
    setReadyToClose(false);
    const armId = setTimeout(() => setReadyToClose(true), 120);

    // Fetch the QR payload
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

  // Lock body scroll while open + Escape key to close
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
    if (!readyToClose) return; // ignore the open-click
    // Only close if the click was on the backdrop itself, NOT bubbled from a child.
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
      if (canvas && navigator.share) {
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
    } catch {/* fall through to copy */}
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

  return createPortal(
    <div
      data-qr-modal-root
      role="dialog"
      aria-modal="true"
      aria-label="My QR Code"
      onClick={attemptBackdropClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 999999,
        background: 'rgba(5,10,15,0.95)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 'max(24px, env(safe-area-inset-top)) 16px max(24px, env(safe-area-inset-bottom)) 16px',
      }}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        aria-label="Close"
        style={{
          position: 'absolute', top: 'max(20px, env(safe-area-inset-top))', right: 20,
          background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
          color: '#fff', width: 44, height: 44, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', padding: 0,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="6" y1="18" x2="18" y2="6" />
        </svg>
      </button>

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#162230',
          padding: '32px 24px',
          borderRadius: 24,
          border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          maxWidth: 420, width: '100%', maxHeight: '90dvh', overflowY: 'auto',
        }}
      >
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, textAlign: 'center', color: '#FFFFFF' }}>
          {data?.roleLabel || 'My QR Code'}
        </h2>

        {err && (
          <p style={{ color: '#E53E3E', textAlign: 'center', fontSize: '0.9rem', margin: 0 }}>
            {err}
          </p>
        )}

        {!data && !err && (
          <div style={{
            width: 240, height: 240, background: '#FFFFFF', borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#162230', fontSize: '0.85rem',
          }}>
            Loading...
          </div>
        )}

        {data && (
          <>
            <div data-qr-container style={{ background: '#FFFFFF', padding: 14, borderRadius: 12 }}>
              <QRCodeGenerator
                url={data.url}
                qrCodeData={data.qrCodeData ?? null}
                size={240}
                fgColor={data.primaryColor ?? '#0F1923'}
                bgColor="#FFFFFF"
              />
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#A8B4C0', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: 6 }}>
                {data.description}
              </div>
              <div style={{
                display: 'inline-flex', gap: 6, alignItems: 'center', padding: '6px 12px',
                background: 'rgba(255,255,255,0.05)', borderRadius: 8, fontSize: '0.78rem',
                color: '#D0DAE4', wordBreak: 'break-all', maxWidth: '100%',
              }}>
                {data.url}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, width: '100%' }}>
              <button type="button" onClick={downloadQR} style={{
                padding: '12px 8px', borderRadius: 10, minHeight: 48, cursor: 'pointer',
                background: '#C0B8A8', color: '#0F1923', border: 'none',
                fontWeight: 700, fontSize: '0.82rem',
              }}>Download</button>
              <button type="button" onClick={shareQR} style={{
                padding: '12px 8px', borderRadius: 10, minHeight: 48, cursor: 'pointer',
                background: 'rgba(255,255,255,0.08)', color: '#FFFFFF',
                border: '1px solid rgba(255,255,255,0.15)', fontWeight: 700, fontSize: '0.82rem',
              }}>Share</button>
              <button type="button" onClick={copyUrl} style={{
                padding: '12px 8px', borderRadius: 10, minHeight: 48, cursor: 'pointer',
                background: 'rgba(255,255,255,0.08)', color: '#FFFFFF',
                border: '1px solid rgba(255,255,255,0.15)', fontWeight: 700, fontSize: '0.82rem',
              }}>Copy Link</button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
