/**
 * openFDA Drug API client. https://api.fda.gov/drug/
 * Used by /api/cron/fda-drugs-sync. Drives FAERS adverse-event counts
 * (compounds.faers_event_count) and writes new FAERS hits + recall hits
 * into compound_recall_alerts.
 */

const OPENFDA_BASE = 'https://api.fda.gov/drug';

export interface DrugLabelResult {
  set_id: string | null;
  generic_name: string | null;
  brand_name: string | null;
  manufacturer: string | null;
  effective_time: string | null;
  indications_and_usage: string | null;
  boxed_warning: string | null;
  warnings: string | null;
  contraindications: string | null;
  raw: unknown;
}

export interface FaersEvent {
  safetyreportid: string;
  receivedate: string | null;
  serious: number | null;
  reactionmeddrapt: string[];
}

export interface FdaApproval {
  application_number: string;
  sponsor_name: string | null;
  brand_name: string | null;
  active_ingredients: string[];
  approval_year: number | null;
  marketing_status: string | null;
}

function firstString(v: unknown): string | null {
  if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'string') return v[0];
  if (typeof v === 'string') return v;
  return null;
}

export async function searchDrugLabel(generic_name: string): Promise<DrugLabelResult[]> {
  const g = (generic_name || '').trim();
  if (!g) return [];
  try {
    const search = `openfda.generic_name:"${g.replace(/"/g, '')}"`;
    const resp = await fetch(
      `${OPENFDA_BASE}/label.json?search=${encodeURIComponent(search)}&limit=5`,
    );
    if (!resp.ok) return [];
    const json = (await resp.json()) as { results?: unknown[] };
    const arr = Array.isArray(json?.results) ? json.results : [];
    const out: DrugLabelResult[] = [];
    for (const r of arr as Record<string, unknown>[]) {
      const fda = (r.openfda as Record<string, unknown>) ?? {};
      out.push({
        set_id: firstString(fda.spl_set_id),
        generic_name: firstString(fda.generic_name),
        brand_name: firstString(fda.brand_name),
        manufacturer: firstString(fda.manufacturer_name),
        effective_time: typeof r.effective_time === 'string' ? r.effective_time : null,
        indications_and_usage: firstString(r.indications_and_usage),
        boxed_warning: firstString(r.boxed_warning),
        warnings: firstString(r.warnings),
        contraindications: firstString(r.contraindications),
        raw: r,
      });
    }
    return out;
  } catch {
    return [];
  }
}

export async function searchFaersAdverseEvents(
  generic_name: string,
  limit = 100,
): Promise<{ total: number; events: FaersEvent[] }> {
  const g = (generic_name || '').trim();
  if (!g) return { total: 0, events: [] };
  try {
    const search = `patient.drug.openfda.generic_name:"${g.replace(/"/g, '')}"`;
    const resp = await fetch(
      `${OPENFDA_BASE}/event.json?search=${encodeURIComponent(search)}&limit=${Math.min(100, limit)}`,
    );
    if (!resp.ok) return { total: 0, events: [] };
    const json = (await resp.json()) as {
      meta?: { results?: { total?: number } };
      results?: unknown[];
    };
    const total = json?.meta?.results?.total ?? 0;
    const arr = Array.isArray(json?.results) ? json.results : [];
    const events: FaersEvent[] = [];
    for (const r of arr as Record<string, unknown>[]) {
      const id = typeof r.safetyreportid === 'string' ? r.safetyreportid : null;
      if (!id) continue;
      const patient = (r.patient as Record<string, unknown>) ?? {};
      const reactions = Array.isArray(patient.reaction) ? (patient.reaction as unknown[]) : [];
      events.push({
        safetyreportid: id,
        receivedate: typeof r.receivedate === 'string' ? r.receivedate : null,
        serious: typeof r.serious === 'number' ? r.serious : null,
        reactionmeddrapt: reactions
          .map((rx) => {
            const o = rx as Record<string, unknown>;
            return typeof o.reactionmeddrapt === 'string' ? (o.reactionmeddrapt as string) : null;
          })
          .filter((x): x is string => x !== null),
      });
    }
    return { total: Number(total) || 0, events };
  } catch {
    return { total: 0, events: [] };
  }
}

export async function getApprovalRecords(generic_name: string): Promise<FdaApproval[]> {
  const g = (generic_name || '').trim();
  if (!g) return [];
  try {
    const search = `products.active_ingredients.name:"${g.replace(/"/g, '')}"`;
    const resp = await fetch(
      `${OPENFDA_BASE}/drugsfda.json?search=${encodeURIComponent(search)}&limit=10`,
    );
    if (!resp.ok) return [];
    const json = (await resp.json()) as { results?: unknown[] };
    const arr = Array.isArray(json?.results) ? json.results : [];
    const out: FdaApproval[] = [];
    for (const r of arr as Record<string, unknown>[]) {
      const appNo = typeof r.application_number === 'string' ? r.application_number : null;
      if (!appNo) continue;
      const products = Array.isArray(r.products) ? (r.products as Array<Record<string, unknown>>) : [];
      const first = products[0] ?? {};
      const sponsor = typeof r.sponsor_name === 'string' ? r.sponsor_name : null;
      const ingredients = Array.isArray(first.active_ingredients)
        ? (first.active_ingredients as Array<Record<string, unknown>>).map((i) =>
            typeof i.name === 'string' ? (i.name as string) : null,
          ).filter((x): x is string => x !== null)
        : [];
      const subs = Array.isArray(r.submissions) ? (r.submissions as Array<Record<string, unknown>>) : [];
      const earliest = subs
        .map((s) => (typeof s.submission_status_date === 'string' ? (s.submission_status_date as string) : null))
        .filter((x): x is string => x !== null)
        .sort()[0];
      out.push({
        application_number: appNo,
        sponsor_name: sponsor,
        brand_name: typeof first.brand_name === 'string' ? (first.brand_name as string) : null,
        active_ingredients: ingredients,
        approval_year: earliest ? Number(earliest.slice(0, 4)) || null : null,
        marketing_status: typeof first.marketing_status === 'string' ? (first.marketing_status as string) : null,
      });
    }
    return out;
  } catch {
    return [];
  }
}
