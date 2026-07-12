'use client';

/**
 * MyQRCodeModal - premium brushed-nickel restyle.
 *
 * Visual layer: matches the existing platform "metal" aesthetic
 * (.glass-panel + . + .metal-text + .glass-panel)
 * used across AdminAgents, AgentBundles, AdminAnalytics, etc.
 *
 * Event-bubble defenses retained from prior fix:
 *   1. `readyToClose` flag - backdrop close handler is a no-op for the first
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
  slug: string | null;
  displayName?: string;
  qrCodeData?: string | null;
  primaryColor?: string;
  isInvite: boolean;
  referCode?: string | null;
  roleLabel: string;
  description: string;
  referralCode?: string | null;
  signupUrl?: string | null;
  storefrontUrl?: string | null;
  role?: 'researcher' | 'sub_agent' | 'agent' | 'super_agent';
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
  const [reward, setReward] = useState<{ isSubAgent: boolean; enabled: boolean; amount: number } | null>(null);
  const [rewardSaving, setRewardSaving] = useState(false);

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

    // Load the per-account referral reward opt-in (meaningful for sub-agents).
    setReward(null);
    fetch('/api/agent/referral-reward', { cache: 'no-store' })
      .then(async r => (r.ok ? r.json() : null))
      .then(j => { if (j && typeof j === 'object') setReward(j); })
      .catch(() => { /* non-agent accounts simply have no reward panel */ });

    return () => clearTimeout(armId);
  }, [open]);

  async function saveReward(nextEnabled: boolean, nextAmount: number) {
    setRewardSaving(true);
    try {
      const res = await fetch('/api/agent/referral-reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextEnabled, amount: nextAmount }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(j?.error || 'Could Not Save'); return; }
      setReward(prev => ({ isSubAgent: prev?.isSubAgent ?? true, enabled: !!j.enabled, amount: Number(j.amount) || 0 }));
      toast.success('Referral Reward Updated');
    } catch {
      toast.error('Could Not Save');
    } finally {
      setRewardSaving(false);
    }
  }

  async function copyCode(e: React.MouseEvent) {
    e.stopPropagation();
    const code = data?.referralCode ?? data?.referCode;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(String(code));
      toast.success('Referral Code Copied');
    } catch {
      toast.error('Could Not Copy');
    }
  }

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
  // Brushed-nickel button skin (matches .glass-panel outer ring + inset highlights).
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
      {/* X close button - nickel pill, top-right */}
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
        className="glass-panel"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 460, width: '100%', maxHeight: '92dvh', overflow: 'hidden' }}
      >
        <div className="" style={{
          padding: '28px 24px',
          maxHeight: 'calc(92dvh - 6px)',
          overflowY: 'auto',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18,
        }}>
          {/* Title - gradient metal text */}
          <h2
            className="metal-text"
            style={{
              fontSize: '1.4rem', fontWeight: 800, margin: 0, textAlign: 'center',
              fontFamily: 'var(--font-brand)', letterSpacing: '0.04em',
            }}
          >
            {data?.roleLabel || 'Referral Codes'}
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
                    fgColor="#1F2937"
                    bgColor="#FFFFFF"
                  />
                </div>
              </div>

              {/* Referral code chip + copy */}
              {(data.referralCode || data.referCode) && (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8FA0B0', textAlign: 'center' }}>
                    Your Referral Code
                  </span>
                  <button
                    type="button"
                    onClick={copyCode}
                    title="Copy Referral Code"
                    style={{
                      width: '100%', cursor: 'pointer',
                      padding: '10px 14px', borderRadius: 12,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                      background: 'linear-gradient(180deg, rgba(0,196,188,0.12) 0%, rgba(0,196,188,0.04) 100%)',
                      border: '1px solid rgba(0,196,188,0.35)',
                      color: '#EAF7F6', fontWeight: 800, fontSize: '1.05rem', letterSpacing: '0.05em',
                    }}
                  >
                    {String(data.referralCode || data.referCode)}
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  </button>
                </div>
              )}

              {/* Description */}
              <p style={{
                color: '#A8B4C0', fontSize: '0.88rem', lineHeight: 1.5, margin: 0,
                textAlign: 'center', maxWidth: 360, fontWeight: 500,
              }}>
                {data.description}
              </p>

              {/* URL - embossed inset panel */}
              <div className="glass-panel" style={{
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

              {/* Action buttons - Download (nickel) + Share + Copy (ghost) */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 10, width: '100%', marginTop: 4,
              }}>
                <button type="button" onClick={downloadQR} style={nickelButton}>Download</button>
                <button type="button" onClick={shareQR} style={ghostButton}>Share</button>
                <button type="button" onClick={copyUrl} style={ghostButton}>Copy Link</button>
              </div>

              {/* Storefront link (secondary) */}
              {data.storefrontUrl && (
                <a
                  href={data.storefrontUrl}
                  onClick={(e) => e.stopPropagation()}
                  style={{ fontSize: '0.78rem', color: '#7FD9D3', textDecoration: 'none', textAlign: 'center' }}
                >
                  Or share your storefront →
                </a>
              )}

              {/* Sub-agent referral reward opt-in (default OFF / $0) */}
              {reward?.isSubAgent && (
                <div className="glass-panel" style={{ width: '100%', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#EAF1F6' }}>Referral Reward</span>
                    <button
                      type="button"
                      disabled={rewardSaving}
                      onClick={(e) => { e.stopPropagation(); saveReward(!reward.enabled, reward.enabled ? 0 : (reward.amount || 10)); }}
                      style={{
                        cursor: 'pointer', padding: '6px 12px', borderRadius: 999, border: 'none',
                        fontWeight: 800, fontSize: '0.72rem', letterSpacing: '0.05em',
                        color: reward.enabled ? '#04231F' : '#CBD5E1',
                        background: reward.enabled ? 'linear-gradient(180deg,#2fe0c9,#12b3a0)' : 'rgba(255,255,255,0.08)',
                        border: reward.enabled ? 'none' : '1px solid rgba(255,255,255,0.15)',
                      }}
                    >
                      {reward.enabled ? 'ON' : 'OFF'}
                    </button>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: '#93A3B2', margin: 0, lineHeight: 1.4 }}>
                    Earn store credit when someone you refer places their first qualifying order. Off by default.
                  </p>
                  {reward.enabled && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={(e) => e.stopPropagation()}>
                      <span style={{ color: '#93A3B2', fontSize: '0.85rem' }}>$</span>
                      <input
                        type="number" min={0} max={1000} step={1}
                        defaultValue={reward.amount}
                        onBlur={(e) => {
                          const v = Math.max(0, Math.min(1000, Number(e.target.value) || 0));
                          if (v !== reward.amount) saveReward(true, v);
                        }}
                        style={{
                          flex: 1, padding: '8px 10px', borderRadius: 8,
                          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)',
                          color: '#EAF1F6', fontSize: '0.9rem', fontWeight: 700,
                        }}
                      />
                      <span style={{ color: '#93A3B2', fontSize: '0.75rem' }}>per referral</span>
                    </div>
                  )}
                </div>
              )}

              {/* Full referral dashboard link (agent-tier) */}
              {(data.role === 'agent' || data.role === 'super_agent' || data.role === 'sub_agent') && (
                <a
                  href="/dashboard/agent/referrals"
                  onClick={(e) => e.stopPropagation()}
                  style={{ fontSize: '0.8rem', color: '#7FD9D3', textDecoration: 'none', textAlign: 'center', fontWeight: 600 }}
                >
                  Open Full Referral Dashboard →
                </a>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
