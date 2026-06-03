/**
 * Google-style query parser for the Research Library FTS engine.
 *
 * Supports:
 *   - "quoted phrase"          -> exact phrase match
 *   - field:value             -> scoped filter (mechanism:GLP-1, tier:approved_drug,
 *                                wada:prohibited, mw:>3000, area:weight_management,
 *                                class:peptide, risk:low, half_life:<2)
 *   - +required  -term        -> Google +/- operators
 *   - AND, OR, NOT            -> boolean operators (case-insensitive)
 *   - prefix*                 -> wildcard suffix
 *   - bare token              -> plain term, ANDed with everything else
 *
 * Pure module — no IO, safe in client or server.
 *
 * Consumers (new in v3):
 *   - app/api/research/search/route.ts
 *   - app/api/research/suggest/route.ts
 *   - app/api/research/instant-answer/route.ts
 *   - components/research/SearchResults.tsx
 *   - components/research/AutocompleteDropdown.tsx
 */

export type FilterOp = 'eq' | 'gt' | 'lt' | 'gte' | 'lte' | 'in';

export interface FieldFilter {
  field: string;
  op: FilterOp;
  value: string | number;
}

export interface ParsedQuery {
  terms: string[];
  phrases: string[];
  required: string[];
  excluded: string[];
  wildcards: string[];
  filters: FieldFilter[];
  raw: string;
  normalized: string;
}

const KNOWN_FIELDS = new Set([
  'mechanism', 'tier', 'evidence', 'wada', 'class', 'category', 'area',
  'risk', 'mw', 'half_life', 'route', 'target', 'glp1', 'angiogenic', 'stack', 'hl',
]);

const FIELD_NORMALIZATION: Record<string, string> = {
  evidence: 'tier',
  category: 'class',
  area: 'research_area',
  target: 'molecular_target',
  half_life: 'half_life_hours',
  hl: 'half_life_hours',
};

function normalizeQuery(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s:>"<*+\-./]/g, '');
}

function parseFieldValue(raw: string): FieldFilter | null {
  const m = /^([a-z_]+):(>=|<=|>|<)?([^\s]+)$/i.exec(raw);
  if (!m) return null;
  const fieldRaw = m[1].toLowerCase();
  const opSym = m[2];
  const valueRaw = m[3];
  if (!KNOWN_FIELDS.has(fieldRaw)) return null;
  const field = FIELD_NORMALIZATION[fieldRaw] ?? fieldRaw;
  let op: FilterOp = 'eq';
  if (opSym === '>') op = 'gt';
  else if (opSym === '<') op = 'lt';
  else if (opSym === '>=') op = 'gte';
  else if (opSym === '<=') op = 'lte';
  const asNum = Number(valueRaw);
  const value: string | number =
    !Number.isNaN(asNum) && /^-?\d/.test(valueRaw) ? asNum : valueRaw.toLowerCase();
  return { field, op, value };
}

function tokenize(raw: string): string[] {
  const tokens: string[] = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    if (m[1] !== undefined) tokens.push(`"${m[1]}"`);
    else if (m[2] !== undefined) tokens.push(m[2]);
  }
  return tokens;
}

export function parseQuery(raw: string): ParsedQuery {
  const trimmed = (raw ?? '').trim();
  const parsed: ParsedQuery = {
    terms: [],
    phrases: [],
    required: [],
    excluded: [],
    wildcards: [],
    filters: [],
    raw: trimmed,
    normalized: normalizeQuery(trimmed),
  };
  if (!trimmed) return parsed;

  const tokens = tokenize(trimmed);
  for (const tokRaw of tokens) {
    const upper = tokRaw.toUpperCase();
    if (upper === 'AND' || upper === 'OR' || upper === 'NOT') continue;
    if (tokRaw.startsWith('"') && tokRaw.endsWith('"') && tokRaw.length >= 2) {
      const inner = tokRaw.slice(1, -1).trim();
      if (inner) parsed.phrases.push(inner);
      continue;
    }
    if (tokRaw.startsWith('-') && tokRaw.length > 1) {
      parsed.excluded.push(tokRaw.slice(1).toLowerCase());
      continue;
    }
    if (tokRaw.startsWith('+') && tokRaw.length > 1) {
      parsed.required.push(tokRaw.slice(1).toLowerCase());
      continue;
    }
    if (tokRaw.endsWith('*') && tokRaw.length > 1) {
      parsed.wildcards.push(tokRaw.slice(0, -1).toLowerCase());
      continue;
    }
    if (tokRaw.includes(':')) {
      const filter = parseFieldValue(tokRaw);
      if (filter) {
        parsed.filters.push(filter);
        continue;
      }
    }
    parsed.terms.push(tokRaw.toLowerCase());
  }
  return parsed;
}

export function buildTsquery(parsed: ParsedQuery): string {
  function clean(t: string): string {
    return t.replace(/[^a-z0-9_\-]/gi, '');
  }
  const atoms: string[] = [];
  for (const phrase of parsed.phrases) {
    const words = phrase.split(/\s+/).map(clean).filter(Boolean);
    if (words.length === 0) continue;
    atoms.push('(' + words.join(' <-> ') + ')');
  }
  for (const term of parsed.required) {
    const c = clean(term);
    if (c) atoms.push(c);
  }
  for (const term of parsed.terms) {
    const c = clean(term);
    if (c) atoms.push(c);
  }
  for (const w of parsed.wildcards) {
    const c = clean(w);
    if (c) atoms.push(`${c}:*`);
  }
  let q = atoms.join(' & ');
  for (const excl of parsed.excluded) {
    const c = clean(excl);
    if (c) q = q ? `${q} & !${c}` : `!${c}`;
  }
  return q;
}

export function buildAutoWildcardTsquery(parsed: ParsedQuery): string {
  const base = buildTsquery(parsed);
  if (
    parsed.phrases.length === 0 &&
    parsed.wildcards.length === 0 &&
    parsed.terms.length + parsed.required.length === 1
  ) {
    const lone = [...parsed.required, ...parsed.terms][0];
    const c = lone.replace(/[^a-z0-9_\-]/gi, '');
    if (c) return base ? `${base} | ${c}:*` : `${c}:*`;
  }
  return base;
}
