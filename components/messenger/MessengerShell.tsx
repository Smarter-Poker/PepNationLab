'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import ConversationList from './ConversationList';
import MessagePane from './MessagePane';
import SearchBar from './SearchBar';
import NewConversationDialog from './NewConversationDialog';
import { useMessengerStore } from '@/stores/messengerStore';
import {
  subscribeMyIncomingMessages,
  unsubscribe,
  type IncomingMessageNotification,
} from '@/lib/messenger/realtime';
import { vibrateLight } from '@/lib/messenger/haptics';

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

  const [composeOpen, setComposeOpen] = useState(false);

  // fix-46.1: react to ?compose=1 via useSearchParams so the dialog opens
  // even when the user is already mounted on /messenger and the URL changes
  // via client-side navigation (Next.js App Router does not remount the
  // component, so a useEffect([]) read of window.location.search misses
  // the change). After consuming the param we use router.replace() to
  // strip it; the resulting reactive run sees compose=null and bails out.
  const router = useRouter();
  const searchParams = useSearchParams();
  useEffect(() => {
    if (!searchParams) return;
    const v = searchParams.get('compose');
    if (v === '1' || v === 'true') {
      setComposeOpen(true);
      const params = new URLSearchParams(searchParams.toString());
      params.delete('compose');
      const qs = params.toString();
      router.replace(qs ? `/messenger?${qs}` : '/messenger', { scroll: false });
    }
  }, [searchParams, router]);

  const prefsRef = useRef<CachedPrefs>({ browser_push: false, mute_all: false });
  const activeIdRef = useRef<string | null>(null);

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
          browser_push: json.prefs?.browser_push === true,
          mute_all: json.prefs?.mute_all === true,
        };
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!userId) return;

    const allowConvIds = new Set<string>(conversations.map((c) => c.conversation_id));
    const ch = subscribeMyIncomingMessages(
      userId,
      (m: IncomingMessageNotification & { sender_id?: string }) => {
        if (m.sender_id === userId) return;
        if (activeIdRef.current === m.conversation_id) return;
        if (mutedConvIdsRef.current.has(m.conversation_id)) return;
        try { vibrateLight(); } catch {}
        if (prefsRef.current.browser_push && !prefsRef.current.mute_all) {
          try {
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              new Notification('New Message', {
                body: (m.text ?? '').slice(0, 120) || 'You Have A New Message',
                tag: `pnl-msg-${m.conversation_id}`,
              });
            }
          } catch { /* silent */ }
        }
      },
      allowConvIds,
    );

    return () => { unsubscribe(ch); };
  }, [userId, conversations]);

  useEffect(() => {
    let cancelled = false;
    const ping = async () => {
      try {
        await fetch('/api/messenger/presence-ping', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
          cache: 'no-store',
          keepalive: true,
        });
      } catch { /* silent */ }
    };
    void ping();
    const id = setInterval(() => { if (!cancelled) void ping(); }, PRESENCE_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const handleBack = useCallback(() => {
    setActive(null);
  }, [setActive]);

  const handleNewConversation = useCallback(() => {
    setComposeOpen(true);
  }, []);

  return (
    <div
      className={`messenger-shell${activeId ? ' msg-panel-active' : ''}`}
      style={{ display: 'flex', height: '100dvh', minHeight: 0, background: 'var(--black, #050A0F)', overflow: 'hidden' }}
    >
      <aside
        style={{
          width: activeId ? 320 : '100%',
          maxWidth: '100%',
          flexShrink: 0,
          borderRight: '1px solid var(--surface-3, #1D2D3E)',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
        className={`messenger-sidebar${activeId ? ' has-active' : ''}`}
      >
        <SearchBar onNewConversation={handleNewConversation} />
        <ConversationList />
      </aside>
      <section
        style={{
          flex: 1,
          display: activeId ? 'flex' : 'none',
          flexDirection: 'column',
          minWidth: 0,
          minHeight: 0,
        }}
        className="messenger-main"
      >
        {activeId && (
          <>
            <button
              type="button"
              onClick={handleBack}
              aria-label="Back To Conversations"
              className="messenger-back-btn"
              style={{
                display: 'none',
                alignItems: 'center',
                gap: 6,
                padding: '10px 12px',
                background: 'transparent',
                border: 0,
                borderBottom: '1px solid var(--surface-3, #1D2D3E)',
                color: 'var(--white, #FFFFFF)',
                fontSize: '0.92rem',
                cursor: 'pointer',
              }}
            >
              <ArrowLeft size={16} />
              Conversations
            </button>
            <MessagePane conversationId={activeId} selfId={userId} />
          </>
        )}
      </section>
      {composeOpen && (
        <NewConversationDialog selfId={userId} onClose={() => setComposeOpen(false)} />
      )}
    </div>
  );
}
