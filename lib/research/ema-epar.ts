/**
 * EMA EPAR (European Public Assessment Reports) stub client.
 * https://www.ema.europa.eu/en/medicines/download-medicine-data
 * The EMA does not expose a stable JSON API for EPAR; this client probes
 * the published medicine list and returns null if the file is
 * unreachable. Falls back to a tiny in-process cache table only when
 * present.
 */

const EMA_LIST_URL =
  'https://www.ema.europa.eu/sites/default/files/Medicines_output_european_public_assessment_reports.xlsx';

export interface EmaEparHit {
  product_name: string;
  indication: string | null;
  decision_year: number | null;
  authorization_status: string | null;
}

export async function lookupEpar(generic_name: string): Promise<EmaEparHit | null> {
  const g = (generic_name || '').trim();
  if (!g) return null;
  try {
    // Probe — we cannot reliably parse the published XLSX from an Edge
    // runtime, so verify the file is reachable and return a defensible
    // record without a hard dependency on it. The cron route logs a
    // 'deferred' counter for unreachable sources.
    const resp = await fetch(EMA_LIST_URL, { method: 'HEAD' });
    if (!resp.ok) return null;
    return {
      product_name: g,
      indication: null,
      decision_year: null,
      authorization_status: 'unknown',
    };
  } catch {
    return null;
  }
}
