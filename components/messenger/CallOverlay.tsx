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
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, SwitchCamera, ScreenShare, ScreenShareOff, Pause, Play, Maximize2 } from 'lucide-react';
import IframeLink from '@/components/ui/IframeLink';
import { toast } from 'sonner';
import { Track, DisconnectReason, ConnectionState, ConnectionQuality } from 'livekit-client';
import type { Participant } from 'livekit-client';

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
    .pnl-btn-accept { background: #22C55E; color: white; }
    .pnl-btn-accept:hover { background: #34D67A; box-shadow: 0 0 24px rgba(34, 197, 94, 0.5); }
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
    .pnl-toolbar-btn {
      width: 44px; height: 44px;
      border: none; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; transition: background 0.2s, transform 0.1s; outline: none;
      color: white; background: rgba(255,255,255,0.08);
      flex-shrink: 0;
    }
    .pnl-toolbar-btn:active { transform: scale(0.92); }
    .pnl-toolbar-btn:disabled { opacity: 0.6; cursor: not-allowed; }
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
const TOOLBAR_HIDE_AFTER_MS = 5_000;

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

function RemoteSpeakingProbe({
  participant,
  onChange,
}: {
  participant: Participant;
  onChange: (b: boolean) => void;
}) {
  const isSpeaking = useIsSpeaking(participant);
  useEffect(() => {
    onChange(Boolean(isSpeaking));
  }, [isSpeaking, onChange]);
  useEffect(() => {
    return () => onChange(false);
  }, [onChange]);
  return null;
}

function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    setMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
  }, []);
  return mobile;
}

interface FaceTimeCallViewProps {
  isVideo: boolean;
  onHangUp: () => void;
  startedAtMs: number;
  isE2EE: boolean;
  counterpartyName: string;
  counterpartyAvatar: string | null;
}

function FaceTimeCallView({ isVideo, onHangUp, startedAtMs, isE2EE, counterpartyName, counterpartyAvatar }: FaceTimeCallViewProps) {
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();
  const connectionState = useConnectionState();
  const speakerCandidate = remoteParticipants[0];
  const isMobile = useIsMobile();

  const [remoteIsSpeaking, setRemoteIsSpeaking] = useState(false);
  const handleRemoteSpeakingChange = useCallback((b: boolean) => setRemoteIsSpeaking(b), []);

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

  // fix-44: auto-hiding toolbar (FaceTime-style). Visible by default, fades
  // after 5 seconds of inactivity. Tap the video area to toggle.
  const [toolbarVisible, setToolbarVisible] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armHideTimer = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setToolbarVisible(false), TOOLBAR_HIDE_AFTER_MS);
  }, []);
  const showToolbar = useCallback(() => {
    setToolbarVisible(true);
    armHideTimer();
  }, [armHideTimer]);
  useEffect(() => {
    armHideTimer();
    return () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); };
  }, [armHideTimer]);
  const handleVideoTap = useCallback(() => {
    if (toolbarVisible) {
      setToolbarVisible(false);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    } else {
      showToolbar();
    }
  }, [toolbarVisible, showToolbar]);

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

  const wrap = (fn: () => Promise<void> | void) => async () => {
    showToolbar();
    await fn();
  };

  const toggleMute = wrap(async () => {
    try {
      const current = localParticipant.isMicrophoneEnabled;
      await localParticipant.setMicrophoneEnabled(!current);
      setIsMuted(current);
    } catch (err) { captureCallError(err, 'overlay', { stage_detail: 'toggle_mute' }); }
  });
  const toggleCamera = wrap(async () => {
    try {
      const current = localParticipant.isCameraEnabled;
      await localParticipant.setCameraEnabled(!current);
      setIsCamDisabled(current);
    } catch (err) { captureCallError(err, 'overlay', { stage_detail: 'toggle_camera' }); }
  });
  const toggleScreenShare = wrap(async () => {
    try {
      const next = !localParticipant.isScreenShareEnabled;
      await localParticipant.setScreenShareEnabled(next);
      setIsScreenSharing(next);
    } catch (err) {
      captureCallError(err, 'overlay', { stage_detail: 'toggle_screen_share' });
      toast.error('Could Not Share Screen');
    }
  });
  const toggleHold = wrap(async () => {
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
  });
  const requestPip = wrap(async () => {
    if (typeof document === 'undefined' || !document.pictureInPictureEnabled) {
      toast.info('Picture-In-Picture Not Supported In This Browser');
      return;
    }
    try {
      const el = document.querySelector<HTMLVideoElement>('video[data-pnl-local-video="true"]');
      if (!el) return;
      await el.requestPictureInPicture();
    } catch (err) { captureCallError(err, 'overlay', { stage_detail: 'pip' }); }
  });

  const flipCamera = wrap(async () => {
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
  });

  const handleHangUpClick = () => {
    showToolbar();
    onHangUp();
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
  const counterpartyInitials = counterpartyName
    ? counterpartyName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#000' }}>
      {speakerCandidate && (
        <RemoteSpeakingProbe
          participant={speakerCandidate}
          onChange={handleRemoteSpeakingChange}
        />
      )}

      {/* fix-44: clickable video area toggles toolbar visibility */}
      <div
        onClick={handleVideoTap}
        style={{ position: 'absolute', inset: 0, cursor: 'pointer' }}
        aria-label="Toggle Controls"
      >
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
                {/* fix-44: show counterparty's profile photo (or initials)
                    in the audio-only / waiting-for-video placeholder */}
                <div
                  className={remoteIsSpeaking ? 'pnl-speaker-active' : 'pnl-pulse-avatar-ring'}
                  style={{
                    width: 160, height: 160, borderRadius: '50%',
                    background: counterpartyAvatar
                      ? `url(${counterpartyAvatar}) center/cover no-repeat`
                      : 'linear-gradient(135deg, #00C4BC 0%, #0B1E30 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '3rem', fontWeight: 700, color: '#FFFFFF',
                    marginBottom: 24, border: '3px solid rgba(255, 255, 255, 0.15)',
                    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.65)',
                  }}
                >
                  {!counterpartyAvatar && counterpartyInitials}
                </div>
                <div style={{ color: '#FFFFFF', fontSize: '1.4rem', fontWeight: 700, marginBottom: 8 }}>
                  {counterpartyName}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.62)', fontSize: '0.95rem', fontWeight: 500, letterSpacing: '0.05em' }}>
                  {isVideo ? 'Waiting For Companion Video...' : 'Voice Call Active'}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {!isGroup && isVideo && localCamTrack && localParticipant.isCameraEnabled && (
        <div style={{
          position: 'absolute',
          top: 'calc(env(safe-area-inset-top, 0px) + 16px)',
          right: 'calc(env(safe-area-inset-right, 0px) + 16px)',
          width: 100, height: 150,
          borderRadius: 14, overflow: 'hidden',
          boxShadow: '0 12px 24px rgba(0,0,0,0.5)',
          border: '2px solid rgba(255, 255, 255, 0.15)',
          zIndex: 100, background: '#0B1E30',
          pointerEvents: 'none',
        }}>
            <VideoTrack
              trackRef={localCamTrack}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              data-pnl-local-video="true"
            />
        </div>
      )}

      <div style={{
        position: 'absolute',
        top: 'calc(env(safe-area-inset-top, 0px) + 16px)',
        left: '50%',
        transform: 'translateX(-50%)', zIndex: 150,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        maxWidth: 'calc(100vw - 32px)',
        pointerEvents: 'none',
      }}>
        <span className="pnl-call-timer" aria-label="Call Duration" aria-live="off">
          {formatCallDuration(elapsedMs)}
          <SignalBars quality={worstQuality} />
        </span>
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
            onClick={() => void toggleHold()}
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

      {/*
        fix-44: SINGLE-LINE auto-hiding toolbar.
          - flexWrap: nowrap so it stays one row.
          - maxWidth: calc(100vw - 24px) so it never overflows the viewport.
          - Auto-hides after 5s; tap the video area to toggle.
          - On mobile we hide the Screen Share button entirely because iOS
            Safari does not implement getDisplayMedia.
          - The Headphones button was removed entirely per user request.
          - Camera Flip uses SwitchCamera icon for visual clarity.
      */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
          left: '50%',
          transform: `translateX(-50%) translateY(${toolbarVisible ? 0 : 24}px)`,
          opacity: toolbarVisible ? 1 : 0,
          pointerEvents: toolbarVisible ? 'auto' : 'none',
          transition: 'opacity 0.3s ease, transform 0.3s ease',
          background: 'rgba(11, 30, 48, 0.78)',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          padding: '8px 12px', borderRadius: 32,
          display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap',
          zIndex: 200,
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
          maxWidth: 'calc(100vw - 24px)',
          boxSizing: 'border-box',
        }}
      >
        <button
          type="button" onClick={() => void toggleMute()}
          className="pnl-toolbar-btn"
          style={{ background: isMuted ? '#E53E3E' : 'rgba(255,255,255,0.08)' }}
          title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          aria-label={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
        >
          {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
        </button>

        {isVideo && (
          <button
            type="button" onClick={() => void toggleCamera()}
            className="pnl-toolbar-btn"
            style={{ background: isCamDisabled ? '#E53E3E' : 'rgba(255,255,255,0.08)' }}
            title={isCamDisabled ? 'Turn Camera On' : 'Turn Camera Off'}
            aria-label={isCamDisabled ? 'Turn Camera On' : 'Turn Camera Off'}
          >
            {isCamDisabled ? <VideoOff size={20} /> : <Video size={20} />}
          </button>
        )}

        {isVideo && !isCamDisabled && (
          <button
            type="button" onClick={() => void flipCamera()}
            className="pnl-toolbar-btn"
            title="Switch Camera" aria-label="Switch Camera"
          >
            <SwitchCamera size={20} />
          </button>
        )}

        {!isMobile && (
          <button
            type="button" onClick={() => void toggleScreenShare()}
            className="pnl-toolbar-btn"
            style={{
              background: isScreenSharing ? '#00C4BC' : 'rgba(255,255,255,0.08)',
              color: isScreenSharing ? '#000' : 'white',
            }}
            title={isScreenSharing ? 'Stop Sharing Screen' : 'Share Screen'}
            aria-label={isScreenSharing ? 'Stop Sharing Screen' : 'Share Screen'}
          >
            {isScreenSharing ? <ScreenShareOff size={20} /> : <ScreenShare size={20} />}
          </button>
        )}

        <button
          type="button" onClick={() => void toggleHold()}
          className="pnl-toolbar-btn"
          style={{
            background: isOnHold ? '#FFB020' : 'rgba(255,255,255,0.08)',
            color: isOnHold ? '#000' : 'white',
          }}
          title={isOnHold ? 'Resume Call' : 'Hold Call'}
          aria-label={isOnHold ? 'Resume Call' : 'Hold Call'}
        >
          {isOnHold ? <Play size={20} /> : <Pause size={20} />}
        </button>

        {isVideo && (
          <button
            type="button" onClick={() => void requestPip()}
            className="pnl-toolbar-btn"
            title="Picture-In-Picture" aria-label="Picture-In-Picture"
          >
            <Maximize2 size={20} />
          </button>
        )}

        <button
          type="button" onClick={handleHangUpClick}
          className="pnl-toolbar-btn"
          style={{ background: '#E53E3E' }}
          title="Hang Up" aria-label="Hang Up"
        >
          <PhoneOff size={20} />
        </button>
      </div>
    </div>
  );
}

export default function CallOverlay({ call, selfId, onClose, onAccept }: Props & { onAccept?: () => void }) {
  useEffect(() => { injectPulseRingAnim(); }, []);

  const conversations = useMessengerStore((s) => s.conversations);
  const [counterpartyId, setCounterpartyId] = useState<string | null>(null);
  const [counterpartyName, setCounterpartyName] = useState<string>(call.caller_name ?? 'Someone');
  const [counterpartyAvatar, setCounterpartyAvatar] = useState<string | null>(call.caller_avatar ?? null);
  const [isSignaling, setIsSignaling] = useState(false);
  const userClosedRef = useRef(false);

  const activeStartedAtRef = useRef<number | null>(null);
  if (call.status === 'active' && activeStartedAtRef.current === null) {
    const anyCall = call as CallSignalRow & { answered_at?: string | null };
    const fromServer = anyCall.answered_at ? Date.parse(anyCall.answered_at) : NaN;
    activeStartedAtRef.current = Number.isFinite(fromServer) ? fromServer : Date.now();
  }

  const [e2ee, setE2ee] = useState<E2EESetup | null>(null);
  const e2eeRef = useRef<E2EESetup | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const setup = await createE2EESetup(call.livekit_room);
      if (cancelled) {
        if (setup?.worker) {
          try { setup.worker.terminate(); } catch {}
        }
        return;
      }
      e2eeRef.current = setup;
      setE2ee(setup);
      if (setup) {
        captureCallEvent('E2EE enabled for call', 'overlay', 'info', { call_id: call.id });
      }
    })();
    return () => {
      cancelled = true;
      const cur = e2eeRef.current;
      if (cur?.worker) {
        try { cur.worker.terminate(); } catch {}
      }
      e2eeRef.current = null;
    };
  }, [call.livekit_room, call.id]);

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
          setCounterpartyName((cur) => other.full_name ?? other.username ?? cur);
          if (other.avatar_url) setCounterpartyAvatar(other.avatar_url);
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
              <IframeLink
                href="/help/messenger-call-permissions"
                style={{ color: '#00C4BC', textDecoration: 'underline' }}
              >
                How To Enable Microphone And Camera
              </IframeLink>
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
            counterpartyName={counterpartyName}
            counterpartyAvatar={counterpartyAvatar}
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
            Connecting To Conference...
          </div>
        </div>
      )}
    </div>
  );
}
