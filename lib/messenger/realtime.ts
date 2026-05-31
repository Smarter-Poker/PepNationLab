'use client';
import { createClient } from '@/lib/supabase/client';
import type { Message, Reaction, Participant } from './types';
import type { RealtimeChannel } from '@supabase/supabase-js';

const supabase = createClient();

interface MessageHandlers {
  onInsert?: (m: Message) => void;
  onUpdate?: (m: Message) => void;
  onDelete?: (id: string) => void;
  onReactionInsert?: (r: Reaction) => void;
  onReactionDelete?: (r: { message_id: string; user_id: string; emoji: string | null }) => void;
}

export function subscribeMessages(
  conversationId: string,
  handlers: MessageHandlers,
  selfId: string,
): { channel: RealtimeChannel; broadcastNewMessage: (m: Message) => void } {
  const ch = supabase.channel(`conversation:${conversationId}`);

  ch.on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'messenger_messages',
      filter: `conversation_id=eq.${conversationId}`,
    },
    (payload) => {
      const newMsg = payload.new as Message;
      // Skip optimistic local messages
      if (newMsg.sender_id === selfId) return;
      
      handlers.onInsert?.(newMsg);
    }
  );

  ch.on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'messenger_messages',
      filter: `conversation_id=eq.${conversationId}`,
    },
    (payload) => {
      const updatedMsg = payload.new as Message;
      handlers.onUpdate?.(updatedMsg);
    }
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
      if (payload.old && payload.old.id) {
        handlers.onDelete?.(payload.old.id);
      }
    }
  );

  ch.on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'messenger_reactions',
      filter: `conversation_id=eq.${conversationId}`,
    },
    (payload) => {
      handlers.onReactionInsert?.(payload.new as Reaction);
    }
  );

  ch.on(
    'postgres_changes',
    {
      event: 'DELETE',
      schema: 'public',
      table: 'messenger_reactions',
      filter: `conversation_id=eq.${conversationId}`,
    },
    (payload) => {
      if (payload.old) {
        handlers.onReactionDelete?.({
          message_id: payload.old.message_id,
          user_id: payload.old.user_id,
          emoji: payload.old.emoji,
        });
      }
    }
  );

  ch.subscribe();

  return {
    channel: ch,
    broadcastNewMessage: (m: Message) => {
      // Opt to still broadcast if needed, but postgres_changes handles standard delivery
      void ch.send({ type: 'broadcast', event: 'new_message', payload: m });
    },
  };
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
  const ch = supabase.channel(`typing:${conversationId}`, {
    config: { broadcast: { ack: false, self: false } },
  });
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
  const ch = supabase.channel(`user_unread:${userId}`);
  ch.on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'messenger_participants',
      filter: `user_id=eq.${userId}`,
    },
    (payload) => {
      onChange(payload.new as ParticipantUnreadRow, 'UPDATE');
    },
  );
  ch.on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'messenger_participants',
      filter: `user_id=eq.${userId}`,
    },
    (payload) => {
      onChange(payload.new as ParticipantUnreadRow, 'INSERT');
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
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'messenger_messages',
    },
    (payload) => {
      const m = payload.new as IncomingMessageNotification & { sender_id: string };
      if (!m) return;
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
