'use client';

/**
 * GlossaryExplorer — progressive-disclosure glossary. The reader taps a letter
 * to see only that letter's terms (instead of every letter at once), or types
 * in the search box to filter across all terms. Teal/black, Title Case headings,
 * no emoji, 44px touch targets. Research-Use-Only.
 */

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

export interface GlossaryTermEntry {
  term: string;
  def: string;
}

export default function GlossaryExplorer({ terms }: { terms: GlossaryTermEntry[] }) {
  const sorted = useMemo(() => [...terms].sort((a, b) => a.term.localeCompare(b.term)), [terms]);

  const groups = useMemo(() => {
    const g: Record<string, GlossaryTermEntry[]> = {};
    for (const e of sorted) {
      const first = (e.term[0] ?? '#').toUpperCase();
      const key = /[A-Z]/.test(first) ? first : '#';
      (g[key] ||= []).push(e);
    }
    return g;
  }, [sorted]);

  const letters = useMemo(() => Object.keys(groups).sort(), [groups]);
  const [activeLetter, setActiveLetter] = useState(letters[0] ?? '');
  const [q, setQ] = useState('');

  const term = q.trim().toLowerCase();
  const searching = term.length > 0;
  const results = searching
    ? sorted.filter((e) => e.term.toLowerCase().includes(term) || e.def.toLowerCase().includes(term))
    : groups[activeLetter] ?? groups[letters[0]] ?? [];

  return (
    <div>
      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 'var(--space-4, 16px)' }}>
        <Search size={18} aria-hidden="true" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--silver, #A8B4C0)' }} />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search Every Term"
          aria-label="Search Glossary Terms"
          style={{
            width: '100%',
            background: 'var(--surface-1, #0F1923)',
            border: '1px solid rgba(0,196,188,0.35)',
            borderRadius: '12px',
            color: '#FFFFFF',
            padding: '13px 16px 13px 42px',
            fontSize: '16px',
          }}
        />
      </div>

      {/* Letter button rail (hidden while searching) */}
      {!searching && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: 'var(--space-5, 24px)' }}>
          {letters.map((l) => {
            const isActive = l === activeLetter;
            return (
              <button
                key={l}
                type="button"
                aria-pressed={isActive}
                onClick={() => setActiveLetter(l)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 44,
                  height: 44,
                  padding: '0 10px',
                  borderRadius: '10px',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  background: isActive ? 'rgba(0,196,188,0.16)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${isActive ? 'var(--teal, #00C4BC)' : 'rgba(255,255,255,0.12)'}`,
                  color: isActive ? 'var(--teal, #00C4BC)' : 'var(--silver, #D0DAE4)',
                  transition: 'background 0.15s ease, border-color 0.15s ease, color 0.15s ease',
                }}
              >
                {l}
              </button>
            );
          })}
        </div>
      )}

      {/* Heading for the active view */}
      <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--teal, #00C4BC)', margin: '0 0 var(--space-3, 12px)', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '6px' }}>
        {searching ? `${results.length} Result${results.length === 1 ? '' : 's'}` : activeLetter}
      </h2>

      {/* Terms */}
      {results.length === 0 ? (
        <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '0.95rem' }}>No Terms Matched That Search.</p>
      ) : (
        <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-3, 12px)' }}>
          {results.map((e) => (
            <div key={e.term} className="card-metal" style={{ borderRadius: 'var(--radius-lg, 12px)', padding: 'var(--space-3, 12px) var(--space-4, 16px)' }}>
              <dt style={{ fontWeight: 700, color: 'var(--white, #FFFFFF)', fontSize: '0.98rem' }}>{e.term}</dt>
              <dd style={{ margin: '4px 0 0', color: 'var(--silver, #A8B4C0)', fontSize: '0.92rem', lineHeight: 1.55 }}>{e.def}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
