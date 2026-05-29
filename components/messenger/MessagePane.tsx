'use client';
import { useEffect } from 'react';
import { useMessengerStore } from '@/stores/messengerStore';
import type { Message } from '@/lib/messenger/types';
import { MessageCircle } from 'lucide-react';

interface Props {
  userId: string;
}

export default function MessagePane({ userId }: Props) {
  const activeId = useMessengerStore((s) => s.activeConversationId);
  const messagesByConv = useMessengerStore((s) => s.messages);
  const setMessages = useMessengerStore((s) => s.setMessages);
  const setLoading = useMessengerStore((s) => s.setLoadingMessages);
  const loadingByConv = useMessengerStore((s) => s.loadingMessages);

  useEffect(() => {
    if (!activeId) return;
    if (messagesByConv[activeId]) return;
    let cancelled = false;

    (async () => {
      setLoading(activeId, true);
      try {
        const res = await fetch('/api/messenger/get-messages', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ conversationId: activeId }),
        });
        if (!res.ok) return;
        const json = (await res.json()) as { messages?: Message[] };
        if (cancelled) return;
        setMessages(activeId, json.messages ?? []);
      } finally {
        if (!cancelled) setLoading(activeId, false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeId, messagesByConv, setMessages, setLoading]);

  if (!activeId) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--grey-400, #A8B4C0)',
          gap: 12,
        }}
      >
        <MessageCircle size={56} aria-hidden="true" />
        <div style={{ fontWeight: 600, color: 'var(--white, #FFFFFF)' }}>
          Open A Conversation
        </div>
        <div style={{ fontSize: '0.9rem' }}>Select One From The Left To See Messages.</div>
      </div>
    );
  }

  const messages = messagesByConv[activeId] ?? [];
  const loading = loadingByConv[activeId] ?? false;

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--surface-1, #0F1923)',
      }}
    >
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading && messages.length === 0 ? (
          <div style={{ color: 'var(--grey-400, #A8B4C0)', textAlign: 'center', marginTop: 32 }}>
            Loading Messages
          </div>
        ) : messages.length === 0 ? (
          <div style={{ color: 'var(--grey-400, #A8B4C0)', textAlign: 'center', marginTop: 32 }}>
            No Messages Yet. Composer Ships In Phase 4.
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              style={{
                alignSelf: m.sender_id === userId ? 'flex-end' : 'flex-start',
                background: m.sender_id === userId ? 'var(--teal, #00C4BC)' : 'var(--surface-2, #162230)',
                color: m.sender_id === userId ? '#000' : 'var(--white, #FFFFFF)',
                padding: '8px 12px',
                borderRadius: 14,
                maxWidth: '70%',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {m.text ?? ''}
            </div>
          ))
        )}
      </div>
      <div
        style={{
          padding: 16,
          borderTop: '1px solid var(--surface-3, #1D2D3E)',
          color: 'var(--grey-400, #A8B4C0)',
          fontSize: '0.84rem',
          textAlign: 'center',
        }}
      >
        Composer Ships In Phase 4.
      </div>
    </div>
  );
}
