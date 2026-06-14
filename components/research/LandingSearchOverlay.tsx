'use client';

/**
 * LandingSearchOverlay - the live, in-place search for the image-hotspot research
 * landing page. Renders the search input + button at the baked-in search-bar
 * coordinates, and shows an instant results dropdown as the user types.
 * Enter or a result click navigates in-app; the button opens the full results
 * page. Research-use-only.
 */

import { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import AutocompleteDropdown, { type Suggestion } from './AutocompleteDropdown';
import TrendingSearchesDropdown from './TrendingSearchesDropdown';
import { useSearchHistory } from './useSearchHistory';

export default function LandingSearchOverlay({
  formStyle,
  buttonStyle,
  resultsStyle,
  inputStyle,
  hideIcon,
  placeholder = "Ask Us Anything...",
  buttonContent,
}: {
  formStyle?: React.CSSProperties;
  buttonStyle?: React.CSSProperties;
  resultsStyle?: React.CSSProperties;
  inputStyle?: React.CSSProperties;
  hideIcon?: boolean;
  placeholder?: string;
  buttonContent?: React.ReactNode;
} = {}) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<number | null>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { recent, addHistory } = useSearchHistory();

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    const trimmed = q.trim();
    if (trimmed.length < 2) {
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

  function goFull(override?: string) {
    const target = (override ?? q).trim();
    if (target) {
      addHistory(target);
      // Route a real query to the dedicated results page (results render at the
      // top), matching CommandSearchBar / UniversalSearch / GlobalSearchBar.
      // Previously this went to /research/catalog?q=, landing the user on the
      // Intelligence Center hero with their results far below the fold - the
      // search felt like it did nothing. An empty submit still goes to the
      // catalog to "browse all".
      router.push(`/research/search?q=${encodeURIComponent(target)}`);
    } else {
      router.push(`/research/catalog`);
    }
    setOpen(false);
  }

  function onSuggestionSelect(s: Suggestion) {
    if (s.kind === 'compound') {
      addHistory(s.display_name);
      router.push(`/research/${s.slug}`);
    } else if (s.kind === 'area') {
      router.push(`/research/area/${s.slug}`);
    } else {
      goFull(s.display_name);
    }
    setOpen(false);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim()) goFull();
  }

  return (
    <>
      {/* Search input - positioned over the baked-in search bar */}
      <form
        onSubmit={onSubmit}
        style={{
          position: 'absolute',
          top: '26.8%',
          left: '7.5%',
          width: '71%',
          height: '4.0%',
          zIndex: 20,
          backgroundColor: (open || q.length > 0) ? '#090e15' : 'transparent',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: '16px',
          ...formStyle,
        }}
      >
        {!hideIcon && <Search size={20} color="#A8B4C0" />}
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => {
            if (blurTimer.current) clearTimeout(blurTimer.current);
            setOpen(true);
          }}
          onBlur={() => {
            blurTimer.current = setTimeout(() => setOpen(false), 160);
          }}
          placeholder={placeholder}
          aria-label="Search The Research Library"
          autoComplete="off"
          style={{
            flex: 1,
            height: '100%',
            backgroundColor: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#ffffff',
            fontSize: 'clamp(12px, 1.4vw, 16px)',
            padding: '0 12px 0 32px', /* Shifted right by 10px to avoid overlapping icon */
            ...inputStyle,
          }}
        />
      </form>

      {/* Search button */}
      <div
        onClick={() => goFull()}
        style={{
          position: 'absolute',
          top: '26.8%',
          left: '79%',
          width: '13.5%',
          height: '4.0%',
          cursor: 'pointer',
          zIndex: 20,
          ...buttonStyle,
        }}
      >
        {buttonContent}
      </div>

      {/* Live results dropdown */}
      {open && (q.trim().length > 0 || recent.length > 0) && (
        <div
          onMouseDown={(e) => e.preventDefault()}
          style={{
            position: 'absolute',
            top: '31.6%',
            left: '7.5%',
            width: '85%',
            zIndex: 30,
            ...resultsStyle,
          }}
        >
          <div style={{ position: 'relative' }}>
            <AutocompleteDropdown
              id="landing-search-autocomplete"
              suggestions={suggestions}
              recent={recent}
              onSelect={onSuggestionSelect}
              onSelectRecent={(text) => goFull(text)}
            />
          </div>
        </div>
      )}

      {open && q.trim().length === 0 && recent.length === 0 && (
        <div
          onMouseDown={(e) => e.preventDefault()}
          style={{
            position: 'absolute',
            top: '31.6%',
            left: '7.5%',
            width: '85%',
            zIndex: 30,
            ...resultsStyle,
          }}
        >
          <div style={{ position: 'relative' }}>
            <TrendingSearchesDropdown
              onSelect={(text) => goFull(text)}
            />
          </div>
        </div>
      )}
    </>
  );
}
