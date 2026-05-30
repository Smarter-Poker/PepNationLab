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

export interface CallSignalRow {
  id: string;
  conversation_id: string;
  initiator_id: string;
  call_type: 'audio' | 'video';
  status: 'ringing' | 'active' | 'ended' | 'missed' | 'declined';
  livekit_room: string;
  started_at: string;
}

interface CallSignalHandlers {
  onInsert?: (c: CallSignalRow) => void;
  onUpdate?: (c: CallSignalRow) => void;
}

// Phase 11: subscribe to call signal INSERTs and UPDATEs across every
// conversation the user participates in. RLS on messenger_calls already
// filters rows to the caller's conversations -- the channel does not need
// an additional filter for ownership.
export function subscribeCallSignals(userId: string, handlers: CallSignalHandlers): RealtimeChannel {
  const ch = supabase.channel(`mc_calls:${userId}`);
  ch.on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'messenger_calls',
    },
    (payload) => handlers.onInsert?.(payload.new as CallSignalRow),
  );
  ch.on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'messenger_calls',
    },
    (payload) => handlers.onUpdate?.(payload.new as CallSignalRow),
  );
  ch.subscribe();
  return ch;
}

// Phase 14: realtime unread bell.
//
// Subscribes to every messenger_participants row owned by the caller and emits
// the new row on INSERT/UPDATE so a consumer can recompute the badge count.
// The DELETE branch surfaces the OLD row (Realtime sends only old on delete)
// so a caller can drop the conv from any cached aggregate.
export interface ParticipantUnreadRow {
  conversation_id: string;
  user_id: string;
  unread_count: number;
  is_muted: boolean;
  last_read_at: string | null;
}

interface MyParticipantsHandler {
  (row: ParticipantUnreadRow, event: 'INSERT' | 'UPDATE' | 'DELETE'): void;
}

export function subscribeMyParticipants(
  userId: string,
  onChange: MyParticipantsHandler,
): RealtimeChannel {
  const ch = supabase.channel(`mp_self:${userId}`);
  ch.on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'messenger_participants',
      filter: `user_id=eq.${userId}`,
    },
    (payload) => {
      const row = payload.new as ParticipantUnreadRow;
      if (row) onChange(row, 'INSERT');
    },
  );
  ch.on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'messenger_participants',
      filter: `user_id=eq.${userId}`,
    },
    (payload) => {
      const row = payload.new as ParticipantUnreadRow;
      if (row) onChange(row, 'UPDATE');
    },
  );
  ch.on(
    'postgres_changes',
    {
      event: 'DELETE',
      schema: 'public',
      table: 'messenger_participants',
      filter: `user_id=eq.${userId}`,
    },
    (payload) => {
      const row = payload.old as ParticipantUnreadRow;
      if (row) onChange(row, 'DELETE');
    },
  );
  ch.subscribe();
  return ch;
}

// Phase 14: cross-conversation incoming-message stream.
//
// The Phase 6 publication already publishes every messenger_messages INSERT,
// and RLS gates the channel so the caller only sees rows from conversations
// they participate in. We filter out self-authored messages locally so the
// caller never browser-pushes its own send.
export interface IncomingMessageNotification {
  id: string;
  conversation_id: string;
  sender_id: string;
  text: string | null;
  message_type: string;
  created_at: string;
}

export function subscribeMyIncomingMessages(
  userId: string,
  onInsert: (m: IncomingMessageNotification) => void,
): RealtimeChannel {
  const ch = supabase.channel(`mm_self:${userId}`);
  ch.on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'messenger_messages',
    },
    (payload) => {
      const m = payload.new as IncomingMessageNotification & { sender_id: string };
      if (m && m.sender_id !== userId) onInsert(m);
    },
  );
  ch.subscribe();
  return ch;
}

export function unsubscribe(ch: RealtimeChannel | null) {
  if (!ch) return;
  void supabase.removeChannel(ch);
}
