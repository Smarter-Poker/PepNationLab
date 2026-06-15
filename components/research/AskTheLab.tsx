'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Sparkles, Search } from 'lucide-react';
import { evidenceTier } from '@/lib/compounds';
import AutocompleteDropdown, { type Suggestion } from './AutocompleteDropdown';
import TrendingSearchesDropdown from './TrendingSearchesDropdown';
import { useSearchHistory } from './useSearchHistory';

interface AskMatch {
  slug: string;
  name: string;
  evidence_tier: string;
  category: string | null;
  reason: string;
  phrase: string | null;
  composed: string;
}

interface AskResponse {
  matches: AskMatch[];
  message?: string;
  note?: string;
}

// Seed searches that show off the goal -> peptide matching.
const EXAMPLES = ['Fat Loss', 'Joint Pain', 'Better Sleep', 'Hair Growth', 'Tanning', 'Energy', 'Libido', 'Anti-Aging'];

export default function AskTheLab() {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AskResponse | null>(null);
  const [searched, setSearched] = useState('');

  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const { recent, addHistory } = useSearchHistory();
  const debounceRef = useRef<number | null>(null);

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
        // swallow
      }
    }, 200);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [q]);

  async function ask(queryArg?: string) {
    const query = (queryArg ?? q).trim();
    if (!query) return;
    if (queryArg) setQ(queryArg);
    addHistory(query);
    setSuggestOpen(false);
    setLoading(true);
    setResult(null);
    setSearched(query);
    try {
      const res = await fetch('/api/research/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: query }),
      });
      const data = res.ok
        ? ((await res.json()) as AskResponse)
        : { matches: [], message: 'Search Temporarily Unavailable. Please Try Again.' };
      setResult(data);
    } catch {
      setResult({ matches: [], message: 'Something Went Wrong. Please Try Again.' });
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      ask();
    }
  }

  return (
    <div className="glass-panel" style={{ padding: 0 }}>
      <div className="glass-panel">
        <div className="" style={{ padding: 'var(--space-6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
            <Sparkles size={22} color="#00C4BC" aria-hidden="true" />
            <h2 style={{ margin: 0, color: '#FFFFFF', fontSize: '1.35rem', fontWeight: 700 }}>Ask The Lab</h2>
          </div>
          <p style={{ margin: '0 0 var(--space-4)', color: '#A8B4C0', fontSize: '0.95rem' }}>
            Search By Goal, Symptom, Or Compound Name And We Will Match The Peptides We Carry. Research Use Only.
          </p>

          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', position: 'relative' }}>
            <div style={{ flex: '1 1 240px', position: 'relative' }}>
              <input
                type="text"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setSuggestOpen(true);
                }}
                onFocus={() => setSuggestOpen(true)}
                onBlur={() => setTimeout(() => setSuggestOpen(false), 200)}
                onKeyDown={onKeyDown}
                placeholder="Try A Goal Like Fat Loss, Joint Pain, Or A Compound Name"
                aria-label="Search The Peptide Library"
                autoComplete="off"
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid #1D2D3E',
                  background: '#0F1923',
                  color: '#FFFFFF',
                  fontSize: '1rem',
                }}
              />
              {suggestOpen && (q.trim().length > 0 || recent.length > 0) && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: '4px' }}>
                  <AutocompleteDropdown
                    id="ask-lab-search-autocomplete"
                    suggestions={suggestions}
                    recent={recent}
                    onSelect={(s) => {
                      addHistory(s.display_name);
                      setQ(s.display_name);
                      ask(s.display_name);
                    }}
                    onSelectRecent={(t) => {
                      addHistory(t);
                      setQ(t);
                      ask(t);
                    }}
                  />
                </div>
              )}
              {suggestOpen && q.trim().length === 0 && recent.length === 0 && (
                 <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: '4px' }}>
                   <TrendingSearchesDropdown 
                     onSelect={(term) => {
                       addHistory(term);
                       setQ(term);
                       ask(term);
                     }}
                   />
                 </div>
              )}
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={() => ask()}
              disabled={loading || !q.trim()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', height: 'fit-content' }}
            >
              <Search size={18} aria-hidden="true" />
              {loading ? 'Searching' : 'Search'}
            </button>
          </div>

          {/* Example seed searches */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: 'var(--space-3)' }}>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => ask(ex)}
                disabled={loading}
                style={{
                  fontSize: '0.78rem',
                  color: '#A8B4C0',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '999px',
                  padding: '4px 12px',
                  cursor: loading ? 'default' : 'pointer',
                }}
              >
                {ex}
              </button>
            ))}
          </div>

          {loading && <p style={{ marginTop: 'var(--space-4)', color: '#A8B4C0' }}>Searching The Compound Library</p>}

          {!loading && result && result.matches.length === 0 && (
            <p style={{ marginTop: 'var(--space-4)', color: '#A8B4C0' }}>
              {result.message ?? 'No Matching Compound Found. Try A Goal Like Recovery Or Sleep.'}
            </p>
          )}

          {!loading && result && result.matches.length > 0 && (
            <div style={{ marginTop: 'var(--space-5)' }}>
              <p style={{ margin: '0 0 var(--space-3)', color: '#A8B4C0', fontSize: '0.85rem' }}>
                {result.matches.length} {result.matches.length === 1 ? 'Match' : 'Matches'} For
                <span style={{ color: '#FFFFFF', fontWeight: 700 }}> {searched}</span>
              </p>
              <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                {result.matches.map((m) => {
                  const tier = evidenceTier(m.evidence_tier);
                  return (
                    <Link
                      key={m.slug}
                      href={`/research/${m.slug}`}
                      style={{
                        display: 'block',
                        padding: 'var(--space-4)',
                        borderRadius: 'var(--radius-md)',
                        background: '#0F1923',
                        border: '1px solid #1D2D3E',
                        textDecoration: 'none',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                        <span style={{ color: '#00C4BC', fontWeight: 700, fontSize: '1.1rem' }}>{m.name}</span>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '0.15rem 0.6rem',
                            borderRadius: '999px',
                            color: tier.color,
                            border: `1px solid ${tier.color}`,
                            background: 'rgba(0,0,0,0.2)',
                          }}
                        >
                          {tier.label}
                        </span>
                        {m.reason && (
                          <span style={{ fontSize: '0.72rem', color: '#A8B4C0', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '999px', padding: '0.1rem 0.55rem' }}>
                            {m.reason}
                          </span>
                        )}
                      </div>
                      <p style={{ margin: 'var(--space-2) 0 0', color: '#D0DAE4', lineHeight: 1.55, fontSize: '0.92rem' }}>{m.composed}</p>
                    </Link>
                  );
                })}
              </div>
              {result.note && (
                <p style={{ margin: 'var(--space-4) 0 0', color: '#A8B4C0', fontSize: '0.8rem', fontStyle: 'italic' }}>{result.note}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
