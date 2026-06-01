'use client';
import { createClient } from '@/lib/supabase/client';
import type { Message, Reaction, Participant } from './types';
import type { RealtimeChannel } from '@supabase/supabase-js';

export const supabase = createClient();

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
  console.log('[REALTIME] subscribeMessages called for conv:', conversationId);
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
      handlers.onInsert?.(newMsg);
    }
  );

  ch.on(
    'broadcast',
    { event: 'new_message' },
    (payload) => {
      const newMsg = payload.payload?.message as Message;
      if (newMsg && newMsg.sender_id !== selfId) {
        handlers.onInsert?.(newMsg);
      }
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
  // fix-41: Optional fields populated by the server-side broadcast so the
  // receiver can render the caller's identity WITHOUT making an authenticated
  // /api/messenger/list-participants call. This closes the "shows Someone"
  // bug when the receiver's session JWT has expired and the API call 401s.
  caller_name?: string;
  caller_username?: string | null;
}

interface CallSignalHandlers {
  onInsert?: (c: CallSignalRow) => void;
  onUpdate?: (c: CallSignalRow) => void;
}

export function subscribeCallSignals(userId: string, handlers: CallSignalHandlers): RealtimeChannel {
  console.log('[REALTIME] subscribeCallSignals called for user:', userId);
  // HOTFIX fix-38: public channel (reverted from `private: true`).
  // The B8 realtime.messages policies have been dropped; a private
  // channel would now fail subscribe because no policy matches.
  const ch = supabase.channel(`call-signal:${userId}`);

  ch.on('broadcast', { event: 'incoming_call' }, (payload) => {
    console.log('[REALTIME] received incoming_call broadcast:', payload);
    if (payload.payload) {
      handlers.onInsert?.(payload.payload as CallSignalRow);
    }
  });

  ch.on('broadcast', { event: 'call_accepted' }, (payload) => {
    console.log('[REALTIME] received call_accepted broadcast:', payload);
    if (payload.payload && handlers.onUpdate) {
      handlers.onUpdate({ ...payload.payload, status: 'active' } as CallSignalRow);
    }
  });

  ch.on('broadcast', { event: 'call_declined' }, (payload) => {
    console.log('[REALTIME] received call_declined broadcast:', payload);
    if (payload.payload && handlers.onUpdate) {
      handlers.onUpdate({ ...payload.payload, status: 'declined' } as CallSignalRow);
    }
  });

  ch.on('broadcast', { event: 'call_ended' }, (payload) => {
    console.log('[REALTIME] received call_ended broadcast:', payload);
    if (payload.payload && handlers.onUpdate) {
      handlers.onUpdate({ ...payload.payload, status: 'ended' } as CallSignalRow);
    }
  });

  // audit15 fix-22 (B4): filter INSERT to skip the user's own outgoing calls.
  ch.on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'messenger_calls',
      filter: `initiator_id=neq.${userId}`,
    },
    (payload) => {
      console.log('[REALTIME] received messenger_calls postgres INSERT:', payload);
      const row = payload.new as CallSignalRow;
      if (row.status === 'ringing' && row.initiator_id !== userId) {
        handlers.onInsert?.(row);
      }
    }
  );

  ch.on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'messenger_calls',
    },
    (payload) => {
      console.log('[REALTIME] received messenger_calls postgres UPDATE:', payload);
      const row = payload.new as CallSignalRow;
      handlers.onUpdate?.(row);
    }
  );

  ch.subscribe();
  return ch;
}

// audit15 fix-12 (S7): per-target broadcast channel pool — public channels
// (HOTFIX fix-38: reverted from private:true).
const CHANNEL_POOL_MAX = 32;
const CHANNEL_POOL_IDLE_MS = 60_000;

interface PoolEntry {
  channel: RealtimeChannel;
  subscribed: Promise<void>;
  lastUsed: number;
}

const channelPool = new Map<string, PoolEntry>();
let sweepHandle: ReturnType<typeof setTimeout> | null = null;

function scheduleSweep() {
  if (sweepHandle) return;
  sweepHandle = setTimeout(() => {
    sweepHandle = null;
    const now = Date.now();
    for (const [key, entry] of channelPool.entries()) {
      if (now - entry.lastUsed > CHANNEL_POOL_IDLE_MS) {
        try { void supabase.removeChannel(entry.channel); } catch {}
        channelPool.delete(key);
      }
    }
    if (channelPool.size > 0) scheduleSweep();
  }, CHANNEL_POOL_IDLE_MS + 1_000);
}

function evictIfFull() {
  if (channelPool.size < CHANNEL_POOL_MAX) return;
  let oldestKey: string | null = null;
  let oldestT = Infinity;
  for (const [k, e] of channelPool.entries()) {
    if (e.lastUsed < oldestT) {
      oldestT = e.lastUsed;
      oldestKey = k;
    }
  }
  if (oldestKey) {
    const e = channelPool.get(oldestKey);
    if (e) {
      try { void supabase.removeChannel(e.channel); } catch {}
      channelPool.delete(oldestKey);
    }
  }
}

function getOrCreateChannel(targetUserId: string): PoolEntry {
  const existing = channelPool.get(targetUserId);
  if (existing) {
    existing.lastUsed = Date.now();
    return existing;
  }
  evictIfFull();
  // HOTFIX fix-38: public channel.
  const channel = supabase.channel(`call-signal:${targetUserId}`);
  const subscribed = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Channel subscription timeout')), 5000);
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timeout);
        resolve();
      } else if (status === 'CHANNEL_ERROR') {
        clearTimeout(timeout);
        reject(new Error('Channel error'));
      }
    });
  });
  const entry: PoolEntry = { channel, subscribed, lastUsed: Date.now() };
  channelPool.set(targetUserId, entry);
  scheduleSweep();
  return entry;
}

export async function broadcastCallSignal(
  targetUserId: string,
  event: 'incoming_call' | 'call_accepted' | 'call_declined' | 'call_ended',
  payload: any,
): Promise<void> {
  console.log(`[REALTIME] broadcasting event ${event} to target ${targetUserId}`);
  try {
    const entry = getOrCreateChannel(targetUserId);
    try {
      await entry.subscribed;
    } catch (subErr) {
      try { void supabase.removeChannel(entry.channel); } catch {}
      channelPool.delete(targetUserId);
      throw subErr;
    }
    entry.lastUsed = Date.now();
    await entry.channel.send({
      type: 'broadcast',
      event,
      payload,
    });
  } catch (err) {
    console.warn(`[REALTIME] broadcastCallSignal failed for ${event}:`, err);
  }
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
  ch.on('broadcast', { event: 'participant_updated' }, (payload) => {
    if (payload.payload?.participant) {
      onChange(payload.payload.participant as ParticipantUnreadRow, 'UPDATE');
    }
  });
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
  ch.on('broadcast', { event: 'new_message_notify' }, (payload) => {
    const m = payload.payload?.message as IncomingMessageNotification & { sender_id: string };
    if (!m) return;
    if (allowConversationIds && !allowConversationIds.has(m.conversation_id)) return;
    onInsert(m);
  });
  ch.subscribe();
  return ch;
}

export function unsubscribe(ch: RealtimeChannel | null) {
  if (!ch) return;
  void supabase.removeChannel(ch);
}
