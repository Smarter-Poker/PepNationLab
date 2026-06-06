'use client';

/**
 * LandingSearchOverlay - the live, in-place search for the image-hotspot research
 * landing page. Renders the search input + button at the baked-in search-bar
 * coordinates, and shows an instant results dropdown as the user types (lazy-
 * loading the universal index from /research/search-index on first focus).
 * Enter or a result click navigates in-app; the button opens the full results
 * page. Research-use-only.
 */

import { useRef, useState } from 'react';
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
  tool: '#E8C07D',
};

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
  const [docs, setDocs] = useState<SearchDoc[]>([]);
  const [open, setOpen] = useState(false);
  const fetched = useRef(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function ensureIndex() {
    if (fetched.current) return;
    fetched.current = true;
    try {
      const res = await fetch('/research/search-index');
      const json = await res.json();
      if (Array.isArray(json?.docs)) setDocs(json.docs as SearchDoc[]);
    } catch {
      fetched.current = false; // allow retry on next focus
    }
  }

  const results = q.trim().length >= 2 ? searchDocs(q, docs, 8) : [];

  function goFull() {
    if (q.trim()) router.push(`/research/catalog?q=${encodeURIComponent(q.trim())}`);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (results.length > 0) router.push(results[0].doc.url);
    else goFull();
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
            setOpen(true);
            ensureIndex();
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
            padding: '0 12px 0 12px',
            ...inputStyle,
          }}
        />
      </form>

      {/* Search button */}
      <div
        onClick={goFull}
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
      {open && q.trim().length >= 2 && (
        <div
          onMouseDown={(e) => e.preventDefault()}
          style={{
            position: 'absolute',
            top: '31.6%',
            left: '7.5%',
            width: '85%',
            maxHeight: '46%',
            overflowY: 'auto',
            zIndex: 30,
            background: '#0b1219',
            border: '1px solid rgba(0,196,188,0.35)',
            borderRadius: '14px',
            boxShadow: '0 18px 50px rgba(0,0,0,0.6)',
            WebkitOverflowScrolling: 'touch',
            ...resultsStyle,
          }}
        >
          {results.length === 0 ? (
            <div style={{ padding: '14px 16px', color: '#A8B4C0', fontSize: '0.85rem' }}>
              No Matches - Press Enter To Browse The Catalog.
            </div>
          ) : (
            results.map((hit) => {
              const color = TYPE_COLOR[hit.doc.type];
              return (
                <button
                  key={hit.doc.id}
                  type="button"
                  onClick={() => router.push(hit.doc.url)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    padding: '11px 16px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, color: '#FFFFFF', fontSize: '0.92rem' }}>{hit.doc.title}</span>
                    <span
                      style={{
                        fontSize: '0.58rem',
                        fontWeight: 800,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        padding: '2px 7px',
                        borderRadius: 9999,
                        background: `${color}1A`,
                        border: `1px solid ${color}55`,
                        color,
                      }}
                    >
                      {SEARCH_TYPE_LABEL[hit.doc.type]}
                    </span>
                    {hit.doc.subtitle && (
                      <span style={{ fontSize: '0.7rem', color: '#A8B4C0' }}>{hit.doc.subtitle}</span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </>
  );
}
