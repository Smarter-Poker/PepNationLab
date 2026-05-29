'use client';
import { useEffect, useRef } from 'react';

interface Props {
  onPick: (seconds: number | null) => void;
  onClose: () => void;
  currentSeconds: number | null;
}

const CHOICES: Array<{ label: string; value: number | null }> = [
  { label: 'Never', value: null },
  { label: 'Five Minutes', value: 5 * 60 },
  { label: 'One Hour', value: 60 * 60 },
  { label: 'Twenty Four Hours', value: 24 * 60 * 60 },
  { label: 'Seven Days', value: 7 * 24 * 60 * 60 },
];

export default function ExpiryPicker({ onPick, onClose, currentSeconds }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Set Expiry"
      style={{
        position: 'absolute',
        bottom: 'calc(100% + 8px)',
        left: 12,
        zIndex: 30,
        background: 'var(--surface-3, #1D2D3E)',
        border: '1px solid var(--surface-2, #162230)',
        borderRadius: 10,
        padding: 8,
        boxShadow: '0 10px 24px rgba(0,0,0,0.6)',
        minWidth: 220,
      }}
    >
      <div
        style={{
          fontSize: '0.7rem', color: 'var(--grey-400, #A8B4C0)',
          textTransform: 'uppercase', fontWeight: 700, padding: '0 4px 6px',
        }}
      >
        Set Expiry
      </div>
      {CHOICES.map((c) => {
        const selected = c.value === currentSeconds;
        return (
          <button
            key={c.label}
            type="button"
            onClick={() => { onPick(c.value); onClose(); }}
            aria-label={`Expiry ${c.label}`}
            aria-pressed={selected}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '6px 8px', borderRadius: 6,
              border: 0,
              background: selected ? 'var(--teal, #00C4BC)' : 'var(--surface-1, #0F1923)',
              color: selected ? '#000' : 'var(--white, #FFFFFF)',
              cursor: 'pointer', fontSize: '0.84rem', fontWeight: 600,
              marginBottom: 4,
            }}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
