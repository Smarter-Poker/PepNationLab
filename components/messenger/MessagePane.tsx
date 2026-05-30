'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMessengerStore } from '@/stores/messengerStore';
import type { ConversationListItem, Message, Reaction, ParticipantRole } from '@/lib/messenger/types';
import type { MessageLabelValue, ThemeValue } from '@/lib/messenger/schemas';
import type { CallSignalRow } from '@/lib/messenger/realtime';
import { MessageCircle, Info, Bell, BellOff } from 'lucide-react';
import MessageBubble from './MessageBubble';
import MessageComposer from './MessageComposer';
import TypingIndicator from './TypingIndicator';
import GroupInfoDrawer from './GroupInfoDrawer';
import PinnedBar from './PinnedBar';
import ThreadDrawer from './ThreadDrawer';
import BookmarksDrawer from './BookmarksDrawer';
import CallButton from './CallButton';
import ReportModal from './ReportModal';
import BlockList from './BlockList';
import RemindersList from './RemindersList';
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
  activeCall: CallSignalRow | null;
  setActiveCall: (c: CallSignalRow | null) => void;
}

const TYPING_TTL_MS = 4000;
const PUSH_DISMISS_KEY = 'messenger:push-opt-in-dismissed';

const THEME_BACKGROUND: Record<ThemeValue, string> = {
  default: 'var(--surface-1, #0F1923)',
  teal: 'linear-gradient(180deg, #0F1923 0%, #032427 100%)',
  indigo: 'linear-gradient(180deg, #0F1923 0%, #1E1B4B 100%)',
  rose: 'linear-gradient(180deg, #0F1923 0%, #4C0519 100%)',
  amber: 'linear-gradient(180deg, #0F1923 0%, #451A03 100%)',
  slate: 'linear-gradient(180deg, #0F1923 0%, #1E293B 100%)',
};

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

function resolveConversationLabel(c: ConversationListItem | undefined): string {
  if (!c) return 'Conversation';
  if (c.title && c.title.trim().length > 0) return c.title;
  if (c.type === 'direct') {
    if (c.counterparty_full_name && c.counterparty_full_name.trim().length > 0) return c.counterparty_full_name;
    if (c.counterparty_username && c.counterparty_username.trim().length > 0) return c.counterparty_username;
    return 'Direct Message';
  }
  return 'Conversation';
}

function reminderPreviewFromMessage(m: Message): string {
  if (m.text && m.text.trim().length > 0) {
    const t = m.text.trim();
    return t.length > 200 ? `${t.slice(0, 200)}...` : t;
  }
  switch (m.message_type) {
    case 'image':
      return '[Image]';
    case 'gif':
      return '[Gif]';
    case 'voice':
      return '[Voice Note]';
    case 'file':
      return '[File]';
    default:
      return m.media_url ? '[Media]' : '';
  }
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

type PushBannerState = 'hidden' | 'default' | 'denied';

export default function MessagePane({ userId, activeCall, setActiveCall }: Props) {
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
  const setActive = useMessengerStore((s) => s.setActive);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [reactionsByMsg, setReactionsByMsg] = useState<Record<string, Reaction[]>>({});
  const [typingUserIds, setTypingUserIds] = useState<string[]>([]);
  const [infoOpen, setInfoOpen] = useState(false);
  const [selfRole, setSelfRole] = useState<ParticipantRole | null>(null);
  const [pinRefreshKey, setPinRefreshKey] = useState(0);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [labelsByMsg, setLabelsByMsg] = useState<Record<string, MessageLabelValue[]>>({});
  const [threadParentId, setThreadParentId] = useState<string | null>(null);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [themeValue, setThemeValue] = useState<ThemeValue>('default');
  // Phase 12: blocks + report modal
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [reportTarget, setReportTarget] = useState<Message | null>(null);
  const [blockListOpen, setBlockListOpen] = useState(false);
  // Phase 13: reminders drawer
  const [remindersOpen, setRemindersOpen] = useState(false);
  const [reminderSeed, setReminderSeed] = useState<
    | { messageId?: string; conversationId?: string; preview?: string }
    | null
  >(null);
  // Phase 14: push opt-in banner state
  const [pushBanner, setPushBanner] = useState<PushBannerState>('hidden');

  // activeCall is hoisted to MessengerShell so IncomingCallToast accept-handlers can set it.
  void activeCall;

  const typingExpiryRef = useRef<Record<string, number>>({});
  const typingSweeperRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setReplyTo(null);
    setInfoOpen(false);
    setThreadParentId(null);
    setBookmarksOpen(false);
    setReportTarget(null);
    setRemindersOpen(false);
    setReminderSeed(null);
  }, [activeId]);

  // Phase 14: decide whether to show the push opt-in banner. Visible only
  // when the Notification API exists, permission === 'default', the user
  // hasn't already opted in (browser_push !== true), and the user has not
  // dismissed the banner this session.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') {
      setPushBanner('hidden');
      return;
    }

    // Check the dismiss flag FIRST — if the user dismissed, hide regardless
    // of permission state. Previously the denied check ran before this,
    // causing the "dismissed" banner to reappear on every conversation switch.
    const dismissed = window.sessionStorage.getItem(PUSH_DISMISS_KEY) === '1';
    if (dismissed) {
      setPushBanner('hidden');
      return;
    }

    if (Notification.permission === 'denied') {
      setPushBanner('denied');
      return;
    }
    if (Notification.permission === 'granted') {
      setPushBanner('hidden');
      return;
    }
    // permission === 'default'
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/messenger/notification-prefs', {
          method: 'GET',
          cache: 'no-store',
        });
        if (!res.ok) return;
        const json = (await res.json()) as { prefs?: { browser_push?: boolean | null } };
        if (cancelled) return;
        if (json.prefs?.browser_push === true) {
          setPushBanner('hidden');
        } else {
          setPushBanner('default');
        }
      } catch {
        // non-fatal
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeId]);


  const handleAllowPush = useCallback(async () => {
    try {
      if (typeof Notification === 'undefined') return;
      const result = await Notification.requestPermission();
      if (result === 'granted') {
        const res = await fetch('/api/messenger/notification-prefs', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ browserPush: true }),
        });
        if (res.ok) {
          toast('Notifications Enabled');
          // Notify MessengerShell so its cached prefs stay in sync without
          // a window reload.
          try {
            window.dispatchEvent(
              new CustomEvent('messenger:prefs-updated', {
                detail: { browser_push: true },
              }),
            );
          } catch {
            /* non-fatal */
          }
          setPushBanner('hidden');
        } else {
          toast('Could Not Save Preference');
        }
      } else if (result === 'denied') {
        setPushBanner('denied');
      } else {
        // 'default' -- user dismissed the prompt; honor that for the session.
        try {
          window.sessionStorage.setItem(PUSH_DISMISS_KEY, '1');
        } catch {
          /* non-fatal */
        }
        setPushBanner('hidden');
      }
    } catch {
      toast('Notifications Not Available');
    }
  }, []);

  const handleDismissPush = useCallback(() => {
    try {
      window.sessionStorage.setItem(PUSH_DISMISS_KEY, '1');
    } catch {
      /* non-fatal */
    }
    setPushBanner('hidden');
  }, []);

  // Phase 12: fetch the caller's block list once per session (re-fetches when
  // activeId changes so newly-added blocks made elsewhere in the UI propagate).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/messenger/list-blocks', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        });
        if (!res.ok) return;
        const json = (await res.json()) as { blocks?: Array<{ blocked_id: string }> };
        if (cancelled) return;
        setBlockedIds(new Set((json.blocks ?? []).map((b) => b.blocked_id)));
      } catch {
        // non-fatal
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeId, blockListOpen]);

  // Resolve self role + theme for the active conversation. Drives Pin/Unpin
  // policy in PinnedBar and applies the per-user theme override to the pane.
  useEffect(() => {
    if (!activeId) {
      setSelfRole(null);
      setThemeValue('default');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [rolesRes, themeRes] = await Promise.all([
          fetch('/api/messenger/list-participants', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ conversationId: activeId }),
          }),
          fetch('/api/messenger/get-theme', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ conversationId: activeId }),
          }),
        ]);
        if (cancelled) return;
        if (rolesRes.ok) {
          const json = (await rolesRes.json()) as { participants?: Array<{ user_id: string; role: ParticipantRole }> };
          const me = json.participants?.find((p) => p.user_id === userId);
          setSelfRole(me?.role ?? null);
        }
        if (themeRes.ok) {
          const json = (await themeRes.json()) as { themeValue?: ThemeValue | null };
          setThemeValue((json.themeValue ?? 'default') as ThemeValue);
        }
      } catch {
        // non-fatal
      }
    })();
    return () => { cancelled = true; };
  }, [activeId, userId]);

  // Resolve pins, bookmarks, labels for the loaded messages.
  const loadPinsBookmarksLabels = useCallback(async (conversationId: string, messageIds: string[]) => {
    try {
      const reqs: Promise<Response>[] = [
        fetch('/api/messenger/list-pins', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ conversationId }),
        }),
        fetch('/api/messenger/list-bookmarks', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        }),
      ];
      if (messageIds.length > 0) {
        reqs.push(
          fetch('/api/messenger/list-labels', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ messageIds }),
          }),
        );
      }
      const [pinsRes, bksRes, labelsRes] = await Promise.all(reqs);
      if (pinsRes.ok) {
        const json = (await pinsRes.json()) as { pins?: Array<{ message_id: string }> };
        setPinnedIds(new Set((json.pins ?? []).map((p) => p.message_id)));
      }
      if (bksRes.ok) {
        const json = (await bksRes.json()) as { bookmarks?: Array<{ message_id: string }> };
        setBookmarkedIds(new Set((json.bookmarks ?? []).map((b) => b.message_id)));
      }
      if (labelsRes && labelsRes.ok) {
        const json = (await labelsRes.json()) as { labels?: Array<{ message_id: string; label: MessageLabelValue }> };
        const map: Record<string, MessageLabelValue[]> = {};
        (json.labels ?? []).forEach((r) => {
          (map[r.message_id] ??= []).push(r.label);
        });
        setLabelsByMsg(map);
      }
    } catch {
      // non-fatal
    }
  }, []);

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
        const lastId = list.length > 0 ? list[list.length - 1].id : null;
        if (lastId) void markConversationRead(activeId, lastId);
        void loadPinsBookmarksLabels(activeId, list.map((m) => m.id));
      } finally {
        if (!cancelled) setLoading(activeId, false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeId, messagesByConv, setMessages, setLoading, loadPinsBookmarksLabels]);

  useEffect(() => {
    if (!activeId) return;

    const msgCh = subscribeMessages(activeId, {
      onInsert: (m) => {
        if (m.sender_id === userId) return;
        appendMessage(activeId, m);
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

  const handlePinToggle = useCallback(
    async (m: Message, action: 'pin' | 'unpin') => {
      if (!activeId) return;
      const wasPinned = pinnedIds.has(m.id);
      setPinnedIds((cur) => {
        const next = new Set(cur);
        if (action === 'pin') next.add(m.id);
        else next.delete(m.id);
        return next;
      });
      try {
        const res = await fetch('/api/messenger/pin-message', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            messageId: m.id,
            conversationId: activeId,
            action,
          }),
        });
        if (!res.ok) {
          const json = (await res.json().catch(() => ({}))) as { error?: string };
          toast(json.error ?? (action === 'pin' ? 'Could Not Pin' : 'Could Not Unpin'));
          // revert
          setPinnedIds((cur) => {
            const next = new Set(cur);
            if (wasPinned) next.add(m.id);
            else next.delete(m.id);
            return next;
          });
          return;
        }
        setPinRefreshKey((k) => k + 1);
      } catch {
        toast('Network Error');
        setPinnedIds((cur) => {
          const next = new Set(cur);
          if (wasPinned) next.add(m.id);
          else next.delete(m.id);
          return next;
        });
      }
    },
    [activeId, pinnedIds],
  );

  const handleBookmarkToggle = useCallback(
    async (m: Message, action: 'add' | 'remove') => {
      const wasBookmarked = bookmarkedIds.has(m.id);
      setBookmarkedIds((cur) => {
        const next = new Set(cur);
        if (action === 'add') next.add(m.id);
        else next.delete(m.id);
        return next;
      });
      try {
        const res = await fetch('/api/messenger/bookmark-message', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ messageId: m.id, action }),
        });
        if (!res.ok) {
          const json = (await res.json().catch(() => ({}))) as { error?: string };
          toast(json.error ?? 'Could Not Update Bookmark');
          setBookmarkedIds((cur) => {
            const next = new Set(cur);
            if (wasBookmarked) next.add(m.id);
            else next.delete(m.id);
            return next;
          });
        }
      } catch {
        toast('Network Error');
        setBookmarkedIds((cur) => {
          const next = new Set(cur);
          if (wasBookmarked) next.add(m.id);
          else next.delete(m.id);
          return next;
        });
      }
    },
    [bookmarkedIds],
  );

  const handleLabelToggle = useCallback(
    async (m: Message, label: MessageLabelValue, action: 'add' | 'remove') => {
      const had = (labelsByMsg[m.id] ?? []).includes(label);
      setLabelsByMsg((cur) => {
        const arr = cur[m.id] ?? [];
        if (action === 'add') {
          if (arr.includes(label)) return cur;
          return { ...cur, [m.id]: [...arr, label] };
        }
        return { ...cur, [m.id]: arr.filter((l) => l !== label) };
      });
      try {
        const res = await fetch('/api/messenger/label-message', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ messageId: m.id, label, action }),
        });
        if (!res.ok) {
          const json = (await res.json().catch(() => ({}))) as { error?: string };
          toast(json.error ?? 'Could Not Update Label');
          // revert
          setLabelsByMsg((cur) => {
            const arr = cur[m.id] ?? [];
            if (had) {
              if (arr.includes(label)) return cur;
              return { ...cur, [m.id]: [...arr, label] };
            }
            return { ...cur, [m.id]: arr.filter((l) => l !== label) };
          });
        }
      } catch {
        toast('Network Error');
      }
    },
    [labelsByMsg],
  );

  const handleJumpToMessage = useCallback((messageId: string) => {
    const el = document.querySelector(`[data-msg-id="${messageId}"]`);
    if (el && 'scrollIntoView' in el) {
      (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
      (el as HTMLElement).style.outline = '2px solid var(--teal, #00C4BC)';
      setTimeout(() => {
        (el as HTMLElement).style.outline = '';
      }, 1600);
    }
  }, []);

  // Audit3 fix: pending jump survives the activeId switch. The messages
  // effect re-fires when activeId changes; once messages render we look for
  // a pending jump and execute it. Replaces the fragile 800ms setTimeout
  // race that silently failed on slow networks.
  const [pendingJumpMessageId, setPendingJumpMessageId] = useState<string | null>(null);

  const handleJumpAcrossConv = useCallback(
    (conversationId: string, messageId: string) => {
      setBookmarksOpen(false);
      if (conversationId !== activeId) {
        setPendingJumpMessageId(messageId);
        setActive(conversationId);
      } else {
        handleJumpToMessage(messageId);
      }
    },
    [activeId, setActive, handleJumpToMessage],
  );

  // Audit3 fix: consume the pending cross-conv jump once messages for the
  // new activeId have actually rendered into the DOM. Polls 100ms up to ~5s
  // so it tolerates slow networks much better than the previous fixed
  // 800ms setTimeout race.
  useEffect(() => {
    if (!pendingJumpMessageId || !activeId) return;
    let attempts = 0;
    const interval = setInterval(() => {
      attempts += 1;
      const el = document.querySelector(`[data-msg-id="${pendingJumpMessageId}"]`);
      if (el) {
        handleJumpToMessage(pendingJumpMessageId);
        setPendingJumpMessageId(null);
        clearInterval(interval);
        return;
      }
      if (attempts >= 50) {
        setPendingJumpMessageId(null);
        clearInterval(interval);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [pendingJumpMessageId, activeId, handleJumpToMessage]);

  // Phase 13: opens the reminders drawer in create-mode pre-populated with the
  // message reference + preview snippet.
  const handleSetReminder = useCallback(
    (m: Message) => {
      setReminderSeed({
        messageId: m.id,
        conversationId: m.conversation_id,
        preview: reminderPreviewFromMessage(m),
      });
      setRemindersOpen(true);
    },
    [],
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
  const currentConv = conversations.find((c) => c.conversation_id === activeId);
  const headerLabel = resolveConversationLabel(currentConv);
  const conversationType = currentConv?.type;
  const isDirectConv = conversationType === 'direct';

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: THEME_BACKGROUND[themeValue] ?? THEME_BACKGROUND.default,
        position: 'relative',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          borderBottom: '1px solid var(--surface-3, #1D2D3E)',
          background: 'var(--surface-2, #162230)',
        }}
      >
        <div
          style={{
            fontWeight: 700,
            fontSize: '0.95rem',
            color: 'var(--white, #FFFFFF)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {headerLabel}
        </div>
        <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          <CallButton
            conversationId={activeId}
            onCallStarted={(c) => setActiveCall(c)}
          />
          <button
            type="button"
            onClick={() => { setReminderSeed(null); setRemindersOpen(true); }}
            aria-label="Open Reminders"
            style={headerBtn}
          >
            <Bell size={12} aria-hidden="true" />
            Reminders
          </button>
          <button
            type="button"
            onClick={() => setBookmarksOpen(true)}
            aria-label="Open Bookmarks"
            style={headerBtn}
          >
            Bookmarks
          </button>
          <button
            type="button"
            onClick={() => setInfoOpen(true)}
            aria-label="Conversation Info"
            style={headerBtn}
          >
            <Info size={12} aria-hidden="true" />
            Info
          </button>
        </div>
      </header>
      {pushBanner !== 'hidden' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '10px 14px',
            borderBottom: '1px solid var(--surface-3, #1D2D3E)',
            background: pushBanner === 'denied' ? 'rgba(229,62,62,0.06)' : 'rgba(0,196,188,0.06)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--white, #FFFFFF)', fontSize: '0.82rem' }}>
            {pushBanner === 'denied' ? (
              <>
                <BellOff size={14} aria-hidden="true" />
                <span style={{ fontWeight: 700 }}>Push Notifications Blocked</span>
                <span style={{ color: 'var(--grey-400, #A8B4C0)' }}>
                  Allow In Browser Settings To Get Alerts.
                </span>
              </>
            ) : (
              <>
                <Bell size={14} aria-hidden="true" />
                <span style={{ fontWeight: 700 }}>Enable Push Notifications</span>
                <span style={{ color: 'var(--grey-400, #A8B4C0)' }}>
                  Allow Push To Get Alerts When Tab Is Hidden.
                </span>
              </>
            )}
          </div>
          {pushBanner === 'default' && (
            <div style={{ display: 'inline-flex', gap: 6 }}>
              <button
                type="button"
                onClick={handleAllowPush}
                style={{
                  ...headerBtn,
                  background: 'var(--teal, #00C4BC)',
                  color: '#0F1923',
                  border: '1px solid var(--teal, #00C4BC)',
                }}
              >
                Allow
              </button>
              <button
                type="button"
                onClick={handleDismissPush}
                style={headerBtn}
              >
                Not Now
              </button>
            </div>
          )}
          {pushBanner === 'denied' && (
            <button
              type="button"
              onClick={handleDismissPush}
              style={headerBtn}
              aria-label="Dismiss Push Notice"
            >
              Dismiss
            </button>
          )}
        </div>
      )}
      <PinnedBar
        conversationId={activeId}
        selfId={userId}
        selfRole={selfRole}
        refreshKey={pinRefreshKey}
        onJump={handleJumpToMessage}
      />
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
          messages
            .filter((m) => {
              // Phase 12: in direct conversations, fully hide messages from blocked
              // senders. In groups we keep a placeholder so context flow is
              // preserved -- handled below.
              if (!isDirectConv) return true;
              return !blockedIds.has(m.sender_id);
            })
            .map((m) => {
              const isBlockedSender = blockedIds.has(m.sender_id) && m.sender_id !== userId;
              if (isBlockedSender && !isDirectConv) {
                return (
                  <div
                    key={m.id}
                    data-msg-id={m.id}
                    style={{
                      alignSelf: 'flex-start',
                      maxWidth: '70%',
                      padding: '8px 12px',
                      borderRadius: 14,
                      background: 'var(--surface-2, #162230)',
                      color: 'var(--grey-400, #A8B4C0)',
                      fontStyle: 'italic',
                      fontSize: '0.82rem',
                      border: '1px dashed var(--surface-3, #1D2D3E)',
                    }}
                  >
                    Message Hidden - Blocked User
                  </div>
                );
              }
              return (
                <MessageBubble
                  key={m.id}
                  message={m}
                  isOwn={m.sender_id === userId}
                  reactions={reactionsByMsg[m.id] ?? []}
                  selfId={userId}
                  selfRole={selfRole}
                  conversationType={conversationType}
                  isPinned={pinnedIds.has(m.id)}
                  isBookmarked={bookmarkedIds.has(m.id)}
                  currentLabels={labelsByMsg[m.id] ?? []}
                  onReply={setReplyTo}
                  onReact={handleReact}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onPinToggle={handlePinToggle}
                  onBookmarkToggle={handleBookmarkToggle}
                  onLabelToggle={handleLabelToggle}
                  onThread={(parent) => setThreadParentId(parent.id)}
                  onReport={(msg) => setReportTarget(msg)}
                  onSetReminder={handleSetReminder}
                />
              );
            })
        )}
      </div>
      <TypingIndicator typingUserIds={typingUserIds} />
      <MessageComposer
        conversationId={activeId}
        selfId={userId}
        replyTo={replyTo}
        onClearReply={() => setReplyTo(null)}
      />
      {infoOpen && currentConv && (
        <GroupInfoDrawer
          conversation={currentConv}
          selfId={userId}
          onClose={() => setInfoOpen(false)}
          currentTheme={themeValue}
          onThemeChange={(next) => setThemeValue(next)}
          onOpenBookmarks={() => { setInfoOpen(false); setBookmarksOpen(true); }}
          onOpenBlockList={() => { setInfoOpen(false); setBlockListOpen(true); }}
        />
      )}
      {threadParentId && (
        <ThreadDrawer
          threadParentId={threadParentId}
          selfId={userId}
          onClose={() => setThreadParentId(null)}
        />
      )}
      {bookmarksOpen && (
        <BookmarksDrawer
          onClose={() => setBookmarksOpen(false)}
          onJump={handleJumpAcrossConv}
        />
      )}
      {reportTarget && (
        <ReportModal
          message={reportTarget}
          onClose={() => setReportTarget(null)}
        />
      )}
      {blockListOpen && <BlockList onClose={() => setBlockListOpen(false)} />}
      {remindersOpen && (
        <RemindersList
          onClose={() => { setRemindersOpen(false); setReminderSeed(null); }}
          seed={reminderSeed}
        />
      )}
    </div>
  );
}

const headerBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 8px',
  borderRadius: 6,
  border: '1px solid var(--surface-3, #1D2D3E)',
  background: 'transparent',
  color: 'var(--white, #FFFFFF)',
  cursor: 'pointer',
  fontSize: '0.78rem',
  fontWeight: 600,
};
