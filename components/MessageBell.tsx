'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

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

/**
 * A bell icon with unread badge + dropdown for the header.
 * - `onViewAll`: callback when "View All Messages" is clicked (e.g. navigate or switch tab)
 */
export default function MessageBell({ onViewAll, dropUp }: { onViewAll: () => void; dropUp?: boolean }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Fetch unread count on mount + poll every 30s
  const fetchUnread = useCallback(async () => {
    try {
      const res = await fetch('/api/messages?unread=true');
      const json = await res.json();
      if (res.ok) setUnreadCount(json.unreadCount ?? 0);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [fetchUnread]);

  // Fetch latest messages when dropdown opens
  const fetchLatest = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/messages');
      const json = await res.json();
      if (res.ok) {
        setMessages((json.messages ?? []).slice(0, 5));
        // Mark unread ones as read
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
          setUnreadCount(prev => Math.max(0, prev - unreadIds.length));
        }
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next) fetchLatest();
  };

  const typeColor: Record<string, string> = {
    invoice: 'var(--teal)',
    notification: '#63B3ED',
    direct_message: 'var(--silver)',
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Bell Button */}
      <button
        onClick={handleToggle}
        aria-label="Messages"
        style={{
          position: 'relative',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 6,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--silver)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 0, right: 0,
            background: 'var(--red)', color: 'var(--white)',
            fontSize: '0.6rem', fontWeight: 800,
            minWidth: 16, height: 16,
            borderRadius: 999, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            padding: '0 4px',
            lineHeight: 1,
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute',
          ...(dropUp
            ? { bottom: 'calc(100% + 8px)', right: 0 }
            : { top: 'calc(100% + 8px)', right: 0 }),
          width: 360, maxHeight: 440,
          background: 'var(--grey-900)', border: '1px solid rgba(0,196,188,0.2)',
          borderRadius: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
          zIndex: 1000, overflow: 'hidden',
          animation: 'fadeIn 0.15s ease-out',
        }}>
          {/* Header */}
          <div style={{
            padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--white)', fontFamily: 'var(--font-brand)', letterSpacing: '0.05em' }}>
              Messages
            </span>
            <button
              onClick={() => { setOpen(false); onViewAll(); }}
              style={{ fontSize: '0.72rem', color: 'var(--teal)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
            >
              View All →
            </button>
          </div>

          {/* Messages List */}
          <div style={{ overflowY: 'auto', maxHeight: 360 }}>
            {loading ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--grey-400)', fontSize: '0.82rem' }}>Loading...</div>
            ) : messages.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center' }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--grey-600)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px', display: 'block' }}>
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                <div style={{ color: 'var(--grey-400)', fontSize: '0.82rem' }}>No Messages Yet</div>
              </div>
            ) : (
              messages.map(msg => (
                <div
                  key={msg.id}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                    background: msg.is_read ? 'transparent' : 'rgba(0,196,188,0.04)',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                  onClick={() => { setOpen(false); onViewAll(); }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                  onMouseLeave={e => (e.currentTarget.style.background = msg.is_read ? 'transparent' : 'rgba(0,196,188,0.04)')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: typeColor[msg.type] || 'var(--silver)' }}>
                      {msg.type === 'invoice' ? '💰 ' : msg.type === 'notification' ? '🔔 ' : ''}
                      {msg.subject}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--grey-400)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 4 }}>
                    {msg.body.substring(0, 80)}{msg.body.length > 80 ? '...' : ''}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--grey-500)' }}>
                    <span>From: {msg.sender_profile?.full_name || msg.sender_profile?.username || 'System'}</span>
                    <span>{timeAgo(msg.created_at)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just Now';
  if (mins < 60) return `${mins}m Ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h Ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d Ago`;
  return new Date(dateStr).toLocaleDateString();
}
