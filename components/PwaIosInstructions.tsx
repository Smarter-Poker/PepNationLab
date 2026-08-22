'use client';

import { useEffect, useRef } from 'react';

interface Props {
  onClose: () => void;
}

export default function PwaIosInstructions({ onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Focus the close button on open; close on Escape
  useEffect(() => {
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="How To Install Pep Nation Lab On iPhone"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: 'rgba(5,10,15,0.75)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: '0 0 env(safe-area-inset-bottom, 0px) 0',
      }}
    >
      <div
        style={{
          background: 'linear-gradient(160deg, #0d1f2d 0%, #0a1820 100%)',
          border: '1px solid rgba(0,196,188,0.25)',
          borderRadius: '1.25rem 1.25rem 0 0',
          width: '100%',
          maxWidth: 480,
          padding: '1.5rem 1.25rem calc(1.5rem + env(safe-area-inset-bottom, 0px))',
          boxShadow: '0 -10px 60px rgba(0,0,0,0.6)',
          animation: 'iosSheetUp 0.32s cubic-bezier(0.32,0.72,0,1)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {/* App icon placeholder */}
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'linear-gradient(135deg, #00C4BC, #007B76)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: '#fff', lineHeight: 1.2 }}>Add To Home Screen</div>
              <div style={{ fontSize: '0.72rem', color: '#00C4BC', fontWeight: 600, marginTop: 1 }}>Pep Nation Lab</div>
            </div>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'rgba(255,255,255,0.08)', border: 'none',
              borderRadius: '50%', width: 30, height: 30,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#A8B4C0', flexShrink: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <p style={{ fontSize: '0.8rem', color: '#A8B4C0', marginBottom: '1.1rem', lineHeight: 1.5 }}>
          Apple doesn't allow one-tap installs on Safari. Follow these 3 quick steps:
        </p>

        {/* Steps */}
        {[
          {
            num: 1,
            title: 'Tap the Share button',
            detail: 'The box-with-arrow icon at the bottom center of your Safari browser bar.',
            icon: (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00C4BC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                <polyline points="16 6 12 2 8 6"/>
                <line x1="12" y1="2" x2="12" y2="15"/>
              </svg>
            ),
          },
          {
            num: 2,
            title: 'Scroll down and tap "Add to Home Screen"',
            detail: 'It has a plus icon. You may need to scroll down the share sheet to find it.',
            icon: (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00C4BC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="3"/>
                <line x1="12" y1="8" x2="12" y2="16"/>
                <line x1="8" y1="12" x2="16" y2="12"/>
              </svg>
            ),
          },
          {
            num: 3,
            title: 'Tap "Add" in the top right',
            detail: 'Pep Nation Lab will appear on your home screen like a native app.',
            icon: (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00C4BC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            ),
          },
        ].map((step) => (
          <div
            key={step.num}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.85rem',
              padding: '0.85rem 0.9rem',
              marginBottom: '0.5rem',
              background: 'rgba(0,196,188,0.05)',
              border: '1px solid rgba(0,196,188,0.12)',
              borderRadius: '0.75rem',
            }}
          >
            <div style={{
              width: 26, height: 26, borderRadius: '50%',
              background: 'rgba(0,196,188,0.15)',
              border: '1.5px solid rgba(0,196,188,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, fontWeight: 800, fontSize: '0.75rem', color: '#00C4BC',
            }}>
              {step.num}
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', flex: 1 }}>
              <div style={{ flexShrink: 0, marginTop: 1 }}>{step.icon}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#fff', marginBottom: 2 }}>{step.title}</div>
                <div style={{ fontSize: '0.74rem', color: '#8B9DAD', lineHeight: 1.45 }}>{step.detail}</div>
              </div>
            </div>
          </div>
        ))}

        {/* Footer tip */}
        <div style={{
          marginTop: '0.85rem',
          padding: '0.65rem 0.85rem',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '0.6rem',
          fontSize: '0.72rem',
          color: '#8B9DAD',
          lineHeight: 1.5,
        }}>
          💡 <strong style={{ color: '#A8B4C0' }}>Tip:</strong> Make sure you're using <strong style={{ color: '#A8B4C0' }}>Safari</strong> on your iPhone or iPad. This won't work in Chrome or other browsers on iOS.
        </div>
      </div>

      <style>{`
        @keyframes iosSheetUp {
          from { transform: translateY(100%); opacity: 0.6; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}
