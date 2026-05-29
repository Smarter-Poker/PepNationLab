'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMessengerStore } from '@/stores/messengerStore';
import type { Message, Reaction } from '@/lib/messenger/types';
import { MessageCircle } from 'lucide-react';
import MessageBubble from './MessageBubble';
import MessageComposer from './MessageComposer';
import TypingIndicator from './TypingIndicator';
import { toast } from 'sonner';
import {
  subscribeMessages,
  subscribeReactions,
  subscribeTyping,
  unsubscribe,
} from '@/lib/messenger/realtime';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface Props {
  userId: string;
}

const TYPING_TTL_MS = 4000;

// Audit fix: stable channel suffix derived from the message ID list so the
// reaction channel name is unique to the current set, not just "first id".
function stableKey(parts: string[]): string {
  let h = 5381;
  for (const p of parts) {
    for (let i = 0; i < p.length; i++) {
      h = ((h << 5) + h) ^ p.charCodeAt(i);
      h |= 0;
    }
  }
  return (h >>> 0).toString(36);
}

async function markConversationRead(conversationId: string, lastReadMessageId: string) {
  try {
    await fetch('/api/messenger/mark-read', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ conversationId, lastReadMessageId }),
    });
  } catch {
    // Best-effort -- the trigger will re-increment when the next message arrives.
  }
}

export default function MessagePane({ userId }: Props) {
  const activeId = useMessengerStore((s) => s.activeConversationId);
  const messagesByConv = useMessengerStore((s) => s.messages);
  const setMessages = useMessengerStore((s) => s.setMessages);
  const setLoading = useMessengerStore((s) => s.setLoadingMessages);
  const loadingByConv = useMessengerStore((s) => s.loadingMessages);
  const appendMessage = useMessengerStore((s) => s.appendMessage);
  const updateMessage = useMessengerStore((s) => s.updateMessage);
  const removeMessage = useMessengerStore((s) => s.removeMessage);
  const conversations = useMessengerStore((s) => s.conversations);
  const setConversations = useMessengerStore((s) => s.setConversations);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [reactionsByMsg, setReactionsByMsg] = useState<Record<string, Reaction[]>>({});
  const [typingUserIds, setTypingUserIds] = useState<string[]>([]);

  const typingExpiryRef = useRef<Record<string, number>>({});
  const typingSweeperRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setReplyTo(null);
  }, [activeId]);

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
        const json = (await res.json()) as { messages?: Message[]; reactions?: Reaction[] };
        if (cancelled) return;
        const list = json.messages ?? [];
        setMessages(activeId, list);
        const map: Record<string, Reaction[]> = {};
        (json.reactions ?? []).forEach((r) => {
          (map[r.message_id] ??= []).push(r);
        });
        setReactionsByMsg(map);
        // Audit fix: mark conversation read when the user opens it, so the
        // unread badge on the conversation list drops to zero. The previous
        // build never called this endpoint, leaving badges permanently stale.
        const lastId = list.length > 0 ? list[list.length - 1].id : null;
        if (lastId) void markConversationRead(activeId, lastId);
      } finally {
        if (!cancelled) setLoading(activeId, false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeId, messagesByConv, setMessages, setLoading]);

  useEffect(() => {
    if (!activeId) return;

    const msgCh = subscribeMessages(activeId, {
      onInsert: (m) => {
        if (m.sender_id === userId) return;
        appendMessage(activeId, m);
        // Audit fix: clear unread for messages the user is actively viewing.
        void markConversationRead(activeId, m.id);
      },
      onUpdate: (m) => updateMessage(activeId, m),
      onDelete: (id) => removeMessage(activeId, id),
    });

    const typing = subscribeTyping(activeId, userId, (e) => {
      if (e.isTyping) {
        typingExpiryRef.current[e.userId] = Date.now() + TYPING_TTL_MS;
        setTypingUserIds((cur) => (cur.includes(e.userId) ? cur : [...cur, e.userId]));
      } else {
        delete typingExpiryRef.current[e.userId];
        setTypingUserIds((cur) => cur.filter((u) => u !== e.userId));
      }
    });

    typingSweeperRef.current = setInterval(() => {
      const now = Date.now();
      const stale: string[] = [];
      for (const [uid, exp] of Object.entries(typingExpiryRef.current)) {
        if (exp <= now) stale.push(uid);
      }
      if (stale.length > 0) {
        stale.forEach((uid) => delete typingExpiryRef.current[uid]);
        setTypingUserIds((cur) => cur.filter((u) => !stale.includes(u)));
      }
    }, 1000);

    return () => {
      if (typingSweeperRef.current) clearInterval(typingSweeperRef.current);
      typingSweeperRef.current = null;
      typingExpiryRef.current = {};
      setTypingUserIds([]);
      unsubscribe(msgCh);
      unsubscribe(typing.channel);
    };
  }, [activeId, userId, appendMessage, updateMessage, removeMessage]);

  // Audit fix: also bump the local conversation list unread to zero when
  // we activate -- the API call lands eventually but the optimistic update
  // prevents the badge from flashing on a quick switch.
  useEffect(() => {
    if (!activeId) return;
    if (!conversations.some((c) => c.conversation_id === activeId && (c.unread_count ?? 0) > 0)) return;
    setConversations(
      conversations.map((c) => (c.conversation_id === activeId ? { ...c, unread_count: 0 } : c)),
    );
  }, [activeId, conversations, setConversations]);

  const messageIds = (messagesByConv[activeId ?? ''] ?? []).map((m) => m.id);
  const messageIdsKey = messageIds.join('|');
  const reactionChannelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!activeId) return;
    if (messageIds.length === 0) {
      if (reactionChannelRef.current) {
        unsubscribe(reactionChannelRef.current);
        reactionChannelRef.current = null;
      }
      return;
    }
    const channelHint = stableKey(messageIds);
    const ch = subscribeReactions(messageIds, {
      onInsert: (r) => {
        setReactionsByMsg((prev) => {
          const arr = prev[r.message_id] ?? [];
          // Audit fix: when the realtime echo of our OWN optimistic reaction
          // arrives, replace the temp `r-...` entry with the server row so
          // the visible count stays correct. For other users, dedupe by
          // (user_id, emoji) -- one user can only hold one of an emoji.
          if (r.user_id === userId) {
            const withoutTemp = arr.filter(
              (x) => !(x.user_id === userId && x.emoji === r.emoji && x.id.startsWith('r-')),
            );
            if (withoutTemp.some((x) => x.user_id === userId && x.emoji === r.emoji && x.id === r.id)) {
              return { ...prev, [r.message_id]: withoutTemp };
            }
            return { ...prev, [r.message_id]: [...withoutTemp, r] };
          }
          if (arr.some((x) => x.user_id === r.user_id && x.emoji === r.emoji)) return prev;
          return { ...prev, [r.message_id]: [...arr, r] };
        });
      },
      onDelete: (r) => {
        setReactionsByMsg((prev) => {
          const arr = prev[r.message_id] ?? [];
          return {
            ...prev,
            [r.message_id]: arr.filter((x) => !(x.user_id === r.user_id && x.emoji === r.emoji)),
          };
        });
      },
    }, channelHint);
    reactionChannelRef.current = ch;
    return () => {
      if (reactionChannelRef.current) {
        unsubscribe(reactionChannelRef.current);
        reactionChannelRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, messageIdsKey, userId]);

  const handleReact = useCallback(
    async (m: Message, emoji: string, action: 'add' | 'remove') => {
      const fakeId = `r-${m.id}-${emoji}-${userId}`;
      setReactionsByMsg((prev) => {
        const arr = prev[m.id] ?? [];
        const next =
          action === 'add'
            ? [
                ...arr,
                {
                  id: fakeId,
                  message_id: m.id,
                  user_id: userId,
                  reaction_type: 'emoji' as const,
                  emoji,
                  gif_url: null,
                  created_at: new Date().toISOString(),
                },
              ]
            : arr.filter((r) => !(r.user_id === userId && r.emoji === emoji));
        return { ...prev, [m.id]: next };
      });
      try {
        const res = await fetch('/api/messenger/react-message', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ messageId: m.id, emoji, action }),
        });
        if (!res.ok) throw new Error('react failed');
      } catch {
        setReactionsByMsg((prev) => {
          const arr = prev[m.id] ?? [];
          const reverted =
            action === 'add'
              ? arr.filter((r) => r.id !== fakeId)
              : [
                  ...arr,
                  {
                    id: fakeId,
                    message_id: m.id,
                    user_id: userId,
                    reaction_type: 'emoji' as const,
                    emoji,
                    gif_url: null,
                    created_at: new Date().toISOString(),
                  },
                ];
          return { ...prev, [m.id]: reverted };
        });
        toast('Reaction Failed');
      }
    },
    [userId],
  );

  const handleEdit = useCallback(
    async (m: Message, nextText: string): Promise<boolean> => {
      if (!nextText || nextText === m.text) return false;
      try {
        const res = await fetch('/api/messenger/edit-message', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ messageId: m.id, text: nextText }),
        });
        if (!res.ok) {
          const json = (await res.json().catch(() => ({}))) as { error?: string };
          toast(json.error ?? 'Edit Failed');
          return false;
        }
        const json = (await res.json()) as { message: Message };
        updateMessage(m.conversation_id, json.message);
        return true;
      } catch {
        toast('Network Error');
        return false;
      }
    },
    [updateMessage],
  );

  const handleDelete = useCallback(
    async (m: Message, scope: 'for_me' | 'for_everyone') => {
      const snapshot = m;
      if (scope === 'for_me') {
        removeMessage(m.conversation_id, m.id);
      } else {
        updateMessage(m.conversation_id, {
          ...m,
          is_deleted: true,
          delete_scope: 'for_everyone',
          text: null,
          media_url: null,
        });
      }
      try {
        const res = await fetch('/api/messenger/delete-message', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ messageId: m.id, scope }),
        });
        if (!res.ok) {
          const json = (await res.json().catch(() => ({}))) as { error?: string };
          toast(json.error ?? 'Delete Failed');
          if (scope === 'for_me') appendMessage(m.conversation_id, snapshot);
          else updateMessage(m.conversation_id, snapshot);
        }
      } catch {
        toast('Network Error');
        if (scope === 'for_me') appendMessage(m.conversation_id, snapshot);
        else updateMessage(m.conversation_id, snapshot);
      }
    },
    [appendMessage, removeMessage, updateMessage],
  );

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
        <div style={{ fontWeight: 600, color: 'var(--white, #FFFFFF)' }}>Open A Conversation</div>
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
            No Messages Yet. Send The First One Below.
          </div>
        ) : (
          messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              isOwn={m.sender_id === userId}
              reactions={reactionsByMsg[m.id] ?? []}
              selfId={userId}
              onReply={setReplyTo}
              onReact={handleReact}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>
      <TypingIndicator typingUserIds={typingUserIds} />
      <MessageComposer
        conversationId={activeId}
        selfId={userId}
        replyTo={replyTo}
        onClearReply={() => setReplyTo(null)}
      />
    </div>
  );
}
