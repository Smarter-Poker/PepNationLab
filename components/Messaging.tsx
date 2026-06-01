'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  edited_at: string | null;
  deleted_at: string | null;
  reply_to_id: string | null;
  invoice_status: string | null;
  invoice_amount: number | null;
  line_items: any[] | null;
}

interface Reaction { emoji: string; count: number; myReaction: boolean }

const EMOJI_QUICK = ['👍', '❤️', '😂', '🔥', '👀', '✅'];
const EMOJI_FULL = ['👍', '❤️', '😂', '🔥', '👀', '✅', '👏', '🙏', '💯', '🎉', '😍', '🤔', '😢', '😮', '👎', '💰', '📎', '⭐', '🚀', '💪', '😎', '🤝', '✨', '💎'];

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
  const [attachmentName, setAttachmentName] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [sending, setSending] = useState(false);
  const [reactions, setReactions] = useState<Record<string, Reaction[]>>({});
  const [showEmojiFor, setShowEmojiFor] = useState<string | null>(null);
  const [showFullEmoji, setShowFullEmoji] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [editBody, setEditBody] = useState('');
  const [contextMenu, setContextMenu] = useState<{ msgId: string; x: number; y: number } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, []);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    setError('');
    const supabase = createClient();
    const { data, error: loadError } = await supabase
      .from('internal_messages')
      .select('id, sender_id, receiver_id, body, subject, attachment_url, type, is_read, created_at, edited_at, deleted_at, reply_to_id, invoice_status, invoice_amount, line_items')
      .or(`and(sender_id.eq.${selfId},receiver_id.eq.${counterpartId}),and(sender_id.eq.${counterpartId},receiver_id.eq.${selfId})`)
      .order('created_at', { ascending: true });

    if (loadError) setError(loadError.message);
    else setMessages((data as Message[]) ?? []);
    setLoading(false);
  }, [selfId, counterpartId]);

  useEffect(() => { loadMessages(); }, [loadMessages]);
  useEffect(() => { setTimeout(scrollToBottom, 50); }, [messages, scrollToBottom]);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100); }, [counterpartId]);

  // Load reactions for visible messages
  useEffect(() => {
    if (messages.length === 0) return;
    const loadReactions = async () => {
      const rMap: Record<string, Reaction[]> = {};
      for (const m of messages.slice(-30)) {
        try {
          const res = await fetch(`/api/messages/reactions?messageId=${m.id}`);
          const json = await res.json();
          if (json.reactions?.length) rMap[m.id] = json.reactions;
        } catch { /* silent */ }
      }
      setReactions(rMap);
    };
    loadReactions();
  }, [messages]);

  // Activity heartbeat
  useEffect(() => {
    fetch('/api/user/activity', { method: 'POST' }).catch(() => {});
    const iv = setInterval(() => fetch('/api/user/activity', { method: 'POST' }).catch(() => {}), 60000);
    return () => clearInterval(iv);
  }, []);

  // Close context menu on outside click
  useEffect(() => {
    const handler = () => setContextMenu(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = editingMsg ? editBody.trim() : body.trim();
    if (!text && !attachmentUrl) return;

    // Edit mode
    if (editingMsg) {
      try {
        const res = await fetch('/api/messages/edit', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageId: editingMsg.id, newBody: text }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        setEditingMsg(null);
        setEditBody('');
        await loadMessages();
      } catch (err: any) { setError(err.message); }
      return;
    }

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
          replyToId: replyTo?.id || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setBody('');
      setAttachmentUrl(null);
      setAttachmentName('');
      setReplyTo(null);
      await loadMessages();
    } catch (err: any) { setError(err.message); }
    finally { setSending(false); }
  }

  async function handleReaction(messageId: string, emoji: string) {
    const existing = reactions[messageId]?.find(r => r.emoji === emoji && r.myReaction);
    try {
      if (existing) {
        await fetch('/api/messages/reactions', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messageId, emoji }) });
      } else {
        await fetch('/api/messages/reactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messageId, emoji }) });
      }
      // Reload reactions for this message
      const res = await fetch(`/api/messages/reactions?messageId=${messageId}`);
      const json = await res.json();
      setReactions(prev => ({ ...prev, [messageId]: json.reactions || [] }));
    } catch { /* silent */ }
    setShowEmojiFor(null);
  }

  async function handleDelete(messageId: string) {
    try {
      const res = await fetch('/api/messages/edit', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messageId }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      await loadMessages();
    } catch (err: any) { setError(err.message); }
    setContextMenu(null);
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    try {
      const res = await fetch(`/api/messages/search?q=${encodeURIComponent(searchQuery)}&counterpartId=${counterpartId}`);
      const json = await res.json();
      setSearchResults(json.results || []);
    } catch { /* silent */ }
  }

  async function handleFileUpload(file: File) {
    setUploadingFile(true); setError('');
    try {
      const supabase = createClient();
      const ext = file.name.split('.').pop();
      const fileName = `${selfId}-${Math.random().toString(36).substring(2)}.${ext}`;
      const { error: err } = await supabase.storage.from('message-attachments').upload(fileName, file);
      if (err) throw err;
      const { data } = supabase.storage.from('message-attachments').getPublicUrl(fileName);
      setAttachmentUrl(data.publicUrl);
      setAttachmentName(file.name);
    } catch (err: any) { setError(err.message); }
    finally { setUploadingFile(false); }
  }

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  // Clipboard paste
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) handleFileUpload(file);
        break;
      }
    }
  };

  const initials = counterpartName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
  const isImage = (url: string | null) => url && /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?|$)/i.test(url);

  function shouldShowTimestamp(i: number): boolean {
    if (i === 0) return true;
    return new Date(messages[i].created_at).getTime() - new Date(messages[i - 1].created_at).getTime() > 5 * 60 * 1000;
  }
  function isFirstInGroup(i: number): boolean {
    if (i === 0) return true;
    return messages[i].sender_id !== messages[i - 1].sender_id || shouldShowTimestamp(i);
  }
  function shouldShowAvatar(i: number): boolean {
    if (i === messages.length - 1) return true;
    return messages[i].sender_id !== messages[i + 1].sender_id;
  }
  function formatTime(d: string) {
    const dt = new Date(d);
    const now = new Date();
    const diff = Math.floor((now.getTime() - dt.getTime()) / 86400000);
    const t = dt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (diff === 0) return t;
    if (diff === 1) return `Yesterday ${t}`;
    if (diff < 7) return `${dt.toLocaleDateString([], { weekday: 'short' })} ${t}`;
    return dt.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ` ${t}`;
  }

  function getReplyPreview(replyId: string | null): Message | undefined {
    if (!replyId) return undefined;
    return messages.find(m => m.id === replyId);
  }

  const lastMsg = messages[messages.length - 1];
  const showReadReceipt = lastMsg && lastMsg.sender_id === selfId && lastMsg.is_read;

  return (
    <div
      style={{
        background: '#0a0f1a', borderRadius: 16,
        display: 'flex', flexDirection: 'column',
        /* Responsive height: fills most of the viewport, capped on desktop */
        height: 'clamp(420px, calc(100dvh - 220px), 720px)',
        overflow: 'hidden',
        border: dragOver ? '2px solid var(--teal)' : '1px solid rgba(255,255,255,0.06)',
        boxShadow: dragOver ? '0 0 20px rgba(192,184,168,0.2)' : '0 4px 24px rgba(0,0,0,0.3)',
        transition: 'border 0.2s, box-shadow 0.2s',
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {dragOver && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 50,
          background: 'rgba(192,184,168,0.05)', backdropFilter: 'blur(2px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 16, pointerEvents: 'none',
        }}>
          <div style={{ color: 'var(--teal)', fontSize: '1rem', fontWeight: 700 }}>
            📎 Drop File To Attach
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{
        padding: '12px 16px', background: 'rgba(255,255,255,0.03)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: '50%',
          background: 'linear-gradient(135deg, #C0B8A8 0%, #0099FF 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.7rem', fontWeight: 800, color: '#fff', flexShrink: 0,
        }}>{initials}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#fff' }}>{counterpartName}</div>
        </div>
        {/* Search toggle */}
        <button onClick={() => { setSearchOpen(!searchOpen); setSearchResults([]); setSearchQuery(''); }}
          style={{ background: searchOpen ? 'rgba(192,184,168,0.08)' : 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8, color: searchOpen ? 'var(--teal)' : 'rgba(255,255,255,0.3)', transition: 'all 0.2s' }}
          title="Search Messages">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
        </button>
        {/* Export */}
        <a href={`/api/messages/export?counterpartId=${counterpartId}`} download
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8, color: 'rgba(255,255,255,0.3)', textDecoration: 'none', display: 'flex' }}
          title="Export Chat CSV">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
        </a>
        <button onClick={loadMessages}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8, color: 'rgba(255,255,255,0.3)' }}
          title="Refresh">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
        </button>
      </div>

      {/* Search bar */}
      {searchOpen && (
        <div style={{ padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', gap: 8 }}>
          <input type="text" placeholder="Search messages..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '6px 10px', color: '#fff', fontSize: '0.8rem', outline: 'none', fontFamily: 'inherit' }} />
          <button onClick={handleSearch}
            style={{ background: 'rgba(192,184,168,0.1)', border: '1px solid rgba(192,184,168,0.2)', borderRadius: 8, padding: '6px 12px', color: 'var(--teal)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
            Search
          </button>
        </div>
      )}
      {searchResults.length > 0 && (
        <div style={{ maxHeight: 120, overflowY: 'auto', borderBottom: '1px solid rgba(255,255,255,0.04)', padding: '4px 16px' }}>
          {searchResults.slice(0, 5).map((r: any) => (
            <div key={r.id} style={{ padding: '4px 0', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
              <span style={{ color: 'var(--teal)', fontWeight: 600 }}>{formatTime(r.created_at)}</span> — {r.body?.substring(0, 80)}
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} style={{ flexGrow: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '12px 16px 6px', display: 'flex', flexDirection: 'column', scrollBehavior: 'smooth', position: 'relative' }}>
        {loading ? (
          <div style={{ margin: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2.5px solid rgba(192,184,168,0.2)', borderTopColor: 'var(--teal)', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.25)' }}>Loading...</span>
          </div>
        ) : messages.length === 0 ? (
          <div style={{ margin: 'auto', textAlign: 'center', padding: '30px 16px' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(192,184,168,0.1) 0%, rgba(0,153,255,0.1) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            </div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', fontWeight: 600 }}>Start A Conversation</div>
            <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.75rem', marginTop: 4 }}>Send The First Message Below</div>
          </div>
        ) : (
          <>
            {messages.map((m, i) => {
              const mine = m.sender_id === selfId;
              const showAv = shouldShowAvatar(i);
              const showTime = shouldShowTimestamp(i);
              const first = isFirstInGroup(i);
              const isDeleted = !!m.deleted_at;
              const isInvoice = m.type === 'invoice' || m.type === 'credit_memo';
              const isNotification = m.type === 'notification' || m.type === 'payment_reminder';
              const isBroadcast = m.type === 'broadcast';
              const isSpecial = isInvoice || isNotification || isBroadcast;
              const replyPreview = getReplyPreview(m.reply_to_id);
              const msgReactions = reactions[m.id] || [];
              const canEdit = mine && !isDeleted && (Date.now() - new Date(m.created_at).getTime() < 5 * 60 * 1000);

              return (
                <div key={m.id}>
                  {showTime && (
                    <div style={{ textAlign: 'center', padding: '10px 0 6px', fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)', fontWeight: 500, letterSpacing: '0.03em' }}>
                      {formatTime(m.created_at)}
                    </div>
                  )}
                  <div style={{
                    display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start',
                    alignItems: 'flex-end', gap: 6, marginBottom: showAv ? 6 : 2,
                    marginTop: first && !showTime ? 6 : 0,
                  }}>
                    {!mine && (
                      <div style={{
                        width: 26, height: 26, borderRadius: '50%',
                        background: showAv ? 'linear-gradient(135deg, #C0B8A8, #0099FF)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.55rem', fontWeight: 800, color: '#fff', flexShrink: 0,
                        visibility: showAv ? 'visible' : 'hidden',
                      }}>{initials}</div>
                    )}
                    <div style={{ maxWidth: '72%', position: 'relative' }}
                      onContextMenu={(e) => { if (canEdit) { e.preventDefault(); setContextMenu({ msgId: m.id, x: e.clientX, y: e.clientY }); } }}
                    >
                      {/* Reply preview */}
                      {replyPreview && !isDeleted && (
                        <div style={{
                          fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)',
                          padding: '4px 10px', marginBottom: 2,
                          borderLeft: '2px solid var(--teal)',
                          background: 'rgba(255,255,255,0.02)', borderRadius: '4px 8px 8px 4px',
                        }}>
                          ↩ {replyPreview.body?.substring(0, 60)}
                        </div>
                      )}

                      {isDeleted ? (
                        <div style={{
                          padding: '8px 12px', borderRadius: 14,
                          background: 'rgba(255,255,255,0.02)', fontStyle: 'italic',
                          fontSize: '0.78rem', color: 'rgba(255,255,255,0.2)',
                        }}>
                          This message was deleted
                        </div>
                      ) : isSpecial ? (
                        <div style={{
                          background: isInvoice
                            ? 'linear-gradient(135deg, rgba(192,184,168,0.06), rgba(0,153,255,0.06))'
                            : isBroadcast
                              ? 'linear-gradient(135deg, rgba(192,132,252,0.06), rgba(99,179,237,0.06))'
                              : 'linear-gradient(135deg, rgba(99,179,237,0.06), rgba(99,179,237,0.03))',
                          border: `1px solid ${isInvoice ? 'rgba(192,184,168,0.15)' : isBroadcast ? 'rgba(192,132,252,0.15)' : 'rgba(99,179,237,0.15)'}`,
                          borderRadius: 14, padding: '12px 14px',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, paddingBottom: 6, borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                            <span style={{ fontSize: '1rem' }}>{isInvoice ? (m.type === 'credit_memo' ? '💳' : '💰') : isBroadcast ? '📢' : m.type === 'payment_reminder' ? '⚠️' : '🔔'}</span>
                            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: isInvoice ? 'var(--teal)' : isBroadcast ? '#C084FC' : '#63B3ED', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                              {m.type === 'credit_memo' ? 'Credit Memo' : m.type === 'payment_reminder' ? 'Payment Reminder' : isBroadcast ? 'Broadcast' : isInvoice ? 'Invoice' : 'Notification'}
                            </span>
                            {m.invoice_status && (
                              <span style={{
                                marginLeft: 'auto', fontSize: '0.6rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                                background: m.invoice_status === 'paid' ? 'rgba(72,187,120,0.1)' : m.invoice_status === 'overdue' ? 'rgba(229,62,62,0.1)' : 'rgba(237,137,54,0.1)',
                                color: m.invoice_status === 'paid' ? '#48BB78' : m.invoice_status === 'overdue' ? '#FC8181' : '#00C4BC',
                                textTransform: 'uppercase', letterSpacing: '0.05em',
                              }}>{m.invoice_status}</span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#fff', marginBottom: 4 }}>{m.subject}</div>
                          {m.invoice_amount !== null && (
                            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: m.type === 'credit_memo' ? '#48BB78' : 'var(--teal)', marginBottom: 6 }}>
                              {m.type === 'credit_memo' ? '-' : ''}${Math.abs(m.invoice_amount).toFixed(2)}
                            </div>
                          )}
                          {m.line_items && m.line_items.length > 0 && (
                            <div style={{ marginBottom: 6 }}>
                              {m.line_items.map((item: any, idx: number) => (
                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', padding: '2px 0' }}>
                                  <span>{item.name} × {item.qty}</span>
                                  <span>${Number(item.price * item.qty).toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>{m.body}</div>
                        </div>
                      ) : (
                        <div style={{
                          background: mine ? 'linear-gradient(135deg, #C0B8A8, #0099FF)' : 'rgba(255,255,255,0.06)',
                          borderRadius: mine ? (first ? '16px 16px 4px 16px' : '16px 4px 4px 16px') : (first ? '16px 16px 16px 4px' : '4px 16px 16px 4px'),
                          padding: '8px 12px',
                        }}>
                          <div style={{ fontSize: '0.82rem', color: mine ? '#fff' : 'rgba(255,255,255,0.85)', lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.body}</div>
                          {m.edited_at && <div style={{ fontSize: '0.6rem', color: mine ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)', marginTop: 2 }}>(edited)</div>}
                          {m.attachment_url && (
                            isImage(m.attachment_url) ? (
                              <img src={m.attachment_url} alt="attachment" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, marginTop: 6, cursor: 'pointer' }} onClick={() => window.open(m.attachment_url!, '_blank')} />
                            ) : (
                              <a href={m.attachment_url} target="_blank" rel="noopener noreferrer" style={{ color: mine ? 'rgba(255,255,255,0.8)' : 'var(--teal)', fontSize: '0.73rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, background: mine ? 'rgba(255,255,255,0.12)' : 'rgba(192,184,168,0.06)', padding: '3px 8px', borderRadius: 6, marginTop: 4 }}>
                                📎 Attachment
                              </a>
                            )
                          )}
                        </div>
                      )}

                      {/* Reactions display */}
                      {msgReactions.length > 0 && !isDeleted && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 3, justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                          {msgReactions.map(r => (
                            <button key={r.emoji} onClick={() => handleReaction(m.id, r.emoji)}
                              style={{
                                background: r.myReaction ? 'rgba(192,184,168,0.12)' : 'rgba(255,255,255,0.04)',
                                border: `1px solid ${r.myReaction ? 'rgba(192,184,168,0.3)' : 'rgba(255,255,255,0.06)'}`,
                                borderRadius: 10, padding: '1px 6px', cursor: 'pointer',
                                fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: 3,
                                color: 'rgba(255,255,255,0.6)',
                              }}>
                              {r.emoji} <span style={{ fontSize: '0.6rem' }}>{r.count}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Hover actions — react / reply */}
                      {!isDeleted && (
                        <div className="msg-hover-actions" style={{
                          position: 'absolute', top: -6,
                          [mine ? 'left' : 'right']: 0,
                          display: 'none', gap: 2, background: '#111827',
                          borderRadius: 8, padding: '2px', border: '1px solid rgba(255,255,255,0.08)',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                        }}>
                          {EMOJI_QUICK.slice(0, 4).map(em => (
                            <button key={em} onClick={() => handleReaction(m.id, em)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', fontSize: '0.85rem', borderRadius: 4 }}>
                              {em}
                            </button>
                          ))}
                          <button onClick={() => setShowEmojiFor(showEmojiFor === m.id ? null : m.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', borderRadius: 4 }}>
                            ＋
                          </button>
                          <button onClick={() => setReplyTo(m)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', borderRadius: 4 }}>
                            ↩
                          </button>
                        </div>
                      )}

                      {/* Extended emoji picker */}
                      {showEmojiFor === m.id && (
                        <div style={{
                          position: 'absolute', top: -44, [mine ? 'left' : 'right']: 0, zIndex: 20,
                          background: '#1f2937', borderRadius: 10, padding: 6,
                          border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                          display: 'flex', flexWrap: 'wrap', gap: 2, maxWidth: 200,
                        }}>
                          {EMOJI_FULL.map(em => (
                            <button key={em} onClick={() => handleReaction(m.id, em)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '3px 4px', fontSize: '0.9rem', borderRadius: 4 }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                              {em}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {showReadReceipt && (
              <div style={{ textAlign: 'right', fontSize: '0.62rem', color: 'rgba(192,184,168,0.5)', fontWeight: 500, padding: '1px 6px 0' }}>✓ Seen</div>
            )}
          </>
        )}
      </div>

      {/* Context menu for edit/delete */}
      {contextMenu && (
        <div style={{
          position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 100,
          background: '#1f2937', borderRadius: 10, padding: 4,
          border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          minWidth: 140,
        }} onClick={e => e.stopPropagation()}>
          <button onClick={() => {
            const msg = messages.find(m => m.id === contextMenu.msgId);
            if (msg) { setEditingMsg(msg); setEditBody(msg.body); }
            setContextMenu(null);
          }} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '8px 12px', color: '#fff', fontSize: '0.8rem', cursor: 'pointer', borderRadius: 6 }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
            ✏️ Edit Message
          </button>
          <button onClick={() => handleDelete(contextMenu.msgId)}
            style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '8px 12px', color: '#FC8181', fontSize: '0.8rem', cursor: 'pointer', borderRadius: 6 }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(229,62,62,0.05)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
            🗑 Delete Message
          </button>
        </div>
      )}

      {/* Reply-to banner */}
      {replyTo && (
        <div style={{ padding: '6px 16px', borderTop: '1px solid rgba(192,184,168,0.1)', background: 'rgba(192,184,168,0.03)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ borderLeft: '3px solid var(--teal)', paddingLeft: 8, flex: 1 }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--teal)', fontWeight: 600 }}>Replying to</div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{replyTo.body?.substring(0, 60)}</div>
          </div>
          <button onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: 4 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
      )}

      {/* Edit banner */}
      {editingMsg && (
        <div style={{ padding: '6px 16px', borderTop: '1px solid rgba(237,137,54,0.1)', background: 'rgba(237,137,54,0.03)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.68rem', color: '#00C4BC', fontWeight: 600 }}>✏️ Editing Message</div>
          </div>
          <button onClick={() => { setEditingMsg(null); setEditBody(''); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: 4 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div style={{ padding: '6px 16px', background: 'rgba(229,62,62,0.04)', borderTop: '1px solid rgba(229,62,62,0.1)', fontSize: '0.75rem', color: '#FC8181' }}>{error}</div>
      )}

      {/* Attachment preview */}
      {attachmentUrl && (
        <div style={{ padding: '6px 16px', borderTop: '1px solid rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', gap: 8 }}>
          {isImage(attachmentUrl) ? (
            <img src={attachmentUrl} alt="preview" style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: '0.78rem', color: 'var(--teal)' }}>📎</span>
          )}
          <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachmentName || 'File Attached'}</span>
          <button onClick={() => { setAttachmentUrl(null); setAttachmentName(''); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: 2 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
      )}

      {/* Composer */}
      <form onSubmit={handleSend} style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 22, padding: '3px 3px 3px 6px', border: '1px solid rgba(255,255,255,0.05)' }}>
          {/* Emoji button */}
          <div style={{ position: 'relative' }}>
            <button type="button" onClick={() => setShowFullEmoji(!showFullEmoji)}
              style={{ width: 30, height: 30, borderRadius: '50%', background: 'none', border: 'none', cursor: 'pointer', color: showFullEmoji ? 'var(--teal)' : 'rgba(255,255,255,0.3)', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              😊
            </button>
            {showFullEmoji && (
              <div style={{ position: 'absolute', bottom: '100%', left: 0, marginBottom: 8, background: '#1f2937', borderRadius: 12, padding: 8, border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', display: 'flex', flexWrap: 'wrap', gap: 2, width: 220, zIndex: 30 }}>
                {EMOJI_FULL.map(em => (
                  <button key={em} type="button" onClick={() => { setBody(prev => prev + em); setShowFullEmoji(false); inputRef.current?.focus(); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 5px', fontSize: '1.1rem', borderRadius: 4 }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                    {em}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Attach */}
          <label style={{ width: 30, height: 30, borderRadius: '50%', cursor: uploadingFile ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>
            {uploadingFile ? <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid var(--teal)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} /> : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
            )}
            <input ref={fileInputRef} type="file" style={{ display: 'none' }} disabled={uploadingFile || sending}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} />
          </label>
          {/* Input */}
          <input ref={inputRef} type="text" placeholder="Aa" disabled={sending}
            value={editingMsg ? editBody : body}
            onChange={e => editingMsg ? setEditBody(e.target.value) : setBody(e.target.value)}
            onPaste={handlePaste}
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: '0.85rem', padding: '7px 4px', fontFamily: 'inherit' }} />
          {/* Send */}
          <button type="submit" disabled={sending || uploadingFile || (!(editingMsg ? editBody.trim() : body.trim()) && !attachmentUrl)}
            style={{
              width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              background: ((editingMsg ? editBody.trim() : body.trim()) || attachmentUrl) ? 'linear-gradient(135deg, #C0B8A8, #0099FF)' : 'rgba(255,255,255,0.05)',
              transition: 'background 0.2s, transform 0.15s', transform: sending ? 'scale(0.9)' : 'scale(1)',
            }}>
            {sending ? <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.8s linear infinite' }} /> : (
              editingMsg ? <span style={{ fontSize: '0.8rem', color: '#fff' }}>✓</span> : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={((body.trim()) || attachmentUrl) ? '#fff' : 'rgba(255,255,255,0.15)'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
              )
            )}
          </button>
        </div>
      </form>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        div:hover > .msg-hover-actions { display: flex !important; }
      `}</style>
    </div>
  );
}
