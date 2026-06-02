/**
 * GlossaryText — pure presentational. Wraps any GLOSSARY term found in `text`
 * in an <abbr> with a dotted underline + title tooltip definition. Builds an
 * array of React nodes (no dangerouslySetInnerHTML). If no terms match, the
 * text renders unchanged.
 */
import React from 'react';
import { GLOSSARY } from '@/lib/compounds';

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default function GlossaryText({ text }: { text: string }) {
  if (!text) return null;

  // Longest terms first so multi-word terms win over substrings.
  const terms = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length);
  if (terms.length === 0) return <>{text}</>;

  const pattern = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'gi');
  const parts = text.split(pattern);

  const nodes: React.ReactNode[] = [];
  parts.forEach((part, i) => {
    if (!part) return;
    const def = GLOSSARY[part.toLowerCase()];
    if (def) {
      nodes.push(
        <abbr
          key={i}
          title={def}
          style={{ textDecoration: 'underline dotted', cursor: 'help' }}
        >
          {part}
        </abbr>,
      );
    } else {
      nodes.push(<React.Fragment key={i}>{part}</React.Fragment>);
    }
  });

  return <>{nodes}</>;
}
