'use client';

/**
 * GlobalSearchBar -- sticky Google-style search bar mounted in the Navbar and
 * on /research surfaces. Cmd-K / Ctrl-K focus shortcut, voice via Web Speech
 * API, localStorage-backed recent searches, and a debounced suggest dropdown
 * powered by /api/research/suggest.
 *
 * Research use only. All routing goes through /research/search?q=.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Sparkles, Mic, X } from 'lucide-react';
import AutocompleteDropdown, { type Suggestion } from './AutocompleteDropdown';

const HISTORY_KEY = 'pep_research_history';
const HISTORY_LIMIT = 8;

function loadHistory(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, HISTORY_LIMIT) : [];
  } catch {
    return [];
  }
}

function pushHistory(query: string) {
  if (typeof window === 'undefined') return;
  const q = query.trim();
  if (!q) return;
  try {
    const cur = loadHistory().filter((x) => x.toLowerCase() !== q.toLowerCase());
    const next = [q, ...cur].slice(0, HISTORY_LIMIT);
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    /* swallow */
  }
}

interface SpeechRecognitionWindow {
  SpeechRecognition?: new () => unknown;
  webkitSpeechRecognition?: new () => unknown;
}

export default function GlobalSearchBar({
  compact = false,
  initialQuery = '',
  autoFocus = false,
}: {
  compact?: boolean;
  initialQuery?: string;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = window as unknown as SpeechRecognitionWindow;
    setVoiceSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
    setRecent(loadHistory());
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    function onKey(e: KeyboardEvent) {
      const isModK = (e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K');
      if (isModK) {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
        return;
      }
      if (e.key === 'Escape') {
        if (document.activeElement === inputRef.current) {
          setQ('');
          setOpen(false);
          inputRef.current?.blur();
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    function onPointer(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener('mousedown', onPointer);
    return () => window.removeEventListener('mousedown', onPointer);
  }, []);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    const trimmed = q.trim();
    if (!trimmed) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/research/suggest?q=${encodeURIComponent(trimmed)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data.suggestions)) {
          setSuggestions(data.suggestions);
        }
      } catch {
        /* swallow */
      }
    }, 200);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [q]);

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
    }
  }, [autoFocus]);

  const submit = useCallback(
    (override?: string) => {
      const target = (override ?? q).trim();
      if (!target) return;
      pushHistory(target);
      setRecent(loadHistory());
      setOpen(false);
      router.push(`/research/search?q=${encodeURIComponent(target)}`);
    },
    [q, router],
  );

  function onSuggestionSelect(s: Suggestion) {
    if (s.kind === 'compound') {
      pushHistory(s.display_name);
      router.push(`/research/${s.slug}`);
      setOpen(false);
      return;
    }
    if (s.kind === 'area') {
      router.push(`/research/area/${s.slug}`);
      setOpen(false);
      return;
    }
    submit(s.display_name);
  }

  function startVoice() {
    if (typeof window === 'undefined') return;
    const w = window as unknown as SpeechRecognitionWindow;
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;
    try {
      const rec = new Ctor() as unknown as {
        lang: string;
        interimResults: boolean;
        continuous: boolean;
        onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
        onerror: () => void;
        onend: () => void;
        start: () => void;
        stop: () => void;
      };
      rec.lang = 'en-US';
      rec.interimResults = false;
      rec.continuous = false;
      rec.onresult = (e) => {
        const transcript = e.results?.[0]?.[0]?.transcript ?? '';
        if (transcript) {
          setQ(transcript);
          submit(transcript);
        }
      };
      rec.onerror = () => setVoiceActive(false);
      rec.onend = () => setVoiceActive(false);
      rec.start();
      setVoiceActive(true);
    } catch {
      setVoiceActive(false);
    }
  }

  const heightPx = compact ? 38 : 52;
  const fontPx = compact ? 14 : 16;

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%', maxWidth: compact ? 420 : 720, margin: '0 auto' }}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          height: heightPx,
          padding: '0 10px 0 14px',
          borderRadius: 999,
          background: 'rgba(15, 25, 35, 0.85)',
          border: '1px solid rgba(168,180,192,0.25)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        }}
      >
        <Search size={compact ? 16 : 20} color="#A8B4C0" aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={compact ? 'Search The Research Library' : 'Search The Research Library, Compounds, Mechanisms, Studies'}
          aria-label="Search The Research Library"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#FFFFFF',
            fontSize: fontPx,
          }}
        />
        {q && (
          <button
            type="button"
            onClick={() => {
              setQ('');
              setSuggestions([]);
              inputRef.current?.focus();
            }}
            aria-label="Clear Search"
            style={{
              background: 'transparent',
              border: 'none',
              padding: 4,
              color: '#A8B4C0',
              cursor: 'pointer',
              display: 'inline-flex',
            }}
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
        {voiceSupported && (
          <button
            type="button"
            onClick={startVoice}
            disabled={voiceActive}
            aria-label="Voice Search"
            title="Voice Search"
            style={{
              background: voiceActive ? 'rgba(0,196,188,0.18)' : 'transparent',
              border: 'none',
              padding: 6,
              color: voiceActive ? '#00C4BC' : '#A8B4C0',
              cursor: voiceActive ? 'default' : 'pointer',
              display: 'inline-flex',
              borderRadius: 999,
            }}
          >
            <Mic size={compact ? 14 : 18} aria-hidden="true" />
          </button>
        )}
        {!compact && (
          <button
            type="button"
            onClick={() => router.push('/research#match-me')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(0,196,188,0.12)',
              border: '1px solid rgba(0,196,188,0.4)',
              color: '#00C4BC',
              fontSize: 12,
              fontWeight: 700,
              padding: '6px 12px',
              borderRadius: 999,
              cursor: 'pointer',
            }}
            aria-label="Match Me To A Peptide"
          >
            <Sparkles size={14} aria-hidden="true" />
            Match Me
          </button>
        )}
      </form>

      {open && (q.trim().length > 0 || recent.length > 0) && (
        <AutocompleteDropdown
          suggestions={suggestions}
          recent={recent}
          onSelect={onSuggestionSelect}
          onSelectRecent={(text) => submit(text)}
        />
      )}

      {!compact && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
          <span style={{ fontSize: 11, color: '#A8B4C0', opacity: 0.8 }}>
            Tip: Press Command-K Or Control-K To Search From Anywhere
          </span>
        </div>
      )}
    </div>
  );
}
