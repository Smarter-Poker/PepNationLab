'use client';
import { createClient } from '@/lib/supabase/client';
import type { Message, Reaction, Participant } from './types';
import type { RealtimeChannel } from '@supabase/supabase-js';

const supabase = createClient();

interface MessageHandlers {
  onInsert?: (m: Message) => void;
  onUpdate?: (m: Message) => void;
  onDelete?: (id: string) => void;
}

export function subscribeMessages(conversationId: string, handlers: MessageHandlers): RealtimeChannel {
  const ch = supabase.channel(`mm:${conversationId}`);
  ch.on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'messenger_messages',
      filter: `conversation_id=eq.${conversationId}`,
    },
    (payload) => handlers.onInsert?.(payload.new as Message),
  );
  ch.on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'messenger_messages',
      filter: `conversation_id=eq.${conversationId}`,
    },
    (payload) => handlers.onUpdate?.(payload.new as Message),
  );
  ch.on(
    'postgres_changes',
    {
      event: 'DELETE',
      schema: 'public',
      table: 'messenger_messages',
      filter: `conversation_id=eq.${conversationId}`,
    },
    (payload) => {
      const old = payload.old as { id?: string };
      if (old?.id) handlers.onDelete?.(old.id);
    },
  );
  ch.subscribe();
  return ch;
}

interface ReactionHandlers {
  onInsert?: (r: Reaction) => void;
  onDelete?: (r: { message_id: string; user_id: string; emoji: string | null }) => void;
}

// Audit fix: accept a `channelHint` so the channel name is stable across
// re-subs for the same set of message ids. Previous code keyed on the
// first id, so two sets that started with the same id (rare but possible)
// would collide. Caller passes a hash of all ids; we fall back to the
// first id for back-compat.
export function subscribeReactions(
  messageIds: string[],
  handlers: ReactionHandlers,
  channelHint?: string,
): RealtimeChannel | null {
  if (messageIds.length === 0) return null;
  const suffix = channelHint && channelHint.length > 0 ? channelHint : messageIds[0];
  const ch = supabase.channel(`mr:${suffix}`);
  ch.on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'messenger_reactions',
      filter: `message_id=in.(${messageIds.join(',')})`,
    },
    (payload) => handlers.onInsert?.(payload.new as Reaction),
  );
  ch.on(
    'postgres_changes',
    {
      event: 'DELETE',
      schema: 'public',
      table: 'messenger_reactions',
      filter: `message_id=in.(${messageIds.join(',')})`,
    },
    (payload) => {
      const old = payload.old as { message_id?: string; user_id?: string; emoji?: string | null };
      if (old?.message_id && old?.user_id) {
        handlers.onDelete?.({
          message_id: old.message_id,
          user_id: old.user_id,
          emoji: old.emoji ?? null,
        });
      }
    },
  );
  ch.subscribe();
  return ch;
}

interface ParticipantHandlers {
  onUpdate?: (p: Participant) => void;
}

export function subscribeParticipants(userId: string, handlers: ParticipantHandlers): RealtimeChannel {
  const ch = supabase.channel(`mp:${userId}`);
  ch.on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'messenger_participants',
      filter: `user_id=eq.${userId}`,
    },
    (payload) => handlers.onUpdate?.(payload.new as Participant),
  );
  ch.subscribe();
  return ch;
}

export interface TypingEvent {
  userId: string;
  isTyping: boolean;
  at: number;
}

export function subscribeTyping(
  conversationId: string,
  selfId: string,
  onEvent: (e: TypingEvent) => void,
): { channel: RealtimeChannel; broadcast: (isTyping: boolean) => void } {
  const ch = supabase.channel(`mt:${conversationId}`, {
    config: { broadcast: { self: false } },
  });
  ch.on('broadcast', { event: 'typing' }, (payload) => {
    const data = payload.payload as TypingEvent;
    if (data?.userId && data.userId !== selfId) onEvent(data);
  });
  ch.subscribe();
  return {
    channel: ch,
    broadcast: (isTyping: boolean) => {
      void ch.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: selfId, isTyping, at: Date.now() } satisfies TypingEvent,
      });
    },
  };
}

export interface PresenceState {
  userId: string;
  online_at: string;
}

export function subscribePresence(
  conversationId: string,
  selfId: string,
  onSync: (states: PresenceState[]) => void,
): RealtimeChannel {
  const ch = supabase.channel(`mp_pres:${conversationId}`, {
    config: { presence: { key: selfId } },
  });
  ch.on('presence', { event: 'sync' }, () => {
    const state = ch.presenceState();
    const flat: PresenceState[] = [];
    for (const key in state) {
      const rows = state[key] as unknown as PresenceState[];
      rows.forEach((r) => flat.push(r));
    }
    onSync(flat);
  });
  ch.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await ch.track({ userId: selfId, online_at: new Date().toISOString() } satisfies PresenceState);
    }
  });
  return ch;
}

export function unsubscribe(ch: RealtimeChannel | null) {
  if (!ch) return;
  void supabase.removeChannel(ch);
}
