'use client';
import { useEffect, useState, useRef } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  ControlBar,
  VideoConference,
} from '@livekit/components-react';
import '@livekit/components-styles';
import type { CallSignalRow } from '@/lib/messenger/realtime';
import { useMessengerStore } from '@/stores/messengerStore';
import { createRingTone } from '@/lib/messenger/ringTone';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { toast } from 'sonner';

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
  `;
  document.head.appendChild(style);
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

  // Outgoing synthesized beep-beep ringtone effect for the initiator
  useEffect(() => {
    if (call.initiator_id !== selfId || call.status !== 'ringing') return;

    console.log('[CALL] Playing synthesized outgoing ringtone...');
    const ring = createRingTone();
    if (ring) {
      ring.start();
    }

    return () => {
      if (ring) {
        console.log('[CALL] Stopping synthesized outgoing ringtone');
        ring.stop();
      }
    };
  }, [call.initiator_id, call.status, selfId]);

  // Guaranteed unmount teardown signaling: broadcasts call_ended
  useEffect(() => {
    return () => {
      if (counterpartyId) {
        console.log('[CALL] Unmounting CallOverlay — broadcasting call_ended to:', counterpartyId);
        import('@/lib/messenger/realtime').then(({ broadcastCallSignal }) => {
          void broadcastCallSignal(counterpartyId, 'call_ended', call);
        }).catch(() => {});
      }
    };
  }, [counterpartyId, call]);

  useEffect(() => {
    const callId = call.id;
    const handler = () => {
      // 1. Unload signaling: broadcast call_ended immediately
      if (counterpartyId) {
        try {
          const bodyEnded = JSON.stringify({
            type: 'broadcast',
            event: 'call_ended',
            payload: call,
          });
          const blobEnded = new Blob([bodyEnded], { type: 'application/json' });
          void navigator.sendBeacon?.(`/api/messenger/call-signal-unload-broadcast?targetId=${counterpartyId}`, blobEnded);
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
  }, [call.id, call, counterpartyId]);

  const isVideo = call.call_type === 'video';

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
        <div style={{ color: 'var(--white, #FFFFFF)', padding: 24, textAlign: 'center' }}>
          <p>{error}</p>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'var(--teal, #00C4BC)',
              color: '#000',
              border: 0,
              padding: '8px 16px',
              borderRadius: 8,
              cursor: 'pointer',
              marginTop: 12,
              fontWeight: 600,
            }}
            aria-label="Close"
            title="Close"
          >
            Close
          </button>
        </div>
      )}
      {!error && token && url && (
        <LiveKitRoom
          serverUrl={url}
          token={token}
          connect={true}
          video={isVideo}
          audio={true}
          onDisconnected={onClose}
          style={{ flex: 1, background: '#000' }}
        >
          {isVideo ? <VideoConference /> : <RoomAudioRenderer />}
          <ControlBar />
        </LiveKitRoom>
      )}
      {!error && !token && (
        <div style={{ color: 'var(--white, #FFFFFF)', padding: 24, textAlign: 'center' }}>
          Connecting To Call
        </div>
      )}
    </div>
  );
}
