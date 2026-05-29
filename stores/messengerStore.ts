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
  updateMessage: (convId: string, msg: Message) => void;
  removeMessage: (convId: string, msgId: string) => void;
  setLoadingConversations: (loading: boolean) => void;
  setLoadingMessages: (convId: string, loading: boolean) => void;
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
    set((s) => ({
      messages: { ...s.messages, [convId]: [...(s.messages[convId] ?? []), msg] },
    })),
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
  totalUnread: () => get().conversations.reduce((sum, c) => sum + (c.unread_count ?? 0), 0),
}));
