'use client';

/**
 * UniversalSearch — a Google-style instant search over the entire Research
 * Library: compounds, stacks, research areas, learn guides, glossary terms, and
 * FAQ. Types-as-you-go with fuzzy/typo-tolerant ranking (lib/research-search),
 * grouped result badges, keyboard navigation, and example chips. All results
 * are in-app pepnationlab.com routes. Research-use-only.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { searchDocs, SEARCH_TYPE_LABEL, type SearchDoc, type SearchType } from '@/lib/research-search';

const TYPE_COLOR: Record<SearchType, string> = {
  compound: '#00C4BC',
  stack: '#8B5CF6',
  area: '#00E5FF',
  guide: '#68D391',
  term: '#A8B4C0',
  faq: '#F6AD55',
};

const EXAMPLES = ['Fat Loss', 'BPC-157', 'Half-Life', 'Sleep', 'GLP-1', 'Reconstitution', 'WADA', 'Joint Repair'];

export default function UniversalSearch({
  docs,
  initialQuery = '',
  autoFocus = false,
}: {
  docs: SearchDoc[];
  initialQuery?: string;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => searchDocs(q, docs, 40), [q, docs]);

  useEffect(() => {
    setActive(0);
  }, [q]);

  useEffect(() => {
    if (autoFocus && inputRef.current) inputRef.current.focus();
  }, [autoFocus]);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const hit = results[active];
      if (hit) router.push(hit.doc.url);
    } else if (e.key === 'Escape') {
      setQ('');
    }
  }

  return (
    <div>
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
          onChange={(e) => setQ(e.target.value)}
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

      {/* Example chips when empty */}
      {!q.trim() && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: 'var(--space-3, 12px)' }}>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setQ(ex)}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.14)',
                borderRadius: 9999,
                color: 'var(--silver, #D0DAE4)',
                fontSize: '0.82rem',
                fontWeight: 600,
                padding: '7px 14px',
                cursor: 'pointer',
              }}
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      {q.trim() && (
        <div style={{ marginTop: 'var(--space-4, 16px)' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--silver, #A8B4C0)', margin: '0 0 var(--space-3, 12px)' }}>
            {results.length === 0
              ? 'No Matches — Try A Different Term Or Goal.'
              : `${results.length} Result${results.length === 1 ? '' : 's'} Across Compounds, Areas, Guides, Glossary, And FAQ`}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {results.map((hit, i) => {
              const color = TYPE_COLOR[hit.doc.type];
              const isActive = i === active;
              return (
                <Link
                  key={hit.doc.id}
                  href={hit.doc.url}
                  onMouseEnter={() => setActive(i)}
                  className="card-glass"
                  style={{
                    display: 'block',
                    padding: 'var(--space-3, 12px) var(--space-4, 16px)',
                    borderRadius: 'var(--radius-lg, 12px)',
                    textDecoration: 'none',
                    border: isActive ? `1px solid ${color}` : '1px solid rgba(255,255,255,0.08)',
                    background: isActive ? 'rgba(0,196,188,0.06)' : undefined,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, color: '#FFFFFF', fontSize: '0.98rem' }}>{hit.doc.title}</span>
                    <span
                      style={{
                        fontSize: '0.62rem',
                        fontWeight: 800,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        padding: '2px 8px',
                        borderRadius: 9999,
                        background: `${color}1A`,
                        border: `1px solid ${color}55`,
                        color,
                      }}
                    >
                      {SEARCH_TYPE_LABEL[hit.doc.type]}
                    </span>
                    {hit.doc.subtitle && (
                      <span style={{ fontSize: '0.74rem', color: 'var(--silver, #A8B4C0)' }}>{hit.doc.subtitle}</span>
                    )}
                    {hit.doc.badge && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--silver, #A8B4C0)', marginLeft: 'auto' }}>
                        {hit.doc.badge}
                      </span>
                    )}
                  </div>
                  {hit.snippet && (
                    <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--silver, #A8B4C0)', lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {hit.snippet}
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
