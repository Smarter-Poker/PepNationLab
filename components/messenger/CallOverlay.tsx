'use client';
import { useEffect, useState } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  ControlBar,
  VideoConference,
} from '@livekit/components-react';
import '@livekit/components-styles';
import type { CallSignalRow } from '@/lib/messenger/realtime';

interface Props {
  call: CallSignalRow;
  selfId: string;
  onClose: () => void;
}

export default function CallOverlay({ call, selfId, onClose }: Props) {
  void selfId;
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

  useEffect(() => {
    const callId = call.id;
    const handler = () => {
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
