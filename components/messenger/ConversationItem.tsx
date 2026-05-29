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

export default function ConversationItem({ conversation, active, onClick }: Props) {
  const unread = conversation.unread_count ?? 0;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        width: '100%',
        padding: '12px 14px',
        background: active ? 'var(--surface-2, #162230)' : 'transparent',
        border: 0,
        borderBottom: '1px solid var(--surface-3, #1D2D3E)',
        cursor: 'pointer',
        textAlign: 'left',
        color: 'var(--white, #FFFFFF)',
      }}
    >
      <Avatar name={conversation.title ?? 'Conversation'} avatarUrl={conversation.avatar_url} size={44} />
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
            {conversation.title || 'Direct Message'}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--grey-400, #A8B4C0)' }}>
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
