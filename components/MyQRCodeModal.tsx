'use client';

/**
 * MyQRCodeModal — R24 unified.
 * Full-screen QR popup with Download + Share + Copy URL.
 * Used by every menu surface (global Navbar drawer + AgentDashboardClient sidebar).
 *
 * Fetches the right URL via /api/agent/my-qr so we get correct behavior for
 * every role including sub-agents (who inherit their parent agent's storefront
 * with a ?ref=<sub_agent_id> query param so attribution credits them).
 */

import { useEffect, useState } from 'react';
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
  const [data, setData] = useState<QRPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setData(null);
    setErr(null);
    fetch('/api/agent/my-qr', { cache: 'no-store' })
      .then(async r => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j.message || 'Could Not Load QR');
        }
        return r.json();
      })
      .then(setData)
      .catch(e => setErr(e.message || 'Could Not Load QR'));
  }, [open]);

  // Lock scroll while modal open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  function downloadQR() {
    // Find the rendered canvas/img in the QR container and download it
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

  async function shareQR() {
    if (!data?.url) return;
    const shareData: ShareData = {
      title: 'Pep Nation Lab',
      text: data.isInvite
        ? 'Join Pep Nation Lab through my invite:'
        : 'Visit my Pep Nation Lab storefront:',
      url: data.url,
    };
    // Try Web Share with file (QR image) first
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
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
    } catch {/* fall through to copy */}
    // Fallback: copy link to clipboard
    try {
      await navigator.clipboard.writeText(data.url);
      toast.success('Link Copied To Clipboard');
    } catch {
      toast.error('Sharing Not Supported');
    }
  }

  async function copyUrl() {
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
      role="dialog"
      aria-modal="true"
      aria-label="My QR Code"
      onClick={onClose}
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
        onClick={onClose}
        aria-label="Close"
        style={{
          position: 'absolute', top: 'max(20px, env(safe-area-inset-top))', right: 20,
          background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
          color: '#fff', width: 44, height: 44, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', fontSize: '1.1rem', fontWeight: 700,
        }}
      >
        ✕
      </button>

      <div
        onClick={e => e.stopPropagation()}
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
              <button
                type="button"
                onClick={downloadQR}
                style={{
                  padding: '12px 8px', borderRadius: 10, minHeight: 48, cursor: 'pointer',
                  background: '#C0B8A8', color: '#0F1923', border: 'none',
                  fontWeight: 700, fontSize: '0.82rem',
                }}
              >Download</button>
              <button
                type="button"
                onClick={shareQR}
                style={{
                  padding: '12px 8px', borderRadius: 10, minHeight: 48, cursor: 'pointer',
                  background: 'rgba(255,255,255,0.08)', color: '#FFFFFF',
                  border: '1px solid rgba(255,255,255,0.15)', fontWeight: 700, fontSize: '0.82rem',
                }}
              >Share</button>
              <button
                type="button"
                onClick={copyUrl}
                style={{
                  padding: '12px 8px', borderRadius: 10, minHeight: 48, cursor: 'pointer',
                  background: 'rgba(255,255,255,0.08)', color: '#FFFFFF',
                  border: '1px solid rgba(255,255,255,0.15)', fontWeight: 700, fontSize: '0.82rem',
                }}
              >Copy Link</button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
