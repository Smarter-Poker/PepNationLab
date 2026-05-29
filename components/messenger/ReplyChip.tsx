'use client';
import { X } from 'lucide-react';
import type { Message } from '@/lib/messenger/types';

interface Props {
  replyTo: Message;
  onClear: () => void;
}

export default function ReplyChip({ replyTo, onClear }: Props) {
  const preview = (replyTo.text ?? '').slice(0, 80);
  return (
    <div
      role="group"
      aria-label="Replying To"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        background: 'var(--surface-2, #162230)',
        borderLeft: '3px solid var(--teal, #00C4BC)',
        borderRadius: 8,
        marginBottom: 6,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.74rem', color: 'var(--teal, #00C4BC)', fontWeight: 700 }}>Replying To</div>
        <div
          style={{
            fontSize: '0.84rem',
            color: 'var(--grey-400, #A8B4C0)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {preview || '(Media)'}
        </div>
      </div>
      <button
        type="button"
        onClick={onClear}
        style={{
          background: 'transparent',
          border: 0,
          color: 'var(--white, #FFFFFF)',
          cursor: 'pointer',
          padding: 4,
        }}
        aria-label="Cancel Reply"
        title="Cancel Reply"
      >
        <X size={16} />
      </button>
    </div>
  );
}
