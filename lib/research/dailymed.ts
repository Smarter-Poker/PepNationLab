/**
 * NLM DailyMed REST client. https://dailymed.nlm.nih.gov/dailymed/services/
 * Provides Structured Product Labels (SPL). Used to populate
 * compounds.dailymed_setid and the label-section provenance row in
 * compound_references.
 */

const DM_BASE = 'https://dailymed.nlm.nih.gov/dailymed/services/v2';

export interface SplHit {
  setid: string;
  title: string | null;
  effective_time: string | null;
  splset_name: string | null;
}

export interface SplFull {
  setid: string;
  title: string | null;
  effective_time: string | null;
  indications: string | null;
  contraindications: string | null;
  warnings: string | null;
  boxed_warning: string | null;
  raw: unknown;
}

function extractTag(xml: string, tag: string): string | null {
  const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i').exec(xml);
  if (!m) return null;
  return m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() || null;
}

function extractSection(xml: string, codeRegex: RegExp): string | null {
  const re = new RegExp(`<section[^>]*>[\\s\\S]*?</section>`, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    if (codeRegex.test(m[0])) {
      const text = m[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (text) return text.slice(0, 4000);
    }
  }
  return null;
}

export async function searchSpl(generic_name: string): Promise<SplHit[]> {
  const g = (generic_name || '').trim();
  if (!g) return [];
  try {
    const params = new URLSearchParams({
      drug_name: g,
      pagesize: '10',
    });
    const resp = await fetch(`${DM_BASE}/spls.json?${params.toString()}`);
    if (!resp.ok) return [];
    const json = (await resp.json()) as { data?: unknown[] };
    const arr = Array.isArray(json?.data) ? json.data : [];
    const out: SplHit[] = [];
    for (const r of arr as Record<string, unknown>[]) {
      const setid = typeof r.setid === 'string' ? r.setid : null;
      if (!setid) continue;
      out.push({
        setid,
        title: typeof r.title === 'string' ? r.title : null,
        effective_time: typeof r.spl_version === 'string' ? r.spl_version : null,
        splset_name: typeof r.splset_name === 'string' ? r.splset_name : null,
      });
    }
    return out;
  } catch {
    return [];
  }
}

export async function getSplBySetId(setid: string): Promise<SplFull | null> {
  const id = (setid || '').trim();
  if (!id) return null;
  try {
    const resp = await fetch(`${DM_BASE}/spls/${encodeURIComponent(id)}.xml`);
    if (!resp.ok) return null;
    const xml = await resp.text();
    return {
      setid: id,
      title: extractTag(xml, 'title'),
      effective_time: extractTag(xml, 'effectiveTime'),
      indications: extractSection(xml, /34067-9|INDICATIONS/i),
      contraindications: extractSection(xml, /34070-3|CONTRAINDICATIONS/i),
      warnings: extractSection(xml, /34071-1|WARNINGS/i),
      boxed_warning: extractSection(xml, /34066-1|BOXED WARNING/i),
      raw: { length: xml.length },
    };
  } catch {
    return null;
  }
}
