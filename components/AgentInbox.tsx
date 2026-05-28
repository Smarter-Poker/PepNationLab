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

  const loadInbox = useCallback(async () => {
    setLoading(true);
    setError('');
    const supabase = createClient();
    
    // Fetch messages where agent is the receiver
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

  if (loading) {
    return (
      <div className="card-metal" style={{ padding: 'var(--space-6)' }}>
        <h3 style={{ fontSize: '1.1rem', color: 'var(--white)', marginBottom: 'var(--space-2)', fontFamily: 'var(--font-brand)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          System Inbox & Notifications
        </h3>
        <p style={{ color: 'var(--grey-400)', fontSize: '0.85rem', marginBottom: 'var(--space-6)' }}>
          View invoices, alerts, and system notifications here.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: '100px', width: '100%' }}></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card-metal" style={{ padding: 'var(--space-6)' }}>
      <h3 style={{ fontSize: '1.1rem', color: 'var(--white)', marginBottom: 'var(--space-2)', fontFamily: 'var(--font-brand)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        System Inbox & Notifications
      </h3>
      <p style={{ color: 'var(--grey-400)', fontSize: '0.85rem', marginBottom: 'var(--space-6)' }}>
        View invoices, alerts, and system notifications here.
      </p>

      {error && (
        <div style={{ background: 'rgba(229,62,62,0.1)', border: '1px solid rgba(229,62,62,0.3)', padding: '12px', borderRadius: '8px', color: 'var(--red)', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {messages.length === 0 ? (
        <div style={{ padding: 'var(--space-8)', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: '1px dashed rgba(255,255,255,0.1)' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--grey-600)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 16px' }}>
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
          </svg>
          <div style={{ color: 'var(--grey-400)', fontSize: '0.95rem' }}>Your inbox is empty.</div>
          <div style={{ color: 'var(--grey-600)', fontSize: '0.8rem', marginTop: 4 }}>System notifications and messages will appear here.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {messages.map((msg) => (
            <div key={msg.id} style={{ 
              background: 'rgba(22, 34, 48, 0.4)', 
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.05)', 
              borderRadius: 'var(--radius-md)', 
              padding: 'var(--space-4)',
              transition: 'all 0.2s ease'
            }} className="message-card-hover">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <strong style={{ color: 'var(--teal)' }}>{msg.subject}</strong>
                <span style={{ fontSize: '0.75rem', color: 'var(--grey-400)' }}>
                  {new Date(msg.created_at).toLocaleString()}
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--grey-400)', marginBottom: '12px', whiteSpace: 'pre-wrap' }}>
                {msg.body}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--silver)' }}>
                  From: {msg.sender_profile?.full_name || msg.sender_profile?.email || 'System'}
                </span>
                <span className="badge badge-silver" style={{ fontSize: '0.7rem' }}>
                  {msg.type}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
