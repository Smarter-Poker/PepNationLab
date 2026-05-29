'use client';
import { useEffect, useRef } from 'react';
import { MESSAGE_LABEL_VALUES, type MessageLabelValue } from '@/lib/messenger/schemas';

interface Props {
  messageId: string;
  currentLabels: string[];
  onToggle: (label: MessageLabelValue, action: 'add' | 'remove') => void;
  onClose: () => void;
}

export default function LabelsMenu({ currentLabels, onToggle, onClose }: Props) {
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
      aria-label="Labels"
      style={{
        position: 'absolute',
        top: '-160px',
        left: 0,
        zIndex: 20,
        background: 'var(--surface-3, #1D2D3E)',
        border: '1px solid var(--surface-2, #162230)',
        borderRadius: 10,
        padding: 8,
        boxShadow: '0 6px 18px rgba(0,0,0,0.55)',
        minWidth: 200,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <div
        style={{
          fontSize: '0.7rem',
          color: 'var(--grey-400, #A8B4C0)',
          textTransform: 'uppercase',
          fontWeight: 700,
          padding: '0 4px',
        }}
      >
        Labels
      </div>
      {MESSAGE_LABEL_VALUES.map((label) => {
        const has = currentLabels.includes(label);
        return (
          <button
            key={label}
            type="button"
            onClick={() => onToggle(label, has ? 'remove' : 'add')}
            aria-label={`${has ? 'Remove' : 'Add'} Label ${label}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 8px',
              borderRadius: 6,
              border: 0,
              background: has ? 'var(--teal, #00C4BC)' : 'var(--surface-1, #0F1923)',
              color: has ? '#000' : 'var(--white, #FFFFFF)',
              cursor: 'pointer',
              textAlign: 'left',
              fontWeight: 600,
              fontSize: '0.82rem',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                display: 'inline-block',
                width: 14,
                height: 14,
                borderRadius: 4,
                border: '1px solid currentColor',
                background: has ? 'currentColor' : 'transparent',
              }}
            />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
