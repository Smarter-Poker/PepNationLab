'use client';
import { useEffect, useState } from 'react';
import { X, Bookmark } from 'lucide-react';
import { toast } from 'sonner';

interface BookmarkRow {
  id: string;
  message_id: string;
  message_text: string | null;
  created_at: string;
  conversation_id: string | null;
  live_text?: string | null;
  source_deleted?: boolean;
}

interface Props {
  onClose: () => void;
  onJump: (conversationId: string, messageId: string) => void;
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export default function BookmarksDrawer({ onClose, onJump }: Props) {
  const [rows, setRows] = useState<BookmarkRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/messenger/list-bookmarks', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        });
        if (!res.ok) return;
        const json = (await res.json()) as { bookmarks?: BookmarkRow[] };
        if (!cancelled) setRows(json.bookmarks ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleRemove = async (row: BookmarkRow) => {
    try {
      const res = await fetch('/api/messenger/bookmark-message', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messageId: row.message_id, action: 'remove' }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        toast(json.error ?? 'Could Not Remove Bookmark');
        return;
      }
      setRows((cur) => cur.filter((r) => r.id !== row.id));
    } catch {
      toast('Network Error');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Bookmarks"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5, 10, 15, 0.78)',
        display: 'flex',
        justifyContent: 'flex-end',
        zIndex: 1300,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <aside
        style={{
          width: 'min(420px, 100%)',
          height: '100%',
          background: 'var(--surface-2, #162230)',
          borderLeft: '1px solid var(--surface-3, #1D2D3E)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 14px',
            borderBottom: '1px solid var(--surface-3, #1D2D3E)',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Bookmarks</h2>
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
            <div style={{ color: 'var(--grey-400, #A8B4C0)', padding: 12, fontSize: '0.85rem' }}>Loading Bookmarks</div>
          ) : rows.length === 0 ? (
            <div style={{ color: 'var(--grey-400, #A8B4C0)', padding: 12, fontSize: '0.85rem' }}>
              No Bookmarks Yet. Use The Bookmark Action On Any Message To Save It Here.
            </div>
          ) : (
            rows.map((row) => (
              <div
                key={row.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  padding: 10,
                  borderRadius: 8,
                  background: 'var(--surface-1, #0F1923)',
                  border: '1px solid var(--surface-3, #1D2D3E)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--teal, #00C4BC)' }}>
                    <Bookmark size={12} aria-hidden="true" />
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase' }}>Saved</span>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--grey-400, #A8B4C0)' }}>
                    {formatWhen(row.created_at)}
                  </span>
                </div>
                <div
                  style={{
                    color: 'var(--white, #FFFFFF)',
                    fontSize: '0.88rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  {row.source_deleted ? 'Source Deleted' : (row.live_text ?? row.message_text ?? 'Message')}
                </div>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  {row.conversation_id && (
                    <button
                      type="button"
                      onClick={() => onJump(row.conversation_id!, row.message_id)}
                      style={{
                        background: 'var(--teal, #00C4BC)',
                        color: '#000',
                        border: 0,
                        borderRadius: 6,
                        padding: '4px 10px',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '0.78rem',
                      }}
                    >
                      Open
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleRemove(row)}
                    style={{
                      background: 'transparent',
                      color: 'var(--white, #FFFFFF)',
                      border: '1px solid var(--surface-3, #1D2D3E)',
                      borderRadius: 6,
                      padding: '4px 10px',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '0.78rem',
                    }}
                  >
                    Remove
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
