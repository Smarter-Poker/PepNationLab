'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Send, Smile, Paperclip, Image as ImageIcon, FileText, Calendar, Clock, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { useMessengerStore } from '@/stores/messengerStore';
import type { Message, MessageType } from '@/lib/messenger/types';
import EmojiPicker from './EmojiPicker';
import ReplyChip from './ReplyChip';
import AttachMenu from './AttachMenu';
import VoiceRecorder from './VoiceRecorder';
import GifPicker from './GifPicker';
import TemplatesMenu from './TemplatesMenu';
import ScheduledMessageList from './ScheduledMessageList';
import ExpiryPicker from './ExpiryPicker';
import { subscribeTyping, unsubscribe } from '@/lib/messenger/realtime';

interface Props {
  conversationId: string;
  selfId: string;
  replyTo: Message | null;
  onClearReply: () => void;
}

const MAX_LEN = 2000;
const TYPING_THROTTLE_MS = 1500;
const TYPING_STOP_MS = 3000;
const ADMIN_MENTION_RE = /(^|\s)@admin(\s|$|[.,!?;:])/i;

interface UploadResult { uploadUrl: string; publicUrl: string; path: string }

async function getSignedUpload(contentType: string, bytes: number): Promise<UploadResult | null> {
  const res = await fetch('/api/messenger/upload-media', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ contentType, bytes }),
  });
  if (!res.ok) return null;
  return (await res.json()) as UploadResult;
}

async function putBlob(uploadUrl: string, blob: Blob, contentType: string): Promise<boolean> {
  try {
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'content-type': contentType, 'x-upsert': 'true' },
      body: blob,
    });
    return res.ok;
  } catch {
    return false;
  }
}

function formatExpirySummary(seconds: number | null): string {
  if (seconds === null) return 'No Expiry';
  if (seconds < 3600) return `Expires In ${Math.round(seconds / 60)} Minutes`;
  if (seconds < 86_400) return `Expires In ${Math.round(seconds / 3600)} Hours`;
  return `Expires In ${Math.round(seconds / 86_400)} Days`;
}

export default function MessageComposer({ conversationId, selfId, replyTo, onClearReply }: Props) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [showGif, setShowGif] = useState(false);
  const [gifAvailable, setGifAvailable] = useState(true);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showScheduled, setShowScheduled] = useState(false);
  const [showExpiry, setShowExpiry] = useState(false);
  const [showScheduleInput, setShowScheduleInput] = useState(false);
  const [scheduleAt, setScheduleAt] = useState('');
  const [pendingExpirySeconds, setPendingExpirySeconds] = useState<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const appendMessage = useMessengerStore((s) => s.appendMessage);
  const updateMessage = useMessengerStore((s) => s.updateMessage);
  const removeMessage = useMessengerStore((s) => s.removeMessage);

  const broadcastRef = useRef<((isTyping: boolean) => void) | null>(null);
  const lastSentAtRef = useRef(0);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const adminMention = useMemo(() => ADMIN_MENTION_RE.test(text), [text]);

  useEffect(() => {
    const { channel, broadcast } = subscribeTyping(conversationId, selfId, () => {});
    broadcastRef.current = broadcast;
    return () => {
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
      broadcast(false);
      unsubscribe(channel);
      broadcastRef.current = null;
    };
  }, [conversationId, selfId]);

  const stopTypingNow = useCallback(() => {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    stopTimerRef.current = null;
    lastSentAtRef.current = 0;
    broadcastRef.current?.(false);
  }, []);

  useEffect(() => { if (voiceMode || showGif || showAttach) stopTypingNow(); }, [voiceMode, showGif, showAttach, stopTypingNow]);

  const pulseTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastSentAtRef.current > TYPING_THROTTLE_MS) {
      broadcastRef.current?.(true);
      lastSentAtRef.current = now;
    }
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    stopTimerRef.current = setTimeout(() => {
      broadcastRef.current?.(false);
      lastSentAtRef.current = 0;
    }, TYPING_STOP_MS);
  }, []);

  const insertAtCursor = (chunk: string) => {
    const el = inputRef.current;
    if (!el) { setText((t) => t + chunk); return; }
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

  const buildOptimistic = (overrides: Partial<Message> & { message_type: MessageType }): Message => ({
    id: `temp-${crypto.randomUUID()}`,
    conversation_id: conversationId,
    sender_id: selfId,
    text: null,
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
    ...overrides,
  });

  const sendOptimistic = async (
    optimistic: Message,
    payload: { text?: string; mediaUrl?: string; mediaMetadata?: Record<string, unknown>; messageType: MessageType; expiresAt?: string }
  ) => {
    appendMessage(conversationId, optimistic);
    setSending(true);
    // Audit10: stamp a fresh idempotency uuid per send. The server's
    // unique partial index on (conversation_id, sender_id, client_message_id)
    // + the 23505 replay path in send-message use this to dedup retries.
    const clientMessageId = crypto.randomUUID();
    try {
      const body: Record<string, unknown> = {
        conversationId,
        messageType: payload.messageType,
        replyToId: replyTo?.id,
        clientMessageId,
      };
      if (payload.text) body.text = payload.text;
      if (payload.mediaUrl) body.mediaUrl = payload.mediaUrl;
      if (payload.mediaMetadata) body.mediaMetadata = payload.mediaMetadata;
      if (payload.expiresAt) body.expiresAt = payload.expiresAt;
      const res = await fetch('/api/messenger/send-message', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        updateMessage(conversationId, { ...optimistic, metadata: { ...optimistic.metadata, failed: true } });
        toast(json.error ?? 'Send Failed');
        return;
      }
      const json = (await res.json()) as { message: Message };
      removeMessage(conversationId, optimistic.id);
      appendMessage(conversationId, json.message);
      setPendingExpirySeconds(null);
    } catch {
      updateMessage(conversationId, { ...optimistic, metadata: { ...optimistic.metadata, failed: true } });
      toast('Network Error');
    } finally {
      setSending(false);
    }
    onClearReply();
  };

  const handleSendText = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    stopTypingNow();
    const expiresAt =
      pendingExpirySeconds === null
        ? undefined
        : new Date(Date.now() + pendingExpirySeconds * 1000).toISOString();
    const optimistic = buildOptimistic({
      message_type: 'text',
      text: trimmed,
      expires_at: expiresAt ?? null,
    });
    setText('');
    await sendOptimistic(optimistic, { text: trimmed, messageType: 'text', expiresAt });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, sending, replyTo, conversationId, selfId, stopTypingNow, pendingExpirySeconds]);

  const handleSchedule = async () => {
    const trimmed = text.trim();
    if (!trimmed) { toast('Type A Message First'); return; }
    if (!scheduleAt) { toast('Pick A Send Time'); return; }
    const t = Date.parse(scheduleAt);
    if (Number.isNaN(t)) { toast('Invalid Time'); return; }
    if (t < Date.now() + 30_000) { toast('Pick A Time At Least Thirty Seconds Away'); return; }
    try {
      const res = await fetch('/api/messenger/schedule-message', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          conversationId,
          text: trimmed,
          messageType: 'text',
          scheduledAt: new Date(t).toISOString(),
          replyToId: replyTo?.id,
        }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        toast(json.error ?? 'Could Not Schedule');
        return;
      }
      setText('');
      setScheduleAt('');
      setShowScheduleInput(false);
      onClearReply();
      toast('Message Scheduled');
    } catch {
      toast('Network Error');
    }
  };

  const uploadAndSend = async (blob: Blob, contentType: string, messageType: MessageType, metadata: Record<string, unknown>) => {
    setSending(true);
    const sig = await getSignedUpload(contentType, blob.size);
    if (!sig) { toast('Upload Sign Failed'); setSending(false); return; }
    const ok = await putBlob(sig.uploadUrl, blob, contentType);
    if (!ok) { toast('Upload Failed'); setSending(false); return; }
    const expiresAt =
      pendingExpirySeconds === null
        ? undefined
        : new Date(Date.now() + pendingExpirySeconds * 1000).toISOString();
    const optimistic = buildOptimistic({
      message_type: messageType,
      media_url: sig.publicUrl,
      media_metadata: metadata,
      expires_at: expiresAt ?? null,
    });
    await sendOptimistic(optimistic, {
      mediaUrl: sig.publicUrl,
      mediaMetadata: metadata,
      messageType,
      expiresAt,
    });
  };

  const handleImage = async (file: File) => {
    const allowed = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
    if (!allowed.has(file.type)) { toast('Unsupported Image Type'); return; }
    await uploadAndSend(file, file.type, 'image', {
      filename: file.name, size: file.size, contentType: file.type,
    });
  };

  const handleVideo = async (file: File) => {
    const allowed = new Set([
      'video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v',
    ]);
    if (!allowed.has(file.type)) { toast('Unsupported Video Type. Use MP4, MOV, Or WebM'); return; }
    if (file.size > 200 * 1024 * 1024) { toast('Video Too Large (Max 200 MB)'); return; }
    await uploadAndSend(file, file.type, 'video', {
      filename: file.name, size: file.size, contentType: file.type,
      duration: null, // populated client-side if needed via VideoMetadata API
    });
  };

  const handleFile = async (file: File) => {
    const videoMimes = new Set(['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v']);
    if (videoMimes.has(file.type)) { return handleVideo(file); }
    const allowed = new Set([
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'audio/webm', 'audio/mp4', 'audio/mpeg',
      'application/pdf',
    ]);
    if (!allowed.has(file.type)) { toast('Unsupported File Type'); return; }
    await uploadAndSend(file, file.type, 'file', {
      filename: file.name, size: file.size, contentType: file.type,
    });
  };

  const handleVoice = async (blob: Blob, durationSec: number) => {
    await uploadAndSend(blob, 'audio/webm', 'voice', { durationSec, size: blob.size });
    setVoiceMode(false);
  };

  const handleGif = async (gifUrl: string) => {
    setShowGif(false);
    const expiresAt =
      pendingExpirySeconds === null
        ? undefined
        : new Date(Date.now() + pendingExpirySeconds * 1000).toISOString();
    const optimistic = buildOptimistic({
      message_type: 'gif',
      media_url: gifUrl,
      expires_at: expiresAt ?? null,
    });
    await sendOptimistic(optimistic, { mediaUrl: gifUrl, messageType: 'gif', expiresAt });
  };

  return (
    <div
      className="msg-composer"
      style={{
        borderTop: '1px solid var(--surface-3, #1D2D3E)',
        padding: 12,
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        background: 'var(--surface-1, #0F1923)',
        position: 'relative',
        flexShrink: 0,
      }}
    >
      <input ref={imageInputRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void handleImage(f);
        }}
      />
      <input ref={videoInputRef} type="file"
        accept="video/mp4,video/webm,video/quicktime,video/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void handleVideo(f);
        }}
      />
      <input ref={fileInputRef} type="file" style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void handleFile(f);
        }}
      />

      {replyTo && <ReplyChip replyTo={replyTo} onClear={onClearReply} />}

      {pendingExpirySeconds !== null && (
        <div
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', borderRadius: 999,
            background: 'var(--surface-3, #1D2D3E)',
            color: 'var(--teal, #00C4BC)',
            fontSize: '0.72rem', fontWeight: 700,
            marginBottom: 6,
          }}
          role="status"
          aria-label="Pending Expiry"
        >
          <Clock size={10} aria-hidden="true" />
          {formatExpirySummary(pendingExpirySeconds)}
          <button
            type="button"
            onClick={() => setPendingExpirySeconds(null)}
            aria-label="Clear Expiry"
            style={{
              background: 'transparent', border: 0, color: 'var(--white, #FFFFFF)',
              cursor: 'pointer', padding: 0, marginLeft: 4, fontWeight: 700,
            }}
          >Clear</button>
        </div>
      )}

      {voiceMode ? (
        <VoiceRecorder
          onComplete={(b, sec) => void handleVoice(b, sec)}
          onCancel={() => setVoiceMode(false)}
        />
      ) : (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
          <button type="button" onClick={() => setShowAttach((v) => !v)} style={iconBtn} aria-label="Attach" title="Attach">
            <Paperclip size={18} />
          </button>
          <button type="button" onClick={() => setShowEmoji((v) => !v)} style={iconBtn} aria-label="Insert Emoji" title="Insert Emoji">
            <Smile size={18} />
          </button>
          {gifAvailable && (
            <button type="button" onClick={() => setShowGif((v) => !v)} style={iconBtn} aria-label="Insert Gif" title="Insert Gif">
              <ImageIcon size={18} />
            </button>
          )}
          <button type="button" onClick={() => setShowTemplates((v) => !v)} style={iconBtn} aria-label="Templates" title="Templates">
            <FileText size={18} />
          </button>
          <button
            type="button"
            onClick={() => setShowScheduleInput((v) => !v)}
            style={iconBtn}
            aria-label="Schedule Send"
            title="Schedule Send"
          >
            <Calendar size={18} />
          </button>
          <button
            type="button"
            onClick={() => setShowExpiry((v) => !v)}
            style={iconBtn}
            aria-label="Set Expiry"
            title="Set Expiry"
          >
            <Clock size={18} />
          </button>
          <button
            type="button"
            onClick={() => setShowScheduled(true)}
            style={iconBtn}
            aria-label="View Scheduled Messages"
            title="View Scheduled Messages"
          >
            <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>List</span>
          </button>
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => { setText(e.target.value.slice(0, MAX_LEN)); pulseTyping(); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSendText(); }
            }}
            placeholder="Type A Message"
            maxLength={MAX_LEN}
            rows={1}
            aria-label="Message Body"
            style={{
              flex: 1, resize: 'none', minHeight: 40, maxHeight: 160,
              padding: '10px 12px', borderRadius: 10,
              border: '1px solid var(--surface-3, #1D2D3E)',
              background: 'var(--surface-2, #162230)',
              color: 'var(--white, #FFFFFF)',
              fontFamily: 'inherit', fontSize: '0.95rem', outline: 'none',
            }}
          />
          <button type="button" onClick={() => void handleSendText()}
            disabled={!text.trim() || sending}
            aria-label="Send Message" title="Send Message"
            style={{
              ...iconBtn,
              background: 'var(--teal, #00C4BC)', color: '#000',
              opacity: !text.trim() || sending ? 0.5 : 1,
            }}
          >
            <Send size={18} />
          </button>
        </div>
      )}

      {adminMention && !voiceMode && (
        <div
          role="status"
          aria-label="Admin Will Be Notified"
          style={{
            marginTop: 6,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: 999,
            background: 'var(--surface-3, #1D2D3E)',
            color: 'var(--teal, #00C4BC)',
            fontSize: '0.72rem',
            fontWeight: 700,
          }}
        >
          <Shield size={10} aria-hidden="true" />
          Admin Will Be Notified
        </div>
      )}

      {showScheduleInput && !voiceMode && (
        <div
          style={{
            marginTop: 8, padding: 10, borderRadius: 8,
            background: 'var(--surface-2, #162230)',
            border: '1px solid var(--surface-3, #1D2D3E)',
            display: 'flex', flexDirection: 'column', gap: 6,
          }}
        >
          <label style={{ fontSize: '0.74rem', color: 'var(--grey-400, #A8B4C0)' }} htmlFor="schedule-at-input">
            Send At
          </label>
          <input
            id="schedule-at-input"
            type="datetime-local"
            value={scheduleAt}
            onChange={(e) => setScheduleAt(e.target.value)}
            aria-label="Schedule Date And Time"
            style={{
              padding: '6px 8px', borderRadius: 6,
              border: '1px solid var(--surface-3, #1D2D3E)',
              background: 'var(--surface-1, #0F1923)',
              color: 'var(--white, #FFFFFF)', fontSize: '0.85rem',
            }}
          />
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => { setShowScheduleInput(false); setScheduleAt(''); }}
              style={{
                padding: '6px 10px', borderRadius: 6,
                border: '1px solid var(--surface-3, #1D2D3E)',
                background: 'transparent', color: 'var(--white, #FFFFFF)',
                cursor: 'pointer', fontSize: '0.78rem',
              }}
            >Cancel</button>
            <button
              type="button"
              onClick={() => void handleSchedule()}
              style={{
                padding: '6px 10px', borderRadius: 6, border: 0,
                background: 'var(--teal, #00C4BC)', color: '#000',
                cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700,
              }}
            >Schedule</button>
          </div>
        </div>
      )}

      {!voiceMode && (
        <div style={{ fontSize: '0.72rem', color: 'var(--grey-400, #A8B4C0)', textAlign: 'right', marginTop: 4 }}>
          {text.length} / {MAX_LEN}
        </div>
      )}

      {showEmoji && <EmojiPicker onPick={insertAtCursor} onClose={() => setShowEmoji(false)} />}
      {showAttach && (
        <AttachMenu
          onClose={() => setShowAttach(false)}
          onPickImage={() => imageInputRef.current?.click()}
          onPickVideo={() => videoInputRef.current?.click()}
          onPickVoice={() => setVoiceMode(true)}
          onPickFile={() => fileInputRef.current?.click()}
        />
      )}
      {showGif && (
        <GifPicker
          onPick={(u) => void handleGif(u)}
          onClose={() => setShowGif(false)}
          onUnavailable={() => setGifAvailable(false)}
        />
      )}
      {showTemplates && (
        <TemplatesMenu
          draftText={text}
          onPick={(body) => insertAtCursor(body)}
          onClose={() => setShowTemplates(false)}
        />
      )}
      {showExpiry && (
        <ExpiryPicker
          currentSeconds={pendingExpirySeconds}
          onPick={(s) => setPendingExpirySeconds(s)}
          onClose={() => setShowExpiry(false)}
        />
      )}
      {showScheduled && (
        <ScheduledMessageList onClose={() => setShowScheduled(false)} />
      )}
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
