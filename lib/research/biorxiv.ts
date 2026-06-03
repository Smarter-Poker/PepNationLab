/**
 * bioRxiv + medRxiv preprint REST client. https://api.biorxiv.org/
 * Used by /api/cron/biorxiv-watch to surface new preprints daily.
 */

const BIORXIV_BASE = 'https://api.biorxiv.org';

export interface PreprintHit {
  doi: string;
  title: string;
  authors: string;
  posted_date: string;
  abstract: string;
  server: 'biorxiv' | 'medrxiv';
}

function isoDayOffset(daysBack: number): string {
  const d = new Date(Date.now() - daysBack * 86400000);
  return d.toISOString().slice(0, 10);
}

async function fetchServer(
  server: 'biorxiv' | 'medrxiv',
  query: string,
  daysBack: number,
): Promise<PreprintHit[]> {
  const fromDate = isoDayOffset(daysBack);
  const toDate = isoDayOffset(0);
  try {
    const resp = await fetch(
      `${BIORXIV_BASE}/details/${server}/${fromDate}/${toDate}/0/json`,
    );
    if (!resp.ok) return [];
    const json = (await resp.json()) as { collection?: unknown[] };
    const arr = Array.isArray(json?.collection) ? json.collection : [];
    const q = query.toLowerCase();
    const out: PreprintHit[] = [];
    for (const r of arr as Record<string, unknown>[]) {
      const doi = typeof r.doi === 'string' ? r.doi : null;
      const title = typeof r.title === 'string' ? r.title : '';
      const abs = typeof r.abstract === 'string' ? r.abstract : '';
      if (!doi || !title) continue;
      const hay = (title + ' ' + abs).toLowerCase();
      if (!hay.includes(q)) continue;
      out.push({
        doi,
        title,
        authors: typeof r.authors === 'string' ? r.authors : '',
        posted_date: typeof r.date === 'string' ? r.date : '',
        abstract: abs,
        server,
      });
      if (out.length >= 25) break;
    }
    return out;
  } catch {
    return [];
  }
}

export async function searchPreprints(
  query: string,
  daysBack = 90,
): Promise<PreprintHit[]> {
  const q = (query || '').trim();
  if (!q) return [];
  const days = Math.max(1, Math.min(365, daysBack));
  const [b, m] = await Promise.all([
    fetchServer('biorxiv', q, days),
    fetchServer('medrxiv', q, days),
  ]);
  return [...b, ...m];
}
