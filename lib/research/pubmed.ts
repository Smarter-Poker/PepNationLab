/**
 * Lightweight NCBI E-utilities client.
 *
 * Uses public endpoints:
 *   esearch.fcgi — ID list for a query
 *   efetch.fcgi  — full article records for given PMIDs
 *
 * Rate limit: 3 requests/second without an API key, 10 req/s with one
 * (PUBMED_API_KEY env). The client never throws — it returns null on
 * network or parse failure so callers (the weekly cron) can move on to
 * the next compound.
 *
 * Used by:
 *   app/api/cron/pubmed-sync/route.ts
 */

const EUTILS_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

export interface EsearchResult {
  pmids: string[];
  total: number;
  raw: unknown;
}

export interface EfetchArticle {
  pmid: string;
  title: string | null;
  authors: string[];
  journal: string | null;
  year: number | null;
  abstract: string | null;
  doi: string | null;
}

export interface EsearchOptions {
  retmax?: number;
  sort?: 'relevance' | 'pub_date' | 'first_author';
  mindate?: string;
  maxdate?: string;
  signal?: AbortSignal;
}

function apiKeyParam(): string {
  const key = (process.env.PUBMED_API_KEY ?? '').trim();
  return key ? `&api_key=${encodeURIComponent(key)}` : '';
}

function extractTag(xml: string, tag: string): string | null {
  const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i').exec(xml);
  if (!m) return null;
  return m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() || null;
}

function extractAll(xml: string, tag: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const stripped = m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (stripped) out.push(stripped);
  }
  return out;
}

export async function esearch(
  term: string,
  opts: EsearchOptions = {},
): Promise<EsearchResult | null> {
  const trimmed = (term || '').trim();
  if (!trimmed) return null;

  const retmax = Math.max(1, Math.min(200, opts.retmax ?? 50));
  const sort = opts.sort ?? 'relevance';
  const params = new URLSearchParams({
    db: 'pubmed',
    term: trimmed,
    retmax: String(retmax),
    retmode: 'json',
    sort,
  });
  if (opts.mindate) params.set('mindate', opts.mindate);
  if (opts.maxdate) params.set('maxdate', opts.maxdate);

  const url = `${EUTILS_BASE}/esearch.fcgi?${params.toString()}${apiKeyParam()}`;

  try {
    const resp = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: opts.signal,
    });
    if (!resp.ok) return null;
    const json = (await resp.json()) as {
      esearchresult?: { idlist?: string[]; count?: string };
    };
    const idlist = json?.esearchresult?.idlist ?? [];
    const total = Number(json?.esearchresult?.count ?? idlist.length);
    return {
      pmids: Array.isArray(idlist) ? idlist : [],
      total: Number.isFinite(total) ? total : idlist.length,
      raw: json,
    };
  } catch {
    return null;
  }
}

export async function efetch(
  pmids: string[],
  opts: { signal?: AbortSignal } = {},
): Promise<EfetchArticle[] | null> {
  const cleaned = (pmids || []).filter((p) => /^\d+$/.test(p));
  if (cleaned.length === 0) return [];

  const params = new URLSearchParams({
    db: 'pubmed',
    id: cleaned.join(','),
    retmode: 'xml',
  });
  const url = `${EUTILS_BASE}/efetch.fcgi?${params.toString()}${apiKeyParam()}`;

  try {
    const resp = await fetch(url, { signal: opts.signal });
    if (!resp.ok) return null;
    const xml = await resp.text();

    const articles: EfetchArticle[] = [];
    const articleRe = /<PubmedArticle>([\s\S]*?)<\/PubmedArticle>/g;
    let m: RegExpExecArray | null;
    while ((m = articleRe.exec(xml)) !== null) {
      const block = m[1];
      const pmid = extractTag(block, 'PMID') ?? '';
      if (!pmid) continue;
      const title = extractTag(block, 'ArticleTitle');
      const journal = extractTag(block, 'Title');
      const yearStr = extractTag(block, 'Year');
      const year = yearStr ? Number(yearStr) : null;
      const abstract =
        extractAll(block, 'AbstractText').join(' ').trim() || null;
      const authors = extractAll(block, 'LastName').slice(0, 12);
      const doiMatch = /<ArticleId IdType="doi">([^<]+)<\/ArticleId>/i.exec(block);
      const doi = doiMatch ? doiMatch[1].trim() : null;
      articles.push({
        pmid,
        title,
        authors,
        journal,
        year: Number.isFinite(year as number) ? (year as number) : null,
        abstract,
        doi,
      });
    }
    return articles;
  } catch {
    return null;
  }
}
