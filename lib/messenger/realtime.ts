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

export function subscribeMessages(conversationId: string, handlers: MessageHandlers): { channel: RealtimeChannel; broadcastNewMessage: (m: Message) => void } {
  const ch = supabase.channel(`chat:${conversationId}`);
  ch.on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'messenger_messages',
      filter: `conversation_id=eq.${conversationId}`
    },
    (payload) => handlers.onInsert?.(payload.new as Message),
  );
  ch.on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'messenger_messages',
      filter: `conversation_id=eq.${conversationId}`
    },
    (payload) => handlers.onUpdate?.(payload.new as Message),
  );
  ch.on('broadcast', { event: 'new_message' }, (payload) => {
    if (payload.payload) handlers.onInsert?.(payload.payload as Message);
  });
  ch.subscribe();
  return {
    channel: ch,
    broadcastNewMessage: (m: Message) => {
      void ch.send({ type: 'broadcast', event: 'new_message', payload: m });
    }
  };
}

interface ReactionHandlers {
  onInsert?: (r: Reaction) => void;
  onDelete?: (r: { message_id: string; user_id: string; emoji: string | null }) => void;
}

export function subscribeReactions(
  messageIds: string[],
  handlers: ReactionHandlers,
  channelHint?: string,
): RealtimeChannel | null {
  if (messageIds.length === 0) return null;
  const suffix = channelHint && channelHint.length > 0 ? channelHint : messageIds[0];
  const ch = supabase.channel(`reactions:${suffix}`);
  const messageIdSet = new Set(messageIds);
  ch.on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'messenger_reactions' },
    (payload) => {
      const row = payload.new as Reaction;
      if (row && messageIdSet.has(row.message_id)) handlers.onInsert?.(row);
    },
  );
  ch.on(
    'postgres_changes',
    { event: 'DELETE', schema: 'public', table: 'messenger_reactions' },
    (payload) => {
      const old = payload.old as { message_id: string; user_id: string; emoji: string | null };
      if (old && messageIdSet.has(old.message_id)) handlers.onDelete?.(old);
    },
  );
  ch.subscribe();
  return ch;
}

interface ParticipantHandlers {
  onUpdate?: (p: Participant) => void;
}

export function subscribeParticipants(userId: string, handlers: ParticipantHandlers): RealtimeChannel {
  const ch = supabase.channel(`user:${userId}`);
  ch.on(
    'broadcast',
    { event: 'participant_updated' },
    (payload) => handlers.onUpdate?.(payload.payload.participant as Participant),
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
  const ch = supabase.channel(`mt:${conversationId}`);
  ch.on('broadcast', { event: 'typing' }, (payload) => {
    if (payload.payload && payload.payload.userId !== selfId) {
      onEvent({ userId: payload.payload.userId, isTyping: !!payload.payload.isTyping, at: payload.payload.at });
    }
  });
  ch.subscribe();
  return {
    channel: ch,
    broadcast: (isTyping: boolean) => {
      void ch.send({ type: 'broadcast', event: 'typing', payload: { userId: selfId, isTyping, at: Date.now() } });
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
  const ch = supabase.channel(`user:${userId}`);
  ch.on(
    'broadcast',
    { event: 'participant_updated' },
    (payload) => {
      const row = payload.payload.participant as ParticipantUnreadRow;
      if (row) onChange(row, 'UPDATE');
    },
  );
  ch.subscribe();
  return ch;
}

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
  allowConversationIds?: Set<string>,
): RealtimeChannel {
  const ch = supabase.channel(`user_notify:${userId}`);
  ch.on(
    'broadcast',
    { event: 'new_message_notify' },
    (payload) => {
      const m = payload.payload.message as IncomingMessageNotification & { sender_id: string };
      if (!m || m.sender_id === userId) return;
      if (allowConversationIds && !allowConversationIds.has(m.conversation_id)) return;
      onInsert(m);
    },
  );
  ch.subscribe();
  return ch;
}

export function unsubscribe(ch: RealtimeChannel | null) {
  if (!ch) return;
  void supabase.removeChannel(ch);
}
