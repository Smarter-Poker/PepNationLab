'use client';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import type { Message } from '@/lib/messenger/types';

type Reason = 'spam' | 'harassment' | 'inappropriate' | 'scam' | 'other';

const REASONS: Array<{ value: Reason; label: string }> = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'inappropriate', label: 'Inappropriate' },
  { value: 'scam', label: 'Scam' },
  { value: 'other', label: 'Other' },
];

interface Props {
  message: Message;
  onClose: () => void;
}

export default function ReportModal({ message, onClose }: Props) {
  const [reason, setReason] = useState<Reason>('spam');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  // Audit2 fix: support Escape to close, matching standard modal behavior.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSubmit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/messenger/report-message', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messageId: message.id, reason, note: note.trim() || undefined }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        toast(json.error ?? 'Could Not Submit Report');
        return;
      }
      toast('Report Submitted');
      onClose();
    } catch {
      toast('Network Error');
    } finally {
      setBusy(false);
    }
  };

  const preview = (() => {
    if (message.text && message.text.trim().length > 0) return message.text.slice(0, 240);
    if (message.message_type === 'image') return 'This Image';
    if (message.message_type === 'gif') return 'This Gif';
    if (message.message_type === 'voice') return 'This Voice Message';
    if (message.message_type === 'file') return 'This File Attachment';
    return 'This Message';
  })();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Report Message"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5, 10, 15, 0.78)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 1400,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 460,
          background: 'var(--surface-2, #162230)',
          border: '1px solid var(--surface-3, #1D2D3E)',
          borderRadius: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          padding: 16,
        }}
      >
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--white, #FFFFFF)' }}>
            Report Message
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'transparent', border: 0, color: 'var(--grey-400, #A8B4C0)', cursor: 'pointer' }}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div
          style={{
            padding: 10,
            background: 'var(--surface-1, #0F1923)',
            border: '1px solid var(--surface-3, #1D2D3E)',
            borderRadius: 8,
            color: 'var(--grey-400, #A8B4C0)',
            fontSize: '0.82rem',
            maxHeight: 96,
            overflow: 'hidden',
            wordBreak: 'break-word',
          }}
        >
          {preview}
        </div>

        <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <legend style={{ fontSize: '0.78rem', color: 'var(--grey-400, #A8B4C0)', textTransform: 'uppercase', marginBottom: 4 }}>
            Reason
          </legend>
          {REASONS.map((r) => (
            <label
              key={r.value}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 8px',
                borderRadius: 6,
                cursor: 'pointer',
                color: 'var(--white, #FFFFFF)',
                fontSize: '0.86rem',
              }}
            >
              <input
                type="radio"
                name="report-reason"
                value={r.value}
                checked={reason === r.value}
                onChange={() => setReason(r.value)}
              />
              <span>{r.label}</span>
            </label>
          ))}
        </fieldset>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label
            htmlFor="report-note"
            style={{ fontSize: '0.78rem', color: 'var(--grey-400, #A8B4C0)', textTransform: 'uppercase' }}
          >
            Note (Optional)
          </label>
          <textarea
            id="report-note"
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 500))}
            rows={3}
            maxLength={500}
            placeholder="Additional Context"
            style={{
              resize: 'vertical',
              padding: 8,
              borderRadius: 6,
              background: 'var(--surface-1, #0F1923)',
              color: 'var(--white, #FFFFFF)',
              border: '1px solid var(--surface-3, #1D2D3E)',
              fontFamily: 'inherit',
              fontSize: '0.86rem',
            }}
          />
          <div style={{ fontSize: '0.7rem', color: 'var(--grey-400, #A8B4C0)', textAlign: 'right' }}>
            {note.length}/500
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid var(--surface-3, #1D2D3E)',
              background: 'transparent',
              color: 'var(--white, #FFFFFF)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.86rem',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: 0,
              background: busy ? 'var(--surface-3, #1D2D3E)' : 'var(--teal, #00C4BC)',
              color: busy ? 'var(--grey-400, #A8B4C0)' : '#000',
              cursor: busy ? 'wait' : 'pointer',
              fontWeight: 700,
              fontSize: '0.86rem',
            }}
          >
            {busy ? 'Submitting' : 'Submit Report'}
          </button>
        </div>
      </div>
    </div>
  );
}
