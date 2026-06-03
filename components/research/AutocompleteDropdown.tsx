'use client';

/**
 * AutocompleteDropdown -- rendered below the GlobalSearchBar. Three sections:
 * Recent, Compounds, Areas And Glossary. Mouse + keyboard navigation. Each
 * row shows display name, blurb, and a small evidence-tier dot for compounds.
 */

import { useEffect, useState } from 'react';
import { History, FlaskConical, BookOpen } from 'lucide-react';
import { evidenceTier, wadaLabel } from '@/lib/compounds';

export interface Suggestion {
  slug: string;
  display_name: string;
  kind: 'compound' | 'area' | 'glossary';
  evidence_tier?: string;
  wada_status?: string;
  blurb?: string;
}

export default function AutocompleteDropdown({
  suggestions,
  recent,
  onSelect,
  onSelectRecent,
}: {
  suggestions: Suggestion[];
  recent: string[];
  onSelect: (s: Suggestion) => void;
  onSelectRecent: (text: string) => void;
}) {
  const compounds = suggestions.filter((s) => s.kind === 'compound');
  const areasAndGlossary = suggestions.filter((s) => s.kind === 'area' || s.kind === 'glossary');

  const flat: Array<{ type: 'recent' | 'sug'; text?: string; sug?: Suggestion }> = [
    ...recent.map((t) => ({ type: 'recent' as const, text: t })),
    ...compounds.map((s) => ({ type: 'sug' as const, sug: s })),
    ...areasAndGlossary.map((s) => ({ type: 'sug' as const, sug: s })),
  ];

  const [focusIdx, setFocusIdx] = useState(-1);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusIdx((i) => Math.min(flat.length - 1, i + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusIdx((i) => Math.max(-1, i - 1));
      } else if (e.key === 'Enter' && focusIdx >= 0 && focusIdx < flat.length) {
        e.preventDefault();
        const item = flat[focusIdx];
        if (item.type === 'recent' && item.text) onSelectRecent(item.text);
        else if (item.type === 'sug' && item.sug) onSelect(item.sug);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flat, focusIdx, onSelect, onSelectRecent]);

  if (flat.length === 0) return null;

  let runningIdx = 0;
  const sectionHeader: React.CSSProperties = {
    fontSize: 10,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#A8B4C0',
    fontWeight: 700,
    padding: '10px 14px 4px',
  };

  const rowBase: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    padding: '10px 14px',
    background: 'transparent',
    border: 'none',
    color: '#FFFFFF',
    textAlign: 'left',
    cursor: 'pointer',
  };

  return (
    <div
      role="listbox"
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        marginTop: 6,
        background: 'rgba(15,25,35,0.96)',
        border: '1px solid rgba(168,180,192,0.25)',
        borderRadius: 12,
        boxShadow: '0 18px 40px rgba(0,0,0,0.5)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        maxHeight: 460,
        overflowY: 'auto',
        zIndex: 1000,
      }}
    >
      {recent.length > 0 && (
        <>
          <div style={sectionHeader}>Recent</div>
          {recent.map((t) => {
            const idx = runningIdx++;
            const active = idx === focusIdx;
            return (
              <button
                key={`r-${t}`}
                type="button"
                onClick={() => onSelectRecent(t)}
                onMouseEnter={() => setFocusIdx(idx)}
                style={{
                  ...rowBase,
                  background: active ? 'rgba(0,196,188,0.10)' : 'transparent',
                }}
              >
                <History size={14} color="#A8B4C0" aria-hidden="true" />
                <span style={{ fontSize: 14 }}>{t}</span>
              </button>
            );
          })}
        </>
      )}

      {compounds.length > 0 && (
        <>
          <div style={sectionHeader}>Compounds</div>
          {compounds.map((s) => {
            const idx = runningIdx++;
            const active = idx === focusIdx;
            const tier = s.evidence_tier ? evidenceTier(s.evidence_tier) : null;
            return (
              <button
                key={`c-${s.slug}`}
                type="button"
                onClick={() => onSelect(s)}
                onMouseEnter={() => setFocusIdx(idx)}
                style={{
                  ...rowBase,
                  background: active ? 'rgba(0,196,188,0.10)' : 'transparent',
                }}
              >
                <FlaskConical size={14} color="#00C4BC" aria-hidden="true" />
                <span style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 2, minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{s.display_name}</span>
                    {tier && (
                      <span
                        style={{
                          display: 'inline-block',
                          width: 8,
                          height: 8,
                          borderRadius: 999,
                          background: tier.color,
                        }}
                        title={tier.label}
                        aria-label={tier.label}
                      />
                    )}
                    {s.wada_status && (s.wada_status === 'prohibited' || s.wada_status === 'prohibited_males') && (
                      <span style={{ fontSize: 10, color: '#E53E3E', fontWeight: 700 }}>
                        {wadaLabel(s.wada_status)}
                      </span>
                    )}
                  </span>
                  {s.blurb && (
                    <span style={{ fontSize: 12, color: '#A8B4C0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.blurb}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </>
      )}

      {areasAndGlossary.length > 0 && (
        <>
          <div style={sectionHeader}>Areas And Glossary</div>
          {areasAndGlossary.map((s) => {
            const idx = runningIdx++;
            const active = idx === focusIdx;
            return (
              <button
                key={`a-${s.kind}-${s.slug}`}
                type="button"
                onClick={() => onSelect(s)}
                onMouseEnter={() => setFocusIdx(idx)}
                style={{
                  ...rowBase,
                  background: active ? 'rgba(0,196,188,0.10)' : 'transparent',
                }}
              >
                <BookOpen size={14} color="#D6BCFA" aria-hidden="true" />
                <span style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 2, minWidth: 0 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{s.display_name}</span>
                  {s.blurb && (
                    <span style={{ fontSize: 12, color: '#A8B4C0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.blurb}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </>
      )}
    </div>
  );
}
