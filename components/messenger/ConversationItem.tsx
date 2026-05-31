'use client';
import Avatar from './Avatar';
import type { ConversationListItem } from '@/lib/messenger/types';

interface Props {
  conversation: ConversationListItem;
  active: boolean;
  onClick: () => void;
}

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function resolveLabel(c: ConversationListItem): string {
  if (c.title && c.title.trim().length > 0) return c.title;
  if (c.type === 'direct') {
    if (c.counterparty_full_name && c.counterparty_full_name.trim().length > 0) return c.counterparty_full_name;
    if (c.counterparty_username && c.counterparty_username.trim().length > 0) return c.counterparty_username;
    return 'Direct Message';
  }
  return 'Conversation';
}

export default function ConversationItem({ conversation, active, onClick }: Props) {
  const unread = conversation.unread_count ?? 0;
  const label = resolveLabel(conversation);
  const avatarToUse = conversation.type === 'direct' 
    ? (conversation.counterparty_avatar_url || conversation.avatar_url) 
    : conversation.avatar_url;

  return (
    <button
      type="button"
      className="hover-lift"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        width: '100%',
        padding: '12px 14px',
        background: active ? 'linear-gradient(90deg, rgba(0,196,188,0.1) 0%, rgba(0,0,0,0) 100%)' : 'transparent',
        border: 0,
        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
        borderLeft: active ? '3px solid var(--teal)' : '3px solid transparent',
        cursor: 'pointer',
        textAlign: 'left',
        color: 'var(--white, #FFFFFF)',
        transition: 'all 0.2s',
      }}
    >
      <Avatar name={label} avatarUrl={avatarToUse} size={44} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <span
            style={{
              fontWeight: unread > 0 ? 700 : 500,
              fontSize: '0.95rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </span>
          <span style={{ fontSize: '0.75rem', color: active ? 'var(--teal)' : 'var(--grey-400, #A8B4C0)', transition: 'color 0.2s' }}>
            {timeAgo(conversation.last_message_at)}
          </span>
        </div>
        <div
          style={{
            fontSize: '0.84rem',
            color: 'var(--grey-400, #A8B4C0)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginTop: 2,
          }}
        >
          {conversation.last_message_text || 'No Messages Yet'}
        </div>
      </div>
      {unread > 0 && (
        <span
          style={{
            background: 'var(--teal, #00C4BC)',
            color: '#000',
            fontWeight: 700,
            fontSize: '0.74rem',
            borderRadius: '999px',
            padding: '2px 8px',
            minWidth: 22,
            textAlign: 'center',
          }}
        >
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </button>
  );
}
