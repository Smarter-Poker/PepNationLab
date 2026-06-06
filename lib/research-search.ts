/**
 * research-search - a pure, dependency-free universal search ranker for the
 * Research Library. It scores a flat list of SearchDoc records (compounds,
 * guides, FAQ, glossary terms, research areas, stacks) against a free-text
 * query with token, prefix, substring, keyword, and light fuzzy (edit-distance)
 * matching. Runs instantly client-side over a few hundred docs - no network.
 *
 * Research-use-only platform: this is a search index over factual reference
 * content; it produces no dosing or medical advice.
 */

export type SearchType = 'compound' | 'guide' | 'faq' | 'term' | 'area' | 'stack' | 'tool';

export interface SearchDoc {
  id: string;
  type: SearchType;
  title: string;
  subtitle?: string;
  url: string;
  /** Lowercased concatenated searchable body (summary / definition / answer). */
  haystack: string;
  /** Extra exact-ish match terms: aliases, search_keywords, match_phrases. */
  keywords?: string[];
  /** Small label shown on the result (e.g. evidence-tier label). */
  badge?: string;
}

export interface SearchHit {
  doc: SearchDoc;
  score: number;
  /** A short snippet of haystack around the first match, for display. */
  snippet: string;
}

const TYPE_WEIGHT: Record<SearchType, number> = {
  compound: 1.0,
  stack: 0.95,
  area: 0.9,
  tool: 0.9,
  guide: 0.85,
  term: 0.8,
  faq: 0.8,
};

export function normalize(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9\s+/-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokenize(s: string): string[] {
  return normalize(s).split(' ').filter(Boolean);
}

/** Bounded Levenshtein: returns distance, short-circuits above `max`. */
function editDistanceWithin(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev = new Array(b.length + 1);
  const curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > max) return max + 1;
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

function makeSnippet(haystack: string, query: string): string {
  if (!haystack) return '';
  const idx = haystack.toLowerCase().indexOf(query.toLowerCase());
  const start = idx < 0 ? 0 : Math.max(0, idx - 40);
  const slice = haystack.slice(start, start + 160).trim();
  return (start > 0 ? '… ' : '') + slice + (start + 160 < haystack.length ? ' …' : '');
}

/**
 * Score one document against the normalized query + its tokens.
 * Higher is better; 0 means no match.
 */
function scoreDoc(doc: SearchDoc, qNorm: string, qTokens: string[]): number {
  const title = normalize(doc.title);
  const titleTokens = title.split(' ').filter(Boolean);
  const kw = (doc.keywords || []).map(normalize);
  const hay = doc.haystack || '';
  let score = 0;

  // Whole-query title signals.
  if (title === qNorm) score += 120;
  else if (title.startsWith(qNorm)) score += 70;
  else if (title.includes(qNorm)) score += 45;

  // Keyword (alias / search term) signals.
  for (const k of kw) {
    if (!k) continue;
    if (k === qNorm) score += 80;
    else if (k.startsWith(qNorm)) score += 30;
    else if (k.includes(qNorm) && qNorm.length >= 3) score += 18;
  }

  // Per-token coverage.
  let covered = 0;
  for (const tok of qTokens) {
    if (tok.length < 2) continue;
    let tokHit = false;
    if (titleTokens.some((w) => w === tok)) { score += 22; tokHit = true; }
    else if (titleTokens.some((w) => w.startsWith(tok))) { score += 14; tokHit = true; }
    if (kw.some((k) => k.split(' ').some((w) => w === tok))) { score += 16; tokHit = true; }
    if (!tokHit && hay.includes(tok)) { score += 6; tokHit = true; }
    // Light fuzzy against title words for typos (len>=4, distance<=1).
    if (!tokHit && tok.length >= 4) {
      const close = titleTokens.some((w) => Math.abs(w.length - tok.length) <= 1 && editDistanceWithin(w, tok, 1) <= 1)
        || kw.some((k) => k.split(' ').some((w) => Math.abs(w.length - tok.length) <= 1 && editDistanceWithin(w, tok, 1) <= 1));
      if (close) { score += 10; tokHit = true; }
    }
    if (tokHit) covered++;
  }

  if (score === 0) return 0;
  // Bonus when every query token matched something.
  if (qTokens.length > 0 && covered === qTokens.length) score += 18;

  return score * TYPE_WEIGHT[doc.type];
}

export function searchDocs(query: string, docs: SearchDoc[], limit = 30): SearchHit[] {
  const qNorm = normalize(query);
  if (!qNorm) return [];
  const qTokens = tokenize(query);
  const hits: SearchHit[] = [];
  for (const doc of docs) {
    const score = scoreDoc(doc, qNorm, qTokens);
    if (score > 0) hits.push({ doc, score, snippet: makeSnippet(doc.haystack, qTokens[0] || qNorm) });
  }
  hits.sort((a, b) => b.score - a.score || a.doc.title.localeCompare(b.doc.title));
  return hits.slice(0, limit);
}

export const SEARCH_TYPE_LABEL: Record<SearchType, string> = {
  compound: 'Compound',
  stack: 'Stack',
  area: 'Research Area',
  tool: 'Tool',
  guide: 'Guide',
  term: 'Glossary',
  faq: 'FAQ',
};
