'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
}

/**
 * A two-party message thread between the signed-in user and one
 * counterpart. Row Level Security limits visible rows to the user's own
 * messages, so this component only ever renders the relevant thread.
 */
export default function Messaging({
  selfId,
  counterpartId,
  counterpartName,
}: {
  selfId: string;
  counterpartId: string;
  counterpartName: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    setError('');
    const supabase = createClient();
    const { data, error: loadError } = await supabase
      .from('messages')
      .select('id, sender_id, recipient_id, body, created_at')
      .or(
        `and(sender_id.eq.${selfId},recipient_id.eq.${counterpartId}),and(sender_id.eq.${counterpartId},recipient_id.eq.${selfId})`
      )
      .order('created_at', { ascending: true });

    if (loadError) {
      setError(loadError.message);
    } else {
      setMessages((data as Message[]) ?? []);
    }
    setLoading(false);
  }, [selfId, counterpartId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;

    setSending(true);
    const supabase = createClient();
    const { error: sendError } = await supabase.from('messages').insert({
      sender_id: selfId,
      recipient_id: counterpartId,
      body: text,
    });
    setSending(false);

    if (sendError) {
      setError(sendError.message);
      return;
    }
    setBody('');
    await loadMessages();
  }

  return (
    <div
      style={{
        background: 'var(--surface-2)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: 'var(--radius-lg)',
        display: 'flex',
        flexDirection: 'column',
        height: 460,
      }}
    >
      {/* Thread header */}
      <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--white)' }}>
          {counterpartName}
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--grey-400)' }}>Direct Messages</div>
      </div>

      {/* Messages */}
      <div style={{ flexGrow: 1, overflowY: 'auto', padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {loading ? (
          <div style={{ margin: 'auto' }}>
            <div style={{ width: 26, height: 26, borderRadius: '50%', border: '2px solid var(--teal)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : error ? (
          <p style={{ color: 'var(--red)', fontSize: '0.82rem' }}>{error}</p>
        ) : messages.length === 0 ? (
          <p style={{ color: 'var(--grey-400)', fontSize: '0.82rem', margin: 'auto', textAlign: 'center' }}>
            No Messages Yet. Send The First Message Below.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === selfId;
            return (
              <div
                key={m.id}
                style={{
                  alignSelf: mine ? 'flex-end' : 'flex-start',
                  maxWidth: '78%',
                  background: mine ? 'rgba(0,196,188,0.12)' : 'var(--surface-3)',
                  border: `1px solid ${mine ? 'rgba(0,196,188,0.3)' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-3) var(--space-4)',
                }}
              >
                <p style={{ fontSize: '0.85rem', color: 'var(--silver)', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {m.body}
                </p>
                <div style={{ fontSize: '0.66rem', color: 'var(--grey-500)', marginTop: 4, textAlign: 'right' }}>
                  {new Date(m.created_at).toLocaleString()}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Composer */}
      <form
        onSubmit={handleSend}
        style={{ display: 'flex', gap: 'var(--space-2)', padding: 'var(--space-4)', borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        <input
          type="text"
          className="form-input"
          placeholder="Write A Message..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          style={{ margin: 0, flexGrow: 1 }}
        />
        <button type="submit" className="btn btn-primary" disabled={sending || !body.trim()}>
          {sending ? 'Sending' : 'Send'}
        </button>
      </form>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
