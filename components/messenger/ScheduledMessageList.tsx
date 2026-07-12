'use client';
import { useEffect, useState } from 'react';
import { X, Calendar, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useModalA11y } from '@/lib/useModalA11y';

interface ScheduledRow {
  id: string;
  conversation_id: string;
  text: string | null;
  message_type: string;
  scheduled_at: string;
  status: string;
  conversation_title: string | null;
  conversation_type: string | null;
}

interface Props {
  onClose: () => void;
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString([], {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch { return ''; }
}

export default function ScheduledMessageList({ onClose }: Props) {
  const [rows, setRows] = useState<ScheduledRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/messenger/list-scheduled', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        });
        if (!res.ok) return;
        const json = (await res.json()) as { scheduled?: ScheduledRow[] };
        if (!cancelled) setRows(json.scheduled ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleCancel = async (row: ScheduledRow) => {
    try {
      const res = await fetch('/api/messenger/schedule-message', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', id: row.id }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        toast(json.error ?? 'Could Not Cancel');
        return;
      }
      setRows((cur) => cur.filter((r) => r.id !== row.id));
      toast('Scheduled Message Cancelled');
    } catch {
      toast('Network Error');
    }
  };

  // A11y: initial focus, Tab trap, Escape-to-close, focus restore (WCAG 2.1.2, 2.4.3).
  const dialogRef = useModalA11y<HTMLDivElement>(true, { onClose });

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Scheduled Messages"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(5, 10, 15, 0.78)',
        display: 'flex', justifyContent: 'flex-end', zIndex: 1300,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <aside
        style={{
          width: 'min(420px, 100%)', height: '100%',
          background: 'var(--surface-2, #162230)',
          borderLeft: '1px solid var(--surface-3, #1D2D3E)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        <header
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 14px', borderBottom: '1px solid var(--surface-3, #1D2D3E)',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={16} aria-hidden="true" />
            Scheduled Messages
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
        <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loading ? (
            <div style={{ color: 'var(--grey-400, #A8B4C0)', padding: 12, fontSize: '0.85rem' }}>Loading Scheduled</div>
          ) : rows.length === 0 ? (
            <div style={{ color: 'var(--grey-400, #A8B4C0)', padding: 12, fontSize: '0.85rem' }}>
              No Pending Scheduled Messages.
            </div>
          ) : (
            rows.map((row) => (
              <div
                key={row.id}
                style={{
                  padding: 10, borderRadius: 8,
                  background: 'var(--surface-1, #0F1923)',
                  border: '1px solid var(--surface-3, #1D2D3E)',
                  display: 'flex', flexDirection: 'column', gap: 6,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--white, #FFFFFF)' }}>
                    {row.conversation_title?.trim() || (row.conversation_type === 'direct' ? 'Direct Message' : 'Conversation')}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--teal, #00C4BC)' }}>
                    {formatWhen(row.scheduled_at)}
                  </span>
                </div>
                <div
                  style={{
                    color: 'var(--grey-400, #A8B4C0)',
                    fontSize: '0.82rem',
                    overflow: 'hidden', textOverflow: 'ellipsis',
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  }}
                >
                  {row.text || (row.message_type !== 'text' ? `(${row.message_type})` : '(Media)')}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => void handleCancel(row)}
                    aria-label="Cancel Scheduled"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '4px 10px', borderRadius: 6,
                      border: '1px solid var(--danger, #E53E3E)',
                      background: 'transparent', color: 'var(--danger, #E53E3E)',
                      cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
                    }}
                  >
                    <Trash2 size={12} aria-hidden="true" />
                    Cancel
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}
