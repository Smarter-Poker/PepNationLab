/**
 * city-narrative.ts
 *
 * Deep, per-city-unique long-form body copy for the highest-value (tier-1)
 * city pages. Every paragraph is woven from the city's real attributes
 * (population, county, region, median income, ZIP coverage) plus its actual
 * regional research institutions, with hash-selected sentence variants so no
 * two tier-1 pages read identically. Naming nearby institutions is factual
 * region-level ecosystem context, NOT a claim of affiliation with Pep Nation
 * Lab.
 *
 * Returns null for tier-2 / tier-3 cities: the long tail keeps the leaner
 * templated copy; only tier-1 markets receive this expanded treatment.
 *
 * Pure data module - safe to import anywhere.
 */

import type { City } from './cities-data';
import { getRegionLabel, getRegionArea } from './city-content';
import { getResearchAnchors } from './research-anchors';

// Deterministic per-city hash (stable across renders; varies by identity).
function hash(city: City): number {
  const s = `${city.name}|${city.stateAbbr}|${city.slug}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function pop(city: City): string {
  const p = city.population;
  if (p >= 1000000) return `${(p / 1000000).toFixed(1)} million`;
  if (p >= 1000) return `${Math.round(p / 1000)},000`;
  return `${p}`;
}

function pick<T>(arr: T[], n: number): T {
  return arr[n % arr.length];
}

function listOf(names: string[]): string {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

/**
 * Returns an ordered array of paragraph strings for a tier-1 city, or null.
 */
export function getCityNarrative(city: City): string[] | null {
  if (city.tier !== 1) return null;

  const h = hash(city);
  const region = getRegionLabel(city);
  const area = getRegionArea(region);
  const anchors = getResearchAnchors(city.region);
  const anchorNames = anchors ? anchors.slice(0, 3).map((a) => a.name) : [];
  const county = city.county ? `${city.county} County` : null;

  // Paragraph 1 - research landscape / market context.
  const p1Open = pick(
    [
      `${city.name} is one of ${city.state}'s most active markets for laboratory-grade peptide research`,
      `Among ${city.state} research hubs, ${city.name} stands out for sustained demand for research-grade peptides`,
      `${city.name} anchors a concentration of scientific and clinical research activity across the ${area}`,
    ],
    h
  );
  const p1Pop = pick(
    [
      `Home to roughly ${pop(city)} residents${county ? ` and seated in ${county}` : ''}, the city supports a working research community`,
      `With a population near ${pop(city)}${county ? ` across ${county}` : ''}, it sustains a base of investigators and institutions`,
      `A metro of about ${pop(city)} people${county ? ` in ${county}` : ''}, ${city.name} carries a research base`,
    ],
    h >> 2
  );
  const p1Anchor = anchorNames.length
    ? pick(
        [
          ` that works alongside established institutions such as ${listOf(anchorNames)}. Pep Nation Lab supplies this ecosystem with research-grade peptides while remaining an independent distributor with no affiliation to those organizations.`,
          ` within reach of research anchors including ${listOf(anchorNames)}. Pep Nation Lab serves investigators across this corridor as an independent supplier, not as an affiliate of any listed institution.`,
        ],
        h >> 4
      )
    : ` drawing on a mix of independent labs, universities, and private research groups that Pep Nation Lab supplies as an independent distributor.`;
  const p1 = `${p1Open}. ${p1Pop}${p1Anchor}`;

  // Paragraph 2 - sourcing and logistics.
  const zipStr =
    city.zips && city.zips.length > 0
      ? ` Coverage reaches local ZIP codes including ${city.zips.slice(0, 4).join(', ')}${city.zips.length > 4 ? ', and more' : ''}.`
      : '';
  const p2Open = pick(
    [
      `Verified researchers in ${city.name} order from a catalog of more than 100 compounds`,
      `Qualified labs across ${city.name} source over 100 research compounds`,
      `Research accounts serving ${city.name} draw on a 100-plus compound catalog`,
    ],
    h >> 3
  );
  const p2Body = pick(
    [
      ` - spanning metabolic, recovery, longevity, cognitive, and tissue-repair research - at wholesale, tier-based pricing with no retail markup. Orders placed before the daily cutoff are typically processed same-day and shipped nationwide to ${city.stateAbbr}, with tracking on every parcel.`,
      ` - from BPC-157 and TB-500 to Semaglutide, Tirzepatide, GHK-Cu, and Epithalon - at transparent wholesale tiers. Same-day processing on orders placed before the fulfillment cutoff keeps ${city.name} labs supplied, with nationwide shipping and full tracking.`,
    ],
    h >> 5
  );
  const p2 = `${p2Open}${p2Body}${zipStr} Every lot ships with certificate-of-analysis (COA) documentation, and temperature-sensitive compounds move under insulated, cold-chain-appropriate packaging.`;

  // Paragraph 3 - quality, compliance, and intended use.
  const p3 = pick(
    [
      `Each compound shipped to ${city.name} is independently verified by third-party HPLC and mass-spectrometry testing, so investigators can confirm identity and purity before beginning an assay. Accounts are limited to verified researchers, and every product is sold strictly for in vitro laboratory research - not for human or animal consumption, and not FDA-approved. Researchers in ${city.state} remain responsible for compliance with all applicable local, state, and federal regulations.`,
      `Before it reaches a ${city.name} bench, every lot passes independent third-party HPLC and mass-spectrometry analysis, giving ${city.state} investigators documented purity and molecular-weight data for their protocols. Access is restricted to verified researchers, and all products are strictly for in vitro laboratory use - never for human or animal use, and not FDA-approved - with buyers responsible for full regulatory compliance.`,
    ],
    h >> 6
  );

  return [p1, p2, p3];
}
