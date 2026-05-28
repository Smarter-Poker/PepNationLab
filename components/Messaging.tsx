'use client';

import { useState, useEffect, useCallback } from 'react';
import { Paperclip } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  body: string;
  subject: string;
  attachment_url: string | null;
  type: string;
  is_read: boolean;
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
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [sending, setSending] = useState(false);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    setError('');
    const supabase = createClient();
    const { data, error: loadError } = await supabase
      .from('internal_messages')
      .select('id, sender_id, receiver_id, body, subject, attachment_url, type, is_read, created_at')
      .or(
        `and(sender_id.eq.${selfId},receiver_id.eq.${counterpartId}),and(sender_id.eq.${counterpartId},receiver_id.eq.${selfId})`
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
    if (!text && !attachmentUrl) return;

    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiverId: counterpartId,
          subject: 'Direct Message',
          body: text,
          type: 'direct_message',
          attachmentUrl: attachmentUrl || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed To Send');
      setBody('');
      setAttachmentUrl(null);
      await loadMessages();
    } catch (err: any) {
      setError(err.message || 'Failed To Send Message');
    } finally {
      setSending(false);
    }
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
                <div style={{ fontSize: '0.85rem', color: 'var(--silver)', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {m.type === 'invoice' && (
                    <div style={{ marginBottom: 'var(--space-2)', fontWeight: 'bold', color: 'var(--teal)' }}>[INVOICE] {m.subject}</div>
                  )}
                  {m.type === 'notification' && (
                    <div style={{ marginBottom: 'var(--space-2)', fontWeight: 'bold', color: '#63B3ED' }}>[NOTIFICATION] {m.subject}</div>
                  )}
                  {m.body}
                </div>
                {m.attachment_url && (
                  <div style={{ marginTop: 'var(--space-2)' }}>
                    <a href={m.attachment_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--teal)', fontSize: '0.8rem', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Paperclip size={14} aria-hidden="true" /> View Attachment
                    </a>
                  </div>
                )}
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
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', padding: 'var(--space-4)', borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        {attachmentUrl && (
          <div style={{ fontSize: '0.8rem', color: 'var(--teal)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Paperclip size={14} aria-hidden="true" /> Attachment Attached
            <button type="button" onClick={() => setAttachmentUrl(null)} style={{ background: 'transparent', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: '0.8rem' }}>
              Remove
            </button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <label className="btn btn-secondary" style={{ padding: '0 var(--space-3)', cursor: 'pointer', opacity: uploadingFile ? 0.5 : 1 }}>
            {uploadingFile ? '...' : <Paperclip size={16} aria-hidden="true" />}
            <input 
              type="file" 
              style={{ display: 'none' }}
              disabled={uploadingFile || sending}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploadingFile(true);
                setError('');
                try {
                  const supabase = createClient();
                  const fileExt = file.name.split('.').pop();
                  const fileName = `${selfId}-${Math.random().toString(36).substring(2)}.${fileExt}`;
                  const { error: uploadError } = await supabase.storage
                    .from('message-attachments')
                    .upload(fileName, file);
                  if (uploadError) throw uploadError;
                  const { data } = supabase.storage.from('message-attachments').getPublicUrl(fileName);
                  setAttachmentUrl(data.publicUrl);
                } catch (err: any) {
                  setError(err.message || 'Failed to upload attachment');
                } finally {
                  setUploadingFile(false);
                }
              }}
            />
          </label>
          <input
            type="text"
            className="form-input"
            placeholder="Write A Message..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            style={{ margin: 0, flexGrow: 1 }}
          />
          <button type="submit" className="btn btn-primary" disabled={sending || uploadingFile || (!body.trim() && !attachmentUrl)}>
            {sending ? 'Sending' : 'Send'}
          </button>
        </div>
      </form>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
