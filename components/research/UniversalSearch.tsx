'use client';

/**
 * UniversalSearch - a Google-style instant search over the entire Research
 * Library: compounds, stacks, research areas, learn guides, glossary terms, and
 * FAQ. Types-as-you-go with fuzzy/typo-tolerant ranking (lib/research-search),
 * grouped result badges, keyboard navigation, and example chips. All results
 * are in-app pepnationlab.com routes. Research-use-only.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import AutocompleteDropdown, { type Suggestion } from './AutocompleteDropdown';
import TrendingSearchesDropdown from './TrendingSearchesDropdown';

export default function UniversalSearch({
  initialQuery = '',
  autoFocus = false,
}: {
  initialQuery?: string;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) inputRef.current.focus();
  }, [autoFocus]);

  useEffect(() => {
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

  const submit = useCallback(
    (override?: string) => {
      const target = (override ?? q).trim();
      if (!target) return;
      setOpen(false);
      router.push(`/research/search?q=${encodeURIComponent(target)}`);
    },
    [q, router],
  );

  function onSuggestionSelect(s: Suggestion) {
    if (s.kind === 'compound') {
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

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    } else if (e.key === 'Escape') {
      setQ('');
      setOpen(false);
    }
  }

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      {/* Search input */}
      <div style={{ position: 'relative' }}>
        <Search
          size={20}
          aria-hidden="true"
          style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--teal, #00C4BC)' }}
        />
        <input
          ref={inputRef}
          type="search"
          value={q}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls="universal-search-autocomplete"
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search Any Compound, Goal, Mechanism, Term, Or Question"
          aria-label="Search The Research Library"
          autoComplete="off"
          style={{
            width: '100%',
            background: 'var(--surface-1, #0F1923)',
            border: '1px solid rgba(0,196,188,0.35)',
            borderRadius: '14px',
            color: '#FFFFFF',
            padding: '16px 16px 16px 48px',
            fontSize: '16px',
            outline: 'none',
          }}
        />
      </div>

      {open && q.trim().length > 0 && (
        <AutocompleteDropdown
          id="universal-search-autocomplete"
          suggestions={suggestions}
          recent={[]}
          onSelect={onSuggestionSelect}
          onSelectRecent={(text) => submit(text)}
        />
      )}

      {open && q.trim().length === 0 && (
        <TrendingSearchesDropdown
          onSelect={(text) => submit(text)}
        />
      )}
    </div>
  );
}
