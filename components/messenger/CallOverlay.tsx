'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useTracks,
  VideoTrack,
  useLocalParticipant,
  useRemoteParticipants,
  useConnectionState,
  useIsSpeaking,
} from '@livekit/components-react';
import '@livekit/components-styles';
import type { CallSignalRow } from '@/lib/messenger/realtime';
import { useMessengerStore } from '@/stores/messengerStore';
import { createRingTone } from '@/lib/messenger/ringTone';
import { captureCallError, captureCallEvent } from '@/lib/messenger/sentryCall';
import { createE2EESetup, asRoomOptions, type E2EESetup } from '@/lib/messenger/livekitE2EE';
import CallGridView from './CallGridView';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Camera, ScreenShare, ScreenShareOff, Pause, Play, Maximize2, Headphones } from 'lucide-react';
import { toast } from 'sonner';
import { Track, DisconnectReason, ConnectionState, ConnectionQuality } from 'livekit-client';

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
    .pnl-pulse-avatar-ring { animation: pnl-pulse-avatar 2s infinite ease-in-out; }
    @keyframes pnl-pulse-glow {
      0%, 100% { opacity: 0.6; transform: scale(1); }
      50% { opacity: 0.9; transform: scale(1.05); }
    }
    @keyframes pnl-speaker-pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(0, 196, 188, 0.6); }
      50% { box-shadow: 0 0 0 18px rgba(0, 196, 188, 0); }
    }
    .pnl-speaker-active { animation: pnl-speaker-pulse 1.2s infinite ease-in-out; }
    .pnl-ringing-bg {
      background: radial-gradient(circle at center, #0B1E30 0%, #03080F 100%);
      position: absolute; inset: 0; overflow: hidden;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
    }
    .pnl-ringing-glow {
      position: absolute; top: 50%; left: 50%; width: 500px; height: 500px;
      margin-left: -250px; margin-top: -250px;
      background: radial-gradient(circle, rgba(0, 196, 188, 0.15) 0%, rgba(0, 0, 0, 0) 70%);
      animation: pnl-pulse-glow 4s infinite ease-in-out; pointer-events: none;
    }
    .pnl-ringing-card {
      position: relative; z-index: 10;
      background: rgba(22, 34, 48, 0.6);
      backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 24px; padding: 48px 40px; width: 90%; max-width: 420px;
      display: flex; flex-direction: column; align-items: center;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6); text-align: center;
    }
    .pnl-btn-action {
      width: 68px; height: 68px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      border: none; outline: none;
    }
    .pnl-btn-action:hover { transform: scale(1.1) translateY(-3px); box-shadow: 0 12px 24px rgba(0,0,0,0.4); }
    .pnl-btn-action:active { transform: scale(0.95) translateY(0); }
    .pnl-btn-action:focus-visible { outline: 3px solid #00C4BC; outline-offset: 4px; }
    .pnl-btn-decline { background: #E53E3E; color: white; }
    .pnl-btn-decline:hover { background: #F56565; box-shadow: 0 0 24px rgba(229, 62, 62, 0.5); }
    .pnl-btn-accept { background: #00C4BC; color: black; }
    .pnl-btn-accept:hover { background: #00e0d7; box-shadow: 0 0 24px rgba(0, 196, 188, 0.5); }
    .pnl-ringing-status {
      font-size: 0.85rem; color: #00C4BC; margin-bottom: 24px;
      letter-spacing: 0.15em; text-transform: uppercase; font-weight: 700;
    }
    .pnl-ringing-name { font-size: 1.8rem; font-weight: 700; color: white; margin-bottom: 8px; text-align: center; }
    .pnl-avatar-placeholder {
      width: 120px; height: 120px; border-radius: 50%;
      background: linear-gradient(135deg, #00C4BC 0%, #0B1E30 100%);
      display: flex; align-items: center; justify-content: center;
      font-size: 2.5rem; font-weight: 700; color: white;
      margin-bottom: 32px; border: 4px solid rgba(255, 255, 255, 0.15);
    }
    .pnl-avatar-img {
      width: 120px; height: 120px; border-radius: 50%;
      object-fit: cover; margin-bottom: 32px;
      border: 4px solid rgba(255, 255, 255, 0.15);
    }
    .pnl-action-container { display: flex; gap: 40px; justify-content: center; margin-top: 24px; }
    .pnl-action-label { font-size: 0.8rem; color: rgba(255, 255, 255, 0.6); margin-top: 10px; text-align: center; font-weight: 600; }
    .pnl-call-timer {
      font-size: 0.85rem; color: rgba(255, 255, 255, 0.85);
      font-variant-numeric: tabular-nums; letter-spacing: 0.05em;
      padding: 4px 12px; background: rgba(0, 0, 0, 0.4);
      border-radius: 999px; border: 1px solid rgba(255, 255, 255, 0.08);
    }
    .pnl-reconnect-pill {
      font-size: 0.78rem; color: #FFB020;
      font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
      padding: 6px 14px; background: rgba(255, 176, 32, 0.15);
      border-radius: 999px; border: 1px solid rgba(255, 176, 32, 0.4);
      display: inline-flex; align-items: center; gap: 8px;
    }
    .pnl-reconnect-dot {
      width: 6px; height: 6px; border-radius: 50%; background: #FFB020;
      animation: pnl-pulse-glow 1.2s infinite ease-in-out;
    }
    .pnl-signal-bar {
      display: inline-block; width: 3px; margin-right: 2px;
      background: currentColor; border-radius: 1px; vertical-align: bottom;
    }
    .pnl-hold-overlay {
      position: absolute; inset: 0; z-index: 250;
      background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(8px);
      display: flex; align-items: center; justify-content: center;
      flex-direction: column; color: white;
    }
    .pnl-hold-overlay h3 { font-size: 2rem; font-weight: 800; letter-spacing: 0.1em; margin-bottom: 8px; }
    .pnl-hold-overlay p { color: rgba(255, 255, 255, 0.7); margin-bottom: 24px; }
    .pnl-e2ee-pill {
      font-size: 0.7rem; color: rgba(0, 196, 188, 0.9);
      letter-spacing: 0.1em; font-weight: 700; text-transform: uppercase;
      padding: 2px 8px; background: rgba(0, 196, 188, 0.12);
      border-radius: 999px; border: 1px solid rgba(0, 196, 188, 0.35);
    }
  `;
  document.head.appendChild(style);
}

function formatCallDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

const ALONE_HANGUP_GRACE_MS = 15_000;

function SignalBars({ quality }: { quality: ConnectionQuality | undefined }) {
  const filled =
    quality === ConnectionQuality.Excellent ? 4 :
    quality === ConnectionQuality.Good ? 3 :
    quality === ConnectionQuality.Poor ? 2 :
    quality === ConnectionQuality.Lost ? 0 :
    1;
  const color =
    quality === ConnectionQuality.Lost ? '#E53E3E' :
    quality === ConnectionQuality.Poor ? '#FFB020' :
    '#00C4BC';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 0, color, marginLeft: 8 }} aria-label={`Connection Quality: ${quality ?? 'Unknown'}`}>
      {[1, 2, 3, 4].map((i) => (
        <span key={i} className="pnl-signal-bar" style={{ height: 4 + i * 2, opacity: i <= filled ? 1 : 0.25 }} />
      ))}
    </span>
  );
}

interface FaceTimeCallViewProps {
  isVideo: boolean;
  onHangUp: () => void;
  startedAtMs: number;
  isE2EE: boolean;
}

function FaceTimeCallView({ isVideo, onHangUp, startedAtMs, isE2EE }: FaceTimeCallViewProps) {
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();
  const connectionState = useConnectionState();
  const speakerCandidate = remoteParticipants[0];
  const remoteIsSpeaking = useIsSpeaking(speakerCandidate);

  const trackReferences = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: false },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  ) as Array<import('@livekit/components-react').TrackReference>;

  const localCamTrack = trackReferences.find((t) => t.participant.isLocal && t.source === Track.Source.Camera);
  const remoteVideoTrack = trackReferences.find(
    (t) => !t.participant.isLocal && (t.source === Track.Source.Camera || t.source === Track.Source.ScreenShare),
  );

  const [isMuted, setIsMuted] = useState(false);
  const [isCamDisabled, setIsCamDisabled] = useState(!isVideo);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const preHoldRef = useRef<{ mic: boolean; cam: boolean } | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  const [, forceTimerTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTimerTick((n) => (n + 1) | 0), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const onVis = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        forceTimerTick((n) => (n + 1) | 0);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);
  const elapsedMs = Date.now() - startedAtMs;

  useEffect(() => {
    setIsMuted(!localParticipant.isMicrophoneEnabled);
    setIsCamDisabled(!localParticipant.isCameraEnabled);
    setIsScreenSharing(localParticipant.isScreenShareEnabled);
  }, [localParticipant.isMicrophoneEnabled, localParticipant.isCameraEnabled, localParticipant.isScreenShareEnabled]);

  const onHangUpRef = useRef(onHangUp);
  useEffect(() => { onHangUpRef.current = onHangUp; }, [onHangUp]);
  const hasSeenRemoteRef = useRef(false);
  useEffect(() => {
    if (remoteParticipants.length > 0) hasSeenRemoteRef.current = true;
  }, [remoteParticipants.length]);
  useEffect(() => {
    if (!hasSeenRemoteRef.current) return;
    if (remoteParticipants.length > 0) return;
    const t = setTimeout(() => {
      try { onHangUpRef.current(); } catch (err) {
        captureCallError(err, 'overlay', { stage_detail: 'auto_hangup_handler' });
      }
    }, ALONE_HANGUP_GRACE_MS);
    return () => clearTimeout(t);
  }, [remoteParticipants.length]);

  const toggleMute = async () => {
    try {
      const current = localParticipant.isMicrophoneEnabled;
      await localParticipant.setMicrophoneEnabled(!current);
      setIsMuted(current);
    } catch (err) { captureCallError(err, 'overlay', { stage_detail: 'toggle_mute' }); }
  };
  const toggleCamera = async () => {
    try {
      const current = localParticipant.isCameraEnabled;
      await localParticipant.setCameraEnabled(!current);
      setIsCamDisabled(current);
    } catch (err) { captureCallError(err, 'overlay', { stage_detail: 'toggle_camera' }); }
  };
  const toggleScreenShare = async () => {
    try {
      const next = !localParticipant.isScreenShareEnabled;
      await localParticipant.setScreenShareEnabled(next);
      setIsScreenSharing(next);
    } catch (err) {
      captureCallError(err, 'overlay', { stage_detail: 'toggle_screen_share' });
      toast.error('Could Not Share Screen');
    }
  };
  const toggleHold = async () => {
    if (!isOnHold) {
      preHoldRef.current = {
        mic: localParticipant.isMicrophoneEnabled,
        cam: localParticipant.isCameraEnabled,
      };
      try {
        await localParticipant.setMicrophoneEnabled(false);
        if (isVideo) await localParticipant.setCameraEnabled(false);
      } catch (err) { captureCallError(err, 'overlay', { stage_detail: 'hold' }); }
      setIsOnHold(true);
    } else {
      const prior = preHoldRef.current;
      try {
        await localParticipant.setMicrophoneEnabled(prior?.mic ?? true);
        if (isVideo) await localParticipant.setCameraEnabled(prior?.cam ?? true);
      } catch (err) { captureCallError(err, 'overlay', { stage_detail: 'resume' }); }
      setIsOnHold(false);
      preHoldRef.current = null;
    }
  };
  const requestPip = async () => {
    if (typeof document === 'undefined' || !document.pictureInPictureEnabled) {
      toast.info('Picture-In-Picture Not Supported In This Browser');
      return;
    }
    try {
      const el = document.querySelector<HTMLVideoElement>('video[data-pnl-local-video="true"]');
      if (!el) return;
      await el.requestPictureInPicture();
    } catch (err) { captureCallError(err, 'overlay', { stage_detail: 'pip' }); }
  };
  // audit15 fix-30: Bluetooth/AirPods routing tooltip. The Web platform
  // has no API to control audio output device routing; the user must
  // change it in their OS. Surface clear guidance instead of nothing.
  const showAudioRoutingHint = () => {
    const ua = navigator.userAgent;
    let detail = 'Tap Your Device Speaker / Bluetooth Icon To Switch.';
    if (/iPhone|iPad|iPod/i.test(ua)) {
      detail = 'On iOS, Use The Control Center Audio Card To Switch Between Speaker / Bluetooth.';
    } else if (/Android/i.test(ua)) {
      detail = 'On Android, Use The Quick Settings Tile Or Bluetooth Menu To Switch Output.';
    } else if (/Mac/i.test(ua)) {
      detail = 'On macOS, Use Sound In System Settings Or The Menubar Volume Icon To Switch Output.';
    }
    toast.info('Audio Output Is Controlled By Your Device Settings', { description: detail });
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
        toast.info('Only One Camera Detected');
      }
    } catch (err) { captureCallError(err, 'overlay', { stage_detail: 'flip_camera' }); }
  };

  const isReconnecting =
    connectionState === ConnectionState.Reconnecting ||
    connectionState === ConnectionState.SignalReconnecting;

  const localQuality = localParticipant.connectionQuality;
  const remoteQuality = speakerCandidate?.connectionQuality;
  const worstQuality = (() => {
    const rank = (q: ConnectionQuality | undefined) => {
      if (q === ConnectionQuality.Lost) return 0;
      if (q === ConnectionQuality.Poor) return 1;
      if (q === ConnectionQuality.Good) return 2;
      if (q === ConnectionQuality.Excellent) return 3;
      return 2;
    };
    return rank(localQuality) < rank(remoteQuality) ? localQuality : remoteQuality;
  })();

  const isGroup = remoteParticipants.length > 1;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#000' }}>
      {/* audit15 fix-30: switch between 1:1 FaceTime layout and group grid */}
      {isGroup ? (
        <CallGridView />
      ) : (
        <div style={{ width: '100%', height: '100%' }}>
          {isVideo && remoteVideoTrack ? (
            <VideoTrack
              trackRef={remoteVideoTrack}
              style={{
                width: '100%', height: '100%', objectFit: 'cover',
                transition: 'box-shadow 0.3s',
                boxShadow: remoteIsSpeaking ? 'inset 0 0 0 4px rgba(0, 196, 188, 0.6)' : 'none',
              }}
            />
          ) : (
            <div style={{
              width: '100%', height: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'radial-gradient(circle at center, #0B1E30 0%, #03080F 100%)',
              flexDirection: 'column'
            }}>
              <div
                className={remoteIsSpeaking ? 'pnl-speaker-active' : 'pnl-pulse-avatar-ring'}
                style={{
                  width: 120, height: 120, borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.05)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '2.5rem', fontWeight: 700, color: '#00C4BC',
                  marginBottom: 20, border: '2px solid rgba(0, 196, 188, 0.2)'
                }}
              >
                <Phone size={48} />
              </div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1.1rem', fontWeight: 600, letterSpacing: '0.05em' }}>
                {isVideo ? 'WAITING FOR COMPANION VIDEO...' : 'VOICE CONNECTION ACTIVE'}
              </div>
            </div>
          )}
        </div>
      )}

      {!isGroup && isVideo && localCamTrack && localParticipant.isCameraEnabled && (
        <div style={{
          position: 'absolute', top: 24, right: 24, width: 110, height: 165,
          borderRadius: 16, overflow: 'hidden',
          boxShadow: '0 12px 24px rgba(0,0,0,0.5)',
          border: '2px solid rgba(255, 255, 255, 0.15)',
          zIndex: 100, background: '#0B1E30',
        }}>
          <VideoTrack
            trackRef={localCamTrack}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            // @ts-expect-error custom data attr forwarded to underlying <video>
            data-pnl-local-video="true"
          />
        </div>
      )}

      <div style={{
        position: 'absolute', top: 24, left: '50%',
        transform: 'translateX(-50%)', zIndex: 150,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      }}>
        <span className="pnl-call-timer" aria-label="Call Duration" aria-live="off">
          {formatCallDuration(elapsedMs)}
          <SignalBars quality={worstQuality} />
        </span>
        {/* audit15 fix-30: E2EE indicator when LiveKit's e2ee worker is active. */}
        {isE2EE && (
          <span className="pnl-e2ee-pill" title="End-To-End Encrypted">End-To-End Encrypted</span>
        )}
        {isReconnecting && (
          <span className="pnl-reconnect-pill" role="status" aria-live="assertive">
            <span className="pnl-reconnect-dot" />
            Reconnecting...
          </span>
        )}
      </div>

      {isOnHold && (
        <div className="pnl-hold-overlay" role="status" aria-live="polite">
          <Pause size={48} style={{ color: '#FFB020', marginBottom: 12 }} />
          <h3>On Hold</h3>
          <p>Microphone And Camera Paused</p>
          <button
            type="button"
            onClick={toggleHold}
            style={{
              background: '#00C4BC', color: '#000',
              border: 0, padding: '12px 24px', borderRadius: 8,
              cursor: 'pointer', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8,
            }}
          >
            <Play size={18} /> Resume
          </button>
        </div>
      )}

      <div style={{
        position: 'absolute', bottom: 40, left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(11, 30, 48, 0.65)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        padding: '16px 28px', borderRadius: 40,
        display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', justifyContent: 'center',
        zIndex: 200,
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
      }}>
        <button
          type="button" onClick={toggleMute}
          style={{
            background: isMuted ? '#E53E3E' : 'rgba(255,255,255,0.08)', color: 'white',
            border: 'none', borderRadius: '50%', width: 52, height: 52,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'all 0.2s', outline: 'none',
          }}
          title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          aria-label={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
        >
          {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
        </button>

        {isVideo && (
          <button
            type="button" onClick={toggleCamera}
            style={{
              background: isCamDisabled ? '#E53E3E' : 'rgba(255,255,255,0.08)', color: 'white',
              border: 'none', borderRadius: '50%', width: 52, height: 52,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'all 0.2s', outline: 'none',
            }}
            title={isCamDisabled ? 'Turn Camera On' : 'Turn Camera Off'}
            aria-label={isCamDisabled ? 'Turn Camera On' : 'Turn Camera Off'}
          >
            {isCamDisabled ? <VideoOff size={22} /> : <Video size={22} />}
          </button>
        )}

        {isVideo && !isCamDisabled && (
          <button
            type="button" onClick={flipCamera}
            style={{
              background: 'rgba(255,255,255,0.08)', color: 'white',
              border: 'none', borderRadius: '50%', width: 52, height: 52,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'all 0.2s', outline: 'none',
            }}
            title="Flip Camera" aria-label="Flip Camera"
          >
            <Camera size={22} />
          </button>
        )}

        <button
          type="button" onClick={toggleScreenShare}
          style={{
            background: isScreenSharing ? '#00C4BC' : 'rgba(255,255,255,0.08)',
            color: isScreenSharing ? '#000' : 'white',
            border: 'none', borderRadius: '50%', width: 52, height: 52,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'all 0.2s', outline: 'none',
          }}
          title={isScreenSharing ? 'Stop Sharing Screen' : 'Share Screen'}
          aria-label={isScreenSharing ? 'Stop Sharing Screen' : 'Share Screen'}
        >
          {isScreenSharing ? <ScreenShareOff size={22} /> : <ScreenShare size={22} />}
        </button>

        <button
          type="button" onClick={toggleHold}
          style={{
            background: isOnHold ? '#FFB020' : 'rgba(255,255,255,0.08)',
            color: isOnHold ? '#000' : 'white',
            border: 'none', borderRadius: '50%', width: 52, height: 52,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'all 0.2s', outline: 'none',
          }}
          title={isOnHold ? 'Resume Call' : 'Hold Call'}
          aria-label={isOnHold ? 'Resume Call' : 'Hold Call'}
        >
          {isOnHold ? <Play size={22} /> : <Pause size={22} />}
        </button>

        {isVideo && (
          <button
            type="button" onClick={requestPip}
            style={{
              background: 'rgba(255,255,255,0.08)', color: 'white',
              border: 'none', borderRadius: '50%', width: 52, height: 52,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'all 0.2s', outline: 'none',
            }}
            title="Picture-In-Picture" aria-label="Picture-In-Picture"
          >
            <Maximize2 size={22} />
          </button>
        )}

        {/* audit15 fix-30: Bluetooth / audio output routing hint. */}
        <button
          type="button" onClick={showAudioRoutingHint}
          style={{
            background: 'rgba(255,255,255,0.08)', color: 'white',
            border: 'none', borderRadius: '50%', width: 52, height: 52,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'all 0.2s', outline: 'none',
          }}
          title="Audio Output (Bluetooth / Speaker)" aria-label="Audio Output Help"
        >
          <Headphones size={22} />
        </button>

        <button
          type="button" onClick={onHangUp}
          style={{
            background: '#E53E3E', color: 'white',
            border: 'none', borderRadius: '50%', width: 52, height: 52,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'all 0.2s', outline: 'none',
          }}
          title="Hang Up" aria-label="Hang Up"
        >
          <PhoneOff size={22} />
        </button>
      </div>
    </div>
  );
}

export default function CallOverlay({ call, selfId, onClose, onAccept }: Props & { onAccept?: () => void }) {
  useEffect(() => { injectPulseRingAnim(); }, []);

  const conversations = useMessengerStore((s) => s.conversations);
  const [counterpartyId, setCounterpartyId] = useState<string | null>(null);
  const [counterpartyName, setCounterpartyName] = useState<string>('Someone');
  const [counterpartyAvatar, setCounterpartyAvatar] = useState<string | null>(null);
  const [isSignaling, setIsSignaling] = useState(false);
  const userClosedRef = useRef(false);

  const activeStartedAtRef = useRef<number | null>(null);
  if (call.status === 'active' && activeStartedAtRef.current === null) {
    const anyCall = call as CallSignalRow & { answered_at?: string | null };
    const fromServer = anyCall.answered_at ? Date.parse(anyCall.answered_at) : NaN;
    activeStartedAtRef.current = Number.isFinite(fromServer) ? fromServer : Date.now();
  }

  // audit15 fix-30: per-call E2EE setup. Both peers derive the same key
  // from the shared `livekit_room` UUID.
  const [e2ee, setE2ee] = useState<E2EESetup | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const setup = await createE2EESetup(call.livekit_room);
      if (!cancelled) {
        setE2ee(setup);
        if (setup) {
          captureCallEvent('E2EE enabled for call', 'overlay', 'info', { call_id: call.id });
        }
      }
    })();
    return () => {
      cancelled = true;
      if (e2ee?.worker) {
        try { e2ee.worker.terminate(); } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call.livekit_room]);

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
            user_id: string; full_name?: string | null;
            username?: string | null; avatar_url?: string | null;
          }>;
        };
        const other = (json.participants ?? []).find((p) => p.user_id !== selfId);
        if (other && !cancelled) {
          setCounterpartyName(other.full_name ?? other.username ?? 'Someone');
          setCounterpartyAvatar(other.avatar_url ?? null);
        }
      } catch (err) {
        captureCallError(err, 'overlay', { stage_detail: 'resolve_counterparty_profile' });
      }
    })();
    return () => { cancelled = true; };
  }, [call.conversation_id, selfId]);

  useEffect(() => {
    if (call.initiator_id !== selfId) { setCounterpartyId(call.initiator_id); return; }
    const activeConv = conversations.find((c) => c.conversation_id === call.conversation_id);
    if (activeConv?.counterparty_id) { setCounterpartyId(activeConv.counterparty_id); return; }
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
        if (other && !cancelled) setCounterpartyId(other.user_id);
      } catch (err) {
        captureCallError(err, 'overlay', { stage_detail: 'resolve_counterparty_id' });
      }
    })();
    return () => { cancelled = true; };
  }, [call.initiator_id, call.conversation_id, selfId, conversations]);

  const [token, setToken] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchToken = useCallback(async (signal?: AbortSignal): Promise<boolean> => {
    try {
      const res = await fetch('/api/messenger/livekit-token', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ callId: call.id }),
        signal,
      });
      if (res.status === 503) { setError('Calls Not Configured'); return false; }
      if (res.status === 410) { onClose(); return false; }
      if (!res.ok) { setError('Could Not Join Call'); return false; }
      const json = (await res.json()) as { token: string; url: string };
      setToken(json.token);
      setUrl(json.url);
      return true;
    } catch (err) {
      if ((err as { name?: string } | null)?.name === 'AbortError') return false;
      captureCallError(err, 'token_fetch', { call_id: call.id });
      setError('Network Error');
      return false;
    }
  }, [call.id, onClose]);

  useEffect(() => {
    const ctrl = new AbortController();
    void fetchToken(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchToken]);

  useEffect(() => {
    if (call.status !== 'active') return;
    const REFRESH_MS = (6 * 60 - 5) * 60 * 1000;
    const id = setInterval(() => { void fetchToken(); }, REFRESH_MS);
    return () => clearInterval(id);
  }, [call.status, fetchToken]);

  useEffect(() => {
    if (call.status !== 'active') return;
    let sentinel: WakeLockSentinel | null = null;
    const requestLock = async () => {
      try {
        const nav = navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinel> } };
        if (!nav.wakeLock?.request) return;
        sentinel = await nav.wakeLock.request('screen');
      } catch (err) {
        captureCallError(err, 'overlay', { stage_detail: 'wake_lock_request' });
      }
    };
    void requestLock();
    const onVis = () => {
      if (document.visibilityState === 'visible' && !sentinel) void requestLock();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      if (sentinel) {
        sentinel.release().catch(() => {});
        sentinel = null;
      }
    };
  }, [call.status]);

  useEffect(() => {
    if (call.status !== 'ringing') return;
    const ring = createRingTone();
    if (ring) ring.start();
    return () => { if (ring) ring.stop(); };
  }, [call.status]);

  const latestCallRef = useRef(call);
  const latestCounterpartyIdRef = useRef(counterpartyId);
  useEffect(() => { latestCallRef.current = call; }, [call]);
  useEffect(() => { latestCounterpartyIdRef.current = counterpartyId; }, [counterpartyId]);

  useEffect(() => {
    return () => {
      if (!userClosedRef.current) return;
      const cid = latestCounterpartyIdRef.current;
      const cl = latestCallRef.current;
      if (cid && cl && cl.status !== 'ended' && cl.status !== 'declined' && cl.status !== 'missed') {
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
      if (cid) {
        try {
          const bodyEnded = JSON.stringify({ type: 'broadcast', event: 'call_ended', payload: cl });
          const blobEnded = new Blob([bodyEnded], { type: 'application/json' });
          void navigator.sendBeacon?.(`/api/messenger/call-signal-unload-broadcast?targetId=${cid}`, blobEnded);
        } catch {}
      }
      const body = JSON.stringify({ action: 'hangup', callId });
      let sent = false;
      try {
        const blob = new Blob([body], { type: 'application/json' });
        sent = Boolean(navigator.sendBeacon?.('/api/messenger/call-signal', blob));
      } catch { sent = false; }
      if (!sent) {
        try {
          void fetch('/api/messenger/call-signal', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body, keepalive: true,
          });
        } catch {}
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
      } catch (e) { captureCallError(e, 'hangup', { call_id: call.id }); }
    }
    try {
      await fetch('/api/messenger/call-signal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'hangup', callId: call.id }),
      });
    } catch (err) { captureCallError(err, 'hangup', { call_id: call.id, stage_detail: 'post' }); }
    onClose();
  };

  const handleAction = async (action: 'accept' | 'decline' | 'hangup') => {
    if (isSignaling) return;
    setIsSignaling(true);
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
          if (onAccept) onAccept();
          else if (counterpartyId) {
            const { broadcastCallSignal } = await import('@/lib/messenger/realtime');
            void broadcastCallSignal(counterpartyId, 'call_accepted', call);
          }
        }
      }
    } catch (err) {
      captureCallError(err, action === 'accept' ? 'accept' : action === 'decline' ? 'decline' : 'hangup', { call_id: call.id });
      toast.error('Network Error');
    } finally {
      setIsSignaling(false);
    }
  };

  const ringingPrimaryRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (call.status !== 'ringing') return;
    const t = setTimeout(() => ringingPrimaryRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [call.status]);

  useEffect(() => {
    if (call.status !== 'ringing') return;
    const isInit = call.initiator_id === selfId;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Enter' && !isInit) {
        ev.preventDefault();
        void handleAction('accept');
      } else if (ev.key === 'Escape') {
        ev.preventDefault();
        if (isInit) void handleHangUp();
        else void handleAction('decline');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call.status, call.initiator_id, selfId]);

  const isVideo = call.call_type === 'video';
  const isInitiator = call.initiator_id === selfId;
  const initials = counterpartyName
    ? counterpartyName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  // audit15 fix-30: build the LiveKitRoom options once per setup.
  const livekitOptions = asRoomOptions(e2ee);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: '#000',
        display: 'flex', flexDirection: 'column', zIndex: 2000,
      }}
      role="dialog" aria-modal="true"
      aria-label={isVideo ? 'Video Call' : 'Voice Call'}
    >
      {error && (
        <div style={{ color: 'var(--white, #FFFFFF)', padding: 24, textAlign: 'center', margin: 'auto' }}>
          <p style={{ fontSize: '1.2rem', marginBottom: 16 }} aria-live="assertive">{error}</p>
          {/permission|denied/i.test(error) && (
            <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)', marginBottom: 16 }}>
              <a
                href="/help/messenger-call-permissions"
                target="_blank" rel="noopener noreferrer"
                style={{ color: '#00C4BC', textDecoration: 'underline' }}
              >
                How To Enable Microphone And Camera
              </a>
            </p>
          )}
          <button
            type="button" onClick={onClose}
            style={{
              background: 'var(--teal, #00C4BC)', color: '#000',
              border: 0, padding: '12px 24px', borderRadius: 8,
              cursor: 'pointer', fontWeight: 600, fontSize: '1rem',
              boxShadow: '0 4px 12px rgba(0, 196, 188, 0.3)', transition: 'all 0.2s',
            }}
            aria-label="Close" title="Close"
          >
            Close
          </button>
        </div>
      )}

      {!error && call.status === 'ringing' && (
        <div className="pnl-ringing-bg">
          <div className="pnl-ringing-glow" />
          <div className="pnl-ringing-card">
            <div className="pnl-ringing-status" aria-live="polite">
              {isVideo ? 'Incoming Video Call' : 'Incoming Voice Call'}
            </div>
            <div className="pnl-pulse-avatar-ring" style={{ display: 'inline-block', borderRadius: '50%' }}>
              {counterpartyAvatar ? (
                <img src={counterpartyAvatar} alt={counterpartyName} className="pnl-avatar-img" />
              ) : (
                <div className="pnl-avatar-placeholder">{initials}</div>
              )}
            </div>
            <div className="pnl-ringing-name">{counterpartyName}</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.95rem', marginBottom: 32 }} aria-live="polite">
              {isInitiator ? 'Calling...' : 'Ringing...'}
            </div>
            <div className="pnl-action-container">
              {isInitiator ? (
                <div>
                  <button
                    ref={ringingPrimaryRef}
                    type="button" onClick={handleHangUp}
                    className="pnl-btn-action pnl-btn-decline"
                    aria-label="Cancel Call" title="Cancel Call (Esc)"
                  >
                    <PhoneOff size={28} />
                  </button>
                  <div className="pnl-action-label">Cancel</div>
                </div>
              ) : (
                <>
                  <div>
                    <button
                      type="button" onClick={() => void handleAction('decline')}
                      className="pnl-btn-action pnl-btn-decline"
                      aria-label="Decline Call" title="Decline Call (Esc)"
                    >
                      <PhoneOff size={28} />
                    </button>
                    <div className="pnl-action-label">Decline</div>
                  </div>
                  <div>
                    <button
                      ref={ringingPrimaryRef}
                      type="button" onClick={() => void handleAction('accept')}
                      className="pnl-btn-action pnl-btn-accept"
                      aria-label="Answer Call" title="Answer Call (Enter)"
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
          options={livekitOptions}
          onDisconnected={(reason) => {
            if (reason === DisconnectReason.DUPLICATE_IDENTITY) {
              toast.info('Call Answered On Another Device');
            }
            onClose();
          }}
          onError={(err) => {
            captureCallError(err, 'realtime', { call_id: call.id, stage_detail: 'livekit_room_error' });
            const msg = err?.message || '';
            if (/permission|denied|notallowed/i.test(msg)) {
              setError('Microphone Or Camera Permission Denied');
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
            isE2EE={Boolean(e2ee)}
          />
        </LiveKitRoom>
      )}

      {!error && call.status === 'active' && (!token || !url) && (
        <div style={{
          color: 'var(--white, #FFFFFF)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          flex: 1, background: '#03080F',
        }}>
          <div className="pnl-pulse-avatar-ring" style={{
            width: 80, height: 80, borderRadius: '50%',
            background: 'rgba(0, 196, 188, 0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 24,
          }}>
            <Phone size={32} style={{ color: '#00C4BC' }} />
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: 600, letterSpacing: '0.05em' }} aria-live="polite">
            CONNECTING TO CONFERENCE...
          </div>
        </div>
      )}
    </div>
  );
}
