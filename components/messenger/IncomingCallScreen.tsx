'use client';
import { useEffect, useState } from 'react';
import { Phone, PhoneOff, Video, LogIn } from 'lucide-react';
import type { CallSignalRow } from '@/lib/messenger/realtime';
import { createRingTone } from '@/lib/messenger/ringTone';
import { toast } from 'sonner';

interface Props {
  call: CallSignalRow;
  onAccept: () => void;
  onDecline: () => void;
}

const STYLE_ID = 'pnl-incoming-call-anim';
function injectAnim() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes pnl-incoming-pulse-ring {
      0%   { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(0, 196, 188, 0.5); }
      70%  { transform: scale(1);    box-shadow: 0 0 0 36px rgba(0, 196, 188, 0); }
      100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(0, 196, 188, 0); }
    }
    .pnl-incoming-avatar-ring { animation: pnl-incoming-pulse-ring 2s ease-in-out infinite; }
    @keyframes pnl-incoming-bg-pulse {
      0%, 100% { opacity: 0.20; transform: scale(1); }
      50%      { opacity: 0.45; transform: scale(1.06); }
    }
    .pnl-incoming-bg-glow { animation: pnl-incoming-bg-pulse 3s ease-in-out infinite; }
    @keyframes pnl-bounce-accept {
      0%, 100% { transform: scale(1); }
      50%      { transform: scale(1.06); }
    }
    .pnl-accept-bounce { animation: pnl-bounce-accept 1.4s ease-in-out infinite; }
  `;
  document.head.appendChild(style);
}

export default function IncomingCallScreen({ call, onAccept, onDecline }: Props) {
  const [callerName, setCallerName] = useState<string>(call.caller_name ?? 'Someone');
  const [callerAvatar] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [authExpired, setAuthExpired] = useState(false);

  // fix-42: keep callerName in sync if the parent re-renders with a richer
  // payload (e.g. broadcast arrived after postgres_changes and merged in).
  useEffect(() => {
    if (call.caller_name && call.caller_name !== callerName) {
      setCallerName(call.caller_name);
    }
  }, [call.caller_name, callerName]);

  useEffect(() => {
    injectAnim();
  }, []);

  useEffect(() => {
    if (call.caller_name) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/messenger/list-participants', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ conversationId: call.conversation_id }),
        });
        if (cancelled || !res.ok) return;
        const json = (await res.json()) as {
          participants?: Array<{
            user_id: string;
            full_name?: string | null;
            username?: string | null;
          }>;
        };
        const caller = (json.participants ?? []).find((p) => p.user_id === call.initiator_id);
        if (caller && !cancelled) {
          setCallerName(caller.full_name ?? caller.username ?? 'Someone');
        }
      } catch {
        // non-fatal
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [call.conversation_id, call.initiator_id, call.caller_name]);

  // fix-42: ringtone is gated on authExpired. When auth fails on Accept the
  // screen stays mounted with the Sign In CTA but goes silent — previously
  // the ringtone kept playing forever because the effect's [] deps meant
  // the cleanup only ran on full unmount.
  useEffect(() => {
    if (authExpired) return;
    const ring = createRingTone();
    if (ring) ring.start();
    return () => { if (ring) ring.stop(); };
  }, [authExpired]);

  const handleAction = async (action: 'accept' | 'decline') => {
    if (isBusy) return;
    setIsBusy(true);

    try {
      const h = await import('@/lib/messenger/haptics');
      h.initHaptics();
      if (action === 'accept') h.vibrateHeavy(); else h.vibrateMedium();
    } catch {}

    if (action === 'accept') {
      try { sessionStorage.setItem('answered_call_' + call.id, 'true'); } catch {}
    }

    let success = false;
    try {
      const res = await fetch('/api/messenger/call-signal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, callId: call.id }),
      });

      // fix-42: on 401 we go straight to the Sign In CTA. We DO NOT call
      // supabase.auth.refreshSession() here — if the refresh token is also
      // dead, that call clears the local session, fires onAuthStateChange
      // with null, GlobalCallListener treats it as a logout, and the user
      // is signed out app-wide. SessionKeepalive handles refresh proactively
      // in the background; if a stale-JWT 401 reaches us here, the right UX
      // is a contained sign-in prompt, not a forced logout.
      if (res.status === 401) {
        setAuthExpired(true);
        setIsBusy(false);
        return;
      }

      success = res.ok;
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast.error(json.error || (action === 'accept' ? 'Could Not Answer Call' : 'Could Not Decline Call'));
      }
    } catch {
      toast.error('Network Error');
    } finally {
      setIsBusy(false);
    }

    if (action === 'accept') {
      if (success) onAccept();
      else onDecline();
    } else {
      onDecline();
    }
  };

  const isVideo = call.call_type === 'video';
  const initials = callerName
    ? callerName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <div
      role="alertdialog"
      aria-label="Incoming Call"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background:
          'linear-gradient(180deg, #03080F 0%, #0B1E30 50%, #03080F 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding:
          'calc(env(safe-area-inset-top, 0px) + 48px) 24px calc(env(safe-area-inset-bottom, 0px) + 56px) 24px',
        overflow: 'hidden',
      }}
    >
      <div
        className="pnl-incoming-bg-glow"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 640,
          height: 640,
          marginLeft: -320,
          marginTop: -320,
          background:
            'radial-gradient(circle, rgba(0, 196, 188, 0.45) 0%, rgba(0, 196, 188, 0) 70%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      <div style={{ position: 'relative', zIndex: 2, textAlign: 'center' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: '0.82rem',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: '#00C4BC',
            fontWeight: 700,
          }}
        >
          {isVideo ? <Video size={16} aria-hidden="true" /> : <Phone size={16} aria-hidden="true" />}
          PepNationLab {isVideo ? 'Video' : 'Voice'} Call
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 2, textAlign: 'center' }}>
        <div
          className="pnl-incoming-avatar-ring"
          style={{
            width: 180,
            height: 180,
            borderRadius: '50%',
            margin: '0 auto 32px',
            background: callerAvatar
              ? `url(${callerAvatar}) center/cover no-repeat`
              : 'linear-gradient(135deg, #00C4BC 0%, #0B1E30 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            fontSize: '3.4rem',
            fontWeight: 700,
            border: '4px solid rgba(255, 255, 255, 0.15)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.65)',
          }}
          aria-hidden="true"
        >
          {!callerAvatar && initials}
        </div>
        <div
          style={{
            fontSize: '2.2rem',
            fontWeight: 700,
            color: '#FFFFFF',
            marginBottom: 8,
            textAlign: 'center',
            letterSpacing: '-0.01em',
          }}
        >
          {callerName}
        </div>
        <div style={{ fontSize: '1rem', color: 'rgba(255, 255, 255, 0.62)', fontWeight: 500 }}>
          {isVideo ? 'Incoming Video Call' : 'Incoming Voice Call'}
        </div>
      </div>

      {authExpired && (
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            background: 'rgba(229, 62, 62, 0.12)',
            border: '1px solid rgba(229, 62, 62, 0.4)',
            borderRadius: 12,
            padding: '12px 16px',
            color: '#FFFFFF',
            fontSize: '0.9rem',
            textAlign: 'center',
            maxWidth: 420,
          }}
          role="status"
          aria-live="assertive"
        >
          Your Session Has Expired. Please Sign In Again To Answer.
        </div>
      )}

      <div
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          justifyContent: 'space-around',
          width: '100%',
          maxWidth: 460,
          gap: 40,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <button
            type="button"
            disabled={isBusy}
            onClick={() => void handleAction('decline')}
            aria-label="Decline Call"
            title="Decline"
            style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: '#E53E3E',
              color: '#FFFFFF',
              border: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 12px 32px rgba(229, 62, 62, 0.55)',
              transition: 'transform 0.15s ease, box-shadow 0.2s ease',
              outline: 'none',
            }}
            onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.92)'; }}
            onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
            onTouchStart={(e) => { e.currentTarget.style.transform = 'scale(0.92)'; }}
            onTouchEnd={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            <PhoneOff size={32} aria-hidden="true" />
          </button>
          <div style={{ color: 'rgba(255, 255, 255, 0.72)', marginTop: 12, fontSize: '0.92rem', fontWeight: 600 }}>
            Decline
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          {authExpired ? (
            <>
              <button
                type="button"
                onClick={() => {
                  const target = '/login?redirect=' + encodeURIComponent('/messenger');
                  try {
                    window.open(target, '_blank', 'noopener,noreferrer');
                  } catch {
                    window.location.href = target;
                  }
                }}
                aria-label="Sign In To Answer"
                title="Sign In To Answer"
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  background: '#00C4BC',
                  color: '#000',
                  border: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 12px 32px rgba(0, 196, 188, 0.55)',
                  outline: 'none',
                }}
              >
                <LogIn size={32} aria-hidden="true" />
              </button>
              <div style={{ color: 'rgba(255, 255, 255, 0.72)', marginTop: 12, fontSize: '0.92rem', fontWeight: 600 }}>
                Sign In
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => void handleAction('accept')}
                aria-label="Accept Call"
                title="Accept"
                className="pnl-accept-bounce"
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  background: '#22C55E',
                  color: '#FFFFFF',
                  border: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 12px 32px rgba(34, 197, 94, 0.55)',
                  outline: 'none',
                }}
              >
                <Phone size={32} aria-hidden="true" />
              </button>
              <div style={{ color: 'rgba(255, 255, 255, 0.72)', marginTop: 12, fontSize: '0.92rem', fontWeight: 600 }}>
                Accept
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
