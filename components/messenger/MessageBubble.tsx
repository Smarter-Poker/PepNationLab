'use client';
import { useEffect, useState } from 'react';
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

interface Props {
  message: Message;
  isOwn: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  senderName?: string | null;
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
  message, isOwn, isFirst = true, isLast = true, senderName, reactions, selfId,
  selfRole = null, conversationType,
  isPinned = false, currentLabels = [],
  onReply, onReact, onEdit, onDelete,
  onPinToggle, onLabelToggle, onThread, onReport, onSetReminder,
  activeMenuId, onMenuToggle, readBy = [],
}: Props) {
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
    if (message.message_type === 'image' && message.media_url) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {message.text && <span>{message.text}</span>}
          <button type="button" onClick={() => setLightbox(true)} aria-label="Open Image"
            style={{ background: 'transparent', border: 0, padding: 0, cursor: 'zoom-in' }}
          >
            <img src={message.media_url} alt="Image" loading="lazy"
              style={{ maxWidth: 320, maxHeight: 240, borderRadius: 10, display: 'block' }}
            />
          </button>
        </div>
      );
    }
    if (message.message_type === 'gif' && message.media_url) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {message.text && <span>{message.text}</span>}
          <img src={message.media_url} alt="Gif" loading="lazy"
            style={{ maxWidth: 320, maxHeight: 240, borderRadius: 10, display: 'block' }}
          />
        </div>
      );
    }
    if (message.message_type === 'voice' && message.media_url) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {message.text && <span>{message.text}</span>}
          <VoicePlayer src={message.media_url} />
        </div>
      );
    }
    if (message.message_type === 'video' && message.media_url) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {message.text && <span>{message.text}</span>}
          <div style={{ position: 'relative', maxWidth: 320 }}>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              src={message.media_url}
              controls
              playsInline
              preload="metadata"
              aria-label={`Video${meta.filename ? `: ${meta.filename}` : ''}`}
              style={{
                maxWidth: '100%',
                width: 320,
                borderRadius: 10,
                display: 'block',
                background: '#000',
                aspectRatio: '16 / 9',
              }}
            />
          {meta.filename && (
            <a
              href={safeHref(message.media_url)}
              download={meta.filename}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '4px 8px', fontSize: '0.76rem',
                color: isOwn ? '#000' : 'var(--grey-400, #A8B4C0)',
              }}
              aria-label={`Download ${meta.filename}`}
            >
              <Download size={12} />
              {meta.filename}
              {meta.size ? <span style={{ opacity: 0.7 }}>({formatSize(meta.size)})</span> : null}
            </a>
          )}
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
      <style>{`
        .imessage-bubble {
          position: relative;
          max-width: 65%;
          padding: 10px 16px;
          border-radius: 20px;
          color: white;
          box-shadow: 0 1px 2px rgba(0,0,0,0.1);
          white-space: pre-wrap;
          word-break: break-word;
        }
        .imessage-bubble::before, .imessage-bubble::after {
          content: "";
          position: absolute;
          bottom: 0;
          height: 20px;
        }
        
        .imessage-own {
          background: linear-gradient(180deg, #0084FF 0%, #0073E6 100%);
          align-self: flex-end;
        }
        .imessage-own.imessage-tail::before {
          right: -7px;
          width: 20px;
          background: #0073E6;
          border-bottom-left-radius: 16px 14px;
          z-index: -1;
        }
        .imessage-own.imessage-tail::after {
          right: -26px;
          width: 26px;
          background: var(--surface-1, #0F1923);
          border-bottom-left-radius: 10px;
          z-index: -1;
        }

        .imessage-other {
          background: var(--surface-3, #1D2D3E);
          align-self: flex-start;
          color: white;
        }
        .imessage-other.imessage-tail::before {
          left: -7px;
          width: 20px;
          background: var(--surface-3, #1D2D3E);
          border-bottom-right-radius: 16px 14px;
          z-index: -1;
        }
        .imessage-other.imessage-tail::after {
          left: -26px;
          width: 26px;
          background: var(--surface-1, #0F1923);
          border-bottom-right-radius: 10px;
          z-index: -1;
        }
        
        /* Media bubbles don't get standard padding or tails */
        .imessage-media {
          padding: 4px !important;
          border-radius: 14px !important;
        }
        .imessage-media::before, .imessage-media::after {
          display: none !important;
        }
      `}</style>
      <div
      data-msg-id={message.id}
      style={{ alignSelf: isOwn ? 'flex-end' : 'flex-start', maxWidth: '65%',
        display: 'flex', alignItems: 'flex-end', gap: 8, position: 'relative',
        marginBottom: isLast ? 8 : 2 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onContextMenu={(e) => { e.preventDefault(); if (editing || confirmDelete) return; setMenuOpen(!isMenuOpen); }}
    >
      {!isOwn && (
        <div style={{ width: 28, flexShrink: 0, opacity: isLast ? 1 : 0 }}>
          {isLast && <Avatar name={senderName ?? ''} size={28} />}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, position: 'relative', flex: 1, minWidth: 0, maxWidth: '100%' }}>
      {/* ── Visible action trigger button ── */}
      {showActionMenu && !message.is_deleted && (
        <button
          type="button"
          aria-label="Message Actions"
          title="Message Actions"
          onClick={(e) => { e.stopPropagation(); setMenuOpen(!isMenuOpen); }}
          style={{
            position: 'absolute',
            top: -24,
            // Own messages: button on the left. Others: button on the right.
            ...(isOwn ? { left: -50 } : { right: -50 }),
            background: isMenuOpen ? 'var(--surface-3, #1D2D3E)' : 'var(--surface-2, #162230)',
            border: '1px solid var(--surface-3, #1D2D3E)',
            borderRadius: 6,
            color: 'var(--white, #FFFFFF)',
            cursor: 'pointer',
            padding: '3px 5px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            // Desktop: show on hover. Mobile: always slightly visible.
            opacity: isMenuOpen ? 1 : hovered ? 1 : 0.25,
            transition: 'opacity 0.15s, background 0.15s',
          }}
          className="msg-action-btn"
        >
          <MoreHorizontal size={35} />
        </button>
      )}
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
        {isMenuOpen && showActionMenu && (
          <div role="menu" aria-label="Message Actions"
            style={{ position: 'absolute', bottom: 'calc(100% + 12px)', right: isOwn ? 0 : undefined, left: isOwn ? undefined : 0,
              display: 'flex', flexWrap: 'nowrap', overflowX: 'auto', maxWidth: 'calc(100vw - 32px)', gap: 4, background: 'var(--surface-3, #1D2D3E)', borderRadius: 8, padding: 4,
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)', zIndex: 5 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" onClick={() => { onReply(message); setMenuOpen(false); }} style={menuBtn} aria-label="Reply" title="Reply"><Reply size={40} /></button>
            <button type="button" onClick={() => { setMenuOpen(false); setPopoverOpen(true); }} style={menuBtn} aria-label="React" title="React"><Smile size={40} /></button>
            {canRemind && (
              <button
                type="button"
                onClick={() => { onSetReminder?.(message); setMenuOpen(false); }}
                style={menuBtn}
                aria-label="Remind Me"
                title="Remind Me"
              >
                <Bell size={40} />
              </button>
            )}
            {canReport && (
              <button
                type="button"
                onClick={() => { onReport?.(message); setMenuOpen(false); }}
                style={menuBtn}
                aria-label="Report Message"
                title="Report Message"
              >
                <Flag size={40} />
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
                <Pin size={40} />
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
                <Tag size={40} />
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
                <MessageSquare size={40} />
              </button>
            )}
            {isOwn && message.message_type === 'text' && (
              <button type="button" onClick={() => { setMenuOpen(false); setEditing(true); }} style={menuBtn} aria-label="Edit" title="Edit"><Pencil size={40} /></button>
            )}
            <button type="button" onClick={() => { setMenuOpen(false); setConfirmDelete(true); }} style={menuBtn} aria-label="Delete" title="Delete"><Trash2 size={40} /></button>
          </div>
        )}
        {popoverOpen && (
          <ReactionPopover
            onPick={(emoji) => { const had = grouped[emoji]?.mine === true; onReact(message, emoji, had ? 'remove' : 'add'); }}
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
            style={{ position: 'absolute', bottom: 'calc(100% + 12px)', right: isOwn ? 0 : undefined, left: isOwn ? undefined : 0,
              display: 'flex', flexWrap: 'wrap', gap: 6, background: 'var(--surface-3, #1D2D3E)', borderRadius: 8, padding: 6,
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)', zIndex: 5 }}
          >
            <button type="button" onClick={() => { onDelete(message, 'for_me'); setConfirmDelete(false); }} style={confirmBtnText} aria-label="Delete For Me" title="Delete For Me">Delete For Me</button>
            {isOwn && (
              <button type="button" onClick={() => { onDelete(message, 'for_everyone'); setConfirmDelete(false); }} style={{ ...confirmBtnText, color: 'var(--red, #E53E3E)' }} aria-label="Delete For Everyone" title="Delete For Everyone">Delete For Everyone</button>
            )}
            <button type="button" onClick={() => setConfirmDelete(false)} style={confirmBtnText} aria-label="Cancel" title="Cancel">Cancel</button>
          </div>
        )}
      </div>

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
