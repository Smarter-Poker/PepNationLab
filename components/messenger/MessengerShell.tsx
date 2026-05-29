'use client';
import { useCallback, useEffect, useState } from 'react';
import ConversationList from './ConversationList';
import MessagePane from './MessagePane';
import SearchBar from './SearchBar';
import IncomingCallToast from './IncomingCallToast';
import CallOverlay from './CallOverlay';
import { useMessengerStore } from '@/stores/messengerStore';
import {
  subscribeCallSignals,
  unsubscribe,
  type CallSignalRow,
} from '@/lib/messenger/realtime';

interface Props {
  userId: string;
}

const PRESENCE_INTERVAL_MS = 30_000;

export default function MessengerShell({ userId }: Props) {
  const setActive = useMessengerStore((s) => s.setActive);
  const [incomingCalls, setIncomingCalls] = useState<CallSignalRow[]>([]);
  const [activeCall, setActiveCall] = useState<CallSignalRow | null>(null);

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
