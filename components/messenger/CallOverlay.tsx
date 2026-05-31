'use client';
import { useEffect, useState, useRef } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useTracks,
  VideoTrack,
  useLocalParticipant,
  useRemoteParticipants,
} from '@livekit/components-react';
import '@livekit/components-styles';
import type { CallSignalRow } from '@/lib/messenger/realtime';
import { useMessengerStore } from '@/stores/messengerStore';
import { createRingTone } from '@/lib/messenger/ringTone';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { Track, DisconnectReason } from 'livekit-client';

interface Props {
  call: CallSignalRow;
  selfId: string;
  onClose: () => void;
}

const PULSE_STYLE_ID = 'pnl-pulse-ring';
function injectPulseRingAnim() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(PULSE_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = PULSE_STYLE_ID;
  style.textContent = `
    @keyframes pnl-pulse-avatar {
      0%   { transform: scale(0.96); box-shadow: 0 0 0 0 rgba(0, 196, 188, 0.4); }
      70%  { transform: scale(1); box-shadow: 0 0 0 24px rgba(0, 196, 188, 0); }
      100% { transform: scale(0.96); box-shadow: 0 0 0 0 rgba(0, 196, 188, 0); }
    }
    .pnl-pulse-avatar-ring {
      animation: pnl-pulse-avatar 2s infinite ease-in-out;
    }
    @keyframes pnl-pulse-glow {
      0%, 100% { opacity: 0.6; transform: scale(1); }
      50% { opacity: 0.9; transform: scale(1.05); }
    }
    .pnl-ringing-bg {
      background: radial-gradient(circle at center, #0B1E30 0%, #03080F 100%);
      position: absolute;
      inset: 0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .pnl-ringing-glow {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 500px;
      height: 500px;
      margin-left: -250px;
      margin-top: -250px;
      background: radial-gradient(circle, rgba(0, 196, 188, 0.15) 0%, rgba(0, 0, 0, 0) 70%);
      animation: pnl-pulse-glow 4s infinite ease-in-out;
      pointer-events: none;
    }
    .pnl-ringing-card {
      position: relative;
      z-index: 10;
      background: rgba(22, 34, 48, 0.6);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 24px;
      padding: 48px 40px;
      width: 90%;
      max-width: 420px;
      display: flex;
      flex-direction: column;
      align-items: center;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
      text-align: center;
    }
    .pnl-btn-action {
      width: 68px;
      height: 68px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      border: none;
      outline: none;
    }
    .pnl-btn-action:hover {
      transform: scale(1.1) translateY(-3px);
      box-shadow: 0 12px 24px rgba(0,0,0,0.4);
    }
    .pnl-btn-action:active {
      transform: scale(0.95) translateY(0);
    }
    .pnl-btn-decline {
      background: #E53E3E;
      color: white;
    }
    .pnl-btn-decline:hover {
      background: #F56565;
      box-shadow: 0 0 24px rgba(229, 62, 62, 0.5);
    }
    .pnl-btn-accept {
      background: #00C4BC;
      color: black;
    }
    .pnl-btn-accept:hover {
      background: #00e0d7;
      box-shadow: 0 0 24px rgba(0, 196, 188, 0.5);
    }
    .pnl-ringing-status {
      font-size: 0.85rem;
      color: #00C4BC;
      margin-bottom: 24px;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      font-weight: 700;
    }
    .pnl-ringing-name {
      font-size: 1.8rem;
      font-weight: 700;
      color: white;
      margin-bottom: 8px;
      text-align: center;
    }
    .pnl-avatar-placeholder {
      width: 120px;
      height: 120px;
      border-radius: 50%;
      background: linear-gradient(135deg, #00C4BC 0%, #0B1E30 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2.5rem;
      font-weight: 700;
      color: white;
      margin-bottom: 32px;
      border: 4px solid rgba(255, 255, 255, 0.15);
    }
    .pnl-avatar-img {
      width: 120px;
      height: 120px;
      border-radius: 50%;
      object-fit: cover;
      margin-bottom: 32px;
      border: 4px solid rgba(255, 255, 255, 0.15);
    }
    .pnl-action-container {
      display: flex;
      gap: 40px;
      justify-content: center;
      margin-top: 24px;
    }
    .pnl-action-label {
      font-size: 0.8rem;
      color: rgba(255, 255, 255, 0.6);
      margin-top: 10px;
      text-align: center;
      font-weight: 600;
    }
    .pnl-call-timer {
      font-size: 0.85rem;
      color: rgba(255, 255, 255, 0.85);
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.05em;
      padding: 4px 12px;
      background: rgba(0, 0, 0, 0.4);
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
  `;
  document.head.appendChild(style);
}

// audit15 fix-5: format milliseconds into mm:ss / h:mm:ss for the in-call timer.
function formatCallDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

interface FaceTimeCallViewProps {
  isVideo: boolean;
  onHangUp: () => void;
  startedAtMs: number;
}

// audit15 fix-13 (S6): how long to wait alone in the room before declaring
// the peer permanently gone and auto-hanging-up. LiveKit's own server-side
// participant timeout is ~30s of total silence; we use a shorter local
// grace because ParticipantDisconnected fires sooner on a clean leave.
const ALONE_HANGUP_GRACE_MS = 15_000;

function FaceTimeCallView({ isVideo, onHangUp, startedAtMs }: FaceTimeCallViewProps) {
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();

  const trackReferences = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: false },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  ) as Array<import('@livekit/components-react').TrackReference>;

  const localVideoTrack = trackReferences.find((t) => t.participant.isLocal);
  const remoteVideoTrack = trackReferences.find((t) => !t.participant.isLocal);

  const [isMuted, setIsMuted] = useState(false);
  const [isCamDisabled, setIsCamDisabled] = useState(!isVideo);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  // audit15 fix-5: tick the call-duration label once per second.
  const [, forceTimerTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTimerTick((n) => (n + 1) | 0), 1000);
    return () => clearInterval(id);
  }, []);
  const elapsedMs = Date.now() - startedAtMs;

  useEffect(() => {
    setIsMuted(!localParticipant.isMicrophoneEnabled);
    setIsCamDisabled(!localParticipant.isCameraEnabled);
  }, [localParticipant.isMicrophoneEnabled, localParticipant.isCameraEnabled]);

  // audit15 fix-13 (S6): auto-hangup grace window when alone in the room.
  // We can't put `onHangUp` in the dep array directly without re-running
  // the effect every render (CallOverlay's handleHangUp is recreated each
  // render), so park it in a ref and read from the ref inside the timer.
  const onHangUpRef = useRef(onHangUp);
  useEffect(() => {
    onHangUpRef.current = onHangUp;
  }, [onHangUp]);

  const hasSeenRemoteRef = useRef(false);
  useEffect(() => {
    if (remoteParticipants.length > 0) {
      hasSeenRemoteRef.current = true;
    }
  }, [remoteParticipants.length]);

  useEffect(() => {
    // Only arm the timer after at least one remote has joined. The initial
    // "waiting for companion" window (caller in the room while answerer
    // is still fetching their token) must not trigger auto-hangup.
    if (!hasSeenRemoteRef.current) return;
    if (remoteParticipants.length > 0) return;

    console.log('[CALL] Remote left room — arming auto-hangup grace timer');
    const t = setTimeout(() => {
      console.log('[CALL] Grace expired with no remote participants — auto-hangup');
      try {
        onHangUpRef.current();
      } catch (err) {
        console.warn('[CALL] auto-hangup handler threw:', err);
      }
    }, ALONE_HANGUP_GRACE_MS);

    return () => clearTimeout(t);
  }, [remoteParticipants.length]);

  const toggleMute = async () => {
    try {
      const current = localParticipant.isMicrophoneEnabled;
      await localParticipant.setMicrophoneEnabled(!current);
      setIsMuted(current);
    } catch (err) {
      console.warn('Failed to toggle microphone:', err);
    }
  };

  const toggleCamera = async () => {
    try {
      const current = localParticipant.isCameraEnabled;
      await localParticipant.setCameraEnabled(!current);
      setIsCamDisabled(current);
    } catch (err) {
      console.warn('Failed to toggle camera:', err);
    }
  };

  const flipCamera = async () => {
    if (!localParticipant.isCameraEnabled) return;
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === 'videoinput');
      if (videoDevices.length > 1) {
        const currentId = localParticipant.videoTrackPublications.values().next().value?.track?.mediaStreamTrack?.getSettings().deviceId;
        const currentIndex = videoDevices.findIndex((d) => d.deviceId === currentId);
        const nextIndex = (currentIndex + 1) % videoDevices.length;
        const nextDevice = videoDevices[nextIndex];
        if (nextDevice) {
          await localParticipant.setCameraEnabled(false);
          await new Promise((r) => setTimeout(r, 100));
          await localParticipant.setCameraEnabled(true, { deviceId: nextDevice.deviceId });
        }
      } else {
        toast.info('Only one camera detected');
      }
    } catch (err) {
      console.warn('Failed to switch camera device:', err);
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#000' }}>
      {/* 1. REMOTE VIDEO (Full Screen) */}
      <div style={{ width: '100%', height: '100%' }}>
        {isVideo && remoteVideoTrack ? (
          <VideoTrack
            trackRef={remoteVideoTrack}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'radial-gradient(circle at center, #0B1E30 0%, #03080F 100%)',
            flexDirection: 'column'
          }}>
            <div className="pnl-pulse-avatar-ring" style={{
              width: 120,
              height: 120,
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2.5rem',
              fontWeight: 700,
              color: '#00C4BC',
              marginBottom: 20,
              border: '2px solid rgba(0, 196, 188, 0.2)'
            }}>
              <Phone size={48} />
            </div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1.1rem', fontWeight: 600, letterSpacing: '0.05em' }}>
              {isVideo ? 'WAITING FOR COMPANION VIDEO...' : 'VOICE CONNECTION ACTIVE'}
            </div>
          </div>
        )}
      </div>

      {/* 2. LOCAL VIDEO (Floating Picture-in-Picture) */}
      {isVideo && localVideoTrack && localParticipant.isCameraEnabled && (
        <div style={{
          position: 'absolute',
          top: 24,
          right: 24,
          width: 110,
          height: 165,
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 12px 24px rgba(0,0,0,0.5)',
          border: '2px solid rgba(255, 255, 255, 0.15)',
          zIndex: 100,
          background: '#0B1E30',
          transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}>
          <VideoTrack
            trackRef={localVideoTrack}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      )}

      {/* audit15 fix-5: in-call timer chip, top-center */}
      <div style={{
        position: 'absolute',
        top: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 150,
      }}>
        <span className="pnl-call-timer" aria-label="Call Duration" title="Call Duration">
          {formatCallDuration(elapsedMs)}
        </span>
      </div>

      {/* 3. CONTROL OVERLAY (FaceTime-like floating bar) */}
      <div style={{
        position: 'absolute',
        bottom: 40,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(11, 30, 48, 0.65)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        padding: '16px 28px',
        borderRadius: 40,
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        zIndex: 200,
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
      }}>
        {/* Mute Mic Button */}
        <button
          type="button"
          onClick={toggleMute}
          style={{
            background: isMuted ? '#E53E3E' : 'rgba(255,255,255,0.08)',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            width: 52,
            height: 52,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s',
            outline: 'none'
          }}
          title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
        >
          {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
        </button>

        {/* Camera Toggle Button */}
        {isVideo && (
          <button
            type="button"
            onClick={toggleCamera}
            style={{
              background: isCamDisabled ? '#E53E3E' : 'rgba(255,255,255,0.08)',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: 52,
              height: 52,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
              outline: 'none'
            }}
            title={isCamDisabled ? 'Turn Camera On' : 'Turn Camera Off'}
          >
            {isCamDisabled ? <VideoOff size={22} /> : <Video size={22} />}
          </button>
        )}

        {/* Flip Camera Button */}
        {isVideo && !isCamDisabled && (
          <button
            type="button"
            onClick={flipCamera}
            style={{
              background: 'rgba(255,255,255,0.08)',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: 52,
              height: 52,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
              outline: 'none'
            }}
            title="Flip Camera"
          >
            <Camera size={22} />
          </button>
        )}

        {/* Hang Up Button */}
        <button
          type="button"
          onClick={onHangUp}
          style={{
            background: '#E53E3E',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            width: 52,
            height: 52,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s',
            outline: 'none'
          }}
          title="Hang Up"
        >
          <PhoneOff size={22} />
        </button>
      </div>
    </div>
  );
}

export default function CallOverlay({ call, selfId, onClose, onAccept }: Props & { onAccept?: () => void }) {
  // Inject pulsing animation stylesheet on mount
  useEffect(() => {
    injectPulseRingAnim();
  }, []);

  const conversations = useMessengerStore((s) => s.conversations);
  const [counterpartyId, setCounterpartyId] = useState<string | null>(null);
  const [counterpartyName, setCounterpartyName] = useState<string>('Someone');
  const [counterpartyAvatar, setCounterpartyAvatar] = useState<string | null>(null);
  const [isSignaling, setIsSignaling] = useState(false);

  // audit15: gate the unmount-broadcasts-call_ended effect on an explicit
  // user action. Without this, any spurious React unmount (e.g. parent
  // re-render after accept) broadcasts call_ended and tears down the caller.
  const userClosedRef = useRef(false);

  // audit15 fix-5: anchor the in-call timer to the moment status flipped to
  // 'active'. Captured once via ref so the displayed elapsed time doesn't
  // jitter when the parent passes a fresh `call` object on every realtime
  // update (which would otherwise reset Date.now() arithmetic).
  const activeStartedAtRef = useRef<number | null>(null);
  if (call.status === 'active' && activeStartedAtRef.current === null) {
    // Prefer the server's answered_at if the row carries one; fall back to
    // local clock so the timer starts immediately even before the answered_at
    // value arrives via realtime.
    const anyCall = call as CallSignalRow & { answered_at?: string | null };
    const fromServer = anyCall.answered_at ? Date.parse(anyCall.answered_at) : NaN;
    activeStartedAtRef.current = Number.isFinite(fromServer) ? fromServer : Date.now();
  }

  // Resolve counterparty name and avatar details
  useEffect(() => {
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
        const other = (json.participants ?? []).find((p) => p.user_id !== selfId);
        if (other && !cancelled) {
          setCounterpartyName(other.full_name ?? other.username ?? 'Someone');
          setCounterpartyAvatar(other.avatar_url ?? null);
        }
      } catch (err) {
        console.warn('Failed to resolve counterparty profile in CallOverlay:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [call.conversation_id, selfId]);

  useEffect(() => {
    // 1. If we are the callee, the counterparty is the initiator
    if (call.initiator_id !== selfId) {
      setCounterpartyId(call.initiator_id);
      return;
    }

    // 2. If we are the initiator, check if we can resolve it from Zustand store
    const activeConv = conversations.find((c) => c.conversation_id === call.conversation_id);
    if (activeConv?.counterparty_id) {
      setCounterpartyId(activeConv.counterparty_id);
      return;
    }

    // 3. Fallback: fetch participants from the API to get the other participant
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/messenger/list-participants', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ conversationId: call.conversation_id }),
        });
        if (cancelled || !res.ok) return;
        const json = (await res.json()) as { participants?: Array<{ user_id: string }> };
        const other = (json.participants ?? []).find((p) => p.user_id !== selfId);
        if (other && !cancelled) {
          setCounterpartyId(other.user_id);
        }
      } catch (err) {
        console.warn('Failed to resolve counterparty in CallOverlay:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [call.initiator_id, call.conversation_id, selfId, conversations]);

  const [token, setToken] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/messenger/livekit-token', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ callId: call.id }),
        });
        if (cancelled) return;
        if (res.status === 503) {
          setError('Calls Not Configured');
          return;
        }
        if (res.status === 410) {
          onClose();
          return;
        }
        if (!res.ok) {
          setError('Could Not Join Call');
          return;
        }
        const json = (await res.json()) as { token: string; url: string };
        setToken(json.token);
        setUrl(json.url);
      } catch {
        if (!cancelled) setError('Network Error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [call.id, onClose]);

  // Outgoing and incoming synthesized beep-beep ringtone effect for both parties
  useEffect(() => {
    if (call.status !== 'ringing') return;

    console.log('[CALL] Playing synthesized ringtone...');
    const ring = createRingTone();
    if (ring) {
      ring.start();
    }

    return () => {
      if (ring) {
        console.log('[CALL] Stopping synthesized ringtone');
        ring.stop();
      }
    };
  }, [call.status]);

  // Ref-based trackers to prevent premature teardown signaling on intermediate updates
  const latestCallRef = useRef(call);
  const latestCounterpartyIdRef = useRef(counterpartyId);

  useEffect(() => {
    latestCallRef.current = call;
  }, [call]);

  useEffect(() => {
    latestCounterpartyIdRef.current = counterpartyId;
  }, [counterpartyId]);

  // audit15: broadcast call_ended ONLY when the user explicitly closed the
  // overlay (hangup / decline). Previously this fired on every unmount,
  // including spurious re-mounts from parent re-renders right after accept,
  // which tore down the caller's side and produced "call failed immediately".
  useEffect(() => {
    return () => {
      if (!userClosedRef.current) return;
      const cid = latestCounterpartyIdRef.current;
      const cl = latestCallRef.current;
      if (cid && cl && cl.status !== 'ended' && cl.status !== 'declined' && cl.status !== 'missed') {
        console.log('[CALL] Unmounting CallOverlay (user-closed) — broadcasting call_ended to:', cid);
        import('@/lib/messenger/realtime').then(({ broadcastCallSignal }) => {
          void broadcastCallSignal(cid, 'call_ended', cl);
        }).catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    const callId = call.id;
    const handler = () => {
      const cid = latestCounterpartyIdRef.current;
      const cl = latestCallRef.current;
      if (!cl || cl.status === 'ended' || cl.status === 'declined' || cl.status === 'missed') return;

      // 1. Unload signaling: broadcast call_ended immediately
      if (cid) {
        try {
          const bodyEnded = JSON.stringify({
            type: 'broadcast',
            event: 'call_ended',
            payload: cl,
          });
          const blobEnded = new Blob([bodyEnded], { type: 'application/json' });
          void navigator.sendBeacon?.(`/api/messenger/call-signal-unload-broadcast?targetId=${cid}`, blobEnded);
        } catch {}
      }

      // 2. Unload database cleanup
      const body = JSON.stringify({ action: 'hangup', callId });
      let sent = false;
      try {
        const blob = new Blob([body], { type: 'application/json' });
        sent = Boolean(navigator.sendBeacon?.('/api/messenger/call-signal', blob));
      } catch {
        sent = false;
      }
      if (!sent) {
        try {
          void fetch('/api/messenger/call-signal', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body,
            keepalive: true,
          });
        } catch {
          // best effort -- nothing else to do once the page is unloading
        }
      }
    };
    window.addEventListener('pagehide', handler);
    return () => window.removeEventListener('pagehide', handler);
  }, [call.id]);

  const handleHangUp = async () => {
    userClosedRef.current = true;
    if (counterpartyId) {
      try {
        const { broadcastCallSignal } = await import('@/lib/messenger/realtime');
        void broadcastCallSignal(counterpartyId, 'call_ended', call);
      } catch (e) {
        console.warn('Failed to broadcast call ended:', e);
      }
    }

    try {
      await fetch('/api/messenger/call-signal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'hangup', callId: call.id }),
      });
    } catch (err) {
      console.warn('Failed to update DB on call end:', err);
    }

    onClose();
  };

  const handleAction = async (action: 'accept' | 'decline' | 'hangup') => {
    if (isSignaling) return;
    setIsSignaling(true);

    // audit15: claim ownership of the accept BEFORE the HTTP call fires.
    // Supabase Realtime delivers the postgres_changes UPDATE faster than the
    // HTTP response returns, so the "another tab answered" guard in
    // GlobalCallListener.onUpdate fires first and unmounts the overlay if
    // this flag is not already set.
    if (action === 'accept') {
      try { sessionStorage.setItem('answered_call_' + call.id, 'true'); } catch {}
    }
    if (action === 'decline' || action === 'hangup') {
      userClosedRef.current = true;
    }

    try {
      const res = await fetch('/api/messenger/call-signal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, callId: call.id }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast.error(json.error || `Could not ${action} call`);
        if (action !== 'accept') onClose();
      } else {
        if (action === 'decline' || action === 'hangup') {
          if (counterpartyId) {
            const { broadcastCallSignal } = await import('@/lib/messenger/realtime');
            void broadcastCallSignal(
              counterpartyId,
              action === 'decline' ? 'call_declined' : 'call_ended',
              call
            );
          }
          onClose();
        } else if (action === 'accept') {
          if (onAccept) {
            onAccept();
          } else if (counterpartyId) {
            const { broadcastCallSignal } = await import('@/lib/messenger/realtime');
            void broadcastCallSignal(counterpartyId, 'call_accepted', call);
          }
        }
      }
    } catch {
      toast.error('Network Error');
    } finally {
      setIsSignaling(false);
    }
  };

  const isVideo = call.call_type === 'video';
  const isInitiator = call.initiator_id === selfId;
  const initials = counterpartyName
    ? counterpartyName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : '?';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 2000,
      }}
      role="dialog"
      aria-modal="true"
      aria-label={isVideo ? 'Video Call' : 'Voice Call'}
    >
      {error && (
        <div style={{ color: 'var(--white, #FFFFFF)', padding: 24, textAlign: 'center', margin: 'auto' }}>
          <p style={{ fontSize: '1.2rem', marginBottom: 16 }}>{error}</p>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'var(--teal, #00C4BC)',
              color: '#000',
              border: 0,
              padding: '12px 24px',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '1rem',
              boxShadow: '0 4px 12px rgba(0, 196, 188, 0.3)',
              transition: 'all 0.2s',
            }}
            aria-label="Close"
            title="Close"
          >
            Close
          </button>
        </div>
      )}

      {!error && call.status === 'ringing' && (
        <div className="pnl-ringing-bg">
          <div className="pnl-ringing-glow" />
          <div className="pnl-ringing-card">
            <div className="pnl-ringing-status">
              {isVideo ? 'Incoming Video Call' : 'Incoming Voice Call'}
            </div>

            <div className="pnl-pulse-avatar-ring" style={{ display: 'inline-block', borderRadius: '50%' }}>
              {counterpartyAvatar ? (
                <img
                  src={counterpartyAvatar}
                  alt={counterpartyName}
                  className="pnl-avatar-img"
                />
              ) : (
                <div className="pnl-avatar-placeholder">
                  {initials}
                </div>
              )}
            </div>

            <div className="pnl-ringing-name">{counterpartyName}</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.95rem', marginBottom: 32 }}>
              {isInitiator ? 'Calling...' : 'Ringing...'}
            </div>

            <div className="pnl-action-container">
              {isInitiator ? (
                <div>
                  <button
                    type="button"
                    onClick={handleHangUp}
                    className="pnl-btn-action pnl-btn-decline"
                    aria-label="Cancel Call"
                    title="Cancel Call"
                  >
                    <PhoneOff size={28} />
                  </button>
                  <div className="pnl-action-label">Cancel</div>
                </div>
              ) : (
                <>
                  <div>
                    <button
                      type="button"
                      onClick={() => void handleAction('decline')}
                      className="pnl-btn-action pnl-btn-decline"
                      aria-label="Decline Call"
                      title="Decline Call"
                    >
                      <PhoneOff size={28} />
                    </button>
                    <div className="pnl-action-label">Decline</div>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => void handleAction('accept')}
                      className="pnl-btn-action pnl-btn-accept"
                      aria-label="Answer Call"
                      title="Answer Call"
                    >
                      <Phone size={28} />
                    </button>
                    <div className="pnl-action-label">Answer</div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {!error && call.status === 'active' && token && url && (
        <LiveKitRoom
          serverUrl={url}
          token={token}
          connect={true}
          video={isVideo}
          audio={true}
          // audit15 fix-4: route a LiveKit disconnect to LOCAL teardown only.
          // Previously this called handleHangUp, which broadcasts call_ended
          // to the peer and POSTs hangup — turning a transient network drop
          // into a force-end of the call for the OTHER party, who was
          // perfectly healthy. The peer either has their own disconnect
          // handler when they notice us leave (LiveKit ParticipantDisconnected
          // event), or the 4-hour stale-active cron sweep cleans up.
          //
          // audit15 fix-16 (S8): if a second tab/device joins with the same
          // LiveKit identity, the server kicks the older participant with
          // DisconnectReason.DUPLICATE_IDENTITY. Surface a specific toast
          // so the kicked tab understands why instead of staring at a
          // suddenly-black screen.
          onDisconnected={(reason) => {
            if (reason === DisconnectReason.DUPLICATE_IDENTITY) {
              toast.info('Call Answered On Another Device');
            }
            onClose();
          }}
          // audit15 fix-6: surface mic/cam permission failures as a toast
          // instead of letting the user stare at a black screen wondering
          // why nothing's happening.
          onError={(err) => {
            console.warn('[CALL] LiveKitRoom error:', err);
            const msg = err?.message || '';
            if (/permission|denied|notallowed/i.test(msg)) {
              toast.error('Microphone Or Camera Permission Denied');
            } else if (/notfound/i.test(msg)) {
              toast.error('No Microphone Or Camera Found');
            } else {
              toast.error('Call Connection Error');
            }
          }}
          style={{ flex: 1, background: '#000' }}
        >
          <RoomAudioRenderer />
          <FaceTimeCallView
            isVideo={isVideo}
            onHangUp={handleHangUp}
            startedAtMs={activeStartedAtRef.current ?? Date.now()}
          />
        </LiveKitRoom>
      )}

      {!error && call.status === 'active' && (!token || !url) && (
        <div style={{
          color: 'var(--white, #FFFFFF)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          background: '#03080F',
        }}>
          <div className="pnl-pulse-avatar-ring" style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: 'rgba(0, 196, 188, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
          }}>
            <Phone size={32} style={{ color: '#00C4BC' }} />
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: 600, letterSpacing: '0.05em' }}>
            CONNECTING TO CONFERENCE...
          </div>
        </div>
      )}
    </div>
  );
}
