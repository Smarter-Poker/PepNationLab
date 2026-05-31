'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { subscribeCallSignals, unsubscribe, type CallSignalRow } from '@/lib/messenger/realtime';
import IncomingCallToast from './IncomingCallToast';
import CallOverlay from './CallOverlay';

export default function GlobalCallListener() {
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [incomingCalls, setIncomingCalls] = useState<CallSignalRow[]>([]);
  const [activeCall, setActiveCall] = useState<CallSignalRow | null>(null);
  const activeCallRef = useRef<CallSignalRow | null>(null);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  // Fetch active session to check auth status and listen for auth changes
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({ id: session.user.id });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (session?.user) {
        setUser({ id: session.user.id });
      } else {
        setUser(null);
        setIncomingCalls([]);
        setActiveCall(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Listen for starting outgoing calls initiated by CallButton
  useEffect(() => {
    const handleStartCall = (e: Event) => {
      const call = (e as CustomEvent<CallSignalRow>).detail;
      if (call) {
        console.log('[GLOBAL CALL] Starting call overlay for initiator call ID:', call.id);
        setActiveCall(call);
      }
    };
    window.addEventListener('messenger:start-call', handleStartCall as EventListener);
    return () => {
      window.removeEventListener('messenger:start-call', handleStartCall as EventListener);
    };
  }, []);

  // Subscribe to realtime call signals
  useEffect(() => {
    if (!user?.id) return;

    console.log('[GLOBAL CALL] Subscribing user to call signals:', user.id);
    const ch = subscribeCallSignals(user.id, {
      onInsert: (c) => {
        if (c.status !== 'ringing') return;
        if (c.initiator_id === user.id) return;
        if (activeCallRef.current) {
          console.log('[GLOBAL CALL] Ignored signal — already active in a call');
          return;
        }

        // Tab Claim Coordination to prevent multiple tabs from ringing simultaneously
        const roomName = c.livekit_room;
        const claimKey = `call_claim_${roomName}`;
        const existingClaim = localStorage.getItem(claimKey);
        const now = Date.now();
        if (existingClaim && (now - parseInt(existingClaim, 10)) < 30000) {
          console.log('[GLOBAL CALL] Ignored signal — claimed by another tab:', roomName);
          return;
        }
        localStorage.setItem(claimKey, now.toString());
        setTimeout(() => {
          try { localStorage.removeItem(claimKey); } catch {}
        }, 35000);

        setIncomingCalls((cur) => (cur.some((x) => x.id === c.id) ? cur : [...cur, c]));
        setActiveCall(c);
      },
      onUpdate: (c) => {
        if (c.status !== 'ringing') {
          setIncomingCalls((cur) => cur.filter((x) => x.id !== c.id));
        }
        setActiveCall((cur) => {
          if (!cur || cur.id !== c.id) return cur;
          if (c.status === 'ended' || c.status === 'declined' || c.status === 'missed') return null;
          return { ...cur, status: c.status };
        });
      },
    });

    return () => {
      void unsubscribe(ch);
    };
  }, [user?.id]);

  const handleAccept = useCallback((call: CallSignalRow) => {
    setIncomingCalls((cur) => cur.filter((x) => x.id !== call.id));
    setActiveCall({ ...call, status: 'active' });

    // Broadcast call_accepted signal back to initiator
    import('@/lib/messenger/realtime').then(({ broadcastCallSignal }) => {
      void broadcastCallSignal(call.initiator_id, 'call_accepted', call);
    }).catch(err => {
      console.warn('Failed to broadcast call accepted signal:', err);
    });
  }, []);

  const handleDecline = useCallback((call: CallSignalRow) => {
    setIncomingCalls((cur) => cur.filter((x) => x.id !== call.id));

    // Broadcast call_declined signal back to initiator
    import('@/lib/messenger/realtime').then(({ broadcastCallSignal }) => {
      void broadcastCallSignal(call.initiator_id, 'call_declined', call);
    }).catch(err => {
      console.warn('Failed to broadcast call declined signal:', err);
    });
  }, []);

  if (!user?.id) return null;

  return (
    <>
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
          selfId={user.id}
          onClose={() => setActiveCall(null)}
        />
      )}
    </>
  );
}
