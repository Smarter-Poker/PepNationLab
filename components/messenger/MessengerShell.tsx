'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ConversationList from './ConversationList';
import MessagePane from './MessagePane';
import SearchBar from './SearchBar';
import NewConversationDialog from './NewConversationDialog';
import { SquarePen } from 'lucide-react';
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
  //
  // R30 Phase 5: also handle deep-links from the Researcher CRM:
  //   ?participant=<uuid>    → open/create a 1:1 thread with that user
  //   ?participants=<csv>    → open a group thread with all of them
  // These are fired by the CRM's per-row Message button and the bulk
  // Message All button so the agent lands directly in the right
  // conversation instead of an empty messenger screen.
  const router = useRouter();
  const searchParams = useSearchParams();
  const consumedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!searchParams) return;
    const conversation = searchParams.get('conversation') || searchParams.get('conv');
    if (conversation) {
      setActive(conversation);
      const params = new URLSearchParams(searchParams.toString());
      params.delete('conversation');
      params.delete('conv');
      const qs = params.toString();
      router.replace(qs ? `/messenger?${qs}` : '/messenger', { scroll: false });
      return;
    }

    const compose = searchParams.get('compose');
    const participant = searchParams.get('participant');
    const participants = searchParams.get('participants');

    if (compose === '1' || compose === 'true') {
      setComposeOpen(true);
      const params = new URLSearchParams(searchParams.toString());
      params.delete('compose');
      const qs = params.toString();
      router.replace(qs ? `/messenger?${qs}` : '/messenger', { scroll: false });
      return;
    }

    if (participant || participants) {
      const key = participant ?? participants ?? '';
      if (consumedRef.current === key) return;
      consumedRef.current = key;

      const ids = participant
        ? [participant]
        : (participants ?? '')
            .split(',')
            .map((s) => s.trim())
            .filter((s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s));
      if (ids.length === 0) return;

      const params = new URLSearchParams(searchParams.toString());
      params.delete('participant');
      params.delete('participants');
      const qs = params.toString();
      router.replace(qs ? `/messenger?${qs}` : '/messenger', { scroll: false });

      void (async () => {
        try {
          const body =
            ids.length === 1
              ? { type: 'direct', participantIds: ids }
              : { type: 'group', participantIds: ids, title: '' };
          const res = await fetch('/api/messenger/start-conversation', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          });
          if (!res.ok) return;
          const json = (await res.json()) as { conversationId?: string };
          if (json.conversationId) {
            setActive(json.conversationId);
          }
        } catch {
          /* leave the messenger on the empty state if the API errors */
        }
      })();
    }
  }, [searchParams, router, setActive]);

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

  // round-22c: fetch own role so the realtime allow-list can skip the
  // downline filter for admins. Without this, the round-22 sidebar
  // filtering would also suppress push notifications for any message
  // from a non-downline user the admin DM'd.
  //
  // Originally tried /api/auth/resolve in round-22b but that endpoint
  // is a username→email lookup that returns {email}, NOT {role}, so the
  // fetch was a silent no-op and admins were still being filtered.
  // /api/messenger/me is a tiny dedicated endpoint that returns {role}.
  const [selfRole, setSelfRole] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/messenger/me', { method: 'POST', cache: 'no-store' });
        if (!res.ok) return;
        const json = (await res.json()) as { role?: string | null };
        if (!cancelled && typeof json.role === 'string') setSelfRole(json.role);
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!userId) return;

    // round-22b: for admins, pass `undefined` so the subscription
    // accepts ALL incoming-message broadcasts. Non-admin users still
    // get the conservative allow-list derived from the visible
    // conversation list (avoids noise from convs not yet in state).
    const allowConvIds = selfRole === 'admin'
      ? undefined
      : new Set<string>(conversations.map((c) => c.conversation_id));
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
  }, [userId, conversations, selfRole]);

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

  const handleNewConversation = useCallback(() => {
    setComposeOpen(true);
  }, []);

  // Mobile back-button integration:
  // The in-content "Conversations" back row is REMOVED. The global navbar
  // back button is the single back UX on mobile. We push a history entry
  // when a conversation is opened so the browser/system back triggers
  // popstate, which we intercept to clear activeId (showing the
  // conversation list again) instead of routing away from /messenger.
  // The next system back actually leaves /messenger.
  const pushedRef = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (activeId && !pushedRef.current) {
      try {
        window.history.pushState({ pnlMessengerActive: activeId }, '');
        pushedRef.current = true;
      } catch { /* silent */ }
    } else if (!activeId && pushedRef.current) {
      // activeId was cleared programmatically (e.g. user picked another
      // conversation from the list); roll the synthetic entry off the
      // history stack so the stack stays clean.
      try {
        window.history.back();
      } catch { /* silent */ }
      pushedRef.current = false;
    }
  }, [activeId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPop = () => {
      if (activeIdRef.current) {
        setActive(null);
        pushedRef.current = false;
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [setActive]);

  return (
    <div
      className={`messenger-shell${activeId ? ' msg-panel-active' : ''}`}
      // round-10 fix: the parent layout (app/messenger/layout.tsx) already
      // subtracts the 60px fixed navbar via a spacer + flex:1 1 0 content
      // column. Using height:100dvh here would push the shell 60px below
      // the visible viewport and hide the composer / Send button on mobile.
      // Use flex:1 1 0 so the shell fills the space its parent gives it.
      style={{ display: 'flex', flex: '1 1 0', minHeight: 0, width: '100%', background: 'var(--black, #050A0F)', overflow: 'hidden' }}
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
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 10px',
            flexShrink: 0,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <SearchBar />
          </div>
          <button
            type="button"
            onClick={handleNewConversation}
            aria-label="New Message"
            title="New Message"
            className="hover-lift"
            style={{
              flexShrink: 0,
              width: 44,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 12,
              border: '1px solid var(--surface-3, #1D2D3E)',
              background: 'var(--teal, #00C4BC)',
              color: '#000',
              cursor: 'pointer',
            }}
          >
            <SquarePen size={20} aria-hidden="true" />
          </button>
        </header>
        <ConversationList selfId={userId} />
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
          <MessagePane userId={userId} />
        )}
      </section>
      {composeOpen && (
        <NewConversationDialog selfId={userId} onClose={() => setComposeOpen(false)} />
      )}
    </div>
  );
}
