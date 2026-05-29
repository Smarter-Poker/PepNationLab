'use client';
import { useState } from 'react';
import { Reply, Smile, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Message } from '@/lib/messenger/types';

interface Props {
  message: Message;
  isOwn: boolean;
  onReply: (m: Message) => void;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function MessageBubble({ message, isOwn, onReply }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const failed = (message.metadata as { failed?: boolean })?.failed === true;
  const pending = message.id.startsWith('temp-');

  return (
    <div
      style={{
        alignSelf: isOwn ? 'flex-end' : 'flex-start',
        maxWidth: '70%',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
      onContextMenu={(e) => {
        e.preventDefault();
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
        {message.is_deleted && message.delete_scope === 'for_everyone'
          ? 'Message Deleted'
          : (message.text ?? '')}
        {menuOpen && (
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
                toast('Reactions Ship In Phase 5');
                setMenuOpen(false);
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
                  toast('Edit Ships In Phase 5');
                  setMenuOpen(false);
                }}
                style={menuBtn}
                aria-label="Edit"
                title="Edit"
              >
                <Pencil size={16} />
              </button>
            )}
            {isOwn && (
              <button
                type="button"
                onClick={() => {
                  toast('Delete Ships In Phase 5');
                  setMenuOpen(false);
                }}
                style={menuBtn}
                aria-label="Delete"
                title="Delete"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        )}
      </div>
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
