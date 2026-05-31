'use client';
import { create } from 'zustand';
import type { ConversationListItem, Message } from '@/lib/messenger/types';

interface MessengerState {
  conversations: ConversationListItem[];
  activeConversationId: string | null;
  messages: Record<string, Message[]>;
  loadingConversations: boolean;
  loadingMessages: Record<string, boolean>;

  setConversations: (c: ConversationListItem[]) => void;
  setActive: (id: string | null) => void;
  setMessages: (convId: string, msgs: Message[]) => void;
  appendMessage: (convId: string, msg: Message) => void;
  prependMessages: (convId: string, msgs: Message[]) => void;
  updateMessage: (convId: string, msg: Message) => void;
  removeMessage: (convId: string, msgId: string) => void;
  setLoadingConversations: (loading: boolean) => void;
  setLoadingMessages: (convId: string, loading: boolean) => void;
  setConversationUnread: (convId: string, unread: number) => void;
  updateConversationSnippet: (m: { conversation_id: string; text: string | null; message_type: string; created_at: string }, incoming: boolean) => void;
  totalUnread: () => number;
}

export const useMessengerStore = create<MessengerState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: {},
  loadingConversations: false,
  loadingMessages: {},

  setConversations: (c) => set({ conversations: c }),
  setActive: (id) => set({ activeConversationId: id }),
  setMessages: (convId, msgs) =>
    set((s) => ({ messages: { ...s.messages, [convId]: msgs } })),
  appendMessage: (convId, msg) =>
    set((s) => {
      const list = s.messages[convId] ?? [];
      if (list.some(m => m.id === msg.id || (msg.client_message_id && m.client_message_id === msg.client_message_id))) return s;
      return { messages: { ...s.messages, [convId]: [...list, msg] } };
    }),
  prependMessages: (convId, msgs) =>
    set((s) => {
      const currentList = s.messages[convId] ?? [];
      const newMsgs = msgs.filter((newMsg) => !currentList.some((existing) => existing.id === newMsg.id));
      if (newMsgs.length === 0) return s;
      return { messages: { ...s.messages, [convId]: [...newMsgs, ...currentList] } };
    }),
  updateMessage: (convId, msg) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [convId]: (s.messages[convId] ?? []).map((m) => (m.id === msg.id ? msg : m)),
      },
    })),
  removeMessage: (convId, msgId) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [convId]: (s.messages[convId] ?? []).filter((m) => m.id !== msgId),
      },
    })),
  setLoadingConversations: (loading) => set({ loadingConversations: loading }),
  setLoadingMessages: (convId, loading) =>
    set((s) => ({
      loadingMessages: { ...s.loadingMessages, [convId]: loading },
    })),
  setConversationUnread: (convId, unread) =>
    set((s) => {
      const idx = s.conversations.findIndex((c) => c.conversation_id === convId);
      if (idx === -1) return s;
      if (s.conversations[idx].unread_count === unread) return s;
      const arr = [...s.conversations];
      arr[idx] = { ...arr[idx], unread_count: unread };
      return { conversations: arr };
    }),
  updateConversationSnippet: (m, incoming) =>
    set((s) => {
      const idx = s.conversations.findIndex((c) => c.conversation_id === m.conversation_id);
      if (idx === -1) return s;
      const conv = s.conversations[idx];
      const isActive = s.activeConversationId === m.conversation_id;
      
      const updatedConv = {
        ...conv,
        last_message_text: m.text ?? (m.message_type !== 'text' ? `[${m.message_type}]` : 'No Messages Yet'),
        last_message_type: m.message_type,
        last_message_at: m.created_at,
        unread_count: (incoming && !isActive) ? (conv.unread_count ?? 0) + 1 : conv.unread_count,
      };

      const newList = [...s.conversations];
      newList.splice(idx, 1);
      newList.unshift(updatedConv);
      return { conversations: newList };
    }),
  totalUnread: () => get().conversations.reduce((sum, c) => sum + (c.unread_count ?? 0), 0),
}));
