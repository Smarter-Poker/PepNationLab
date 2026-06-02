'use client';

/**
 * audit15 fix-29 (B7): group-call grid view.
 *
 * Replaces the FaceTime-style remote-fullscreen layout when there are
 * 2+ remote participants. Each remote gets a tile with their video,
 * name, mute indicator, and active-speaker pulse.
 */

import {
  useRemoteParticipants,
  useTracks,
  VideoTrack,
  useIsSpeaking,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import type { Participant } from 'livekit-client';
import { Mic, MicOff } from 'lucide-react';

function gridColumns(count: number): string {
  if (count <= 1) return '1fr';
  if (count <= 4) return '1fr 1fr';
  if (count <= 9) return '1fr 1fr 1fr';
  return '1fr 1fr 1fr 1fr';
}

interface TileProps {
  participant: Participant;
  videoTrackRef: import('@livekit/components-react').TrackReference | undefined;
}

function CallGridTile({ participant, videoTrackRef }: TileProps) {
  const speaking = useIsSpeaking(participant);
  const micOn = participant.isMicrophoneEnabled;
  const initials = (participant.name || participant.identity || '?')
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      style={{
        position: 'relative',
        background: '#0B1E30',
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: speaking
          ? '0 0 0 3px rgba(0, 196, 188, 0.85), 0 8px 24px rgba(0,0,0,0.4)'
          : '0 8px 24px rgba(0,0,0,0.4)',
        transition: 'box-shadow 0.2s',
        minHeight: 160,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      role="region"
      aria-label={participant.name || participant.identity}
    >
      {videoTrackRef ? (
        <VideoTrack
          trackRef={videoTrackRef}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #00C4BC 0%, #0B1E30 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.75rem',
            fontWeight: 700,
            color: 'white',
            border: '3px solid rgba(255, 255, 255, 0.12)',
          }}
        >
          {initials}
        </div>
      )}

      {/* Bottom strip: name + mic state */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)',
        }}
      >
        <span
          style={{
            color: 'white',
            fontSize: '0.85rem',
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: 'calc(100% - 28px)',
          }}
          title={participant.name || participant.identity}
        >
          {participant.name || participant.identity}
        </span>
        {micOn ? (
          <Mic size={14} style={{ color: 'rgba(255, 255, 255, 0.7)' }} />
        ) : (
          <MicOff size={14} style={{ color: '#E53E3E' }} aria-label="Microphone Muted" />
        )}
      </div>
    </div>
  );
}

export default function CallGridView() {
  const remoteParticipants = useRemoteParticipants();
  const allTracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: false },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  ) as Array<import('@livekit/components-react').TrackReference>;

  // Map participant sid -> best video track (screen share beats camera).
  const trackByParticipant = new Map<string, import('@livekit/components-react').TrackReference>();
  for (const t of allTracks) {
    if (t.participant.isLocal) continue;
    const existing = trackByParticipant.get(t.participant.sid);
    if (!existing) {
      trackByParticipant.set(t.participant.sid, t);
    } else if (t.source === Track.Source.ScreenShare && existing.source !== Track.Source.ScreenShare) {
      trackByParticipant.set(t.participant.sid, t);
    }
  }

  const cols = gridColumns(remoteParticipants.length);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        padding: 16,
        background: 'radial-gradient(circle at center, #0B1E30 0%, #03080F 100%)',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: cols,
          gap: 12,
          height: '100%',
          maxHeight: 'calc(100dvh - 160px)',
        }}
      >
        {remoteParticipants.map((p) => (
          <CallGridTile
            key={p.sid}
            participant={p}
            videoTrackRef={trackByParticipant.get(p.sid)}
          />
        ))}
      </div>
    </div>
  );
}
