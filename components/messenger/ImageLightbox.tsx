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
          position: 'absolute', top: 16, right: 16, background: 'rgba(0,0,0,0.6)',
          border: 0, color: '#FFFFFF', cursor: 'pointer', padding: 8, borderRadius: '50%',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <X size={18} />
      </button>
      <img src={src} alt="Preview" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain' }} />
    </div>
  );
}
