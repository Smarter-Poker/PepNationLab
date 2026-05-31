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

  // audit15 fix-9: resume any in-flight call when the listener mounts.
  // Closes the "reload during ring loses toast" gap (S5 from the previous
  // audit). Runs once whenever the authenticated user resolves; the
  // fetch is idempotent because IncomingCallToast dedupe (line ~78 below)
  // skips already-known call ids.
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/messenger/list-active-calls', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        });
        if (cancelled || !res.ok) return;
        const json = (await res.json()) as { calls?: CallSignalRow[] };
        const calls = json.calls ?? [];

        // Mount the most recent active-or-ringing call from THIS user as the
        // active overlay (caller refreshed their tab mid-call). If the row
        // is still 'ringing', the overlay shows the calling-out screen;
        // if 'active' the LiveKitRoom reconnects to the existing room.
        const myActive = calls.find((c) => c.initiator_id === user.id);
        if (myActive && !activeCallRef.current) {
          console.log('[GLOBAL CALL] Resuming my in-flight call after reload:', myActive.id);
          setActiveCall(myActive);
        }

        // For ringing calls TO this user, surface the toast again unless this
        // tab has already answered (sessionStorage marker present).
        for (const c of calls) {
          if (c.status !== 'ringing') continue;
          if (c.initiator_id === user.id) continue;
          const alreadyAnswered = (() => {
            try { return Boolean(sessionStorage.getItem(`answered_call_${c.id}`)); } catch { return false; }
          })();
          if (alreadyAnswered) continue;
          setIncomingCalls((cur) => (cur.some((x) => x.id === c.id) ? cur : [...cur, c]));
        }
      } catch (err) {
        console.warn('[GLOBAL CALL] Failed to resume in-flight calls:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

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
          if (c.status === 'ended' || c.status === 'declined' || c.status === 'missed') {
            import('@/lib/messenger/haptics').then((h) => {
              h.initHaptics();
              h.playCallEndedSound();
              h.vibrateHeavy();
            });
            return null;
          }
          
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
