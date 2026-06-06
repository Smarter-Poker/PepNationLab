/**
 * GlossaryText - pure presentational. Wraps any known glossary term found in
 * `text` in an <abbr> with a dotted underline + title tooltip definition. Builds
 * an array of React nodes (no dangerouslySetInnerHTML). If no terms match, the
 * text renders unchanged.
 *
 * The tooltip dictionary merges the curated short map in lib/compounds (GLOSSARY)
 * with the full 65-term data-center glossary (PEPTIDE_GLOSSARY), so every
 * monograph paragraph can surface plain-language definitions on hover. The
 * curated map wins on conflict to preserve its tighter phrasing.
 */
import React from 'react';
import { GLOSSARY } from '@/lib/compounds';
import { PEPTIDE_GLOSSARY } from '@/lib/research-education';

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Build the merged lowercase term -> definition map once at module load.
const TOOLTIP_TERMS: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const { term, def } of PEPTIDE_GLOSSARY) {
    map[term.toLowerCase()] = def;
    // Also index a paren-stripped alias, e.g. "GHS-R1a (Ghrelin Receptor)" -> "ghs-r1a".
    const base = term.replace(/\s*\(.*\)\s*$/, '').trim();
    if (base && base !== term) map[base.toLowerCase()] = def;
  }
  // Curated short definitions override where they overlap.
  for (const k of Object.keys(GLOSSARY)) map[k.toLowerCase()] = GLOSSARY[k];
  return map;
})();

export default function GlossaryText({ text }: { text: string }) {
  if (!text) return null;

  // Longest terms first so multi-word terms win over substrings.
  const terms = Object.keys(TOOLTIP_TERMS).sort((a, b) => b.length - a.length);
  if (terms.length === 0) return <>{text}</>;

  const pattern = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'gi');
  const parts = text.split(pattern);

  const nodes: React.ReactNode[] = [];
  parts.forEach((part, i) => {
    if (!part) return;
    const def = TOOLTIP_TERMS[part.toLowerCase()];
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
