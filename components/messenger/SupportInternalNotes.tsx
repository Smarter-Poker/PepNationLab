'use client';

import { useCallback, useEffect, useState } from 'react';
import { StickyNote, Loader2 } from 'lucide-react';

/**
 * Customer Support v2 - Admin Internal Notes.
 *
 * Renders an internal-notes list scoped to a single support conversation.
 * Backed by /api/messenger/support/[id]/notes (admin-only). The component
 * still self-gates by hiding when the API returns 401/403 so no error UI
 * leaks for non-admin callers.
 *
 * v2 styling: dropped the bright yellow sticky-note treatment in favour
 * of a grey-on-white neutral surface that matches the rest of the support
 * sidebar (reads better against the dark backdrop).
 */

interface Note {
  id: string;
  body: string;
  created_at: string;
  author?: {
    id: string;
    full_name: string | null;
    username: string | null;
  } | null;
}

function relTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const diff = Date.now() - then;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function authorName(n: Note): string {
  return (n.author?.full_name && n.author.full_name.trim())
    || (n.author?.username && n.author.username.trim())
    || 'Admin';
}

export default function SupportInternalNotes({ conversationId }: { conversationId: string }) {
  const [show, setShow] = useState(true);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/messenger/support/${encodeURIComponent(conversationId)}/notes`, {
        cache: 'no-store',
      });
      if (res.status === 401 || res.status === 403) {
        setShow(false);
        return;
      }
      if (!res.ok) return;
      const json = await res.json();
      setNotes(Array.isArray(json.notes) ? json.notes : []);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  async function submitNote() {
    const body = draft.trim();
    if (!body || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/messenger/support/${encodeURIComponent(conversationId)}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      if (res.ok) {
        setDraft('');
        await fetchNotes();
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!show) return null;

  return (
    <section
      aria-label="Internal Notes"
      style={{
        borderTop: '1px solid rgba(255,255,255,0.06)',
        paddingTop: 12,
        marginTop: 4,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 8,
        }}
      >
        <StickyNote size={14} style={{ color: 'var(--silver, #C0B8A8)' }} aria-hidden="true" />
        <strong
          style={{
            fontSize: '0.66rem',
            color: 'var(--white, #fff)',
            fontWeight: 800,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          Internal Notes
        </strong>
        {loading && (
          <Loader2 size={12} className="spin" aria-hidden="true" style={{ color: 'var(--silver, #C0B8A8)', marginLeft: 'auto' }} />
        )}
      </div>

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {notes.length === 0 && !loading ? (
          <li
            style={{
              padding: '8px 10px',
              borderRadius: 6,
              background: 'rgba(255,255,255,0.04)',
              border: '1px dashed rgba(255,255,255,0.18)',
              color: 'var(--silver, #C0B8A8)',
              fontSize: '0.74rem',
              fontStyle: 'italic',
            }}
          >
            No Internal Notes Yet. Add One Below.
          </li>
        ) : (
          notes.map((n) => (
            <li
              key={n.id}
              style={{
                padding: '8px 10px',
                borderRadius: 6,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.12)',
                boxShadow: '0 2px 4px rgba(0,0,0,0.30)',
                color: 'var(--white, #fff)',
                fontSize: '0.78rem',
                lineHeight: 1.4,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <strong style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--white, #fff)' }}>
                  {authorName(n)}
                </strong>
                <span style={{ fontSize: '0.66rem', color: 'var(--silver, #C0B8A8)', fontWeight: 700 }}>
                  {relTime(n.created_at)}
                </span>
              </div>
              <div>{n.body}</div>
            </li>
          ))
        )}
      </ul>

      <div style={{ marginTop: 8 }}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add Internal Note (Admin-Only)…"
          rows={2}
          maxLength={2000}
          style={{
            width: '100%',
            resize: 'vertical',
            padding: '8px 10px',
            borderRadius: 6,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'var(--white, #fff)',
            fontSize: '0.78rem',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            lineHeight: 1.4,
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, gap: 8 }}>
          <span style={{ fontSize: '0.66rem', color: 'var(--silver, #C0B8A8)' }}>
            {draft.length}/2000
          </span>
          <button
            type="button"
            onClick={submitNote}
            disabled={submitting || draft.trim().length === 0}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              background: draft.trim().length === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.20)',
              color: draft.trim().length === 0 ? 'var(--silver, #C0B8A8)' : 'var(--white, #fff)',
              fontWeight: 800,
              fontSize: '0.74rem',
              cursor: submitting || draft.trim().length === 0 ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.65 : 1,
            }}
          >
            {submitting ? 'Saving…' : 'Add Note'}
          </button>
        </div>
      </div>

      <style jsx>{`
        .spin { animation: notes-spin 1s linear infinite; }
        @keyframes notes-spin { to { transform: rotate(360deg); } }
      `}</style>
    </section>
  );
}
