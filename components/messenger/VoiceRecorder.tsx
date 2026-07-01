'use client';
import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Send, X } from 'lucide-react';

interface Props {
  onComplete: (blob: Blob, durationSec: number) => void;
  onCancel: () => void;
}

const MAX_SEC = 60;

export default function VoiceRecorder({ onComplete, onCancel }: Props) {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = (commit: boolean) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([10, 30, 10]); // double click for stop
    }
    const rec = recRef.current;
    if (rec && rec.state !== 'inactive') {
      rec.onstop = () => {
        const final = new Blob(chunksRef.current, { type: 'audio/webm' });
        rec.stream.getTracks().forEach((t) => t.stop());
        recRef.current = null;
        if (commit && final.size > 0) setBlob(final);
      };
      try { rec.stop(); } catch {}
    }
    if (tickRef.current) clearInterval(tickRef.current);
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    setRecording(false);
  };

  const start = async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError('You Are Offline');
      return;
    }
    setError(null);
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(15); // single click for start
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
      const rec = new MediaRecorder(stream, { mimeType: mime });
      recRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (ev) => { if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data); };
      rec.start(250);
      startedAtRef.current = Date.now();
      setRecording(true);
      tickRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }, 250);
      stopTimerRef.current = setTimeout(() => { stop(true); }, MAX_SEC * 1000);
    } catch {
      setError('Microphone Access Denied');
    }
  };

  useEffect(() => {
    void start();
    return () => stop(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8 }}>
        <span style={{ color: 'var(--red, #E53E3E)' }}>{error}</span>
        <button type="button" onClick={onCancel} aria-label="Cancel" title="Cancel" style={btn}><X size={14} /></button>
      </div>
    );
  }

  if (blob) {
    const sec = duration || 0;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8 }}>
        <span style={{ fontSize: '0.84rem', color: 'var(--white, #FFFFFF)' }}>
          Voice Note Ready ({sec}s)
        </span>
        <button type="button" onClick={() => onComplete(blob, sec)} aria-label="Send Voice Note" title="Send Voice Note" style={btnPrimary}>
          <Send size={14} /> Send
        </button>
        <button type="button" onClick={onCancel} aria-label="Discard" title="Discard" style={btn}>
          <X size={14} /> Discard
        </button>
      </div>
    );
  }

  return (
    <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8 }}>
      <Mic size={16} aria-hidden="true" />
      <span style={{ fontSize: '0.84rem' }}>Recording {duration}s / {MAX_SEC}s</span>
      <button type="button" onClick={() => stop(true)} aria-label="Stop Recording" title="Stop Recording" style={btnPrimary} disabled={!recording}>
        <Square size={14} /> Stop
      </button>
      <button type="button" onClick={onCancel} aria-label="Cancel Recording" title="Cancel Recording" style={btn}>
        <X size={14} /> Cancel
      </button>
    </div>
  );
}

const btn: React.CSSProperties = {
  background: 'transparent', border: '1px solid var(--surface-3, #1D2D3E)',
  color: 'var(--white, #FFFFFF)', cursor: 'pointer', padding: '4px 8px', borderRadius: 6,
  display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.84rem',
};
const btnPrimary: React.CSSProperties = {
  background: 'var(--teal, #00C4BC)', border: 0, color: '#000', cursor: 'pointer',
  padding: '4px 8px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.84rem',
};