'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { subscribeCallSignals, unsubscribe, type CallSignalRow } from '@/lib/messenger/realtime';
import dynamic from 'next/dynamic';

// PERF: IncomingCallScreen and CallOverlay transitively import the full
// LiveKit stack (~300KB transfer). Static imports welded that stack into the
// deferred-globals chunk downloaded on EVERY page - including logged-out
// public pages where a call can never arrive. Dynamic imports keep LiveKit in
// its own chunk, fetched only when a call actually rings (subscriptions below
// are already gated on an authenticated session). Tradeoff: first ring pays
// one extra chunk fetch (~100-300ms) before the ring UI paints.
const IncomingCallScreen = dynamic(() => import('./IncomingCallScreen'), { ssr: false });
const CallOverlay = dynamic(() => import('./CallOverlay'), { ssr: false });

/**
 * fix-40 boundary: surfaces the actual error.message so future call-subsystem
 * crashes are diagnosable instead of opaque. Still contains the crash so the
 * rest of the app keeps running.
 */
class CallOverlayErrorBoundary extends React.Component<
  { children: React.ReactNode; onClose: () => void },
  { hasError: boolean; errorMessage: string | null }
> {
  state = { hasError: false, errorMessage: null as string | null };
  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      errorMessage: (error && (error.message || String(error))) ?? 'Unknown error',
    };
  }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[CallOverlay] render crash caught by boundary:', error, errorInfo);
    try {
      import('@/lib/messenger/sentryCall').then(({ captureCallError }) => {
        captureCallError(error, 'overlay', {
          stage_detail: 'render_crash',
          component_stack: errorInfo.componentStack ?? undefined,
        });
      }).catch(() => {});
    } catch {
      // Sentry helper missing - fall through silently.
    }
  }
  handleClose = () => {
    this.setState({ hasError: false, errorMessage: null });
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
          <div style={{ maxWidth: 380 }}>
            <h2 style={{ marginBottom: 12, fontSize: '1.4rem', fontWeight: 700 }}>
              Call Could Not Start
            </h2>
            <p style={{ marginBottom: 16, color: 'rgba(255,255,255,0.7)', fontSize: '0.95rem' }}>
              An Error Occurred While Connecting The Call. Please Close This
              Panel And Try Again.
            </p>
            {this.state.errorMessage && (
              <p
                style={{
                  marginBottom: 24,
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: '0.72rem',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  wordBreak: 'break-word',
                  background: 'rgba(255,255,255,0.04)',
                  padding: '8px 12px',
                  borderRadius: 6,
                }}
              >
                {this.state.errorMessage}
              </p>
            )}
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

/**
 * fix-42: merge dedupe helper. The realtime layer has two INSERT sources for
 * the same call.id: postgres_changes (no caller_name - it's not a DB column)
 * and the explicit ch.send broadcast (caller_name populated). Whichever lands
 * first becomes the cached row. The identity-only dedupe used pre-fix-42
 * silently dropped the second event, so caller_name was lost when
 * postgres_changes won the race. This merger preserves caller fields from
 * whichever source provided them.
 */
function mergeCallRows(existing: CallSignalRow, incoming: CallSignalRow): CallSignalRow {
  return {
    ...existing,
    ...incoming,
    caller_name: incoming.caller_name ?? existing.caller_name,
    caller_username: incoming.caller_username ?? existing.caller_username,
    // Group fields arrive only on the enriched broadcast/API rows, never on
    // postgres_changes — preserve them across whichever source lands second.
    conversation_type: incoming.conversation_type ?? existing.conversation_type,
    conversation_title: incoming.conversation_title ?? existing.conversation_title,
  };
}

export default function GlobalCallListener() {
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [incomingCalls, setIncomingCalls] = useState<CallSignalRow[]>([]);
  const [activeCall, setActiveCall] = useState<CallSignalRow | null>(null);
  const activeCallRef = useRef<CallSignalRow | null>(null);
  // Call id from a tapped push notification (/messenger?call=ID). When that
  // ringing call surfaces, we auto-accept it so the user lands straight in the
  // call instead of having to tap Accept again.
  const autoAcceptIdRef = useRef<string | null>(null);

  useEffect(() => {
    try {
      const u = new URL(window.location.href);
      const cid = u.searchParams.get('call');
      if (cid) {
        autoAcceptIdRef.current = cid;
        // Strip the param so a later refresh doesn't re-trigger auto-accept.
        u.searchParams.delete('call');
        window.history.replaceState({}, '', u.pathname + (u.search ? u.search : '') + u.hash);
      }
    } catch { /* no-op */ }
  }, []);

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
        setActiveCall(call);
      }
    };
    window.addEventListener('messenger:start-call', handleStartCall as EventListener);
    return () => {
      window.removeEventListener('messenger:start-call', handleStartCall as EventListener);
    };
  }, []);

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

        const myRinging = calls.find(
          (c) => c.initiator_id === user.id && c.status === 'ringing',
        );
        if (myRinging && !activeCallRef.current) {
          setActiveCall(myRinging);
        }

        for (const c of calls) {
          // An ACTIVE group call is joinable — surface it as a "call in
          // progress, tap to join" screen on app open, exactly like Zoom's
          // meeting-in-progress banner. Direct calls keep ringing-only.
          const joinableGroup = c.status === 'active' && c.conversation_type === 'group';
          if (c.status !== 'ringing' && !joinableGroup) continue;
          if (c.initiator_id === user.id) continue;
          const alreadyAnswered = (() => {
            try { return Boolean(sessionStorage.getItem(`answered_call_${c.id}`)); } catch { return false; }
          })();
          if (alreadyAnswered) continue;
          setIncomingCalls((cur) => {
            const idx = cur.findIndex((x) => x.id === c.id);
            if (idx === -1) return [...cur, c];
            return cur.map((x, i) => (i === idx ? mergeCallRows(x, c) : x));
          });
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

    const ch = subscribeCallSignals(user.id, {
      onInsert: (c) => {
        if (c.initiator_id === user.id) return;

        if (activeCallRef.current) {
          return;
        }

        // fix-42: merge dedupe - preserve caller fields across the race
        // between postgres_changes (no name) and broadcast (has name).
        setIncomingCalls((cur) => {
          const idx = cur.findIndex((x) => x.id === c.id);
          if (idx === -1) return [...cur, c];
          return cur.map((x, i) => (i === idx ? mergeCallRows(x, c) : x));
        });
      },
      onUpdate: (c) => {
        const terminal = c.status === 'ended' || c.status === 'declined' || c.status === 'missed';
        if (terminal) {
          setIncomingCalls((cur) => cur.filter((x) => x.id !== c.id));
        } else {
          // ringing OR active — merge so caller/group fields from a delayed
          // broadcast are preserved. When the first person accepts a GROUP
          // call (status -> active) the others must NOT lose their ring
          // screen: it flips into a joinable "call in progress" screen
          // instead. For DIRECT calls an accept anywhere dismisses the ring
          // exactly as before. The type comes from the merged entry, since
          // postgres_changes rows never carry it.
          setIncomingCalls((cur) => {
            const idx = cur.findIndex((x) => x.id === c.id);
            if (idx === -1) return cur;
            const merged = mergeCallRows(cur[idx], c);
            if (c.status === 'active' && merged.conversation_type !== 'group') {
              return cur.filter((x) => x.id !== c.id);
            }
            const answeredHere = (() => {
              try { return Boolean(sessionStorage.getItem(`answered_call_${c.id}`)); } catch { return false; }
            })();
            if (c.status === 'active' && answeredHere) {
              return cur.filter((x) => x.id !== c.id);
            }
            return cur.map((x, i) => (i === idx ? merged : x));
          });
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

  // Auto-accept the call the user tapped in a push notification, the moment it
  // shows up in the incoming list (from the active-calls fetch or realtime).
  useEffect(() => {
    const cid = autoAcceptIdRef.current;
    if (!cid || activeCall) return;
    const match = incomingCalls.find((c) => c.id === cid && c.status === 'ringing');
    if (match) {
      autoAcceptIdRef.current = null;
      handleAccept(match);
    }
  }, [incomingCalls, activeCall, handleAccept]);

  const handleClose = useCallback(() => setActiveCall(null), []);
  const handleOverlayAccept = useCallback(() => {
    const cur = activeCallRef.current;
    if (cur) handleAccept(cur);
  }, [handleAccept]);

  if (!user?.id) return null;

  const primaryIncoming = !activeCall ? incomingCalls[0] : null;

  return (
    <>
      {primaryIncoming && (
        <IncomingCallScreen
          key={primaryIncoming.id}
          call={primaryIncoming}
          onAccept={() => handleAccept(primaryIncoming)}
          onDecline={() => handleDecline(primaryIncoming)}
        />
      )}
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
