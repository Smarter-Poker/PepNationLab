/**
 * Citation export -- format reference rows into BibTeX, RIS, EndNote, and
 * plain-text strings. Pure functions, no IO.
 */

export interface ReferenceLike {
  authors?: string | string[] | null;
  title?: string | null;
  journal?: string | null;
  year?: number | string | null;
  pmid?: string | null;
  doi?: string | null;
  url?: string | null;
  ref_type?: string | null;
  volume?: string | null;
  pages?: string | null;
}

function authorsToList(a: ReferenceLike['authors']): string[] {
  if (!a) return [];
  if (Array.isArray(a)) return a.map((x) => String(x).trim()).filter(Boolean);
  return String(a)
    .split(/[;,]\s*(?=[A-Z])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function slugifyKey(ref: ReferenceLike): string {
  const firstAuthor = authorsToList(ref.authors)[0] ?? 'anon';
  const lastName = firstAuthor.split(/\s+/).slice(-1)[0] ?? 'anon';
  const year = ref.year ? String(ref.year) : 'nd';
  return `${lastName.toLowerCase().replace(/[^a-z0-9]/g, '')}${year}`;
}

export function toBibtex(ref: ReferenceLike): string {
  const key = slugifyKey(ref);
  const fields: string[] = [];
  const authors = authorsToList(ref.authors).join(' and ');
  if (authors) fields.push(`  author = {${authors}}`);
  if (ref.title) fields.push(`  title = {${ref.title}}`);
  if (ref.journal) fields.push(`  journal = {${ref.journal}}`);
  if (ref.year) fields.push(`  year = {${ref.year}}`);
  if (ref.volume) fields.push(`  volume = {${ref.volume}}`);
  if (ref.pages) fields.push(`  pages = {${ref.pages}}`);
  if (ref.doi) fields.push(`  doi = {${ref.doi}}`);
  if (ref.url) fields.push(`  url = {${ref.url}}`);
  if (ref.pmid) fields.push(`  note = {PMID: ${ref.pmid}}`);
  const type = (ref.ref_type ?? 'article').toLowerCase() === 'book' ? 'book' : 'article';
  return `@${type}{${key},\n${fields.join(',\n')}\n}`;
}

export function toRis(ref: ReferenceLike): string {
  const lines: string[] = [];
  const type = (ref.ref_type ?? 'article').toLowerCase();
  const tyMap: Record<string, string> = {
    article: 'JOUR',
    journal: 'JOUR',
    book: 'BOOK',
    conference: 'CONF',
    preprint: 'GEN',
    review: 'JOUR',
  };
  lines.push(`TY  - ${tyMap[type] ?? 'JOUR'}`);
  for (const a of authorsToList(ref.authors)) lines.push(`AU  - ${a}`);
  if (ref.title) lines.push(`TI  - ${ref.title}`);
  if (ref.journal) lines.push(`JO  - ${ref.journal}`);
  if (ref.year) lines.push(`PY  - ${ref.year}`);
  if (ref.volume) lines.push(`VL  - ${ref.volume}`);
  if (ref.pages) lines.push(`SP  - ${ref.pages}`);
  if (ref.doi) lines.push(`DO  - ${ref.doi}`);
  if (ref.url) lines.push(`UR  - ${ref.url}`);
  if (ref.pmid) lines.push(`AN  - ${ref.pmid}`);
  lines.push('ER  - ');
  return lines.join('\n');
}

export function toEndnote(ref: ReferenceLike): string {
  const lines: string[] = [];
  const type = (ref.ref_type ?? 'article').toLowerCase();
  const en: Record<string, string> = {
    article: 'Journal Article',
    journal: 'Journal Article',
    book: 'Book',
    conference: 'Conference Paper',
    preprint: 'Manuscript',
    review: 'Journal Article',
  };
  lines.push(`%0 ${en[type] ?? 'Journal Article'}`);
  for (const a of authorsToList(ref.authors)) lines.push(`%A ${a}`);
  if (ref.title) lines.push(`%T ${ref.title}`);
  if (ref.journal) lines.push(`%J ${ref.journal}`);
  if (ref.year) lines.push(`%D ${ref.year}`);
  if (ref.volume) lines.push(`%V ${ref.volume}`);
  if (ref.pages) lines.push(`%P ${ref.pages}`);
  if (ref.doi) lines.push(`%R ${ref.doi}`);
  if (ref.url) lines.push(`%U ${ref.url}`);
  if (ref.pmid) lines.push(`%M ${ref.pmid}`);
  return lines.join('\n');
}

export function toPlainText(ref: ReferenceLike): string {
  const parts: string[] = [];
  const authors = authorsToList(ref.authors);
  if (authors.length) {
    parts.push(authors.join(', ') + '.');
  }
  if (ref.title) parts.push(`${ref.title}.`);
  const tail: string[] = [];
  if (ref.journal) tail.push(ref.journal);
  if (ref.year) tail.push(String(ref.year));
  if (ref.volume) tail.push(`Vol. ${ref.volume}`);
  if (ref.pages) tail.push(`pp. ${ref.pages}`);
  if (tail.length) parts.push(tail.join(', ') + '.');
  if (ref.doi) parts.push(`DOI: ${ref.doi}.`);
  if (ref.pmid) parts.push(`PMID: ${ref.pmid}.`);
  if (ref.url && !ref.doi) parts.push(ref.url);
  return parts.join(' ');
}
