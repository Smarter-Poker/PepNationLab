'use client';

/**
 * /device-check — prove your camera and microphone work BEFORE the call.
 *
 * Built after a round of call failures that were all the same shape: someone
 * joins, cannot be seen or heard, and nobody on the call can diagnose it while
 * the call is happening. The person with the problem is the one least able to
 * debug it, because the browser only ever told them "Camera And Microphone
 * Required" no matter what was actually wrong.
 *
 * So this page answers the question directly and separately for each device:
 * do you have a camera, do you have a microphone, did you grant access, is
 * something else holding them, and — the part a permission dialog can never
 * tell you — is the microphone picking up your voice RIGHT NOW. A live level
 * meter is the only way to catch a muted headset or an input switched to the
 * wrong device, which is by far the most common "my mic is broken".
 *
 * Deliberately standalone and link-shareable: you send it to the other people
 * on the call, they open it on the device they will actually use, and everyone
 * finds out before the meeting instead of during it.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, Monitor, CheckCircle2, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { canShareScreen } from '@/lib/messenger/mediaPreflight';

type Verdict = 'unknown' | 'good' | 'warn' | 'bad';

const TEAL = '#00C4BC';

function VerdictIcon({ v }: { v: Verdict }) {
  if (v === 'good') return <CheckCircle2 size={20} style={{ color: '#22C55E', flexShrink: 0 }} aria-hidden="true" />;
  if (v === 'warn') return <AlertTriangle size={20} style={{ color: '#FFB020', flexShrink: 0 }} aria-hidden="true" />;
  if (v === 'bad') return <XCircle size={20} style={{ color: '#E53E3E', flexShrink: 0 }} aria-hidden="true" />;
  return <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.2)', flexShrink: 0 }} />;
}

function Row({ icon, label, verdict, detail }: { icon: React.ReactNode; label: string; verdict: Verdict; detail: string }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12, padding: '14px 16px', marginBottom: 10,
      }}
    >
      <div style={{ color: TEAL, flexShrink: 0, marginTop: 2 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, marginBottom: 2 }}>{label}</div>
        <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.9rem', lineHeight: 1.45 }}>{detail}</div>
      </div>
      <VerdictIcon v={verdict} />
    </div>
  );
}

export default function DeviceCheckPage() {
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  const [camVerdict, setCamVerdict] = useState<Verdict>('unknown');
  const [camDetail, setCamDetail] = useState('Not Tested Yet.');
  const [micVerdict, setMicVerdict] = useState<Verdict>('unknown');
  const [micDetail, setMicDetail] = useState('Not Tested Yet.');
  const [level, setLevel] = useState(0);
  const [peak, setPeak] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  const shareSupported = typeof window !== 'undefined' ? canShareScreen() : false;

  const stopAll = useCallback(() => {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (audioCtxRef.current) { void audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null; }
    if (streamRef.current) {
      for (const t of streamRef.current.getTracks()) { try { t.stop(); } catch { /* already stopped */ } }
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  // Releasing the camera when you leave matters: on most machines the light
  // stays on and the device stays claimed until every track is stopped, and a
  // camera still held by this tab is a camera the call cannot have.
  useEffect(() => stopAll, [stopAll]);

  const describe = (err: unknown): string => {
    const name = (err as { name?: string } | null)?.name ?? '';
    if (/NotAllowedError|SecurityError/i.test(name)) return 'Access Was Blocked. Allow It In Your Browser Settings And Run The Test Again.';
    if (/NotFoundError|OverconstrainedError/i.test(name)) return 'No Device Of This Kind Is Attached To This Computer.';
    if (/NotReadableError|AbortError|TrackStartError/i.test(name)) return 'Another App Is Using It. Close Zoom, Teams, Photo Booth Or FaceTime And Try Again.';
    return 'Could Not Be Started. Try Again, Or Use A Different Browser.';
  };

  const run = useCallback(async () => {
    stopAll();
    setRunning(true);
    setDone(false);
    setPeak(0);
    setCamVerdict('unknown'); setCamDetail('Testing…');
    setMicVerdict('unknown'); setMicDetail('Testing…');

    if (!navigator.mediaDevices?.getUserMedia) {
      setCamVerdict('bad'); setCamDetail('This Browser Cannot Access Media Devices. Use Chrome, Edge Or Safari Over HTTPS.');
      setMicVerdict('bad'); setMicDetail('This Browser Cannot Access Media Devices.');
      setRunning(false); setDone(true);
      return;
    }

    // Camera and microphone are requested SEPARATELY and on purpose. Asking
    // for both at once cannot tell you which one failed — the single most
    // common confusion this page exists to end.
    let camStream: MediaStream | null = null;
    try {
      camStream = await navigator.mediaDevices.getUserMedia({ video: true });
      setCamVerdict('good');
      const label = camStream.getVideoTracks()[0]?.label;
      setCamDetail(label ? `Working — ${label}` : 'Working. You Should See Yourself Below.');
      if (videoRef.current) {
        videoRef.current.srcObject = camStream;
        void videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      const name = (err as { name?: string } | null)?.name ?? '';
      // No camera is a warning, not a failure: audio calls are entirely
      // normal, and a great many desktops have never had a webcam.
      setCamVerdict(/NotFoundError|OverconstrainedError/i.test(name) ? 'warn' : 'bad');
      setCamDetail(describe(err));
    }

    let micStream: MediaStream | null = null;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const label = micStream.getAudioTracks()[0]?.label;
      setMicVerdict('good');
      setMicDetail(label ? `Working — ${label}. Speak And Watch The Bar Move.` : 'Working. Speak And Watch The Bar Move.');

      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctor();
      audioCtxRef.current = ctx;
      // Safari starts contexts suspended until a gesture; this runs from the
      // button click, so resuming here is allowed.
      if (ctx.state === 'suspended') await ctx.resume().catch(() => {});
      const source = ctx.createMediaStreamSource(micStream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteTimeDomainData(buf);
        // RMS around the 128 midpoint: a real loudness measure rather than a
        // single sample, so the bar tracks speech instead of flickering.
        let sum = 0;
        for (let i = 0; i < buf.length; i++) { const d = (buf[i] - 128) / 128; sum += d * d; }
        const rms = Math.sqrt(sum / buf.length);
        const pct = Math.min(100, Math.round(rms * 300));
        setLevel(pct);
        setPeak((p) => (pct > p ? pct : p));
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      setMicVerdict('bad');
      setMicDetail(describe(err));
    }

    // Keep both streams alive so the preview and meter keep running.
    const tracks = [...(camStream?.getTracks() ?? []), ...(micStream?.getTracks() ?? [])];
    streamRef.current = tracks.length ? new MediaStream(tracks) : null;

    setRunning(false);
    setDone(true);
  }, [stopAll]);

  const micHeard = peak >= 8;

  return (
    <div style={{ minHeight: '100dvh', background: '#05070A', color: '#E2E8F0', padding: '24px 16px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <h1 style={{ fontSize: '1.5rem', margin: '0 0 6px' }}>Camera &amp; Microphone Check</h1>
        <p style={{ color: 'rgba(255,255,255,0.6)', margin: '0 0 20px', lineHeight: 1.5 }}>
          Run this on the device you will actually use for the call. It tests the camera and the
          microphone separately, so you find out exactly which one needs attention — before you are
          on a call with other people.
        </p>

        <button
          type="button"
          onClick={() => void run()}
          disabled={running}
          style={{
            background: TEAL, color: '#04211F', border: 0,
            padding: '13px 26px', borderRadius: 10, fontWeight: 800, fontSize: '1rem',
            cursor: running ? 'wait' : 'pointer', marginBottom: 20,
            display: 'inline-flex', alignItems: 'center', gap: 8,
            boxShadow: '0 6px 18px rgba(0, 196, 188, 0.28)',
          }}
        >
          {done ? <RefreshCw size={18} aria-hidden="true" /> : null}
          {running ? 'Testing…' : done ? 'Run The Test Again' : 'Start The Test'}
        </button>

        <Row
          icon={camVerdict === 'good' ? <Video size={20} /> : <VideoOff size={20} />}
          label="Camera"
          verdict={camVerdict}
          detail={camDetail}
        />

        {camVerdict === 'good' && (
          <video
            ref={videoRef}
            autoPlay playsInline muted
            style={{
              width: '100%', maxHeight: 300, objectFit: 'cover',
              borderRadius: 12, background: '#000', marginBottom: 10,
              transform: 'scaleX(-1)', // mirrored, like every other selfie view
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          />
        )}

        <Row
          icon={micVerdict === 'good' ? <Mic size={20} /> : <MicOff size={20} />}
          label="Microphone"
          verdict={micVerdict}
          detail={micDetail}
        />

        {micVerdict === 'good' && (
          <div style={{ marginBottom: 10 }}>
            <div
              style={{ height: 14, background: 'rgba(255,255,255,0.07)', borderRadius: 999, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}
              role="meter"
              aria-label="Microphone Input Level"
              aria-valuenow={level}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                style={{
                  width: `${level}%`, height: '100%',
                  background: level > 70 ? '#FFB020' : TEAL,
                  transition: 'width 90ms linear',
                }}
              />
            </div>
            <div style={{ fontSize: '0.85rem', marginTop: 7, color: micHeard ? '#22C55E' : 'rgba(255,255,255,0.6)', fontWeight: micHeard ? 700 : 400 }}>
              {micHeard
                ? 'Your Voice Is Being Picked Up — The Microphone Works.'
                : 'Say Something. If This Bar Never Moves, The Wrong Input Is Selected Or The Microphone Is Muted In Hardware.'}
            </div>
          </div>
        )}

        <Row
          icon={<Monitor size={20} />}
          label="Screen Sharing"
          verdict={shareSupported ? 'good' : 'warn'}
          detail={
            shareSupported
              ? 'Available On This Device. The Share Screen Button Appears In The Call Toolbar.'
              : 'Not Available On This Device. Phone And Tablet Browsers Cannot Share A Screen — Join From A Computer If You Need To Present.'
          }
        />

        <div
          style={{
            background: 'rgba(0, 196, 188, 0.06)',
            border: '1px solid rgba(0, 196, 188, 0.22)',
            borderRadius: 12, padding: '14px 16px', marginTop: 16,
            fontSize: '0.9rem', lineHeight: 1.55, color: 'rgba(255,255,255,0.78)',
          }}
        >
          <strong style={{ color: TEAL }}>No camera on this machine?</strong> That is fine — you can still join,
          and you will be heard and will see everyone else. A missing camera never stops you taking a call.
        </div>
      </div>
    </div>
  );
}
