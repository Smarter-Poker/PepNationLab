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
        console.log('[GLOBAL CALL] received incoming_call:', c);
        if (c.initiator_id === user.id) return;

        if (activeCallRef.current) {
          console.log('[GLOBAL CALL] Ignored signal — already active in a call');
          return;
        }

        // audit15: ONLY show the toast on incoming; do NOT mount CallOverlay
        // until the user accepts. Pre-mounting the overlay at status='ringing'
        // started a livekit-token fetch + an unmount-broadcast cleanup that
        // both fired spuriously when the realtime UPDATE arrived before the
        // accept HTTP response (race condition).
        setIncomingCalls((cur) => (cur.some((x) => x.id === c.id) ? cur : [...cur, c]));
      },
      onUpdate: (c) => {
        if (c.status !== 'ringing') {
          setIncomingCalls((cur) => cur.filter((x) => x.id !== c.id));
        }
        setActiveCall((cur) => {
          if (!cur || cur.id !== c.id) return cur;
          if (c.status === 'ended' || c.status === 'declined' || c.status === 'missed') return null;
          
          // If the call transitioned to active, but THIS tab did not click "Answer",
          // then another tab answered it. We should hide the overlay on this tab!
          if (c.status === 'active' && c.initiator_id !== user.id) {
            const answeredHere = sessionStorage.getItem(`answered_call_${c.id}`);
            if (!answeredHere) {
               console.log('[GLOBAL CALL] Another tab answered this call, hiding overlay in this tab.');
               return null;
            }
          }
          
          return { ...cur, status: c.status };
        });
      },
    });

    return () => {
      void unsubscribe(ch);
    };
  }, [user?.id]);

  const handleAccept = useCallback((call: CallSignalRow) => {
    // Mark this tab as the one that answered the call!
    sessionStorage.setItem(`answered_call_${call.id}`, 'true');
    
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

  // audit15: memoized so CallOverlay's livekit-token effect (which has
  // onClose in its dep array) does not re-fire on every parent render.
  const handleClose = useCallback(() => setActiveCall(null), []);
  const handleOverlayAccept = useCallback(() => {
    const cur = activeCallRef.current;
    if (cur) handleAccept(cur);
  }, [handleAccept]);

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
          onClose={handleClose}
          onAccept={handleOverlayAccept}
        />
      )}
    </>
  );
}
