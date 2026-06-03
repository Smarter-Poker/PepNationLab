/**
 * WADA Prohibited List archive client. https://www.wada-ama.org/en/resources
 * Returns one record per year with a link to the official PDF. The cron
 * walks this list to keep compounds.wada_status and a per-year history
 * row in compound_references current.
 */

export interface WadaArchiveEntry {
  year: number;
  peptide_section_url: string;
  last_updated: string;
}

// Curated list of known years and their canonical PDF locations on the
// WADA site. Updated annually by the wada-archive-sync cron.
const KNOWN_YEARS: Array<{ year: number; url: string }> = [
  { year: 2026, url: 'https://www.wada-ama.org/sites/default/files/2025-09/2026list_en_final_clean.pdf' },
  { year: 2025, url: 'https://www.wada-ama.org/sites/default/files/2024-09/2025list_en_final_clean.pdf' },
  { year: 2024, url: 'https://www.wada-ama.org/sites/default/files/2023-09/2024list_en_final_clean.pdf' },
  { year: 2023, url: 'https://www.wada-ama.org/sites/default/files/2022-09/2023list_en_final.pdf' },
  { year: 2022, url: 'https://www.wada-ama.org/sites/default/files/resources/files/2022list_final_en.pdf' },
  { year: 2021, url: 'https://www.wada-ama.org/sites/default/files/resources/files/2021list_en.pdf' },
];

export async function listArchive(): Promise<WadaArchiveEntry[]> {
  // We do not try to scrape the site index; the canonical list of yearly
  // PDFs is small and stable enough to cache here. Each entry's reachability
  // is probed by the cron at run-time.
  return KNOWN_YEARS.map((e) => ({
    year: e.year,
    peptide_section_url: e.url,
    last_updated: new Date().toISOString(),
  }));
}

export async function probeReachable(url: string): Promise<boolean> {
  try {
    const resp = await fetch(url, { method: 'HEAD' });
    return resp.ok;
  } catch {
    return false;
  }
}
