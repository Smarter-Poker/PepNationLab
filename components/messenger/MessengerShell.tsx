'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import ConversationList from './ConversationList';
import MessagePane from './MessagePane';
import SearchBar from './SearchBar';
import IncomingCallToast from './IncomingCallToast';
import CallOverlay from './CallOverlay';
import { useMessengerStore } from '@/stores/messengerStore';
import {
  subscribeCallSignals,
  subscribeMyIncomingMessages,
  unsubscribe,
  type CallSignalRow,
  type IncomingMessageNotification,
} from '@/lib/messenger/realtime';

interface Props {
  userId: string;
}

const PRESENCE_INTERVAL_MS = 30_000;

interface CachedPrefs {
  browser_push: boolean;
  mute_all: boolean;
}

export default function MessengerShell({ userId }: Props) {
  const setActive = useMessengerStore((s) => s.setActive);
  const activeId = useMessengerStore((s) => s.activeConversationId);
  const conversations = useMessengerStore((s) => s.conversations);
  const [incomingCalls, setIncomingCalls] = useState<CallSignalRow[]>([]);
  const [activeCall, setActiveCall] = useState<CallSignalRow | null>(null);

  // Phase 14: cache the caller's notification preferences in a ref so the
  // Realtime onInsert callback doesn't have to refetch on every message.
  // We refetch once on mount and again whenever the POST flow in MessagePane
  // would normally write -- but cheaper than a per-message GET.
  const prefsRef = useRef<CachedPrefs>({ browser_push: false, mute_all: false });
  const activeIdRef = useRef<string | null>(null);

  // Audit5 fix: also honor per-conversation mute. Previously the cross-conv
  // browser push subscription only checked prefs.mute_all -- if a user muted a
  // single noisy conversation, messages from that conv would still fire OS
  // notifications when the tab was hidden. Mirror the in-list mute by keeping
  // a Set<conversation_id> of muted convs derived from the store.
  const mutedConvIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    activeIdRef.current = activeId ?? null;
  }, [activeId]);

  useEffect(() => {
    const next = new Set<string>();
    conversations.forEach((c) => {
      if (c.is_muted) next.add(c.conversation_id);
    });
    mutedConvIdsRef.current = next;

    // Auto-open first conversation on desktop if none selected
    if (!activeId && conversations.length > 0) {
      if (typeof window !== 'undefined' && window.innerWidth > 768) {
        setActive(conversations[0].conversation_id);
      }
    }
  }, [conversations, activeId, setActive]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/messenger/notification-prefs', {
          method: 'GET',
          cache: 'no-store',
        });
        if (!res.ok) return;
        const json = (await res.json()) as {
          prefs?: { browser_push?: boolean | null; mute_all?: boolean | null };
        };
        if (cancelled) return;
        prefsRef.current = {
          browser_push: Boolean(json.prefs?.browser_push),
          mute_all: Boolean(json.prefs?.mute_all),
        };
      } catch {
        // non-fatal
      }
    })();
    // Listen for an in-page event from MessagePane after the opt-in flow so
    // the cache stays in sync without a window reload.
    function onPrefsUpdated(e: Event) {
      const detail = (e as CustomEvent<CachedPrefs>).detail;
      if (detail) prefsRef.current = { ...prefsRef.current, ...detail };
    }
    window.addEventListener('messenger:prefs-updated', onPrefsUpdated as EventListener);
    return () => {
      cancelled = true;
      window.removeEventListener('messenger:prefs-updated', onPrefsUpdated as EventListener);
    };
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    const ping = async () => {
      try {
        await fetch('/api/messenger/update-presence', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        });
      } catch {
        // network blips are tolerated
      }
    };
    void ping();
    const id = setInterval(() => {
      if (!cancelled) void ping();
    }, PRESENCE_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [userId]);

  // Phase 11: subscribe to call signals across every conversation the user
  // participates in. RLS already filters rows to allowed conversations.
  useEffect(() => {
    const ch = subscribeCallSignals(userId, {
      onInsert: (c) => {
        if (c.status !== 'ringing') return;
        if (c.initiator_id === userId) return;
        setIncomingCalls((cur) => (cur.some((x) => x.id === c.id) ? cur : [...cur, c]));
      },
      onUpdate: (c) => {
        // remove from incoming whenever status leaves 'ringing'
        if (c.status !== 'ringing') {
          setIncomingCalls((cur) => cur.filter((x) => x.id !== c.id));
        }
        // if the call we are in just ended for everyone, dismiss the overlay
        setActiveCall((cur) => {
          if (!cur || cur.id !== c.id) return cur;
          if (c.status === 'ended' || c.status === 'declined' || c.status === 'missed') return null;
          return { ...cur, status: c.status };
        });
      },
    });
    return () => unsubscribe(ch);
  }, [userId]);

  // Phase 14: cross-conversation incoming-message subscription. Fires a
  // browser Notification only when the tab is hidden OR the message belongs
  // to a different conversation than the one currently active.
  const lastNotifiedRef = useRef<Set<string>>(new Set());
  // Audit6 fix: cache sender name lookups so consecutive messages from the
  // same sender don't hit the network for every notification. Cleared on
  // unmount with the rest of the component state.
  const senderNameCacheRef = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    function preview(m: IncomingMessageNotification): string {
      if (m.text && m.text.trim().length > 0) {
        const t = m.text.trim();
        return t.length > 120 ? `${t.slice(0, 120)}...` : t;
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
          return '[Media]';
      }
    }
    // Audit7 fix: cap the sender-name cache so it cannot grow unbounded across
    // a long-lived browser session. The Map preserves insertion order so we
    // can drop the oldest entries when we cross the soft limit. 500 entries
    // is more than any single user will realistically meet inside one tab.
    const SENDER_CACHE_MAX = 500;
    function trimSenderCache() {
      const cache = senderNameCacheRef.current;
      if (cache.size <= SENDER_CACHE_MAX) return;
      // Drop the oldest 100 entries in one shot so we don't run the trim
      // logic on every single insert.
      const overflow = cache.size - (SENDER_CACHE_MAX - 100);
      const it = cache.keys();
      for (let i = 0; i < overflow; i += 1) {
        const next = it.next();
        if (next.done) break;
        cache.delete(next.value);
      }
    }
    async function resolveSenderName(m: IncomingMessageNotification): Promise<string> {
      const cached = senderNameCacheRef.current.get(m.sender_id);
      if (cached) return cached;
      try {
        const res = await fetch('/api/messenger/list-participants', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ conversationId: m.conversation_id }),
        });
        if (!res.ok) {
          senderNameCacheRef.current.set(m.sender_id, 'Someone');
          trimSenderCache();
          return 'Someone';
        }
        const json = (await res.json()) as {
          participants?: Array<{ user_id: string; full_name: string | null; username: string | null }>;
        };
        // Populate the cache with everyone in the conversation in one shot.
        (json.participants ?? []).forEach((p) => {
          const name =
            (p.full_name && p.full_name.trim()) ||
            (p.username && p.username.trim()) ||
            'Someone';
          senderNameCacheRef.current.set(p.user_id, name);
        });
        trimSenderCache();
        return senderNameCacheRef.current.get(m.sender_id) ?? 'Someone';
      } catch {
        senderNameCacheRef.current.set(m.sender_id, 'Someone');
        trimSenderCache();
        return 'Someone';
      }
    }
    async function maybeNotify(m: IncomingMessageNotification) {
      try {
        // Skip if user is actively looking at this conversation.
        const hidden = typeof document !== 'undefined' && document.visibilityState !== 'visible';
        
        // If the user is physically looking at the messenger app (any conversation), 
        // we NEVER push OS notifications because it's intrusive.
        const isMessengerActive = typeof window !== 'undefined' && window.location.pathname.startsWith('/messenger');
        if (isMessengerActive && !hidden) return;

        const lookingAtThisConv =
          activeIdRef.current === m.conversation_id && !hidden;
        if (lookingAtThisConv) return;
        if (prefsRef.current.mute_all) return;
        // Audit5 fix: per-conversation mute honored here too.
        if (mutedConvIdsRef.current.has(m.conversation_id)) return;
        if (!prefsRef.current.browser_push) return;
        if (typeof Notification === 'undefined') return;
        if (Notification.permission !== 'granted') return;
        // Dedupe in case Realtime delivers the same row twice.
        if (lastNotifiedRef.current.has(m.id)) return;
        lastNotifiedRef.current.add(m.id);
        // Trim the dedupe set if it grows.
        if (lastNotifiedRef.current.size > 200) {
          const arr = Array.from(lastNotifiedRef.current);
          lastNotifiedRef.current = new Set(arr.slice(-100));
        }
        // Audit6 fix: include sender name in body so the user knows who
        // messaged without opening the tab. Lookup is cached per sender.
        const senderName = await resolveSenderName(m);
        const body = `${senderName}: ${preview(m)}`;
        const n = new Notification('New Message On Pep Nation Lab', {
          body,
          tag: m.conversation_id,
          icon: '/logo-mark.svg',
        });
        // Audit6 fix: clicking the OS notification used to do nothing. Focus
        // the tab if possible and navigate to the messenger surface with the
        // target conversation activated. encodeURIComponent guards against
        // an anomalous conv id surfacing in the URL.
        n.onclick = () => {
          try {
            if (typeof window !== 'undefined') {
              window.focus();
              if (window.location.pathname.startsWith('/messenger')) {
                // Already on the surface - dispatch an event so MessengerShell
                // / MessagePane can swap conversations without a full nav.
                window.dispatchEvent(
                  new CustomEvent('messenger:open-conv', {
                    detail: { conversationId: m.conversation_id },
                  }),
                );
              } else {
                window.location.href = `/messenger?conv=${encodeURIComponent(m.conversation_id)}`;
              }
            }
          } catch {
            // non-fatal
          } finally {
            try {
              n.close();
            } catch {
              /* noop */
            }
          }
        };
      } catch {
        // non-fatal
      }
    }
    let cancelled = false;
    let ch: any = null;

    const setupTimer = setTimeout(() => {
      if (cancelled) return;
      ch = subscribeMyIncomingMessages(userId, (m) => {
        const isIncoming = m.sender_id !== userId;
        // 1. Update the sidebar conversation list snippet and bump to top
        useMessengerStore.getState().updateConversationSnippet(m, isIncoming);
        // 2. Fire-and-forget OS notification
        if (isIncoming) {
          void maybeNotify(m);
        }
      });
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(setupTimer);
      if (ch) unsubscribe(ch);
    };
  }, [userId]);

  // Audit6 fix: when the OS notification click dispatches messenger:open-conv,
  // activate the requested conversation in-place. This avoids a full page
  // reload when the user is already on /messenger.
  useEffect(() => {
    function onOpenConv(e: Event) {
      const detail = (e as CustomEvent<{ conversationId?: string }>).detail;
      if (detail?.conversationId) setActive(detail.conversationId);
    }
    window.addEventListener('messenger:open-conv', onOpenConv as EventListener);
    return () =>
      window.removeEventListener('messenger:open-conv', onOpenConv as EventListener);
  }, [setActive]);

  // Audit6 fix: when arriving from an OS notification full-navigation, the URL
  // is /messenger?conv=<uuid>. Activate that conversation on mount so the
  // user lands directly on the message they were notified about. Validated
  // server-side via subsequent get-messages call.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const sp = new URLSearchParams(window.location.search);
      const conv = sp.get('conv');
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (conv && UUID_RE.test(conv)) setActive(conv);
    } catch {
      // non-fatal
    }
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAccept = useCallback(
    (call: CallSignalRow) => {
      setIncomingCalls((cur) => cur.filter((x) => x.id !== call.id));
      setActive(call.conversation_id);
      setActiveCall(call);
    },
    [setActive],
  );

  const handleDecline = useCallback((call: CallSignalRow) => {
    setIncomingCalls((cur) => cur.filter((x) => x.id !== call.id));
  }, []);

  return (
    <>
      {/* ============================================================
          Facebook-style two-panel layout.

          Desktop (>768px): aside (320px) + main fill side by side.
          Mobile  (≤768px): CSS class "msg-panel-active" on the shell
                            hides the aside (translateX(-100%)) and
                            shows the message pane (translateX(0)).
                            No JS required for the transition — the CSS
                            responds to a class on the shell container.

          Key rules (also in globals.css .messenger-* classes):
            - Shell: display:flex, height:100%, overflow:hidden
            - aside: flex-shrink:0, width:320px
            - main:  flex:1 1 0, min-width:0
          ============================================================ */}
      <div
        className={`messenger-shell${activeId ? ' msg-panel-active' : ''}`}
        style={{
          display: 'flex',
          height: '100%',
          overflow: 'hidden',
          background: 'var(--surface-1, #0F1923)',
          position: 'relative',
        }}
      >
        {/* ---- Conversation list sidebar ---- */}
        <aside className="messenger-sidebar" style={{
          flexShrink: 0,
          width: 320,
          borderRight: '1px solid var(--surface-3, #1D2D3E)',
          background: 'var(--surface-2, #162230)',
          display: 'flex',
          flexDirection: 'column',
          // On mobile this slides out when a conv is active (CSS handles it)
        }}>
          <header style={{
            padding: '10px 12px',
            borderBottom: '1px solid var(--surface-3, #1D2D3E)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            flexShrink: 0,
          }}>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--white, #FFFFFF)' }}>Messenger</div>
            <SearchBar />
          </header>
          <ConversationList selfId={userId} />
        </aside>

        {/* ---- Message pane (fills remaining space) ---- */}
        <div className="messenger-main" style={{
          flex: '1 1 0',
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}>
          {/* Mobile back button — only visible on mobile when a conv is active */}
          {activeId && (
            <button
              type="button"
              className="messenger-back-btn"
              onClick={() => setActive(null)}
              aria-label="Back To Conversations"
              style={{
                display: 'none', // shown via CSS on mobile
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                background: 'var(--surface-2, #162230)',
                border: 'none',
                borderBottom: '1px solid var(--surface-3, #1D2D3E)',
                color: 'var(--teal, #00C4BC)',
                cursor: 'pointer',
                fontSize: '0.88rem',
                fontWeight: 600,
                flexShrink: 0,
                width: '100%',
                textAlign: 'left',
              }}
            >
              <ArrowLeft size={16} aria-hidden="true" />
              All Conversations
            </button>
          )}
          <MessagePane key={activeId || 'empty'} userId={userId} activeCall={activeCall} setActiveCall={setActiveCall} />
        </div>
      </div>

      {/* Incoming call toasts — absolutely positioned so they don't affect layout */}
      {incomingCalls.map((c, idx) => (
        <IncomingCallToast
          key={c.id}
          call={c}
          onAccept={() => handleAccept(c)}
          onDecline={() => handleDecline(c)}
          stackIndex={idx}
        />
      ))}
      {activeCall && (
        <CallOverlay
          call={activeCall}
          selfId={userId}
          onClose={() => setActiveCall(null)}
        />
      )}
    </>
  );
}
