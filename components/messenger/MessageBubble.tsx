'use client';
import { useEffect, useState } from 'react';
import { Reply, Smile, Pencil, Trash2, Check, X, Download, Pin, Bookmark, Tag, MessageSquare } from 'lucide-react';
import type { Message, Reaction, ParticipantRole } from '@/lib/messenger/types';
import type { MessageLabelValue } from '@/lib/messenger/schemas';
import ReactionPopover from './ReactionPopover';
import VoicePlayer from './VoicePlayer';
import ImageLightbox from './ImageLightbox';
import LinkPreview from './LinkPreview';
import LabelsMenu from './LabelsMenu';
import { toast } from 'sonner';

interface Props {
  message: Message;
  isOwn: boolean;
  reactions: Reaction[];
  selfId: string;
  selfRole?: ParticipantRole | null;
  conversationType?: 'direct' | 'group' | 'announcement';
  isPinned?: boolean;
  isBookmarked?: boolean;
  currentLabels?: MessageLabelValue[];
  onReply: (m: Message) => void;
  onReact: (m: Message, emoji: string, action: 'add' | 'remove') => void;
  onEdit: (m: Message, nextText: string) => Promise<boolean>;
  onDelete: (m: Message, scope: 'for_me' | 'for_everyone') => void;
  onPinToggle?: (m: Message, action: 'pin' | 'unpin') => void;
  onBookmarkToggle?: (m: Message, action: 'add' | 'remove') => void;
  onLabelToggle?: (m: Message, label: MessageLabelValue, action: 'add' | 'remove') => void;
  onThread?: (m: Message) => void;
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
  message, isOwn, reactions, selfId,
  selfRole = null, conversationType,
  isPinned = false, isBookmarked = false, currentLabels = [],
  onReply, onReact, onEdit, onDelete,
  onPinToggle, onBookmarkToggle, onLabelToggle, onThread,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.text ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [expiryTick, setExpiryTick] = useState(0);
  const failed = (message.metadata as { failed?: boolean })?.failed === true;
  const pending = message.id.startsWith('temp-');
  const meta = (message.media_metadata ?? {}) as { filename?: string; size?: number; durationSec?: number; contentType?: string };
  const url = extractFirstUrl(message.text);
  const isMediaBubble = message.message_type === 'image' || message.message_type === 'gif';

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
  const canBookmark = Boolean(onBookmarkToggle) && !message.is_deleted;
  const canLabel = Boolean(onLabelToggle) && !message.is_deleted;
  const canThread = Boolean(onThread)
    && !message.is_deleted
    && conversationType !== 'direct'
    && !message.thread_parent_id; // Don't allow threads on replies in this iteration.

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
        <button type="button" onClick={() => setLightbox(true)} aria-label="Open Image"
          style={{ background: 'transparent', border: 0, padding: 0, cursor: 'zoom-in' }}
        >
          <img src={message.media_url} alt="Image" loading="lazy"
            style={{ maxWidth: 320, maxHeight: 240, borderRadius: 10, display: 'block' }}
          />
        </button>
      );
    }
    if (message.message_type === 'gif' && message.media_url) {
      return (
        <img src={message.media_url} alt="Gif" loading="lazy"
          style={{ maxWidth: 320, maxHeight: 240, borderRadius: 10, display: 'block' }}
        />
      );
    }
    if (message.message_type === 'voice' && message.media_url) {
      return <VoicePlayer src={message.media_url} />;
    }
    if (message.message_type === 'file' && message.media_url) {
      return (
        <a href={safeHref(message.media_url)} target="_blank" rel="noopener noreferrer" download={meta.filename ?? true}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: isOwn ? '#000' : 'var(--white, #FFFFFF)' }}
          aria-label={`Download ${meta.filename ?? 'File'}`}
        >
          <Download size={16} />
          <span>{meta.filename ?? 'Download'}</span>
          {meta.size ? <span style={{ opacity: 0.7, fontSize: '0.78rem' }}>({formatSize(meta.size)})</span> : null}
        </a>
      );
    }
    return <span>{message.text ?? ''}</span>;
  };

  const expiryLabel = formatExpiry(message.expires_at);

  return (
    <div
      data-msg-id={message.id}
      style={{ alignSelf: isOwn ? 'flex-end' : 'flex-start', maxWidth: '70%',
        display: 'flex', flexDirection: 'column', gap: 2, position: 'relative' }}
      onContextMenu={(e) => { e.preventDefault(); if (editing || confirmDelete) return; setMenuOpen((v) => !v); }}
    >
      {(isPinned || isBookmarked || currentLabels.length > 0) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignSelf: isOwn ? 'flex-end' : 'flex-start', padding: '0 4px' }}>
          {isPinned && (
            <span style={badgeStyle} aria-label="Pinned">
              <Pin size={10} aria-hidden="true" />
              Pinned
            </span>
          )}
          {isBookmarked && (
            <span style={badgeStyle} aria-label="Bookmarked">
              <Bookmark size={10} aria-hidden="true" />
              Saved
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
        style={{
          position: 'relative',
          background: isOwn ? 'var(--teal, #00C4BC)' : 'var(--surface-2, #162230)',
          color: isOwn ? '#000' : 'var(--white, #FFFFFF)',
          padding: isMediaBubble ? 4 : '8px 12px',
          borderRadius: 14, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          opacity: pending ? 0.7 : 1,
          border: failed ? '1px solid var(--red, #E53E3E)' : 'none',
        }}
      >
        {renderBody()}
        {menuOpen && showActionMenu && (
          <div role="menu" aria-label="Message Actions"
            style={{ position: 'absolute', top: '-44px', right: isOwn ? 0 : undefined, left: isOwn ? undefined : 0,
              display: 'flex', gap: 4, background: 'var(--surface-3, #1D2D3E)', borderRadius: 8, padding: 4,
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)', zIndex: 5 }}
          >
            <button type="button" onClick={() => { onReply(message); setMenuOpen(false); }} style={menuBtn} aria-label="Reply" title="Reply"><Reply size={16} /></button>
            <button type="button" onClick={() => { setMenuOpen(false); setPopoverOpen(true); }} style={menuBtn} aria-label="React" title="React"><Smile size={16} /></button>
            {canPin && (
              <button
                type="button"
                onClick={() => { onPinToggle?.(message, isPinned ? 'unpin' : 'pin'); setMenuOpen(false); }}
                style={menuBtn}
                aria-label={isPinned ? 'Unpin Message' : 'Pin Message'}
                title={isPinned ? 'Unpin Message' : 'Pin Message'}
              >
                <Pin size={16} />
              </button>
            )}
            {canBookmark && (
              <button
                type="button"
                onClick={() => { onBookmarkToggle?.(message, isBookmarked ? 'remove' : 'add'); setMenuOpen(false); }}
                style={menuBtn}
                aria-label={isBookmarked ? 'Remove Bookmark' : 'Bookmark'}
                title={isBookmarked ? 'Remove Bookmark' : 'Bookmark'}
              >
                <Bookmark size={16} />
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
                <Tag size={16} />
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
                <MessageSquare size={16} />
              </button>
            )}
            {isOwn && message.message_type === 'text' && (
              <button type="button" onClick={() => { setMenuOpen(false); setEditing(true); }} style={menuBtn} aria-label="Edit" title="Edit"><Pencil size={16} /></button>
            )}
            <button type="button" onClick={() => { setMenuOpen(false); setConfirmDelete(true); }} style={menuBtn} aria-label="Delete" title="Delete"><Trash2 size={16} /></button>
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
            style={{ position: 'absolute', top: '-52px', right: isOwn ? 0 : undefined, left: isOwn ? undefined : 0,
              display: 'flex', gap: 6, background: 'var(--surface-3, #1D2D3E)', borderRadius: 8, padding: 6,
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

      <div
        style={{ fontSize: '0.7rem', color: 'var(--grey-400, #A8B4C0)',
          alignSelf: isOwn ? 'flex-end' : 'flex-start', padding: '0 6px' }}
      >
        {failed ? 'Failed To Send' : pending ? 'Sending' : formatTime(message.created_at)}
        {message.is_edited && !message.is_deleted ? ' (Edited)' : ''}
        {expiryLabel ? ` (${expiryLabel})` : ''}
      </div>

      {lightbox && message.media_url && <ImageLightbox src={message.media_url} onClose={() => setLightbox(false)} />}
    </div>
  );
}

const menuBtn: React.CSSProperties = {
  background: 'transparent', border: 0, color: 'var(--white, #FFFFFF)', cursor: 'pointer',
  padding: 4, borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
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
