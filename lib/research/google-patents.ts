/**
 * Google Patents lightweight search wrapper.
 * https://patents.google.com/?q=  (the public results page)
 *
 * Google does not publish a stable JSON API for patents; the JSON-LD
 * embedded in the results HTML is parsed here as a best effort. Returns
 * [] on any network or parse failure.
 */

export interface PatentHit {
  patent_number: string;
  title: string | null;
  applicant: string | null;
  filing_date: string | null;
  publication_date: string | null;
  expiry_estimate: string | null;
  url: string;
}

export async function searchPatents(query: string): Promise<PatentHit[]> {
  const q = (query || '').trim();
  if (!q) return [];
  try {
    const url = `https://patents.google.com/?q=${encodeURIComponent(q)}`;
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 PepNationLab-Research-Bot/1.0 (+https://pepnationlab.com)',
        Accept: 'text/html',
      },
    });
    if (!resp.ok) return [];
    const html = await resp.text();
    const out: PatentHit[] = [];
    const ldMatches = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) ?? [];
    for (const raw of ldMatches) {
      const jsonText = raw.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');
      try {
        const obj = JSON.parse(jsonText) as Record<string, unknown>;
        const list = Array.isArray(obj.itemListElement) ? (obj.itemListElement as unknown[]) : [];
        for (const item of list as Record<string, unknown>[]) {
          const it = (item.item as Record<string, unknown>) ?? item;
          const num = typeof it.patentNumber === 'string' ? (it.patentNumber as string) : null;
          if (!num) continue;
          out.push({
            patent_number: num,
            title: typeof it.name === 'string' ? (it.name as string) : null,
            applicant: typeof it.assignee === 'string' ? (it.assignee as string) : null,
            filing_date: typeof it.applicationDate === 'string' ? (it.applicationDate as string) : null,
            publication_date: typeof it.datePublished === 'string' ? (it.datePublished as string) : null,
            expiry_estimate: null,
            url: `https://patents.google.com/patent/${num}`,
          });
          if (out.length >= 25) break;
        }
      } catch {
        // skip malformed ld+json blocks
      }
      if (out.length >= 25) break;
    }
    return out;
  } catch {
    return [];
  }
}
