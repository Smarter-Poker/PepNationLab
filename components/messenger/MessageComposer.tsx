'use client';
import { useCallback, useRef, useState } from 'react';
import { Send, Smile, Paperclip } from 'lucide-react';
import { toast } from 'sonner';
import { useMessengerStore } from '@/stores/messengerStore';
import type { Message } from '@/lib/messenger/types';
import EmojiPicker from './EmojiPicker';
import ReplyChip from './ReplyChip';

interface Props {
  conversationId: string;
  selfId: string;
  replyTo: Message | null;
  onClearReply: () => void;
}

const MAX_LEN = 2000;

export default function MessageComposer({ conversationId, selfId, replyTo, onClearReply }: Props) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const appendMessage = useMessengerStore((s) => s.appendMessage);
  const updateMessage = useMessengerStore((s) => s.updateMessage);
  const removeMessage = useMessengerStore((s) => s.removeMessage);

  const insertAtCursor = (chunk: string) => {
    const el = inputRef.current;
    if (!el) {
      setText((t) => t + chunk);
      return;
    }
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const next = text.slice(0, start) + chunk + text.slice(end);
    setText(next.slice(0, MAX_LEN));
    queueMicrotask(() => {
      el.focus();
      const pos = start + chunk.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    const tempId = `temp-${crypto.randomUUID()}`;
    const optimistic: Message = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: selfId,
      text: trimmed,
      message_type: 'text',
      media_url: null,
      media_metadata: {},
      reply_to_id: replyTo?.id ?? null,
      thread_parent_id: null,
      is_edited: false,
      is_deleted: false,
      delete_scope: null,
      priority: 'normal',
      status: 'sent',
      labels: [],
      expires_at: null,
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    appendMessage(conversationId, optimistic);
    setText('');
    onClearReply();
    setSending(true);

    try {
      const res = await fetch('/api/messenger/send-message', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          text: trimmed,
          messageType: 'text',
          replyToId: replyTo?.id,
        }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        updateMessage(conversationId, {
          ...optimistic,
          metadata: { ...optimistic.metadata, failed: true },
        });
        toast(json.error ?? 'Send Failed');
        return;
      }
      const json = (await res.json()) as { message: Message };
      removeMessage(conversationId, tempId);
      appendMessage(conversationId, json.message);
    } catch {
      updateMessage(conversationId, {
        ...optimistic,
        metadata: { ...optimistic.metadata, failed: true },
      });
      toast('Network Error');
    } finally {
      setSending(false);
    }
  }, [text, sending, conversationId, selfId, replyTo, appendMessage, updateMessage, removeMessage, onClearReply]);

  return (
    <div
      style={{
        borderTop: '1px solid var(--surface-3, #1D2D3E)',
        padding: 12,
        background: 'var(--surface-1, #0F1923)',
        position: 'relative',
      }}
    >
      {replyTo && <ReplyChip replyTo={replyTo} onClear={onClearReply} />}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
        <button
          type="button"
          onClick={() => toast('Attachments Ship In Phase 7')}
          style={iconBtn}
          aria-label="Attach File"
          title="Attach File"
        >
          <Paperclip size={18} />
        </button>
        <button
          type="button"
          onClick={() => setShowEmoji((v) => !v)}
          style={iconBtn}
          aria-label="Insert Emoji"
          title="Insert Emoji"
        >
          <Smile size={18} />
        </button>
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          placeholder="Type A Message"
          maxLength={MAX_LEN}
          rows={1}
          aria-label="Message Body"
          style={{
            flex: 1,
            resize: 'none',
            minHeight: 40,
            maxHeight: 160,
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid var(--surface-3, #1D2D3E)',
            background: 'var(--surface-2, #162230)',
            color: 'var(--white, #FFFFFF)',
            fontFamily: 'inherit',
            fontSize: '0.95rem',
            outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={!text.trim() || sending}
          aria-label="Send Message"
          title="Send Message"
          style={{
            ...iconBtn,
            background: 'var(--teal, #00C4BC)',
            color: '#000',
            opacity: !text.trim() || sending ? 0.5 : 1,
          }}
        >
          <Send size={18} />
        </button>
      </div>
      <div
        style={{
          fontSize: '0.72rem',
          color: 'var(--grey-400, #A8B4C0)',
          textAlign: 'right',
          marginTop: 4,
        }}
      >
        {text.length} / {MAX_LEN}
      </div>
      {showEmoji && <EmojiPicker onPick={insertAtCursor} onClose={() => setShowEmoji(false)} />}
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--surface-3, #1D2D3E)',
  borderRadius: 10,
  width: 40,
  height: 40,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  color: 'var(--white, #FFFFFF)',
};
