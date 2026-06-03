/**
 * Europe PMC REST client. https://www.ebi.ac.uk/europepmc/webservices/rest/
 * Surfaces open-access full text PDFs missing from PubMed E-utils.
 */

const EPMC_BASE = 'https://www.ebi.ac.uk/europepmc/webservices/rest';

export interface EpmcHit {
  pmcid: string;
  pmid: string | null;
  title: string;
  authors: string;
  year: number | null;
  journal: string | null;
  pdf_url: string | null;
  abstract: string | null;
}

export async function searchOpenAccess(query: string): Promise<EpmcHit[]> {
  const q = (query || '').trim();
  if (!q) return [];
  try {
    const params = new URLSearchParams({
      query: `${q} AND OPEN_ACCESS:y`,
      format: 'json',
      resultType: 'core',
      pageSize: '25',
    });
    const resp = await fetch(`${EPMC_BASE}/search?${params.toString()}`);
    if (!resp.ok) return [];
    const json = (await resp.json()) as { resultList?: { result?: unknown[] } };
    const arr = Array.isArray(json?.resultList?.result) ? json.resultList!.result! : [];
    const out: EpmcHit[] = [];
    for (const r of arr as Record<string, unknown>[]) {
      const pmcid = typeof r.pmcid === 'string' ? (r.pmcid as string) : null;
      if (!pmcid) continue;
      const ft = Array.isArray(r.fullTextUrlList)
        ? r.fullTextUrlList
        : ((r.fullTextUrlList as Record<string, unknown>)?.fullTextUrl as unknown[]) ?? [];
      const ftArr = Array.isArray(ft) ? ft : [];
      let pdf_url: string | null = null;
      for (const u of ftArr as Record<string, unknown>[]) {
        if (u.documentStyle === 'pdf' && typeof u.url === 'string') {
          pdf_url = u.url;
          break;
        }
      }
      out.push({
        pmcid,
        pmid: typeof r.pmid === 'string' ? (r.pmid as string) : null,
        title: typeof r.title === 'string' ? (r.title as string) : '',
        authors: typeof r.authorString === 'string' ? (r.authorString as string) : '',
        year: typeof r.pubYear === 'string' ? Number(r.pubYear) || null : null,
        journal: typeof r.journalTitle === 'string' ? (r.journalTitle as string) : null,
        pdf_url,
        abstract: typeof r.abstractText === 'string' ? (r.abstractText as string) : null,
      });
    }
    return out;
  } catch {
    return [];
  }
}
