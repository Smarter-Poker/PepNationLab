'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Sparkles } from 'lucide-react';
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
      {/* Top Label */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginBottom: '16px' }}>
        <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.4)', flex: 1, maxWidth: '60px' }} />
        <div style={{ color: '#E2E8F0', fontSize: '0.9rem', fontWeight: 600, textTransform: 'capitalize', letterSpacing: '0.5px' }}>
          Type Any Peptide Name, Symptom, Or Research Keyword To Get Started
        </div>
        <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.4)', flex: 1, maxWidth: '60px' }} />
      </div>

      {/* Metallic Container */}
      <div style={{
        padding: '3px',
        borderRadius: '40px',
        background: 'linear-gradient(180deg, #A8B4C0 0%, #4A5568 100%)',
        boxShadow: isFocused ? '0 0 20px rgba(0, 229, 255, 0.3)' : '0 10px 30px rgba(0,0,0,0.6)',
        transition: 'all 0.3s ease'
      }}>
        <div 
          style={{ 
            borderRadius: '37px',
            background: '#0a0a0a',
            display: 'flex',
            alignItems: 'center',
            height: '56px',
            padding: '0 16px',
            boxShadow: 'inset 0 4px 10px rgba(0,0,0,0.8)'
          }}
        >
          {/* Left Search Icon */}
          <Search size={22} color={isFocused ? '#00E5FF' : '#A8B4C0'} style={{ transition: 'color 0.3s ease' }} />
          
          {/* Vertical Separator */}
          <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.2)', margin: '0 16px' }} />
          
          {/* Input */}
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
            placeholder=""
            aria-label="Search The Research Library"
            autoComplete="off"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: '#FFFFFF',
              fontSize: '1.2rem',
              outline: 'none',
            }}
          />

          {/* Right Action Icon */}
          <div style={{ 
            width: '36px', height: '36px', borderRadius: '50%', 
            border: '2px solid rgba(255,255,255,0.4)', 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(0,0,0,0.5))',
            cursor: 'pointer'
          }} onClick={() => inputRef.current?.focus()}>
            <Sparkles size={18} color="#E2E8F0" />
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
