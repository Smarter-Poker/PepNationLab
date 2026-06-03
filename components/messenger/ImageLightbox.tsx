'use client';
import { useEffect } from 'react';
import { X } from 'lucide-react';

interface Props { src: string; onClose: () => void }

export default function ImageLightbox({ src, onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image Preview"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, cursor: 'zoom-out',
      }}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        aria-label="Close"
        title="Close"
        style={{
          // R26: lift close button below iPhone notch / Dynamic Island and away
          // from the right-edge gesture area on landscape iPhones.
          position: 'absolute',
          top: 'calc(16px + env(safe-area-inset-top, 0px))',
          right: 'calc(16px + env(safe-area-inset-right, 0px))',
          background: 'rgba(0,0,0,0.6)',
          border: 0, color: '#FFFFFF', cursor: 'pointer',
          // Touch target: 44x44 minimum on coarse pointers.
          padding: 12, borderRadius: '50%', minWidth: 44, minHeight: 44,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1,
        }}
      >
        <X size={20} />
      </button>
      {/* R26: dvh accounts for iOS Safari address bar; safe-area reserved on each side. */}
      <img src={src} alt="Preview" style={{
        maxWidth: 'calc(100vw - max(16px, env(safe-area-inset-left, 0px)) - max(16px, env(safe-area-inset-right, 0px)))',
        maxHeight: 'calc(100dvh - max(16px, env(safe-area-inset-top, 0px)) - max(16px, env(safe-area-inset-bottom, 0px)))',
        objectFit: 'contain',
      }} />
    </div>
  );
}
