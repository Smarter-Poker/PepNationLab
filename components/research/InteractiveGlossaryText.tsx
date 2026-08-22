'use client';

import React, { useState } from 'react';
import { GLOSSARY } from '@/lib/compounds';

// Helper to escape regex special characters
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Convert term to Title Case for tooltip header
function toTitleCase(str: string): string {
  return str
    .split(/[- ]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

interface Props {
  text: string;
}

export default function InteractiveGlossaryText({ text }: Props) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // WCAG 1.4.13: the tooltip must be dismissable with Escape while shown,
  // whether it was triggered by hover or by keyboard focus.
  React.useEffect(() => {
    if (hoveredIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setHoveredIndex(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [hoveredIndex]);

  if (!text) return null;

  // Curated list of glossary terms sorted by descending length to prevent substring clashes
  const terms = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length);

  if (terms.length === 0) return <>{text}</>;

  // Regex pattern matching any of the glossary terms as boundary-aware words
  const pattern = new RegExp(`\\b(${terms.map(escapeRegExp).join('|')})\\b`, 'gi');
  const parts = text.split(pattern);

  const nodes: React.ReactNode[] = [];
  let partIndex = 0;

  parts.forEach((part) => {
    if (!part) return;

    const lowerPart = part.toLowerCase();
    const definition = GLOSSARY[lowerPart];

    if (definition) {
      const currentIndex = partIndex++;
      const titleText = toTitleCase(part);

      nodes.push(
        <span
          key={currentIndex}
          role="button"
          tabIndex={0}
          aria-expanded={hoveredIndex === currentIndex}
          style={{
            position: 'relative',
            display: 'inline-block',
            cursor: 'help',
          }}
          onMouseEnter={() => setHoveredIndex(currentIndex)}
          onMouseLeave={() => setHoveredIndex(null)}
          onFocus={() => setHoveredIndex(currentIndex)}
          onBlur={() => setHoveredIndex(null)}
          // Touch path: hover never fires on mobile and tap-to-focus is not
          // reliable across browsers, so an explicit tap toggles the
          // definition (second tap on the same term dismisses it).
          onClick={() => setHoveredIndex(hoveredIndex === currentIndex ? null : currentIndex)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setHoveredIndex(hoveredIndex === currentIndex ? null : currentIndex);
            }
          }}
        >
          <span
            style={{
              borderBottom: '1px dotted var(--teal, #00C4BC)',
              color: 'var(--teal, #00C4BC)',
              fontWeight: 500,
              transition: 'color 0.2s ease',
            }}
          >
            {part}
          </span>
          {hoveredIndex === currentIndex && (
            <span
              style={{
                position: 'absolute',
                bottom: '100%',
                left: '50%',
                transform: 'translateX(-50%)',
                marginBottom: '8px',
                width: '240px',
                padding: '12px 16px',
                background: 'rgba(22, 34, 48, 0.95)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 'var(--radius-md, 8px)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                zIndex: 1000,
                color: 'var(--silver, #A8B4C0)',
                fontSize: '0.78rem',
                lineHeight: '1.4',
                fontWeight: 400,
                textAlign: 'left',
                pointerEvents: 'none',
                display: 'block',
              }}
            >
              <strong
                style={{
                  display: 'block',
                  color: 'var(--white, #FFFFFF)',
                  fontSize: '0.85rem',
                  marginBottom: '4px',
                  fontWeight: 700,
                }}
              >
                {titleText}
              </strong>
              {definition}
              <span
                style={{
                  position: 'absolute',
                  bottom: '-5px',
                  left: '50%',
                  transform: 'translateX(-50%) rotate(45deg)',
                  width: '10px',
                  height: '10px',
                  background: 'rgba(22, 34, 48, 0.95)',
                  borderRight: '1px solid rgba(255, 255, 255, 0.1)',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              />
            </span>
          )}
        </span>
      );
    } else {
      nodes.push(<React.Fragment key={`text-${partIndex++}`}>{part}</React.Fragment>);
    }
  });

  return <>{nodes}</>;
}
