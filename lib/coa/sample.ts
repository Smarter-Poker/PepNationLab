/**
 * COA SAMPLE data generator -- PREVIEW ONLY.
 *
 * This produces plausible, deterministic placeholder analytical values so an
 * admin can see how a finished Certificate Of Analysis will look, populated,
 * across the whole catalogue, BEFORE any real testing exists.
 *
 * Hard rules, enforced by how this is used rather than by hope:
 *   - Nothing here is ever written to product_lots.
 *   - Nothing here is ever marked verified, signed as a true attestation, or
 *     exposed on a public page. It renders only inside the admin preview, always
 *     behind a "SAMPLE" watermark.
 *   - The measured fields (purity, observed mass, water, net peptide) are
 *     invented for layout purposes and must be replaced with real lab readings
 *     before a certificate is ever verified.
 *
 * The only real value used is the peptide's theoretical mass, which is a
 * chemical constant, not a measurement. Observed mass is drawn close to it the
 * way a real instrument reading would land, purely so the sample looks credible.
 *
 * Values are deterministic in the seed (the product name), so the same peptide
 * always shows the same sample -- no flicker between renders, and it reads like
 * a stable record rather than noise.
 */

export interface CoaSample {
  lotNumber: string;
  reportNumber: string;
  testDate: string;
  purityPct: number;
  purityMethod: string;
  hplcColumn: string;
  hplcWavelengthNm: number;
  msMethod: string;
  msObservedMassDa: number | null;
  msTheoreticalMassDa: number | null;
  waterContentPct: number;
  netPeptideContentPct: number;
  appearance: string;
  testingLab: string;
  labIsThirdParty: boolean;
  labAccreditation: string;
}

function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function round(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

function lotToken(name: string): string {
  const cleaned = name.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return (cleaned.slice(0, 4) || 'PEP').padEnd(3, 'X');
}

/**
 * Build a deterministic sample for a peptide. `theoreticalMass` is the real
 * molecular weight when known; when absent, observed mass is left null and
 * renders as Not Reported, exactly as a real certificate would.
 */
export function generateCoaSample(
  productName: string,
  theoreticalMass: number | null,
): CoaSample {
  const rand = mulberry32(hashString(productName));

  const purityPct = round(97.5 + rand() * 2.4, 2); // 97.50 - 99.90
  const waterContentPct = round(1.8 + rand() * 4.0, 2); // 1.80 - 5.80
  const netPeptideContentPct = round(80 + rand() * 14, 1); // 80.0 - 94.0

  const massDelta = round((rand() - 0.5) * 1.0, 2); // +/- 0.50 Da instrument spread
  const msObservedMassDa =
    theoreticalMass && theoreticalMass > 0 ? round(theoreticalMass + massDelta, 2) : null;

  // Deterministic recent-ish test date within the last ~120 days.
  const daysAgo = 7 + Math.floor(rand() * 113);
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  const testDate = d.toISOString().slice(0, 10);

  const token = lotToken(productName);
  const yymm = `${String(d.getUTCFullYear()).slice(2)}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  const serial = String(100 + Math.floor(rand() * 899));

  return {
    lotNumber: `PNL-${token}-${yymm}-${serial}`,
    reportNumber: `PNL-${token}-${serial}`,
    testDate,
    purityPct,
    purityMethod: 'RP-HPLC',
    hplcColumn: 'C18, 4.6 x 250 mm, 5 um',
    hplcWavelengthNm: 214,
    msMethod: 'ESI-MS',
    msObservedMassDa,
    msTheoreticalMassDa: theoreticalMass && theoreticalMass > 0 ? round(theoreticalMass, 2) : null,
    waterContentPct,
    netPeptideContentPct,
    appearance: 'White To Off-White Lyophilized Powder',
    testingLab: 'Pep Nation Lab In-House',
    labIsThirdParty: false,
    labAccreditation: 'In-House Method',
  };
}
