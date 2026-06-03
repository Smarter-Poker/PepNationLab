/**
 * NLM RxNorm RxNav REST client. https://rxnav.nlm.nih.gov/REST/
 * Used to populate the NDC + brand-name pulldowns and feed the RxNorm
 * cross-reference column on compounds.
 */

const RXNAV_BASE = 'https://rxnav.nlm.nih.gov/REST';

export interface RxcuiHit {
  rxcui: string;
  name: string;
}

export interface RelatedDrug {
  rxcui: string;
  name: string;
  tty: string;
}

export interface NdcInfo {
  ndc: string;
  status: string | null;
}

export async function findRxcuiByName(name: string): Promise<RxcuiHit | null> {
  const n = (name || '').trim();
  if (!n) return null;
  try {
    const resp = await fetch(
      `${RXNAV_BASE}/rxcui.json?name=${encodeURIComponent(n)}&search=1`,
    );
    if (!resp.ok) return null;
    const json = (await resp.json()) as {
      idGroup?: { name?: string; rxnormId?: string[] };
    };
    const id = json?.idGroup?.rxnormId?.[0];
    if (!id) return null;
    return { rxcui: id, name: json?.idGroup?.name ?? n };
  } catch {
    return null;
  }
}

export async function getRelatedDrugs(rxcui: string): Promise<RelatedDrug[]> {
  const id = (rxcui || '').trim();
  if (!id) return [];
  try {
    const resp = await fetch(
      `${RXNAV_BASE}/rxcui/${encodeURIComponent(id)}/allrelated.json`,
    );
    if (!resp.ok) return [];
    const json = (await resp.json()) as {
      allRelatedGroup?: { conceptGroup?: Array<{ tty?: string; conceptProperties?: unknown[] }> };
    };
    const groups = Array.isArray(json?.allRelatedGroup?.conceptGroup)
      ? json.allRelatedGroup.conceptGroup
      : [];
    const out: RelatedDrug[] = [];
    for (const g of groups) {
      const tty = g.tty ?? '';
      const props = Array.isArray(g.conceptProperties) ? g.conceptProperties : [];
      for (const p of props as Record<string, unknown>[]) {
        const rxcuiVal = typeof p.rxcui === 'string' ? p.rxcui : null;
        const nameVal = typeof p.name === 'string' ? p.name : null;
        if (!rxcuiVal || !nameVal) continue;
        out.push({ rxcui: rxcuiVal, name: nameVal, tty });
        if (out.length >= 50) break;
      }
      if (out.length >= 50) break;
    }
    return out;
  } catch {
    return [];
  }
}

export async function getNdcByRxcui(rxcui: string): Promise<NdcInfo[]> {
  const id = (rxcui || '').trim();
  if (!id) return [];
  try {
    const resp = await fetch(`${RXNAV_BASE}/rxcui/${encodeURIComponent(id)}/ndcs.json`);
    if (!resp.ok) return [];
    const json = (await resp.json()) as { ndcGroup?: { ndcList?: { ndc?: string[] } } };
    const ndcs = json?.ndcGroup?.ndcList?.ndc ?? [];
    return ndcs.slice(0, 50).map((ndc) => ({ ndc, status: null }));
  } catch {
    return [];
  }
}
