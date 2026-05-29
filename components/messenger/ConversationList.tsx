'use client';
import { useEffect, useState } from 'react';
import { useMessengerStore } from '@/stores/messengerStore';
import ConversationItem from './ConversationItem';
import NewConversationDialog from './NewConversationDialog';
import { MessageSquare, PenSquare } from 'lucide-react';

interface Props {
  selfId: string;
}

export default function ConversationList({ selfId }: Props) {
  const conversations = useMessengerStore((s) => s.conversations);
  const activeId = useMessengerStore((s) => s.activeConversationId);
  const setActive = useMessengerStore((s) => s.setActive);
  const setConversations = useMessengerStore((s) => s.setConversations);
  const setLoading = useMessengerStore((s) => s.setLoadingConversations);
  const loading = useMessengerStore((s) => s.loadingConversations);

  const [composeOpen, setComposeOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/messenger/get-conversations', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        });
        if (!res.ok) return;
        const json = (await res.json()) as { conversations?: unknown };
        if (cancelled) return;
        const list = Array.isArray(json.conversations) ? (json.conversations as never[]) : [];
        setConversations(list);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setConversations, setLoading]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          padding: '6px 10px',
          borderBottom: '1px solid var(--surface-3, #1D2D3E)',
        }}
      >
        <button
          type="button"
          onClick={() => setComposeOpen(true)}
          aria-label="Start A New Conversation"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: 6,
            border: '1px solid var(--teal, #00C4BC)',
            background: 'transparent',
            color: 'var(--teal, #00C4BC)',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '0.78rem',
          }}
        >
          <PenSquare size={12} aria-hidden="true" />
          Compose
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {loading && conversations.length === 0 ? (
          <div style={{ padding: 24, color: 'var(--grey-400, #A8B4C0)', fontSize: '0.9rem' }}>
            Loading Conversations
          </div>
        ) : conversations.length === 0 ? (
          <div
            style={{
              padding: 24,
              textAlign: 'center',
              color: 'var(--grey-400, #A8B4C0)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              marginTop: 32,
            }}
          >
            <MessageSquare size={36} aria-hidden="true" />
            <div style={{ fontWeight: 600, color: 'var(--white, #FFFFFF)' }}>No Conversations Yet</div>
            <div style={{ fontSize: '0.84rem' }}>Start A New Conversation To Begin.</div>
          </div>
        ) : (
          conversations.map((c) => (
            <ConversationItem
              key={c.conversation_id}
              conversation={c}
              active={activeId === c.conversation_id}
              onClick={() => setActive(c.conversation_id)}
            />
          ))
        )}
      </div>
      {composeOpen && <NewConversationDialog selfId={selfId} onClose={() => setComposeOpen(false)} />}
    </div>
  );
}
