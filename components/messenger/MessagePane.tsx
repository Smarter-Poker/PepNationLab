'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMessengerStore } from '@/stores/messengerStore';
import { enablePush } from '@/lib/push-client';
import type { ConversationListItem, Message, Reaction, ParticipantRole } from '@/lib/messenger/types';
import type { MessageLabelValue, ThemeValue } from '@/lib/messenger/schemas';
import type { CallSignalRow } from '@/lib/messenger/realtime';
import { MessageCircle, Info, Bell, BellOff, X } from 'lucide-react';
import MessageBubble from './MessageBubble';
import MessageComposer from './MessageComposer';
import TypingIndicator from './TypingIndicator';
import GroupInfoDrawer from './GroupInfoDrawer';
import PinnedBar from './PinnedBar';
import ThreadDrawer from './ThreadDrawer';
import CallButton from './CallButton';
import ReportModal from './ReportModal';
import BlockList from './BlockList';
import RemindersList from './RemindersList';
import { toast } from 'sonner';
import {
  subscribeMessages,
  subscribeTyping,
  unsubscribe,
  supabase,
} from '@/lib/messenger/realtime';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface Props {
  userId: string;
  activeCall: CallSignalRow | null;
  setActiveCall: (c: CallSignalRow | null) => void;
}

const BATCH_SIZE = 50;
const TYPING_TTL_MS = 16000;
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

const markReadTimeouts: Record<string, NodeJS.Timeout> = {};

async function markConversationRead(conversationId: string, lastReadMessageId: string) {
  if (markReadTimeouts[conversationId]) {
    clearTimeout(markReadTimeouts[conversationId]);
  }
  markReadTimeouts[conversationId] = setTimeout(async () => {
    try {
      await fetch('/api/messenger/mark-read', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ conversationId, lastReadMessageId }),
      });
    } catch {
      // Best-effort
    }
  }, 1000); // 1-second debounce
}

type PushBannerState = 'hidden' | 'default' | 'denied';

let globalAudioCtx: AudioContext | null = null;
let audioInitDone = false;

function initAudio() {
  if (typeof window === 'undefined' || audioInitDone) return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      globalAudioCtx = new AudioContextClass();
    }
    audioInitDone = true;
  } catch {
    // Ignore
  }
}

if (typeof document !== 'undefined') {
  const handleInteraction = () => {
    initAudio();
    if (globalAudioCtx && globalAudioCtx.state === 'suspended') {
      globalAudioCtx.resume().catch(() => {});
    }
    document.removeEventListener('pointerdown', handleInteraction);
    document.removeEventListener('keydown', handleInteraction);
  };
  document.addEventListener('pointerdown', handleInteraction);
  document.addEventListener('keydown', handleInteraction);
}

function playPopSound() {
  if (typeof window === 'undefined') return;
  try {
    if (navigator.vibrate) navigator.vibrate(20);
    if (!globalAudioCtx) return;
    if (globalAudioCtx.state === 'suspended') return;
    
    const osc = globalAudioCtx.createOscillator();
    const gain = globalAudioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, globalAudioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, globalAudioCtx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0, globalAudioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.1, globalAudioCtx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.01, globalAudioCtx.currentTime + 0.1);
    
    osc.connect(gain);
    gain.connect(globalAudioCtx.destination);
    
    osc.start();
    osc.stop(globalAudioCtx.currentTime + 0.1);
  } catch {
    // Ignore autoplay or audio context errors
  }
}

function formatMessageTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const timeString = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toUpperCase();
  
  const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  if (isToday) return `TODAY AT ${timeString}`;
  
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.getDate() === yesterday.getDate() && date.getMonth() === yesterday.getMonth() && date.getFullYear() === yesterday.getFullYear();
  if (isYesterday) return `YESTERDAY AT ${timeString}`;
  
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays < 7) {
    const weekday = date.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
    return `${weekday} AT ${timeString}`;
  }
  
  const dateString = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined }).toUpperCase();
  return `${dateString} AT ${timeString}`;
}


export default function MessagePane({ userId, activeCall, setActiveCall }: Props) {
  const activeId = useMessengerStore((s) => s.activeConversationId);
  const messagesByConv = useMessengerStore((s) => s.messages);
  const setMessages = useMessengerStore((s) => s.setMessages);
  const setLoading = useMessengerStore((s) => s.setLoadingMessages);
  const loadingByConv = useMessengerStore((s) => s.loadingMessages);
  const appendMessage = useMessengerStore((s) => s.appendMessage);
  const upsertMessages = useMessengerStore((s) => s.upsertMessages);
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
  const [participantsMap, setParticipantsMap] = useState<Record<string, { full_name?: string | null; username?: string | null; last_read_message_id?: string | null }>>({});
  const [pinRefreshKey, setPinRefreshKey] = useState(0);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [labelsByMsg, setLabelsByMsg] = useState<Record<string, MessageLabelValue[]>>({});
  const [threadParentId, setThreadParentId] = useState<string | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
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
  const prependMessages = useMessengerStore((s) => s.prependMessages);
  const [hasMoreMessages, setHasMoreMessages] = useState<Record<string, boolean>>({});
  const [loadingMore, setLoadingMore] = useState(false);

  // Phase 14: push opt-in banner state
  const [pushBanner, setPushBanner] = useState<PushBannerState>('hidden');

  // activeCall is hoisted to MessengerShell so IncomingCallToast accept-handlers can set it.
  void activeCall;

  const typingExpiryRef = useRef<Record<string, number>>({});
  const typingSweeperRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const broadcastTypingRef = useRef<((isTyping: boolean) => void) | null>(null);
  const broadcastMessageRef = useRef<((m: Message) => void) | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Offline sync observer
  const wasOfflineRef = useRef(false);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    setTimeout(() => {
      const container = scrollContainerRef.current;
      if (container) {
        if (behavior === 'smooth') {
          container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
        } else {
          container.scrollTop = container.scrollHeight;
        }
      } else {
        messagesEndRef.current?.scrollIntoView({ behavior });
      }
    }, 100); // Increased timeout slightly to ensure paint is done
  }, []);

  // Scroll to bottom when messages load or change or when someone starts typing
  useEffect(() => {
    scrollToBottom();
  }, [activeId, messagesByConv, typingUserIds, scrollToBottom]);

  useEffect(() => {
    setReplyTo(null);
    setInfoOpen(false);
    setThreadParentId(null);
    setReportTarget(null);
    setRemindersOpen(false);
    setReminderSeed(null);
    setActiveMenuId(null);
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
      
      const pushRes = await enablePush();
      if (!pushRes.ok) {
        if (pushRes.error?.includes('Permission')) {
           setPushBanner('denied');
           return;
        }
        toast(`Push Failed: ${pushRes.error}`);
        // Fallback: still request permission so at least they can get notifications locally if server fails?
        // Actually, enablePush() already requests permission.
      }

      const result = Notification.permission;
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
          // Even if saving preference failed, hide it because it's annoying to keep seeing it.
          setPushBanner('hidden');
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
          const json = (await rolesRes.json()) as { participants?: Array<{ user_id: string; role: ParticipantRole; full_name?: string | null; username?: string | null; last_read_message_id?: string | null }> };
          const me = json.participants?.find((p) => p.user_id === userId);
          setSelfRole(me?.role ?? null);
          const map: Record<string, { full_name?: string | null; username?: string | null; last_read_message_id?: string | null }> = {};
          json.participants?.forEach(p => {
             map[p.user_id] = { full_name: p.full_name, username: p.username, last_read_message_id: p.last_read_message_id };
          });
          setParticipantsMap(map);
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

  // Resolve pins, labels for the loaded messages.
  const loadPinsLabels = useCallback(async (conversationId: string, messageIds: string[]) => {
    try {
      const reqs: Promise<Response>[] = [
        fetch('/api/messenger/list-pins', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ conversationId }),
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
      const [pinsRes, labelsRes] = await Promise.all(reqs);
      if (pinsRes.ok) {
        const json = (await pinsRes.json()) as { pins?: Array<{ message_id: string }> };
        setPinnedIds(new Set((json.pins ?? []).map((p) => p.message_id)));
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

  const handleLoadMore = useCallback(async () => {
    const messages = messagesByConv[activeId ?? ''] ?? [];
    if (!activeId || loadingMore || hasMoreMessages[activeId] === false || messages.length === 0) return;
    setLoadingMore(true);
    const firstMessageId = messages[0].id;
    
    const container = scrollContainerRef.current;
    const oldScrollHeight = container?.scrollHeight ?? 0;
    
    try {
      const res = await fetch('/api/messenger/get-messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ conversationId: activeId, beforeId: firstMessageId, limit: 50 }),
      });
      if (!res.ok) return;
      const json = (await res.json()) as { messages?: Message[]; reactions?: Reaction[] };
      const list = json.messages ?? [];
      if (list.length < 50) {
        setHasMoreMessages(prev => ({ ...prev, [activeId]: false }));
      }
      if (list.length > 0) {
        prependMessages(activeId, list);
        const map: Record<string, Reaction[]> = {};
        (json.reactions ?? []).forEach((r) => {
          (map[r.message_id] ??= []).push(r);
        });
        setReactionsByMsg(prev => {
          const next = { ...prev };
          Object.keys(map).forEach(k => {
             next[k] = [...(next[k]||[]), ...map[k]];
          });
          return next;
        });
        void loadPinsLabels(activeId, list.map((m) => m.id));
        
        setTimeout(() => {
           if (container) {
             const newScrollHeight = container.scrollHeight;
             container.scrollTop = newScrollHeight - oldScrollHeight;
           }
        }, 0);
      }
    } catch (err) {
      console.warn('Failed to load more messages:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [activeId, loadingMore, hasMoreMessages, messagesByConv, prependMessages, loadPinsLabels]);

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
        useMessengerStore.getState().upsertMessages(activeId, list);
        if (list.length < 50) {
          setHasMoreMessages(prev => ({ ...prev, [activeId]: false }));
        } else {
          setHasMoreMessages(prev => ({ ...prev, [activeId]: true }));
        }
        const map: Record<string, Reaction[]> = {};
        (json.reactions ?? []).forEach((r) => {
          (map[r.message_id] ??= []).push(r);
        });
        setReactionsByMsg(map);
        const lastId = list.length > 0 ? list[0].id : null;
        if (lastId) void markConversationRead(activeId, lastId);
        void loadPinsLabels(activeId, list.map((m) => m.id));
      } catch (err) {
        console.warn('Failed to load messages:', err);
      } finally {
        if (!cancelled) setLoading(activeId, false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeId, messagesByConv, setMessages, setLoading, loadPinsLabels]);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const topElementRef = useCallback((node: HTMLDivElement | null) => {
    const messages = messagesByConv[activeId ?? ''] ?? [];
    if (loadingMore) return;
    if (observerRef.current) observerRef.current.disconnect();
    
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && activeId && hasMoreMessages[activeId] && messages.length > 0) {
        handleLoadMore();
      }
    });
    
    if (node) observerRef.current.observe(node);
  }, [loadingMore, hasMoreMessages, activeId, messagesByConv, handleLoadMore]);

  useEffect(() => {
    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!activeId) return;

    const handleSync = async () => {
      try {
        const res = await fetch('/api/messenger/get-messages', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ conversationId: activeId, limit: 50 }),
        });
        if (!res.ok) return;
        const json = (await res.json()) as { messages?: Message[]; reactions?: Reaction[] };
        const list = json.messages ?? [];
        if (list.length > 0) {
          const store = useMessengerStore.getState();
          store.upsertMessages(activeId, list);
          
          const map: Record<string, Reaction[]> = {};
          (json.reactions ?? []).forEach((r) => {
            (map[r.message_id] ??= []).push(r);
          });
          setReactionsByMsg(prev => {
            const next = { ...prev };
            Object.keys(map).forEach(k => {
               const existing = next[k] || [];
               const newReactions = map[k].filter(nr => !existing.some(e => e.id === nr.id));
               next[k] = [...existing, ...newReactions];
            });
            return next;
          });
          
          const finalLastId = list[0]?.id;
          if (finalLastId) void markConversationRead(activeId, finalLastId);
        }
      } catch (err) {
        console.warn('Background sync failed:', err);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') handleSync();
    };
    const handleOnline = () => {
      handleSync();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    let msgChannel: any = null;
    let typingChannel: any = null;
    let participantsChannel: any = null;
    let cancelled = false;

    const setupTimer = setTimeout(() => {
      if (cancelled) return;

      const msgSub = subscribeMessages(activeId, {
        onInsert: (m) => {
          appendMessage(activeId, m);
          if (m.sender_id !== userId) {
            void markConversationRead(activeId, m.id);
            if (document.visibilityState === 'visible') {
              playPopSound();
            }
          }
        },
        onUpdate: (m) => updateMessage(activeId, m),
        onDelete: (id) => removeMessage(activeId, id),
        onReactionInsert: (r) => {
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
        onReactionDelete: (r) => {
          setReactionsByMsg((prev) => {
            const arr = prev[r.message_id] ?? [];
            return {
              ...prev,
              [r.message_id]: arr.filter((x) => !(x.user_id === r.user_id && x.emoji === r.emoji)),
            };
          });
        },
      }, userId);
      
      msgChannel = msgSub.channel;
      broadcastMessageRef.current = msgSub.broadcastNewMessage;

      const typingSub = subscribeTyping(activeId, userId, (e) => {
      if (e.isTyping) {
        typingExpiryRef.current[e.userId] = Date.now() + TYPING_TTL_MS;
        setTypingUserIds((cur) => (cur.includes(e.userId) ? cur : [...cur, e.userId]));
      } else {
        delete typingExpiryRef.current[e.userId];
        setTypingUserIds((cur) => cur.filter((u) => u !== e.userId));
      }
      });
      typingChannel = typingSub.channel;
      broadcastTypingRef.current = typingSub.broadcast;

      participantsChannel = supabase
        .channel(`participants_watcher:${activeId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'messenger_participants',
            filter: `conversation_id=eq.${activeId}`,
          },
          (payload: any) => {
            const row = payload.new as any;
            if (row && row.user_id) {
              setParticipantsMap((prev) => ({
                ...prev,
                [row.user_id]: {
                  ...prev[row.user_id],
                  last_read_message_id: row.last_read_message_id,
                },
              }));
            }
          },
        )
        .subscribe();
    }, 150);

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
      cancelled = true;
      clearTimeout(setupTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      if (typingSweeperRef.current) clearInterval(typingSweeperRef.current);
      typingSweeperRef.current = null;
      typingExpiryRef.current = {};
      broadcastTypingRef.current = null;
      broadcastMessageRef.current = null;
      setTypingUserIds([]);
      if (msgChannel) unsubscribe(msgChannel);
      if (typingChannel) unsubscribe(typingChannel);
      if (participantsChannel) unsubscribe(participantsChannel);
    };
  }, [activeId, userId, appendMessage, updateMessage, removeMessage, setReactionsByMsg]);

  useEffect(() => {
    if (!activeId) return;
    if (!conversations.some((c) => c.conversation_id === activeId && (c.unread_count ?? 0) > 0)) return;
    setConversations(
      conversations.map((c) => (c.conversation_id === activeId ? { ...c, unread_count: 0 } : c)),
    );
  }, [activeId, conversations, setConversations]);

  // Removed separate subscribeReactions in favor of subscribeMessages broadcast

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
          if (scope === 'for_me') upsertMessages(m.conversation_id, [snapshot]);
          else updateMessage(m.conversation_id, snapshot);
        }
      } catch {
        toast('Network Error');
        if (scope === 'for_me') upsertMessages(m.conversation_id, [snapshot]);
        else updateMessage(m.conversation_id, snapshot);
      }
    },
    [upsertMessages, removeMessage, updateMessage],
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
        setLabelsByMsg((cur) => {
          const arr = cur[m.id] ?? [];
          if (had) {
            if (arr.includes(label)) return cur;
            return { ...cur, [m.id]: [...arr, label] };
          }
          return { ...cur, [m.id]: arr.filter((l) => l !== label) };
        });
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

  const [pendingJumpMessageId, setPendingJumpMessageId] = useState<string | null>(null);

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

  return (
    <div
      onClick={() => setActiveMenuId(null)}
      style={{
        flex: 1,
        minHeight: 0,
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
          flexShrink: 0,
          gap: 8,
          minWidth: 0,
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
            flex: '1 1 0',
            minWidth: 0,
          }}
        >
          {headerLabel}
        </div>
        <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          <CallButton
            conversationId={activeId}
            onCallStarted={(c) => setActiveCall(c)}
          />
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setReminderSeed(null); setRemindersOpen(true); }}
            aria-label="Open Reminders"
            className="msg-header-action"
            style={headerBtn}
          >
            <Bell size={12} aria-hidden="true" />
            <span className="msg-header-action-label">Reminders</span>
          </button>
          <button
            type="button"
            onClick={() => setInfoOpen(true)}
            aria-label="Conversation Info"
            className="msg-header-action"
            style={headerBtn}
          >
            <Info size={12} aria-hidden="true" />
            <span className="msg-header-action-label">Info</span>
          </button>
        </div>
      </header>
      {pushBanner !== 'hidden' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            padding: '8px 14px',
            borderBottom: '1px solid var(--surface-3, #1D2D3E)',
            background: pushBanner === 'denied' ? 'rgba(229,62,62,0.06)' : 'rgba(0,196,188,0.06)',
            flexWrap: 'wrap',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--white, #FFFFFF)', fontSize: '0.82rem', flex: '1 1 180px', minWidth: 0 }}>
            {pushBanner === 'denied' ? (
              <>
                <BellOff size={14} aria-hidden="true" style={{ flexShrink: 0 }} />
                <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Notifications Blocked</span>
                <span style={{ color: 'var(--grey-400, #A8B4C0)', fontSize: '0.76rem' }}>
                  Allow In Browser Settings.
                </span>
              </>
            ) : (
              <>
                <Bell size={14} aria-hidden="true" style={{ flexShrink: 0 }} />
                <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Enable Push</span>
                <span style={{ color: 'var(--grey-400, #A8B4C0)', fontSize: '0.76rem' }}>
                  Get Alerts When Tab Is Hidden.
                </span>
              </>
            )}
          </div>
          {pushBanner === 'default' && (
            <div style={{ display: 'inline-flex', gap: 6, flexShrink: 0 }}>
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
              style={{ ...headerBtn, flexShrink: 0 }}
              aria-label="Dismiss Push Notice"
            >
              ✕
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
      <div ref={scrollContainerRef} className="msg-list" onClick={() => setActiveMenuId(null)} style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', padding: 16, display: 'flex', flexDirection: 'column', gap: 0 }}>
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
              const isDirectConv = conversationType === 'direct';
              if (!isDirectConv) return true;
              return !blockedIds.has(m.sender_id);
            })
            .map((m, index, arr) => {
              const isFirst = index === 0 || arr[index - 1].sender_id !== m.sender_id || (new Date(m.created_at).getTime() - new Date(arr[index - 1].created_at).getTime() > 60 * 1000);
              const isLast = index === arr.length - 1 || arr[index + 1].sender_id !== m.sender_id || (new Date(arr[index + 1].created_at).getTime() - new Date(m.created_at).getTime() > 60 * 1000);
              const senderProfile = participantsMap[m.sender_id] || {};
              let senderName = senderProfile.full_name || senderProfile.username || 'User';
              if (conversationType === 'direct' && currentConv && m.sender_id !== userId) {
                 senderName = currentConv.counterparty_full_name || currentConv.counterparty_username || 'User';
              }
              const isBlockedSender = blockedIds.has(m.sender_id) && m.sender_id !== userId;

              let timestampBanner = null;
              if (isFirst) {
                const timeString = formatMessageTimestamp(m.created_at);
                timestampBanner = (
                  <div style={{ textAlign: 'center', color: 'rgba(168,180,192,0.45)', fontSize: '0.68rem', fontWeight: 600, margin: '24px 0 16px 0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {timeString}
                  </div>
                );
              }

              const readBy = Object.entries(participantsMap)
                .filter(([uid, data]) => uid !== userId && data.last_read_message_id === m.id)
                .map(([uid, data]) => ({ id: uid, name: data.full_name || data.username || 'User' }));

              if (isBlockedSender && conversationType !== 'direct') {
                return (
                  <div key={m.id} ref={index === 0 ? topElementRef : null}>
                    {timestampBanner}
                    <div
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
                        marginBottom: isLast ? 24 : 2
                      }}
                    >
                      Message Hidden - Blocked User
                    </div>
                  </div>
                );
              }
              return (
                <div key={m.id} ref={index === 0 ? topElementRef : null} style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  width: '100%',
                  alignItems: m.sender_id === userId ? 'flex-end' : 'flex-start' 
                }}>
                  {timestampBanner}
                  <MessageBubble
                    message={m}
                  isOwn={m.sender_id === userId}
                  isFirst={isFirst}
                  isLast={isLast}
                  senderName={senderName}
                  senderAvatarUrl={(senderProfile as any).avatar_url}
                  reactions={reactionsByMsg[m.id] ?? []}
                  selfId={userId}
                  selfRole={selfRole}
                  conversationType={conversationType}
                  isPinned={pinnedIds.has(m.id)}
                  currentLabels={Array.from(new Set([...(Array.isArray(m.labels) ? m.labels : []), ...(labelsByMsg[m.id] ?? [])])) as MessageLabelValue[]}
                  onReply={setReplyTo}
                  onReact={handleReact}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onPinToggle={handlePinToggle}
                  onLabelToggle={handleLabelToggle}
                  onThread={(parent) => setThreadParentId(parent.id)}
                  onReport={(msg) => setReportTarget(msg)}
                  onSetReminder={handleSetReminder}
                  activeMenuId={activeMenuId}
                  onMenuToggle={(id, open) => setActiveMenuId(open ? id : null)}
                  readBy={readBy}
                />
              </div>
              );
            })
        )}
        <TypingIndicator typingUserIds={typingUserIds} />
        <div ref={messagesEndRef} />
      </div>
      <MessageComposer
        conversationId={activeId}
        selfId={userId}
        replyTo={replyTo}
        onClearReply={() => setReplyTo(null)}
        onTyping={(isTyping) => broadcastTypingRef.current?.(isTyping)}
        broadcastNewMessage={(m) => broadcastMessageRef.current?.(m)}
      />
      {infoOpen && currentConv && (
        <GroupInfoDrawer
          conversation={currentConv}
          selfId={userId}
          onClose={() => setInfoOpen(false)}
          currentTheme={themeValue}
          onThemeChange={(next) => setThemeValue(next)}
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
