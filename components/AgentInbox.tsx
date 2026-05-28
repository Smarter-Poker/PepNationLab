'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface InternalMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  subject: string;
  body: string;
  type: string;
  is_read: boolean;
  attachment_url: string | null;
  created_at: string;
  sender_profile?: {
    full_name: string | null;
    email: string;
  };
}

export default function AgentInbox({ agentId }: { agentId: string }) {
  const [messages, setMessages] = useState<InternalMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'invoice' | 'notification' | 'direct_message'>('all');

  const loadInbox = useCallback(async () => {
    setLoading(true);
    setError('');
    const supabase = createClient();
    const { data, error: fetchError } = await supabase
      .from('internal_messages')
      .select('*, sender_profile:profiles!internal_messages_sender_id_fkey(full_name, email)')
      .eq('receiver_id', agentId)
      .order('created_at', { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setMessages(data as any[]);
    }
    setLoading(false);
  }, [agentId]);

  useEffect(() => {
    loadInbox();
  }, [loadInbox]);

  const filtered = activeFilter === 'all' ? messages : messages.filter(m => m.type === activeFilter);

  const counts = {
    all: messages.length,
    invoice: messages.filter(m => m.type === 'invoice').length,
    notification: messages.filter(m => m.type === 'notification').length,
    direct_message: messages.filter(m => m.type === 'direct_message').length,
  };

  const senderInitials = (msg: InternalMessage) => {
    const name = msg.sender_profile?.full_name || msg.sender_profile?.email || '?';
    return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  };

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just Now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  const typeConfig: Record<string, { icon: string; color: string; gradient: string }> = {
    invoice: { icon: '💰', color: 'var(--teal)', gradient: 'linear-gradient(135deg, #00C4BC 0%, #0099FF 100%)' },
    notification: { icon: '🔔', color: '#63B3ED', gradient: 'linear-gradient(135deg, #63B3ED 0%, #805AD5 100%)' },
    direct_message: { icon: '💬', color: 'rgba(255,255,255,0.5)', gradient: 'linear-gradient(135deg, #374151 0%, #4B5563 100%)' },
  };

  const filters: { key: 'all' | 'invoice' | 'notification' | 'direct_message'; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'invoice', label: 'Invoices' },
    { key: 'notification', label: 'Notifications' },
    { key: 'direct_message', label: 'Messages' },
  ];

  if (loading) {
    return (
      <div style={{
        background: '#0a0f1a', borderRadius: 16, padding: 32,
        border: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          border: '2.5px solid rgba(0,196,188,0.2)', borderTopColor: 'var(--teal)',
          animation: 'spin 0.8s linear infinite',
        }} />
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.82rem' }}>Loading Inbox...</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{
      background: '#0a0f1a', borderRadius: 16, overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.06)',
      boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
    }}>
      {/* Header */}
      <div style={{
        padding: '18px 24px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        background: 'rgba(255,255,255,0.01)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{
              fontSize: '1.1rem', margin: 0, color: '#fff',
              fontFamily: 'var(--font-brand)',
              letterSpacing: '0.04em', fontWeight: 800,
            }}>
              INBOX
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.78rem', margin: '4px 0 0' }}>
              Invoices, Notifications, And Messages
            </p>
          </div>
          <button
            onClick={loadInbox}
            style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 8, padding: '6px 12px', cursor: 'pointer',
              color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 6,
              transition: 'background 0.2s, color 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,196,188,0.08)'; e.currentTarget.style.color = 'var(--teal)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{
        display: 'flex', gap: 4, padding: '12px 24px',
        borderBottom: '1px solid rgba(255,255,255,0.03)',
        background: 'rgba(255,255,255,0.01)',
      }}>
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setActiveFilter(f.key)}
            style={{
              padding: '6px 14px', borderRadius: 8,
              border: 'none', cursor: 'pointer',
              fontSize: '0.75rem', fontWeight: activeFilter === f.key ? 700 : 500,
              background: activeFilter === f.key ? 'rgba(0,196,188,0.1)' : 'transparent',
              color: activeFilter === f.key ? 'var(--teal)' : 'rgba(255,255,255,0.35)',
              transition: 'all 0.15s',
            }}
          >
            {f.label}
            {counts[f.key] > 0 && (
              <span style={{
                marginLeft: 5, fontSize: '0.62rem', fontWeight: 700,
                background: activeFilter === f.key ? 'rgba(0,196,188,0.2)' : 'rgba(255,255,255,0.05)',
                padding: '1px 6px', borderRadius: 4,
              }}>
                {counts[f.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <div style={{
          margin: '16px 24px', background: 'rgba(229,62,62,0.06)',
          border: '1px solid rgba(229,62,62,0.15)', borderRadius: 10,
          padding: '10px 14px', fontSize: '0.82rem', color: '#FC8181',
        }}>
          {error}
        </div>
      )}

      {/* Messages */}
      <div style={{ maxHeight: 500, overflowY: 'auto' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'rgba(255,255,255,0.02)', margin: '0 auto 14px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
            </div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.88rem', fontWeight: 600 }}>No Messages</div>
            <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.75rem', marginTop: 4 }}>
              {activeFilter === 'all' ? 'Your inbox is empty' : `No ${activeFilter.replace('_', ' ')}s found`}
            </div>
          </div>
        ) : (
          filtered.map((msg, i) => {
            const cfg = typeConfig[msg.type] || typeConfig.direct_message;
            return (
              <div
                key={msg.id}
                style={{
                  display: 'flex', gap: 14,
                  padding: '14px 24px',
                  borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                  background: !msg.is_read ? 'rgba(0,196,188,0.02)' : 'transparent',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                onMouseLeave={e => (e.currentTarget.style.background = !msg.is_read ? 'rgba(0,196,188,0.02)' : 'transparent')}
              >
                {/* Type avatar */}
                <div style={{
                  width: 42, height: 42, borderRadius: '50%',
                  background: cfg.gradient,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1rem', flexShrink: 0,
                }}>
                  {cfg.icon}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
                    <span style={{
                      fontSize: '0.85rem', fontWeight: !msg.is_read ? 700 : 500,
                      color: !msg.is_read ? cfg.color : 'rgba(255,255,255,0.6)',
                    }}>
                      {msg.subject}
                    </span>
                    <span style={{
                      fontSize: '0.68rem', color: 'rgba(255,255,255,0.2)',
                      fontWeight: 500, flexShrink: 0, marginLeft: 8,
                    }}>
                      {timeAgo(msg.created_at)}
                    </span>
                  </div>
                  <div style={{
                    fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)',
                    whiteSpace: 'pre-wrap', lineHeight: 1.5,
                    display: '-webkit-box', WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical' as const, overflow: 'hidden',
                  }}>
                    {msg.body}
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    marginTop: 6, fontSize: '0.7rem', color: 'rgba(255,255,255,0.2)',
                  }}>
                    <span>From: {msg.sender_profile?.full_name || msg.sender_profile?.email || 'System'}</span>
                    {msg.attachment_url && (
                      <>
                        <span>·</span>
                        <a
                          href={msg.attachment_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'var(--teal)', textDecoration: 'none', fontWeight: 600 }}
                        >
                          📎 Attachment
                        </a>
                      </>
                    )}
                    {!msg.is_read && (
                      <div style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: 'var(--teal)',
                        boxShadow: '0 0 4px rgba(0,196,188,0.4)',
                        marginLeft: 'auto',
                      }} />
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
