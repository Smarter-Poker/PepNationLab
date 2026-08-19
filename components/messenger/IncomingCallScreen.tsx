'use client';
import { useEffect, useState } from 'react';
import { Phone, PhoneOff, Video, LogIn } from 'lucide-react';
import type { CallSignalRow } from '@/lib/messenger/realtime';
import { createRingTone } from '@/lib/messenger/ringTone';
import { toast } from 'sonner';
import { preflightMedia } from '@/lib/messenger/mediaPreflight';

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
  // fix-44: now actually mutable so we can populate from broadcast payload
  // or API fallback. Previously this was const-no-setter and avatars never
  // rendered, so receivers always saw the initials placeholder.
  const [callerAvatar, setCallerAvatar] = useState<string | null>(call.caller_avatar ?? null);
  const [isBusy, setIsBusy] = useState(false);
  const [authExpired, setAuthExpired] = useState(false);
  // Group-call support: an ACTIVE call surfaced here is an ongoing group call
  // the user can still join (someone else accepted first). Ring UX becomes
  // join UX: no ringtone, "Join" instead of "Accept", and dismissing it is a
  // purely local action — it must never send a decline that could touch a
  // live call.
  const isJoin = call.status === 'active';
  const isGroupCall = call.conversation_type === 'group';
  const displayName = isGroupCall && call.conversation_title ? call.conversation_title : callerName;

  useEffect(() => {
    if (call.caller_name && call.caller_name !== callerName) {
      setCallerName(call.caller_name);
    }
    if (call.caller_avatar && call.caller_avatar !== callerAvatar) {
      setCallerAvatar(call.caller_avatar);
    }
  }, [call.caller_name, call.caller_avatar, callerName, callerAvatar]);

  useEffect(() => {
    injectAnim();
  }, []);

  useEffect(() => {
    if (call.caller_name && call.caller_avatar !== undefined) return;
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
            avatar_url?: string | null;
          }>;
        };
        const caller = (json.participants ?? []).find((p) => p.user_id === call.initiator_id);
        if (caller && !cancelled) {
          if (!call.caller_name) setCallerName(caller.full_name ?? caller.username ?? 'Someone');
          if (caller.avatar_url && !callerAvatar) setCallerAvatar(caller.avatar_url);
        }
      } catch {
        // non-fatal
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call.conversation_id, call.initiator_id]);

  useEffect(() => {
    // No ringtone for a joinable in-progress call — the moment someone
    // accepts a group call, everyone else's ring falls silent and the screen
    // becomes an invitation rather than an alarm.
    if (authExpired || isJoin) return;
    const ring = createRingTone();
    if (ring) ring.start();
    return () => { if (ring) ring.stop(); };
  }, [authExpired, isJoin]);

  const handleAction = async (action: 'accept' | 'decline') => {
    if (isBusy) return;
    setIsBusy(true);

    // Dismissing a joinable in-progress call is local-only: there is nothing
    // to decline server-side, and a stray decline must never reach a live
    // group call.
    if (action === 'decline' && isJoin) {
      setIsBusy(false);
      onDecline();
      return;
    }

    try {
      const h = await import('@/lib/messenger/haptics');
      h.initHaptics();
      if (action === 'accept') h.vibrateHeavy(); else h.vibrateMedium();
    } catch {}

    // fix-44 (3): pre-acquire mic/cam permissions INSIDE the user-gesture
    // context. Once the browser caches the grant for this origin, LiveKit's
    // subsequent getUserMedia (inside LiveKitRoom) reuses the permission
    // without re-prompting. On iOS Safari especially, this is the only way
    // "Allow" persists - the prompt MUST fire inside a click handler, not a
    // later async chain. Tracks are stopped immediately; we only want the
    // grant.
    if (action === 'accept') {
      // Answering must NEVER be turned into declining. This used to call
      // onDecline() whenever getUserMedia threw — so a person on a desktop
      // with no webcam, who pressed Answer, sent the caller a "Declined" they
      // never chose. Worse, the message blamed permissions, so they went
      // hunting through browser settings for a camera that does not exist.
      //
      // Now the only thing that stops us answering is an outright refusal the
      // user has to reverse themselves. Missing hardware just means you join
      // with whatever you do have — and with nothing at all you can still
      // watch and listen, which needs no permission.
      const media = await preflightMedia(call.call_type === 'video');
      if (!media.canJoin) {
        toast.error(media.message);
        setIsBusy(false);
        return;
      }
      if (media.message) toast.info(media.message);
    }

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
        background: 'linear-gradient(180deg, #03080F 0%, #0B1E30 50%, #03080F 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'calc(env(safe-area-inset-top, 0px) + 48px) 24px calc(env(safe-area-inset-bottom, 0px) + 56px) 24px',
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
          background: 'radial-gradient(circle, rgba(0, 196, 188, 0.45) 0%, rgba(0, 196, 188, 0) 70%)',
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
          PepNationLab {isGroupCall ? 'Group ' : ''}{isVideo ? 'Video' : 'Voice'} Call
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
          {displayName}
        </div>
        <div style={{ fontSize: '1rem', color: 'rgba(255, 255, 255, 0.62)', fontWeight: 500 }}>
          {isJoin
            ? `${callerName ? callerName + "'s " : ''}Call Is In Progress — Tap To Join`
            : isGroupCall
            ? (isVideo ? 'Incoming Group Video Call' : 'Incoming Group Voice Call')
            : (isVideo ? 'Incoming Video Call' : 'Incoming Voice Call')}
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
            {isJoin ? 'Dismiss' : 'Decline'}
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
                {isJoin ? 'Join' : 'Accept'}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
