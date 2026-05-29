'use client';
import { useCallback, useEffect, useState } from 'react';
import { X, Send } from 'lucide-react';
import { toast } from 'sonner';
import type { Message } from '@/lib/messenger/types';

interface Props {
  threadParentId: string;
  selfId: string;
  onClose: () => void;
}

const MAX_LEN = 2000;

function formatTime(iso: string): string {
  try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
}

export default function ThreadDrawer({ threadParentId, selfId, onClose }: Props) {
  const [parent, setParent] = useState<Message | null>(null);
  const [replies, setReplies] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/messenger/list-thread-replies', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ threadParentId }),
      });
      if (!res.ok) return;
      const json = (await res.json()) as { parent?: Message; messages?: Message[] };
      setParent(json.parent ?? null);
      setReplies(json.messages ?? []);
    } finally {
      setLoading(false);
    }
  }, [threadParentId]);

  useEffect(() => { void load(); }, [load]);

  // Audit3 fix: Escape key closes the drawer (parity with BookmarksDrawer,
  // BlockList, ReportModal).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      const res = await fetch('/api/messenger/thread-reply', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          threadParentId,
          text: trimmed,
          messageType: 'text',
        }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        toast(json.error ?? 'Reply Failed');
        return;
      }
      const json = (await res.json()) as { message: Message };
      setReplies((cur) => [...cur, json.message]);
      setText('');
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Thread Replies"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(5, 10, 15, 0.78)',
        display: 'flex', justifyContent: 'flex-end', zIndex: 1200,
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
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Thread</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'transparent', border: 0, color: 'var(--grey-400, #A8B4C0)', cursor: 'pointer' }}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loading ? (
            <div style={{ color: 'var(--grey-400, #A8B4C0)', padding: 12, fontSize: '0.85rem' }}>Loading Thread</div>
          ) : (
            <>
              {parent && (
                <div
                  style={{
                    padding: 10, borderRadius: 10,
                    background: 'var(--surface-1, #0F1923)',
                    border: '1px solid var(--teal, #00C4BC)',
                  }}
                >
                  <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--teal, #00C4BC)', fontWeight: 700 }}>
                    Original Message
                  </div>
                  <div style={{ color: 'var(--white, #FFFFFF)', fontSize: '0.9rem', marginTop: 4 }}>
                    {parent.is_deleted ? 'Message Deleted' : (parent.text ?? `(${parent.message_type})`)}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--grey-400, #A8B4C0)', marginTop: 4 }}>
                    {formatTime(parent.created_at)}
                  </div>
                </div>
              )}
              {replies.length === 0 ? (
                <div style={{ color: 'var(--grey-400, #A8B4C0)', padding: 12, fontSize: '0.85rem' }}>
                  No Replies Yet. Reply In Thread Below.
                </div>
              ) : (
                replies.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      alignSelf: m.sender_id === selfId ? 'flex-end' : 'flex-start',
                      maxWidth: '85%',
                      padding: '8px 12px',
                      borderRadius: 12,
                      background: m.sender_id === selfId ? 'var(--teal, #00C4BC)' : 'var(--surface-1, #0F1923)',
                      color: m.sender_id === selfId ? '#000' : 'var(--white, #FFFFFF)',
                      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    }}
                  >
                    <div style={{ fontSize: '0.88rem' }}>{m.text ?? `(${m.message_type})`}</div>
                    <div style={{ fontSize: '0.66rem', opacity: 0.8, marginTop: 4 }}>{formatTime(m.created_at)}</div>
                  </div>
                ))
              )}
            </>
          )}
        </div>

        <div
          style={{
            display: 'flex', alignItems: 'flex-end', gap: 8,
            padding: 12,
            borderTop: '1px solid var(--surface-3, #1D2D3E)',
            background: 'var(--surface-1, #0F1923)',
          }}
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend(); } }}
            placeholder="Reply In Thread"
            aria-label="Reply In Thread"
            rows={1}
            maxLength={MAX_LEN}
            style={{
              flex: 1, resize: 'none', minHeight: 40, maxHeight: 140,
              padding: '8px 10px', borderRadius: 8,
              border: '1px solid var(--surface-3, #1D2D3E)',
              background: 'var(--surface-2, #162230)',
              color: 'var(--white, #FFFFFF)',
              fontFamily: 'inherit', fontSize: '0.9rem', outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!text.trim() || sending}
            aria-label="Send Reply"
            title="Send Reply"
            style={{
              background: 'var(--teal, #00C4BC)', color: '#000',
              border: 0, borderRadius: 8, width: 40, height: 40,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', opacity: !text.trim() || sending ? 0.5 : 1,
            }}
          >
            <Send size={16} />
          </button>
        </div>
      </aside>
    </div>
  );
}
