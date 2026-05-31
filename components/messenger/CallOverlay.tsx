'use client';
import { useEffect, useState, useRef } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useTracks,
  VideoTrack,
  useLocalParticipant,
} from '@livekit/components-react';
import '@livekit/components-styles';
import type { CallSignalRow } from '@/lib/messenger/realtime';
import { useMessengerStore } from '@/stores/messengerStore';
import { createRingTone } from '@/lib/messenger/ringTone';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { Track } from 'livekit-client';

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
  `;
  document.head.appendChild(style);
}

interface FaceTimeCallViewProps {
  isVideo: boolean;
  onHangUp: () => void;
}

function FaceTimeCallView({ isVideo, onHangUp }: FaceTimeCallViewProps) {
  const { localParticipant } = useLocalParticipant();

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

  useEffect(() => {
    setIsMuted(!localParticipant.isMicrophoneEnabled);
    setIsCamDisabled(!localParticipant.isCameraEnabled);
  }, [localParticipant.isMicrophoneEnabled, localParticipant.isCameraEnabled]);

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

export default function CallOverlay({ call, selfId, onClose }: Props) {
  // Inject pulsing animation stylesheet on mount
  useEffect(() => {
    injectPulseRingAnim();
  }, []);

  const conversations = useMessengerStore((s) => s.conversations);
  const [counterpartyId, setCounterpartyId] = useState<string | null>(null);
  const [counterpartyName, setCounterpartyName] = useState<string>('Someone');
  const [counterpartyAvatar, setCounterpartyAvatar] = useState<string | null>(null);
  const [isSignaling, setIsSignaling] = useState(false);

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

  // Guaranteed unmount teardown signaling: broadcasts call_ended on true unmount
  useEffect(() => {
    return () => {
      const cid = latestCounterpartyIdRef.current;
      const cl = latestCallRef.current;
      if (cid && cl && cl.status !== 'ended' && cl.status !== 'declined' && cl.status !== 'missed') {
        console.log('[CALL] Unmounting CallOverlay — broadcasting call_ended to:', cid);
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
          if (counterpartyId) {
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
          onDisconnected={handleHangUp}
          style={{ flex: 1, background: '#000' }}
        >
          <RoomAudioRenderer />
          <FaceTimeCallView isVideo={isVideo} onHangUp={handleHangUp} />
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
