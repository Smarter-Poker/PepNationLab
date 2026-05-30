'use client';
import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';

interface GifResult { id: string; title: string; gifUrl: string | null; thumbUrl: string | null }
interface Props { onPick: (gifUrl: string) => void; onClose: () => void; onUnavailable?: () => void }

const DEBOUNCE_MS = 300;

export default function GifPicker({ onPick, onClose, onUnavailable }: Props) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!q.trim()) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/messenger/gif-search', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ q }),
        });
        if (res.status === 503) {
          setError('Gif Search Not Configured');
          onUnavailable?.();
          setResults([]);
          return;
        }
        if (!res.ok) { setError('Search Failed'); setResults([]); return; }
        const json = (await res.json()) as { results?: GifResult[] };
        setResults(json.results ?? []);
      } catch {
        setError('Network Error');
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [q, onUnavailable]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pick A Gif"
      style={{
        position: 'absolute', bottom: 56, left: 8, right: 8,
        background: 'var(--surface-2, #162230)', border: '1px solid var(--surface-3, #1D2D3E)',
        borderRadius: 10, padding: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        maxHeight: 320, overflowY: 'auto', zIndex: 50,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <Search size={14} aria-hidden="true" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search Gifs"
          aria-label="Search Gifs"
          style={{
            flex: 1, background: 'var(--surface-1, #0F1923)', color: 'var(--white, #FFFFFF)',
            border: '1px solid var(--surface-3, #1D2D3E)', borderRadius: 8, padding: '6px 8px',
            outline: 'none', fontSize: '0.88rem',
          }}
        />
        <button type="button" onClick={onClose} aria-label="Close" title="Close"
          style={{ background: 'transparent', border: 0, color: 'var(--white, #FFFFFF)', cursor: 'pointer', padding: 4 }}
        >Close</button>
      </div>
      {loading && <div style={{ color: 'var(--grey-400, #A8B4C0)', fontSize: '0.84rem' }}>Loading</div>}
      {error && <div role="alert" style={{ color: 'var(--red, #E53E3E)', fontSize: '0.84rem' }}>{error}</div>}
      {!loading && !error && q.trim() && results.length === 0 && (
        <div style={{ color: 'var(--grey-400, #A8B4C0)', fontSize: '0.84rem' }}>No Results</div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {results.map((r) => r.gifUrl && (
          <button key={r.id} type="button" onClick={() => onPick(r.gifUrl as string)}
            aria-label={`Send Gif ${r.title}`} title={r.title}
            style={{ background: 'transparent', border: 0, padding: 0, cursor: 'pointer' }}
          >
            <img src={r.thumbUrl ?? r.gifUrl} alt={r.title}
              style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 6 }}
              loading="lazy"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
