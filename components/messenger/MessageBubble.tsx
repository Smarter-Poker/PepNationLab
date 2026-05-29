'use client';
import { useState } from 'react';
import { Reply, Smile, Pencil, Trash2, Check, X } from 'lucide-react';
import type { Message, Reaction } from '@/lib/messenger/types';
import ReactionPopover from './ReactionPopover';

interface Props {
  message: Message;
  isOwn: boolean;
  reactions: Reaction[];
  selfId: string;
  onReply: (m: Message) => void;
  onReact: (m: Message, emoji: string, action: 'add' | 'remove') => void;
  onEdit: (m: Message, nextText: string) => Promise<boolean>;
  onDelete: (m: Message, scope: 'for_me' | 'for_everyone') => void;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function MessageBubble({
  message,
  isOwn,
  reactions,
  selfId,
  onReply,
  onReact,
  onEdit,
  onDelete,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.text ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const failed = (message.metadata as { failed?: boolean })?.failed === true;
  const pending = message.id.startsWith('temp-');

  const grouped = reactions.reduce<Record<string, { count: number; mine: boolean }>>((acc, r) => {
    const key = r.emoji ?? r.gif_url ?? '?';
    const cur = acc[key] ?? { count: 0, mine: false };
    acc[key] = { count: cur.count + 1, mine: cur.mine || r.user_id === selfId };
    return acc;
  }, {});

  return (
    <div
      style={{
        alignSelf: isOwn ? 'flex-end' : 'flex-start',
        maxWidth: '70%',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        position: 'relative',
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        if (editing || confirmDelete) return;
        setMenuOpen((v) => !v);
      }}
    >
      <div
        style={{
          position: 'relative',
          background: isOwn ? 'var(--teal, #00C4BC)' : 'var(--surface-2, #162230)',
          color: isOwn ? '#000' : 'var(--white, #FFFFFF)',
          padding: '8px 12px',
          borderRadius: 14,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          opacity: pending ? 0.7 : 1,
          border: failed ? '1px solid var(--red, #E53E3E)' : 'none',
        }}
      >
        {message.is_deleted && message.delete_scope === 'for_everyone' ? (
          <em style={{ opacity: 0.7 }}>Message Deleted</em>
        ) : editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value.slice(0, 2000))}
              rows={2}
              style={{
                width: '100%',
                resize: 'vertical',
                background: 'var(--surface-1, #0F1923)',
                color: 'var(--white, #FFFFFF)',
                border: '1px solid var(--surface-3, #1D2D3E)',
                borderRadius: 8,
                padding: 6,
              }}
              aria-label="Edit Message"
            />
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={async () => {
                  const ok = await onEdit(message, editText.trim());
                  if (ok) setEditing(false);
                }}
                style={confirmBtn}
                aria-label="Save Edit"
                title="Save Edit"
              >
                <Check size={14} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setEditText(message.text ?? '');
                }}
                style={confirmBtn}
                aria-label="Cancel Edit"
                title="Cancel Edit"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        ) : (
          (message.text ?? '')
        )}

        {menuOpen && !editing && !confirmDelete && (
          <div
            role="menu"
            aria-label="Message Actions"
            style={{
              position: 'absolute',
              top: '-44px',
              right: isOwn ? 0 : undefined,
              left: isOwn ? undefined : 0,
              display: 'flex',
              gap: 4,
              background: 'var(--surface-3, #1D2D3E)',
              borderRadius: 8,
              padding: 4,
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              zIndex: 5,
            }}
          >
            <button
              type="button"
              onClick={() => {
                onReply(message);
                setMenuOpen(false);
              }}
              style={menuBtn}
              aria-label="Reply"
              title="Reply"
            >
              <Reply size={16} />
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setPopoverOpen(true);
              }}
              style={menuBtn}
              aria-label="React"
              title="React"
            >
              <Smile size={16} />
            </button>
            {isOwn && (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setEditing(true);
                }}
                style={menuBtn}
                aria-label="Edit"
                title="Edit"
              >
                <Pencil size={16} />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setConfirmDelete(true);
              }}
              style={menuBtn}
              aria-label="Delete"
              title="Delete"
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}

        {popoverOpen && (
          <ReactionPopover
            onPick={(emoji) => {
              const had = grouped[emoji]?.mine === true;
              onReact(message, emoji, had ? 'remove' : 'add');
            }}
            onClose={() => setPopoverOpen(false)}
          />
        )}

        {confirmDelete && (
          <div
            role="menu"
            aria-label="Confirm Delete"
            style={{
              position: 'absolute',
              top: '-52px',
              right: isOwn ? 0 : undefined,
              left: isOwn ? undefined : 0,
              display: 'flex',
              gap: 6,
              background: 'var(--surface-3, #1D2D3E)',
              borderRadius: 8,
              padding: 6,
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              zIndex: 5,
            }}
          >
            <button
              type="button"
              onClick={() => {
                onDelete(message, 'for_me');
                setConfirmDelete(false);
              }}
              style={confirmBtnText}
              aria-label="Delete For Me"
              title="Delete For Me"
            >
              Delete For Me
            </button>
            {isOwn && (
              <button
                type="button"
                onClick={() => {
                  onDelete(message, 'for_everyone');
                  setConfirmDelete(false);
                }}
                style={{ ...confirmBtnText, color: 'var(--red, #E53E3E)' }}
                aria-label="Delete For Everyone"
                title="Delete For Everyone"
              >
                Delete For Everyone
              </button>
            )}
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              style={confirmBtnText}
              aria-label="Cancel"
              title="Cancel"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {Object.keys(grouped).length > 0 && !message.is_deleted && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 4,
            alignSelf: isOwn ? 'flex-end' : 'flex-start',
            padding: '2px 4px',
          }}
        >
          {Object.entries(grouped).map(([emoji, info]) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onReact(message, emoji, info.mine ? 'remove' : 'add')}
              style={{
                background: info.mine ? 'var(--teal, #00C4BC)' : 'var(--surface-2, #162230)',
                color: info.mine ? '#000' : 'var(--white, #FFFFFF)',
                border: '1px solid var(--surface-3, #1D2D3E)',
                borderRadius: 999,
                padding: '2px 8px',
                fontSize: '0.78rem',
                display: 'inline-flex',
                gap: 4,
                alignItems: 'center',
                cursor: 'pointer',
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
        style={{
          fontSize: '0.7rem',
          color: 'var(--grey-400, #A8B4C0)',
          alignSelf: isOwn ? 'flex-end' : 'flex-start',
          padding: '0 6px',
        }}
      >
        {failed ? 'Failed To Send' : pending ? 'Sending' : formatTime(message.created_at)}
        {message.is_edited && !message.is_deleted ? ' (Edited)' : ''}
      </div>
    </div>
  );
}

const menuBtn: React.CSSProperties = {
  background: 'transparent',
  border: 0,
  color: 'var(--white, #FFFFFF)',
  cursor: 'pointer',
  padding: 4,
  borderRadius: 4,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const confirmBtn: React.CSSProperties = {
  background: 'var(--surface-1, #0F1923)',
  border: '1px solid var(--surface-3, #1D2D3E)',
  color: 'var(--white, #FFFFFF)',
  cursor: 'pointer',
  padding: '4px 8px',
  borderRadius: 6,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
};

const confirmBtnText: React.CSSProperties = {
  background: 'transparent',
  border: 0,
  color: 'var(--white, #FFFFFF)',
  cursor: 'pointer',
  padding: '4px 8px',
  borderRadius: 6,
  fontSize: '0.84rem',
};
