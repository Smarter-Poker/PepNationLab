'use client';
import { useEffect, useState, useRef } from 'react';
import { vibrateLight } from '@/lib/messenger/haptics';
import { Reply, Smile, Pencil, Trash2, Check, X, Download, Pin, Bookmark, Tag, MessageSquare, Flag, Bell, MoreHorizontal } from 'lucide-react';
import type { Message, Reaction, ParticipantRole } from '@/lib/messenger/types';
import type { MessageLabelValue } from '@/lib/messenger/schemas';
import ReactionPopover from './ReactionPopover';
import VoicePlayer from './VoicePlayer';
import ImageLightbox from './ImageLightbox';
import LinkPreview from './LinkPreview';
import LabelsMenu from './LabelsMenu';
import Avatar from './Avatar';
import { toast } from 'sonner';
import Image from 'next/image';

interface Props {
  message: Message;
  isOwn: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  senderName?: string | null;
  senderAvatarUrl?: string | null;
  reactions: Reaction[];
  selfId: string;
  selfRole?: ParticipantRole | null;
  conversationType?: 'direct' | 'group' | 'announcement';
  isPinned?: boolean;
  currentLabels?: MessageLabelValue[];
  onReply: (m: Message) => void;
  onReact: (m: Message, emoji: string, action: 'add' | 'remove') => void;
  onEdit: (m: Message, nextText: string) => Promise<boolean>;
  onDelete: (m: Message, scope: 'for_me' | 'for_everyone') => void;
  onPinToggle?: (m: Message, action: 'pin' | 'unpin') => void;
  onLabelToggle?: (m: Message, label: MessageLabelValue, action: 'add' | 'remove') => void;
  onThread?: (m: Message) => void;
  onReport?: (m: Message) => void;
  onSetReminder?: (m: Message) => void;
  activeMenuId?: string | null;
  onMenuToggle?: (id: string, open: boolean) => void;
  readBy?: { id: string; name: string }[];
}

const URL_RE = /https?:\/\/[^\s<>]+/i;
const SAFE_URL_RE = /^(https?:|mailto:|tel:)/i;

function safeHref(raw: string | null): string {
  if (!raw) return '#';
  return SAFE_URL_RE.test(raw) ? raw : '#';
}

function formatTime(iso: string): string {
  try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
}

function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function extractFirstUrl(text: string | null): string | null {
  if (!text) return null;
  const m = text.match(URL_RE);
  return m ? m[0] : null;
}

function formatExpiry(iso: string | null): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const ms = t - Date.now();
  if (ms <= 0) return 'Expired';
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `Expires In ${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `Expires In ${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `Expires In ${hr}h`;
  const d = Math.floor(hr / 24);
  return `Expires In ${d}d`;
}

export default function MessageBubble({
  message,
  isOwn,
  isFirst = false,
  isLast = false,
  senderName,
  senderAvatarUrl,
  reactions,
  selfId,
  selfRole,
  conversationType,
  isPinned,
  currentLabels = [],
  onReply,
  onReact,
  onEdit,
  onDelete,
  onPinToggle,
  onLabelToggle, onThread, onReport, onSetReminder,
  activeMenuId, onMenuToggle, readBy = [],
}: Props) {
  if (message.message_type === 'system') {
    return (
      <div
        data-msg-id={message.id}
        style={{
          display: 'flex',
          justifyContent: 'center',
          width: '100%',
          margin: '12px 0',
          fontSize: '0.82rem',
          color: 'var(--grey-400, #A8B4C0)',
          fontStyle: 'italic',
          textAlign: 'center',
        }}
      >
        <span>{message.text ?? ''}</span>
      </div>
    );
  }

  const isMenuOpen = activeMenuId !== undefined ? activeMenuId === message.id : false;
  const setMenuOpen = (open: boolean) => {
    if (onMenuToggle) onMenuToggle(message.id, open);
  };
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.text ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [expiryTick, setExpiryTick] = useState(0);
  const [hovered, setHovered] = useState(false);
  const touchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const openedViaTouchRef = useRef<number>(0);
  const lastTapRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
    };
  }, []);

  const handleMediaTap = (e: React.MouseEvent | React.TouchEvent) => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      vibrateLight();
      onReact(message, '❤️', 'add');
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  };

  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      // Double tap detected
      if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
      onReact(message, '❤️', 'add');
      if (navigator.vibrate) navigator.vibrate(50);
      lastTapRef.current = 0;
      return;
    }
    lastTapRef.current = now;

    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
    touchTimerRef.current = setTimeout(() => {
      if (editing || confirmDelete) return;
      openedViaTouchRef.current = Date.now();
      setMenuOpen(!isMenuOpen);
      if (navigator.vibrate) navigator.vibrate(50);
    }, 500); // 500ms for mobile long press
  };

  const cancelTouch = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  };

  const failed = (message.metadata as { failed?: boolean })?.failed === true;
  const pending = message.id.startsWith('temp-');
  const meta = (message.media_metadata ?? {}) as { filename?: string; size?: number; durationSec?: number; contentType?: string };
  const url = extractFirstUrl(message.text);
  const isMediaBubble = ['image', 'gif', 'video'].includes(message.message_type);

  // Re-render once a minute to update the expiry countdown label.
  useEffect(() => {
    if (!message.expires_at) return;
    const id = setInterval(() => setExpiryTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, [message.expires_at]);
  // expiryTick is intentionally read to ensure React re-renders when the timer fires.
  void expiryTick;

  const grouped = reactions.reduce<Record<string, { count: number; mine: boolean }>>((acc, r) => {
    const key = r.emoji ?? r.gif_url ?? '?';
    const cur = acc[key] ?? { count: 0, mine: false };
    acc[key] = { count: cur.count + 1, mine: cur.mine || r.user_id === selfId };
    return acc;
  }, {});

  const showActionMenu = !editing && !confirmDelete && !message.is_deleted;

  // Pin policy:
  //   - In group/announcement conversations: anyone can pin their own, owner/admin can unpin anyone.
  //   - In direct conversations: either participant can pin.
  // Both surfaces are gated by canPin (action menu is hidden if it's false).
  const canPin = Boolean(onPinToggle) && !message.is_deleted;
  const canLabel = Boolean(onLabelToggle) && !message.is_deleted;
  const canThread = Boolean(onThread)
    && !message.is_deleted
    && conversationType !== 'direct'
    && !message.thread_parent_id; // Don't allow threads on replies in this iteration.
  // Phase 12: only non-owner can report, and the message can't already be deleted.
  const canReport = Boolean(onReport) && !isOwn && !message.is_deleted;
  // Phase 13: anyone can set a reminder on any non-deleted message.
  const canRemind = Boolean(onSetReminder) && !message.is_deleted;

  // selfRole gates visibility for additional admin-only affordances later; for
  // now any participant can pin so we only consult it for the Unpin path in
  // PinnedBar. Keep the prop here so consumers don't lose it.
  void selfRole;

  const renderBody = () => {
    if (message.is_deleted && message.delete_scope === 'for_everyone') {
      return <em style={{ opacity: 0.7 }}>Message Deleted</em>;
    }
    if (editing) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <textarea value={editText} onChange={(e) => setEditText(e.target.value.slice(0, 2000))} rows={2}
            style={{ width: '100%', resize: 'vertical', background: 'var(--surface-1, #0F1923)',
              color: 'var(--white, #FFFFFF)', border: '1px solid var(--surface-3, #1D2D3E)',
              borderRadius: 8, padding: 6 }}
            aria-label="Edit Message"
          />
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button type="button" onClick={async () => { const ok = await onEdit(message, editText.trim()); if (ok) setEditing(false); }}
              style={confirmBtn} aria-label="Save Edit" title="Save Edit">
              <Check size={14} />
            </button>
            <button type="button" onClick={() => { setEditing(false); setEditText(message.text ?? ''); }}
              style={confirmBtn} aria-label="Cancel Edit" title="Cancel Edit">
              <X size={14} />
            </button>
          </div>
        </div>
      );
    }
    const isOptimistic = message.id.startsWith('temp-');
    const opacityStyle = isOptimistic ? { opacity: 0.6, filter: 'grayscale(50%)' } : {};

    if (message.message_type === 'image' && message.media_url) {
      const isProof = currentLabels?.includes('PROOF OF PAYMENT' as any) || message.text?.includes('Payment proof');

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: isProof ? 8 : 6, padding: isProof ? 2 : 0 }}>
          {message.text && (
            <span style={{ 
              padding: isProof ? '6px 8px 0 8px' : '4px 8px 0 8px', 
              fontSize: '0.9rem', 
              lineHeight: 1.5,
              fontWeight: isProof ? 500 : 400,
            }}>
              {message.text}
            </span>
          )}
          <button type="button" 
            onClick={(e) => {
              handleMediaTap(e);
              if (!isOptimistic && Date.now() - lastTapRef.current >= 300) setLightbox(true);
            }} 
            aria-label="Open Image"
            style={{ 
              background: 'transparent', border: 0, padding: isProof ? '0 8px 8px 8px' : 0, 
              cursor: isOptimistic ? 'default' : 'zoom-in', ...opacityStyle,
              display: 'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start'
            }}
          >
            <div style={{
               border: isProof ? '2px solid rgba(255, 255, 255, 0.15)' : 'none',
               borderRadius: 14,
               padding: isProof ? 6 : 0,
               background: isProof ? 'linear-gradient(145deg, var(--surface-2, #162230), var(--surface-1, #0F1923))' : 'transparent',
               boxShadow: isProof ? '0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)' : 'none',
               overflow: 'hidden',
               width: '100%',
            }}>
              <Image src={message.media_url} alt="Image" loading="lazy" width={320} height={240} className="media-edge-to-edge"
                unoptimized
                onLoad={() => {
                  if (isLast) {
                    const el = document.querySelector('.msg-list');
                    if (el) el.scrollTop = el.scrollHeight;
                  }
                }}
                style={{ 
                  maxWidth: 320, 
                  maxHeight: isProof ? 450 : 240, 
                  height: 'auto',
                  borderRadius: isProof ? 8 : 10, 
                  display: 'block', 
                  objectFit: isProof ? 'contain' : 'cover',
                  background: isProof ? '#0a0d14' : 'transparent',
                  width: '100%'
                }}
              />
            </div>
          </button>
        </div>
      );
    }
    if (message.message_type === 'gif' && message.media_url) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {message.text && <span>{message.text}</span>}
          <button type="button" 
            onClick={(e) => {
              handleMediaTap(e);
              if (!isOptimistic && Date.now() - lastTapRef.current >= 300) setLightbox(true);
            }} 
            style={{ background: 'transparent', border: 0, padding: 0, cursor: isOptimistic ? 'default' : 'zoom-in' }}
          >
            <Image src={message.media_url} alt="Gif" loading="lazy" width={320} height={240} className="media-edge-to-edge"
              unoptimized
              onLoad={() => {
                if (isLast) {
                  const el = document.querySelector('.msg-list');
                  if (el) el.scrollTop = el.scrollHeight;
                }
              }}
              style={{ maxWidth: 320, maxHeight: 240, borderRadius: 10, display: 'block', width: '100%', height: 'auto', objectFit: 'cover', ...opacityStyle }}
            />
          </button>
        </div>
      );
    }
    if (message.message_type === 'voice' && message.media_url) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...opacityStyle }}>
          {message.text && <span>{message.text}</span>}
          <VoicePlayer src={message.media_url} />
        </div>
      );
    }
    if (message.message_type === 'video' && message.media_url) {
      // round-21: bubble shows ONLY the video player (no filename/size
      // caption below). Append #t=0.1 to force iOS Safari to render the
      // first frame at 0.1s as the static thumbnail - without this, iOS
      // shows a black box until tapped. The native <video controls>
      // overlays its own play button so the bubble looks like a
      // tappable thumbnail with a play icon, matching the user's ask.
      const videoSrc = message.media_url.includes('#t=')
        ? message.media_url
        : `${message.media_url}#t=0.1`;
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {message.text && <span>{message.text}</span>}
          <div style={{ position: 'relative', maxWidth: 320, ...opacityStyle }}>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              src={videoSrc}
              controls={!isOptimistic}
              playsInline
              preload="metadata"
              aria-label="Video"
              style={{
                maxWidth: '100%',
                width: 320,
                borderRadius: 10,
                display: 'block',
                background: '#000',
                aspectRatio: '16 / 9',
              }}
            />
          </div>
        </div>
      );
    }
    if (message.message_type === 'file' && message.media_url) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {message.text && <span>{message.text}</span>}
          <a href={safeHref(message.media_url)} target="_blank" rel="noopener noreferrer" download={meta.filename ?? true}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: isOwn ? '#000' : 'var(--white, #FFFFFF)' }}
            aria-label={`Download ${meta.filename ?? 'File'}`}
          >
            <Download size={16} />
            <span>{meta.filename ?? 'Download'}</span>
            {meta.size ? <span style={{ opacity: 0.7, fontSize: '0.78rem' }}>({formatSize(meta.size)})</span> : null}
          </a>
        </div>
      );
    }
    return <span>{message.text ?? ''}</span>;
  };

  const expiryLabel = formatExpiry(message.expires_at);

  return (
    <>
      <div
      data-msg-id={message.id}
      style={{ alignSelf: isOwn ? 'flex-end' : 'flex-start', maxWidth: '65%',
        display: 'flex', alignItems: 'flex-end', gap: 8, position: 'relative',
        marginBottom: isLast ? 24 : 12,
        WebkitTouchCallout: 'none' // Prevents native iOS popup on long-press
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={cancelTouch}
      onTouchEnd={cancelTouch}
      onTouchCancel={cancelTouch}
      onContextMenu={(e) => { 
        e.preventDefault(); 
        if (editing || confirmDelete) return; 
        if (Date.now() - openedViaTouchRef.current < 1000) return; // Prevent native double-fire on mobile
        setMenuOpen(!isMenuOpen); 
      }}
    >
      {!isOwn && (
        <div style={{ width: 28, flexShrink: 0, opacity: isLast ? 1 : 0 }}>
          {isLast && <Avatar avatarUrl={senderAvatarUrl ?? undefined} name={senderName ?? ''} size={28} />}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, position: 'relative', flex: 1, minWidth: 0, maxWidth: '100%' }}>
      {/* ── Visible action trigger button ── */}
      {(isPinned || currentLabels.length > 0) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignSelf: isOwn ? 'flex-end' : 'flex-start', padding: '0 4px' }}>
          {isPinned && (
            <span style={badgeStyle} aria-label="Pinned">
              <Pin size={10} aria-hidden="true" />
              Pinned
            </span>
          )}
          {currentLabels.map((label) => (
            <span key={label} style={badgeStyle} aria-label={`Label ${label}`}>
              <Tag size={10} aria-hidden="true" />
              {label}
            </span>
          ))}
        </div>
      )}
      <div
        className={`imessage-bubble ${isOwn ? 'imessage-own' : 'imessage-other'} ${isLast ? 'imessage-tail' : ''} ${isMediaBubble ? 'imessage-media' : ''}`}
        style={{
          opacity: pending ? 0.7 : 1,
          border: failed ? '1px solid var(--red, #E53E3E)' : 'none',
        }}
      >
        {renderBody()}
      </div>

      {isMenuOpen && showActionMenu && (
        <div role="menu" aria-label="Message Actions"
          style={{ 
            alignSelf: isOwn ? 'flex-end' : 'flex-start',
            marginTop: 4,
            display: 'flex', flexWrap: 'nowrap', overflowX: 'auto', maxWidth: 'calc(100vw - 32px)', gap: 4, background: 'var(--surface-3, #1D2D3E)', borderRadius: 8, padding: 4,
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            zIndex: 50, position: 'relative'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button type="button" onClick={() => { onReply(message); setMenuOpen(false); }} style={menuBtn} aria-label="Reply" title="Reply"><Reply size={24} /></button>
          <button type="button" onClick={() => { setMenuOpen(false); setPopoverOpen(true); }} style={menuBtn} aria-label="React" title="React"><Smile size={24} /></button>
          {canRemind && (
            <button
              type="button"
              onClick={() => { onSetReminder?.(message); setMenuOpen(false); }}
              style={menuBtn}
              aria-label="Remind Me"
              title="Remind Me"
            >
              <Bell size={24} />
            </button>
          )}
          {canPin && (
            <button
              type="button"
              onClick={() => { onPinToggle?.(message, isPinned ? 'unpin' : 'pin'); setMenuOpen(false); }}
              style={menuBtn}
              aria-label={isPinned ? 'Unpin Message' : 'Pin Message'}
              title={isPinned ? 'Unpin Message' : 'Pin Message'}
            >
              <Pin size={24} />
            </button>
          )}
          {canLabel && (
            <button
              type="button"
              onClick={() => { setMenuOpen(false); setLabelsOpen(true); }}
              style={menuBtn}
              aria-label="Labels"
              title="Labels"
            >
              <Tag size={24} />
            </button>
          )}
          {canThread && (
            <button
              type="button"
              onClick={() => { onThread?.(message); setMenuOpen(false); }}
              style={menuBtn}
              aria-label="Reply In Thread"
              title="Reply In Thread"
            >
              <MessageSquare size={24} />
            </button>
          )}
          {isOwn && message.message_type === 'text' && (
            <button type="button" onClick={() => { setMenuOpen(false); setEditing(true); }} style={menuBtn} aria-label="Edit" title="Edit"><Pencil size={24} /></button>
          )}
          <button type="button" onClick={() => { setMenuOpen(false); setConfirmDelete(true); }} style={menuBtn} aria-label="Delete" title="Delete"><Trash2 size={24} /></button>
        </div>
      )}
      {popoverOpen && (
        <ReactionPopover
          onPick={(emoji: string) => { onReact(message, emoji, 'add'); setPopoverOpen(false); }}
          onClose={() => setPopoverOpen(false)}
        />
      )}
      {labelsOpen && onLabelToggle && (
        <LabelsMenu
          messageId={message.id}
          currentLabels={currentLabels}
          onToggle={(label, action) => {
            try { onLabelToggle(message, label, action); }
            catch { toast('Could Not Update Label'); }
          }}
          onClose={() => setLabelsOpen(false)}
        />
      )}
      {confirmDelete && (
        <div role="menu" aria-label="Confirm Delete"
          style={{ 
            marginTop: 6,
            alignSelf: isOwn ? 'flex-end' : 'flex-start',
            display: 'flex', flexWrap: 'wrap', gap: 6, background: 'var(--surface-3, #1D2D3E)', borderRadius: 8, padding: 6,
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            zIndex: 50, position: 'relative'
          }}
        >
          <button type="button" onClick={() => { onDelete(message, 'for_me'); setConfirmDelete(false); }} style={{ ...confirmBtnText, color: 'var(--red, #E53E3E)' }} aria-label="Delete Message" title="Delete Message">Delete Message</button>
          <button type="button" onClick={() => setConfirmDelete(false)} style={confirmBtnText} aria-label="Cancel" title="Cancel">Cancel</button>
        </div>
      )}

      {url && message.message_type === 'text' && !message.is_deleted && <LinkPreview url={url} />}

      {Object.keys(grouped).length > 0 && !message.is_deleted && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignSelf: isOwn ? 'flex-end' : 'flex-start', padding: '2px 4px' }}>
          {Object.entries(grouped).map(([emoji, info]) => (
            <button key={emoji} type="button"
              onClick={() => onReact(message, emoji, info.mine ? 'remove' : 'add')}
              style={{
                background: info.mine ? 'var(--teal, #00C4BC)' : 'var(--surface-2, #162230)',
                color: info.mine ? '#000' : 'var(--white, #FFFFFF)',
                border: '1px solid var(--surface-3, #1D2D3E)',
                borderRadius: 999, padding: '2px 8px', fontSize: '0.78rem',
                display: 'inline-flex', gap: 4, alignItems: 'center', cursor: 'pointer',
              }}
              aria-label={`Reaction ${emoji} Count ${info.count}`}
            >
              <span>{emoji}</span>
              <span>{info.count}</span>
            </button>
          ))}
        </div>
      )}

      {(failed || pending || message.is_edited || expiryLabel) && (
        <div
          style={{ fontSize: '0.7rem', color: 'var(--grey-400, #A8B4C0)',
            alignSelf: isOwn ? 'flex-end' : 'flex-start', padding: '0 6px',
            marginTop: 2 }}
        >
          {failed ? 'Failed To Send' : pending ? 'Sending' : ''}
          {message.is_edited && !message.is_deleted ? ' (Edited)' : ''}
          {expiryLabel ? ` (${expiryLabel})` : ''}
        </div>
      )}

      {isOwn && readBy.length > 0 && isLast && (
        <div style={{ display: 'flex', alignSelf: 'flex-end', gap: 2, marginTop: 4, paddingRight: 4 }}>
          {readBy.map(user => (
             <Avatar key={user.id} name={user.name} size={14} />
          ))}
        </div>
      )}

      {lightbox && message.media_url && <ImageLightbox src={message.media_url} onClose={() => setLightbox(false)} />}
      </div>
    </div>
    </>
  );
}

const menuBtn: React.CSSProperties = {
  background: 'transparent', border: 0, color: 'var(--white, #FFFFFF)', cursor: 'pointer',
  padding: 10, borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
};
const confirmBtn: React.CSSProperties = {
  background: 'var(--surface-1, #0F1923)', border: '1px solid var(--surface-3, #1D2D3E)',
  color: 'var(--white, #FFFFFF)', cursor: 'pointer', padding: '4px 8px', borderRadius: 6,
  display: 'inline-flex', alignItems: 'center', gap: 4,
};
const confirmBtnText: React.CSSProperties = {
  background: 'transparent', border: 0, color: 'var(--white, #FFFFFF)', cursor: 'pointer',
  padding: '4px 8px', borderRadius: 6, fontSize: '0.84rem',
};
const badgeStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 3,
  padding: '2px 6px', borderRadius: 999,
  background: 'var(--surface-3, #1D2D3E)', color: 'var(--grey-400, #A8B4C0)',
  fontSize: '0.66rem', fontWeight: 700, textTransform: 'uppercase',
};
