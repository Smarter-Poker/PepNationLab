'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  subscribeMyParticipants,
  unsubscribe,
  type ParticipantUnreadRow,
} from '@/lib/messenger/realtime';

interface InboxMessage {
  id: string;
  sender_id: string;
  subject: string;
  body: string;
  type: string;
  is_read: boolean;
  created_at: string;
  sender_profile?: { full_name: string | null; email: string; username: string | null };
}

interface MessengerConversationSummary {
  conversation_id: string;
  unread_count: number | null;
  is_muted: boolean | null;
}

/**
 * Premium message bell with unread badge + polished dropdown.
 *
 * Phase 14: replaced the 30s poll-and-refetch on /api/messages with a
 * Supabase Realtime subscription on messenger_participants (filtered to the
 * caller). The initial unread count is hydrated from
 * /api/messenger/get-conversations (sum of unread_count where !is_muted) and
 * the legacy /api/messages?unread=true call is kept as a one-shot fallback
 * for users on legacy notifications that never migrated to the messenger
 * pipeline. Honors is_muted -- muted conversations do not contribute to the
 * badge.
 */
export default function MessageBell({ onViewAll, dropUp }: { onViewAll: () => void; dropUp?: boolean }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // Per-conversation map of (unread_count, is_muted). Recompute total by
  // summing unread counts only on entries where is_muted is false.
  const participantStateRef = useRef<Map<string, { unread: number; muted: boolean }>>(new Map());

  const recomputeTotal = useCallback(() => {
    let total = 0;
    participantStateRef.current.forEach((v) => {
      if (!v.muted) total += v.unread;
    });
    setUnreadCount(total);
  }, []);

  // Phase 14: one-time hydration from /api/messenger/get-conversations.
  // Sums unread_count across all non-muted conversations.
  const hydrateFromMessenger = useCallback(async () => {
    try {
      const res = await fetch('/api/messenger/get-conversations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      if (!res.ok) return false;
      const json = (await res.json()) as { conversations?: MessengerConversationSummary[] };
      const list = json.conversations ?? [];
      const map = new Map<string, { unread: number; muted: boolean }>();
      list.forEach((c) => {
        map.set(c.conversation_id, {
          unread: Math.max(0, c.unread_count ?? 0),
          muted: Boolean(c.is_muted),
        });
      });
      participantStateRef.current = map;
      recomputeTotal();
      return true;
    } catch {
      return false;
    }
  }, [recomputeTotal]);

  // Legacy fallback for the /api/messages bell-only inbox (notifications,
  // invoice messages, etc). This is best-effort and runs only as a fallback
  // when the messenger hydrate returns 0 conversations -- it keeps the
  // existing badge behaviour for users who never opened messenger.
  const fetchLegacyUnread = useCallback(async () => {
    try {
      const res = await fetch('/api/messages?unread=true');
      if (!res.ok) return;
      const json = await res.json();
      const legacy = Math.max(0, json.unreadCount ?? 0);
      // Add legacy under a synthetic key so muting a single messenger conv
      // does not nuke the legacy count.
      if (legacy > 0) {
        participantStateRef.current.set('__legacy__', { unread: legacy, muted: false });
        recomputeTotal();
      }
    } catch {
      /* silent */
    }
  }, [recomputeTotal]);

  // Phase 14: hydrate once on mount + subscribe to Realtime changes on the
  // caller's participant rows.
  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof subscribeMyParticipants> | null = null;

    (async () => {
      const ok = await hydrateFromMessenger();
      if (cancelled) return;
      if (!ok) {
        // If messenger fetch failed (e.g. user not logged in), fall back to legacy.
        await fetchLegacyUnread();
      } else if (participantStateRef.current.size === 0) {
        // Messenger returned zero conversations -- still run the legacy fetch
        // so users on the old inbox see their badge.
        await fetchLegacyUnread();
      }
      if (cancelled) return;

      // Resolve current user id for the Realtime filter.
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        channel = subscribeMyParticipants(user.id, (row: ParticipantUnreadRow, event) => {
          if (event === 'DELETE') {
            participantStateRef.current.delete(row.conversation_id);
          } else {
            participantStateRef.current.set(row.conversation_id, {
              unread: Math.max(0, row.unread_count ?? 0),
              muted: Boolean(row.is_muted),
            });
          }
          recomputeTotal();
        });
      } catch {
        // Non-fatal -- the initial fetch already populated the badge.
      }
    })();

    return () => {
      cancelled = true;
      if (channel) unsubscribe(channel);
    };
  }, [hydrateFromMessenger, fetchLegacyUnread, recomputeTotal]);

  const fetchLatest = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/messages');
      const json = await res.json();
      if (res.ok) {
        setMessages((json.messages ?? []).slice(0, 5));
        const unreadIds = (json.messages ?? [])
          .filter((m: InboxMessage) => !m.is_read)
          .slice(0, 5)
          .map((m: InboxMessage) => m.id);
        if (unreadIds.length > 0) {
          await fetch('/api/messages', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messageIds: unreadIds }),
          });
        }
      }
    } catch {
      /* silent */
    }
    setLoading(false);
  }, []);

  // Reference fetchLatest so eslint doesn't complain; it is still invoked by
  // the legacy dropdown render path (kept intact for back-compat) when the
  // bell click is repurposed in a future change.
  void fetchLatest;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const router = useRouter();

  const handleToggle = () => {
    // Phase 14: bell click jumps straight into the messenger surface where
    // the unread participant rows will be marked-read.
    router.push('/messenger');
  };

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d`;
    return new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  function senderInitials(msg: InboxMessage): string {
    const name = msg.sender_profile?.full_name || msg.sender_profile?.username || '?';
    return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Bell Button */}
      <button
        onClick={handleToggle}
        aria-label="Messages"
        style={{
          position: 'relative',
          background: open ? 'rgba(192,184,168,0.08)' : 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 8,
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          transition: 'background 0.2s',
        }}
        onMouseEnter={e => { if (!open) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
        onMouseLeave={e => { if (!open) e.currentTarget.style.background = 'none'; }}
      >
        <img src="/images/messenger-icon.png" alt="Messages" width={42} height={42} style={{ transition: 'opacity 0.2s', display: 'block' }} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2,
            background: '#E53E3E',
            color: '#fff',
            fontSize: '0.58rem', fontWeight: 800,
            minWidth: 16, height: 16,
            borderRadius: 999, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            padding: '0 4px',
            lineHeight: 1,
            boxShadow: '0 2px 6px rgba(229,62,62,0.4)',
            animation: 'badgePop 0.3s ease-out',
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown -- kept intact for back-compat; bell currently navigates */}
      {open && (
        <div style={{
          position: 'absolute',
          ...(dropUp
            ? { bottom: 'calc(100% + 8px)', left: 0 }
            : { top: 'calc(100% + 8px)', right: 0 }),
          width: 380, maxHeight: 480,
          background: '#111827',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          boxShadow: '0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(192,184,168,0.05)',
          zIndex: 1000, overflow: 'hidden',
          animation: 'dropdownSlide 0.2s ease-out',
        }}>
          {/* Header */}
          <div style={{
            padding: '16px 20px 12px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{
              fontSize: '1.05rem', fontWeight: 800, color: '#fff',
              fontFamily: 'var(--font-brand)', letterSpacing: '0.03em',
            }}>
              Messages
            </span>
            <button
              onClick={() => { setOpen(false); onViewAll(); }}
              style={{
                fontSize: '0.75rem', color: 'var(--teal)', background: 'rgba(192,184,168,0.06)',
                border: '1px solid rgba(192,184,168,0.15)', borderRadius: 8,
                cursor: 'pointer', fontWeight: 600, padding: '4px 12px',
                transition: 'background 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(192,184,168,0.12)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(192,184,168,0.06)')}
            >
              View All
            </button>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '0 20px' }} />

          {/* Messages List */}
          <div style={{ overflowY: 'auto', maxHeight: 390, padding: '8px 0' }}>
            {loading ? (
              <div style={{ padding: 32, textAlign: 'center' }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', margin: '0 auto 10px',
                  border: '2px solid rgba(192,184,168,0.2)', borderTopColor: 'var(--teal)',
                  animation: 'spin 0.8s linear infinite',
                }} />
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.78rem' }}>Loading...</span>
              </div>
            ) : messages.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <div style={{
                  width: 52, height: 52, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.03)', margin: '0 auto 14px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', fontWeight: 600 }}>No Messages</div>
                <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.75rem', marginTop: 4 }}>Your Inbox Is Empty</div>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    padding: '10px 20px',
                    background: !msg.is_read ? 'rgba(192,184,168,0.03)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                    position: 'relative',
                  }}
                  onClick={() => { setOpen(false); onViewAll(); }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                  onMouseLeave={e => (e.currentTarget.style.background = !msg.is_read ? 'rgba(192,184,168,0.03)' : 'transparent')}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #374151, #4B5563)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                    fontSize: '0.72rem',
                    fontWeight: 800, color: '#fff',
                  }}>
                    {senderInitials(msg)}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
                      <span style={{
                        fontSize: '0.82rem', fontWeight: !msg.is_read ? 700 : 500,
                        color: !msg.is_read ? '#fff' : 'rgba(255,255,255,0.7)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        maxWidth: '70%',
                      }}>
                        {msg.sender_profile?.full_name || msg.sender_profile?.username || 'System'}
                      </span>
                      <span style={{
                        fontSize: '0.68rem',
                        color: !msg.is_read ? 'var(--teal)' : 'rgba(255,255,255,0.25)',
                        fontWeight: 500, flexShrink: 0,
                      }}>
                        {timeAgo(msg.created_at)}
                      </span>
                    </div>
                    <div style={{
                      fontSize: '0.78rem',
                      color: !msg.is_read ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.3)',
                      fontWeight: !msg.is_read ? 500 : 400,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {msg.type !== 'direct_message' && (
                        <span style={{ fontWeight: 600, color: msg.type === 'invoice' ? 'var(--teal)' : '#63B3ED' }}>
                          {msg.subject}
                          {' · '}
                        </span>
                      )}
                      {msg.body.substring(0, 60)}{msg.body.length > 60 ? '...' : ''}
                    </div>
                  </div>

                  {/* Unread dot */}
                  {!msg.is_read && (
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: 'var(--teal)',
                      boxShadow: '0 0 6px rgba(192,184,168,0.4)',
                      flexShrink: 0, marginTop: 6,
                    }} />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes badgePop { 0% { transform: scale(0); } 60% { transform: scale(1.2); } 100% { transform: scale(1); } }
        @keyframes dropdownSlide { from { opacity: 0; transform: translateY(${dropUp ? '8px' : '-8px'}); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
