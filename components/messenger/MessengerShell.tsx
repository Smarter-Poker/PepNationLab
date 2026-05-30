'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
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
  const [incomingCalls, setIncomingCalls] = useState<CallSignalRow[]>([]);
  const [activeCall, setActiveCall] = useState<CallSignalRow | null>(null);

  // Phase 14: cache the caller's notification preferences in a ref so the
  // Realtime onInsert callback doesn't have to refetch on every message.
  // We refetch once on mount and again whenever the POST flow in MessagePane
  // would normally write -- but cheaper than a per-message GET.
  const prefsRef = useRef<CachedPrefs>({ browser_push: false, mute_all: false });
  const activeIdRef = useRef<string | null>(null);

  useEffect(() => {
    activeIdRef.current = activeId ?? null;
  }, [activeId]);

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
    function maybeNotify(m: IncomingMessageNotification) {
      try {
        // Skip if user is actively looking at this conversation.
        const hidden = typeof document !== 'undefined' && document.visibilityState !== 'visible';
        const lookingAtThisConv =
          activeIdRef.current === m.conversation_id && !hidden;
        if (lookingAtThisConv) return;
        if (prefsRef.current.mute_all) return;
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
        new Notification('New Message On Pep Nation Lab', {
          body: preview(m),
          tag: m.conversation_id,
          icon: '/logo-mark.svg',
        });
      } catch {
        // non-fatal
      }
    }
    const ch = subscribeMyIncomingMessages(userId, maybeNotify);
    return () => unsubscribe(ch);
  }, [userId]);

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
    <section className="section" style={{ padding: 0 }}>
      <div
        style={{
          display: 'flex',
          height: 'calc(100vh - 140px)',
          minHeight: 480,
          border: '1px solid var(--surface-3, #1D2D3E)',
          borderRadius: 12,
          overflow: 'hidden',
          background: 'var(--surface-1, #0F1923)',
          margin: '0 auto',
          maxWidth: 1200,
        }}
      >
        <aside
          style={{
            width: 320,
            borderRight: '1px solid var(--surface-3, #1D2D3E)',
            background: 'var(--surface-2, #162230)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <header
            style={{
              padding: '10px 12px',
              borderBottom: '1px solid var(--surface-3, #1D2D3E)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '1rem' }}>Messenger</div>
            <SearchBar />
          </header>
          <ConversationList selfId={userId} />
        </aside>
        <MessagePane userId={userId} activeCall={activeCall} setActiveCall={setActiveCall} />
      </div>
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
    </section>
  );
}
