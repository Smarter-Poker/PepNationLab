'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import AutocompleteDropdown, { type Suggestion } from './AutocompleteDropdown';
import TrendingSearchesDropdown from './TrendingSearchesDropdown';
import { useSearchHistory } from './useSearchHistory';

export default function CommandSearchBar({
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
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<number | null>(null);
  const { recent, addHistory } = useSearchHistory();

  useEffect(() => {
    if (autoFocus && inputRef.current) inputRef.current.focus();
  }, [autoFocus]);

  useEffect(() => {
    setQ(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    function onPointer(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setIsFocused(false);
      }
    }
    window.addEventListener('mousedown', onPointer);
    return () => window.removeEventListener('mousedown', onPointer);
  }, []);

  // Keyboard shortcut listener for CMD+K / CTRL+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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
      addHistory(target);
      setOpen(false);
      router.push(`/research/search?q=${encodeURIComponent(target)}`);
      setTimeout(() => setQ(''), 150);
    },
    [q, router, addHistory],
  );

  function onSuggestionSelect(s: Suggestion) {
    if (s.kind === 'compound') {
      addHistory(s.display_name);
      router.push(`/research/${s.slug}`);
      setOpen(false);
      setTimeout(() => setQ(''), 150);
      return;
    }
    if (s.kind === 'area') {
      router.push(`/research/area/${s.slug}`);
      setOpen(false);
      setTimeout(() => setQ(''), 150);
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
      inputRef.current?.blur();
      setIsFocused(false);
    }
  }

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%', maxWidth: '800px', margin: '0 auto 40px auto' }}>
      <div 
        style={{ 
          position: 'relative',
          background: 'rgba(15, 25, 35, 0.6)',
          backdropFilter: 'blur(16px)',
          borderRadius: '16px',
          border: isFocused ? '1px solid rgba(0, 229, 255, 0.8)' : '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: isFocused ? '0 0 20px rgba(0, 229, 255, 0.2), inset 0 0 10px rgba(0, 229, 255, 0.1)' : '0 10px 30px rgba(0, 0, 0, 0.5)',
          transition: 'all 0.3s ease',
          display: 'flex',
          alignItems: 'center',
          overflow: 'hidden'
        }}
      >
        <div style={{ padding: '0 20px', display: 'flex', alignItems: 'center' }}>
          <Search size={24} color={isFocused ? '#00E5FF' : '#A8B4C0'} style={{ transition: 'color 0.3s ease' }} />
        </div>
        
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
          onFocus={() => { setOpen(true); setIsFocused(true); }}
          onBlur={() => setIsFocused(false)}
          onKeyDown={onKeyDown}
          placeholder="Search any compound, mechanism, goal, or question..."
          aria-label="Search The Research Library"
          autoComplete="off"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            color: '#FFFFFF',
            padding: '24px 0',
            fontSize: '1.2rem',
            outline: 'none',
          }}
        />

        <div style={{ padding: '0 20px', display: 'flex', alignItems: 'center' }}>
          <div style={{ 
            background: 'rgba(255,255,255,0.1)', 
            border: '1px solid rgba(255,255,255,0.2)', 
            borderRadius: '6px', 
            padding: '4px 8px', 
            color: '#A8B4C0', 
            fontSize: '0.85rem', 
            fontWeight: 800,
            cursor: 'pointer'
          }} onClick={() => inputRef.current?.focus()}>
            ⌘K
          </div>
        </div>
      </div>

      {open && (q.trim().length > 0 || recent.length > 0) && (
        <AutocompleteDropdown
          id="universal-search-autocomplete"
          suggestions={suggestions}
          recent={recent}
          onSelect={onSuggestionSelect}
          onSelectRecent={(text) => submit(text)}
        />
      )}

      {open && q.trim().length === 0 && recent.length === 0 && (
        <TrendingSearchesDropdown
          onSelect={(text) => submit(text)}
        />
      )}
    </div>
  );
}
