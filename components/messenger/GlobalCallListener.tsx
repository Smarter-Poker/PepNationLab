'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { subscribeCallSignals, unsubscribe, type CallSignalRow } from '@/lib/messenger/realtime';
import IncomingCallToast from './IncomingCallToast';
import CallOverlay from './CallOverlay';

/**
 * fix-39: Local error boundary around CallOverlay. Any render crash inside
 * the overlay (LiveKitRoom mount throws, E2EE worker dies, etc.) stays
 * contained here instead of bubbling to app/global-error.tsx. The user
 * sees a contained "Call Could Not Start" panel with a Close button and
 * the rest of the app keeps working. Closing the panel calls onClose so
 * the parent clears activeCall, breaking any crash-on-mount loop.
 */
class CallOverlayErrorBoundary extends React.Component<
  { children: React.ReactNode; onClose: () => void },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Best-effort Sentry report. Don't let reporting throw on its own.
    console.error('[CallOverlay] render crash caught by boundary:', error, errorInfo);
    try {
      import('@/lib/messenger/sentryCall').then(({ captureCallError }) => {
        captureCallError(error, 'overlay', {
          stage_detail: 'render_crash',
          component_stack: errorInfo.componentStack ?? undefined,
        });
      }).catch(() => {});
    } catch {
      // Sentry helper missing — fall through silently.
    }
  }
  handleClose = () => {
    this.setState({ hasError: false });
    try { this.props.onClose(); } catch {}
  };
  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alertdialog"
          aria-label="Call Error"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(3, 8, 15, 0.96)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            color: '#FFFFFF',
            padding: 24,
            textAlign: 'center',
          }}
        >
          <div style={{ maxWidth: 360 }}>
            <h2 style={{ marginBottom: 12, fontSize: '1.4rem', fontWeight: 700 }}>
              Call Could Not Start
            </h2>
            <p style={{ marginBottom: 24, color: 'rgba(255,255,255,0.7)', fontSize: '0.95rem' }}>
              An Error Occurred While Connecting The Call. Please Close This
              Panel And Try Again.
            </p>
            <button
              type="button"
              onClick={this.handleClose}
              style={{
                background: '#00C4BC',
                color: '#000',
                border: 0,
                padding: '12px 24px',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '1rem',
              }}
            >
              Close
            </button>
          </div>
        </div>
      );
    }
    return <>{this.props.children}</>;
  }
}

export default function GlobalCallListener() {
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [incomingCalls, setIncomingCalls] = useState<CallSignalRow[]>([]);
  const [activeCall, setActiveCall] = useState<CallSignalRow | null>(null);
  const activeCallRef = useRef<CallSignalRow | null>(null);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

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

  // fix-39: only resume RINGING calls on mount, never auto-mount a call
  // already in 'active' status. A stale active row (LiveKit died or DB
  // not swept by cron) was the root cause of the inescapable crash loop:
  // every refresh re-mounted CallOverlay against a dead room, which
  // threw synchronously and bubbled to global-error.tsx.
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

        // Caller refreshed mid-ring -- restore THEIR own outgoing ringing
        // overlay only. Active calls do NOT auto-resume.
        const myRinging = calls.find(
          (c) => c.initiator_id === user.id && c.status === 'ringing',
        );
        if (myRinging && !activeCallRef.current) {
          console.log('[GLOBAL CALL] Resuming my outgoing ring after reload:', myRinging.id);
          setActiveCall(myRinging);
        }

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
    sessionStorage.setItem(`answered_call_${call.id}`, 'true');

    setIncomingCalls((cur) => cur.filter((x) => x.id !== call.id));
    setActiveCall({ ...call, status: 'active' });

    import('@/lib/messenger/realtime').then(({ broadcastCallSignal }) => {
      void broadcastCallSignal(call.initiator_id, 'call_accepted', call);
    }).catch(err => {
      console.warn('Failed to broadcast call accepted signal:', err);
    });
  }, []);

  const handleDecline = useCallback((call: CallSignalRow) => {
    setIncomingCalls((cur) => cur.filter((x) => x.id !== call.id));

    import('@/lib/messenger/realtime').then(({ broadcastCallSignal }) => {
      void broadcastCallSignal(call.initiator_id, 'call_declined', call);
    }).catch(err => {
      console.warn('Failed to broadcast call declined signal:', err);
    });
  }, []);

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
        <CallOverlayErrorBoundary onClose={handleClose}>
          <CallOverlay
            call={activeCall}
            selfId={user.id}
            onClose={handleClose}
            onAccept={handleOverlayAccept}
          />
        </CallOverlayErrorBoundary>
      )}
    </>
  );
}
