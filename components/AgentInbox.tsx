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
    invoice: { icon: '💰', color: 'var(--teal)', gradient: 'linear-gradient(135deg, #C0B8A8 0%, #0099FF 100%)' },
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
          border: '2.5px solid rgba(192,184,168,0.2)', borderTopColor: 'var(--teal)',
          animation: 'spin 0.8s linear infinite',
        }} />
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.82rem' }}>Loading Inbox...</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div className="glass-panel">
      <div className="" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div>
            <h3 className="metal-text" style={{
              fontSize: '1.25rem', margin: 0,
              fontFamily: 'var(--font-brand)',
              letterSpacing: '0.04em', fontWeight: 800, textTransform: 'uppercase'
            }}>
              Inbox
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.82rem', margin: '4px 0 0' }}>
              Invoices, Notifications, And Messages
            </p>
          </div>
          <button
            onClick={loadInbox}
            className="btn-silver"
            style={{
              padding: '6px 12px', fontSize: '0.75rem',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            Refresh
          </button>
        </div>

        {/* Filter Tabs */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              style={{
                padding: '8px 16px', borderRadius: '4px',
                border: activeFilter === f.key ? '1px solid rgba(0,229,255,0.3)' : '1px solid rgba(255,255,255,0.1)',
                cursor: 'pointer',
                fontSize: '0.8rem', fontWeight: activeFilter === f.key ? 700 : 500,
                background: activeFilter === f.key ? 'rgba(0,229,255,0.1)' : 'rgba(0,0,0,0.5)',
                color: activeFilter === f.key ? '#00E5FF' : 'rgba(255,255,255,0.4)',
                transition: 'all 0.15s',
              }}
            >
              {f.label}
              {counts[f.key] > 0 && (
                <span style={{
                  marginLeft: 6, fontSize: '0.65rem', fontWeight: 700,
                  background: activeFilter === f.key ? 'rgba(0,229,255,0.2)' : 'rgba(255,255,255,0.1)',
                  padding: '2px 6px', borderRadius: '4px',
                }}>
                  {counts[f.key]}
                </span>
              )}
            </button>
          ))}
        </div>

        {error && (
          <div className="glass-panel" style={{ border: '1px solid rgba(229,62,62,0.3)', padding: '10px 14px', fontSize: '0.82rem', color: '#FFAAAA' }}>
            {error}
          </div>
        )}

        {/* Messages */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', maxHeight: 600, overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <div className="glass-panel" style={{ padding: '48px 24px', textAlign: 'center' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'rgba(255,255,255,0.02)', margin: '0 auto 14px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid rgba(255,255,255,0.05)'
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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
                  className="glass-panel"
                  style={{
                    display: 'flex', gap: 14,
                    padding: '16px 20px',
                    borderLeft: !msg.is_read ? '3px solid #00E5FF' : '1px solid rgba(0,0,0,0.5)',
                  }}
                >
                  {/* Type avatar */}
                  <div style={{
                    width: 42, height: 42, borderRadius: '50%',
                    background: cfg.gradient,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.2rem', flexShrink: 0,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}>
                    {cfg.icon}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                      <span style={{
                        fontSize: '0.9rem', fontWeight: !msg.is_read ? 700 : 500,
                        color: !msg.is_read ? '#00E5FF' : 'rgba(255,255,255,0.8)',
                      }}>
                        {msg.subject}
                      </span>
                      <span style={{
                        fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)',
                        fontWeight: 500, flexShrink: 0, marginLeft: 8,
                      }}>
                        {timeAgo(msg.created_at)}
                      </span>
                    </div>
                    <div style={{
                      fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)',
                      whiteSpace: 'pre-wrap', lineHeight: 1.5,
                      display: '-webkit-box', WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical' as const, overflow: 'hidden',
                    }}>
                      {msg.body}
                    </div>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      marginTop: 10, fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)',
                    }}>
                      <span>From: {msg.sender_profile?.full_name || msg.sender_profile?.email || 'System'}</span>
                      {msg.attachment_url && (
                        <>
                          <span>·</span>
                          <a
                            href={msg.attachment_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#00E5FF', textDecoration: 'none', fontWeight: 600 }}
                          >
                            📎 Attachment
                          </a>
                        </>
                      )}
                      {!msg.is_read && (
                        <div style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: '#00E5FF',
                          boxShadow: '0 0 8px #00E5FF',
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
    </div>
  );
}
