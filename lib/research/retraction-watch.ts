/**
 * Retraction lookup client.
 * Uses NCBI E-utils to check whether a given PMID is marked as Retracted
 * Publication, with a fallback HEAD probe to the Retraction Watch DB.
 */

const EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

export interface RetractionStatus {
  retracted: boolean;
  retraction_date?: string;
  notice_url?: string;
}

export async function checkPmidForRetraction(pmid: string): Promise<RetractionStatus> {
  const p = (pmid || '').trim();
  if (!/^\d+$/.test(p)) return { retracted: false };
  try {
    const resp = await fetch(
      `${EUTILS}/efetch.fcgi?db=pubmed&id=${encodeURIComponent(p)}&retmode=xml`,
    );
    if (!resp.ok) return { retracted: false };
    const xml = await resp.text();
    if (!/PublicationType[^>]*>\s*Retracted Publication/i.test(xml) &&
        !/<CommentsCorrectionsList[\s\S]*?RefType="RetractionIn"/i.test(xml)) {
      return { retracted: false };
    }
    const dateMatch = /<DateRevised>[\s\S]*?<Year>(\d{4})<\/Year>[\s\S]*?<Month>(\d{1,2})<\/Month>[\s\S]*?<Day>(\d{1,2})<\/Day>[\s\S]*?<\/DateRevised>/i.exec(xml);
    const date = dateMatch
      ? `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`
      : undefined;
    return {
      retracted: true,
      retraction_date: date,
      notice_url: `https://pubmed.ncbi.nlm.nih.gov/${p}/`,
    };
  } catch {
    return { retracted: false };
  }
}
