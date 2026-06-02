'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { LifeBuoy, X, ChevronRight, Loader2 } from 'lucide-react';

/**
 * Admin Customer Support widget.
 *
 * Visible only on /messenger to a user whose profile.role === 'admin'.
 * Renders a fixed-position pill at the bottom-LEFT of the messenger
 * (over the conversation list, not the chat pane), exactly where the
 * admin's agent / super-agent list sits today.
 *
 * Click opens an inline panel that lists every is_support=true
 * conversation the admin participates in (driven by
 * /api/messenger/support/inbox), with the requesting party's name, last
 * message preview, and an unread badge. Clicking a row navigates to
 * /messenger?conversation=ID so the existing messenger surfaces the
 * thread inline — admin replies become customer-support replies
 * automatically because the conversation is already participant-scoped.
 *
 * This is the secondary-messenger inbox surfacing layer: the underlying
 * thread, message send path, and unread tracking are unchanged.
 */

interface InboxRow {
  conversation_id: string;
  title: string | null;
  created_at: string | null;
  last_message_at: string | null;
  other_user: {
    id: string;
    full_name: string | null;
    username: string | null;
    role: string | null;
  } | null;
  last_message: {
    text: string | null;
    message_type: string | null;
    sender_id: string;
    sender_is_admin: boolean;
    created_at: string;
  } | null;
  unread_count: number;
}

function relTime(iso: string | null): string {
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

function otherName(row: InboxRow): string {
  const o = row.other_user;
  if (!o) return 'Researcher';
  return (o.full_name && o.full_name.trim())
    || (o.username && o.username.trim())
    || 'Researcher';
}

function previewText(row: InboxRow): string {
  const m = row.last_message;
  if (!m) return 'No Messages Yet';
  if (m.text && m.text.trim()) {
    const prefix = m.sender_is_admin ? 'You: ' : '';
    const body = m.text.length > 90 ? `${m.text.slice(0, 87)}…` : m.text;
    return `${prefix}${body}`;
  }
  switch (m.message_type) {
    case 'image': return m.sender_is_admin ? 'You Sent A Photo' : 'Sent A Photo';
    case 'video': return m.sender_is_admin ? 'You Sent A Video' : 'Sent A Video';
    case 'voice': return m.sender_is_admin ? 'You Sent A Voice Note' : 'Sent A Voice Note';
    case 'file': return m.sender_is_admin ? 'You Sent A File' : 'Sent A File';
    default: return m.sender_is_admin ? 'You Replied' : 'New Message';
  }
}

export default function CustomerSupportWidget() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<InboxRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Mount: gate visibility to admins on /messenger only.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.location.pathname.startsWith('/messenger')) return;
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();
        if (cancelled) return;
        if (profile?.role === 'admin') setShow(true);
      } catch { /* hide on any error */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const fetchInbox = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch('/api/messenger/support/inbox', { cache: 'no-store' });
      if (!res.ok) {
        setErr('Could Not Load Support Inbox');
        return;
      }
      const json = await res.json();
      setRows(Array.isArray(json.conversations) ? json.conversations : []);
    } catch {
      setErr('Network Error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + when opening the panel, refresh.
  useEffect(() => {
    if (!show) return;
    fetchInbox();
    // While panel is open, poll every 25s so the inbox stays fresh.
    if (open) {
      pollRef.current = setInterval(fetchInbox, 25000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [show, open, fetchInbox]);

  // Close on ESC.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const totalUnread = rows.reduce((a, r) => a + (r.unread_count || 0), 0);

  function goToConversation(id: string) {
    setOpen(false);
    router.push(`/messenger?conversation=${encodeURIComponent(id)}`);
  }

  if (!show) return null;

  return (
    <>
      {/* Backdrop — only when panel is expanded, dims the rest of the page */}
      {open && (
        <div
          aria-hidden
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 10, 15, 0.55)',
            backdropFilter: 'blur(2px)',
            zIndex: 90,
          }}
        />
      )}

      {/* The pill button (collapsed state) */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close Customer Support Inbox' : 'Open Customer Support Inbox'}
        title="Customer Support Inbox"
        style={{
          position: 'fixed',
          left: 'max(16px, env(safe-area-inset-left))',
          bottom: 'calc(max(16px, env(safe-area-inset-bottom)) + 12px)',
          zIndex: 100,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 14px',
          borderRadius: 999,
          background: 'linear-gradient(180deg, #0F1923 0%, #1D2D3E 100%)',
          color: 'var(--white, #fff)',
          border: '1px solid #C0B8A8',
          fontSize: '0.85rem',
          fontWeight: 700,
          letterSpacing: '0.02em',
          boxShadow: '0 4px 18px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255,255,255,0.15)',
          cursor: 'pointer',
        }}
      >
        <LifeBuoy size={16} aria-hidden="true" style={{ color: 'var(--teal, #00C4BC)' }} />
        Customer Support
        {totalUnread > 0 && (
          <span
            style={{
              minWidth: 20,
              height: 20,
              padding: '0 6px',
              borderRadius: 999,
              background: '#E53E3E',
              color: '#fff',
              fontSize: '0.7rem',
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: 2,
            }}
          >
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
      </button>

      {/* The expanded panel */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Customer Support Inbox"
          style={{
            position: 'fixed',
            left: 'max(16px, env(safe-area-inset-left))',
            bottom: 'calc(max(16px, env(safe-area-inset-bottom)) + 68px)',
            zIndex: 101,
            width: 'min(380px, calc(100vw - 32px))',
            maxHeight: 'min(560px, calc(100dvh - 140px))',
            display: 'flex',
            flexDirection: 'column',
            background: 'linear-gradient(180deg, #0F1923 0%, #050A0F 100%)',
            border: '1px solid rgba(0, 196, 188, 0.45)',
            borderRadius: 14,
            boxShadow: '0 22px 48px rgba(0,0,0,0.65), 0 0 0 1px rgba(0,196,188,0.10)',
            overflow: 'hidden',
          }}
        >
          <header
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 14px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              background:
                'linear-gradient(135deg, rgba(0,196,188,0.12) 0%, rgba(0,196,188,0.03) 100%)',
            }}
          >
            <LifeBuoy size={18} style={{ color: 'var(--teal, #00C4BC)' }} aria-hidden="true" />
            <strong style={{ color: 'var(--white, #fff)', fontSize: '0.95rem', flex: 1 }}>
              Customer Support Inbox
            </strong>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              style={{
                width: 28,
                height: 28,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: 'var(--silver, #C0B8A8)',
                cursor: 'pointer',
              }}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </header>

          {/* Body */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading && rows.length === 0 ? (
              <div
                style={{
                  padding: 'var(--space-6) var(--space-5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  color: 'var(--silver, #C0B8A8)',
                  fontSize: '0.86rem',
                }}
              >
                <Loader2 size={16} className="spin" aria-hidden="true" />
                Loading Threads…
              </div>
            ) : err ? (
              <div
                role="alert"
                style={{
                  margin: 14,
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: 'rgba(229, 62, 62, 0.10)',
                  border: '1px solid rgba(229, 62, 62, 0.35)',
                  color: '#FFAAAA',
                  fontSize: '0.82rem',
                }}
              >
                {err}
              </div>
            ) : rows.length === 0 ? (
              <div
                style={{
                  padding: '36px 18px',
                  textAlign: 'center',
                  color: 'var(--silver, #C0B8A8)',
                  fontSize: '0.88rem',
                  lineHeight: 1.5,
                }}
              >
                <strong
                  style={{
                    display: 'block',
                    color: 'var(--white, #fff)',
                    fontSize: '0.95rem',
                    marginBottom: 6,
                  }}
                >
                  No Open Support Threads
                </strong>
                Researchers Who Click The Support Button Will Show Up Here. Their
                Message Will Open A Thread Directly With You.
              </div>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {rows.map((row) => (
                  <li key={row.conversation_id}>
                    <button
                      type="button"
                      onClick={() => goToConversation(row.conversation_id)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '12px 14px',
                        background: 'transparent',
                        border: 'none',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        color: 'inherit',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                      }}
                    >
                      <span
                        aria-hidden
                        style={{
                          flexShrink: 0,
                          width: 38,
                          height: 38,
                          borderRadius: '50%',
                          background:
                            'linear-gradient(135deg, rgba(0,196,188,0.55) 0%, rgba(0,196,188,0.15) 100%)',
                          color: 'var(--black, #050A0F)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '0.85rem',
                          letterSpacing: '0.02em',
                          textTransform: 'uppercase',
                        }}
                      >
                        {otherName(row).slice(0, 2)}
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 8,
                          }}
                        >
                          <strong
                            style={{
                              color: 'var(--white, #fff)',
                              fontSize: '0.92rem',
                              fontWeight: row.unread_count > 0 ? 800 : 600,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {otherName(row)}
                          </strong>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              color: 'var(--grey-400, #A8B4C0)',
                              flexShrink: 0,
                            }}
                          >
                            {relTime(row.last_message_at)}
                          </span>
                        </span>
                        <span
                          style={{
                            display: 'block',
                            color: row.unread_count > 0 ? 'var(--white, #fff)' : 'var(--silver, #C0B8A8)',
                            fontSize: '0.8rem',
                            marginTop: 2,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontWeight: row.unread_count > 0 ? 600 : 400,
                          }}
                        >
                          {previewText(row)}
                        </span>
                      </span>
                      {row.unread_count > 0 ? (
                        <span
                          style={{
                            flexShrink: 0,
                            minWidth: 22,
                            height: 22,
                            padding: '0 7px',
                            borderRadius: 999,
                            background: '#E53E3E',
                            color: '#fff',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {row.unread_count > 99 ? '99+' : row.unread_count}
                        </span>
                      ) : (
                        <ChevronRight
                          size={16}
                          aria-hidden="true"
                          style={{ color: 'var(--silver, #C0B8A8)', opacity: 0.55, flexShrink: 0 }}
                        />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <footer
            style={{
              padding: '8px 12px',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              background: 'rgba(255,255,255,0.02)',
              fontSize: '0.72rem',
              color: 'var(--grey-400, #A8B4C0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <span>
              {rows.length} Thread{rows.length === 1 ? '' : 's'}
              {totalUnread > 0 ? ` · ${totalUnread} Unread` : ''}
            </span>
            <button
              type="button"
              onClick={() => fetchInbox()}
              disabled={loading}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.12)',
                color: 'var(--silver, #C0B8A8)',
                padding: '4px 8px',
                borderRadius: 6,
                fontSize: '0.72rem',
                cursor: loading ? 'wait' : 'pointer',
              }}
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </footer>
        </div>
      )}

      <style jsx>{`
        .spin { animation: cs-spin 1s linear infinite; }
        @keyframes cs-spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
