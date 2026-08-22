import { CITIES, City } from './cities-data';
import { CITY_COMPOUNDS } from './city-compounds';
import { getResearchAnchors } from './research-anchors';

// The master kill switch for the tier-3 SEO pilot
export const PILOT_ENABLED = true;

// The first 10 compound slugs to pilot
export const PILOT_COMPOUND_SLUGS = CITY_COMPOUNDS.slice(0, 10).map((c) => c.slug);

// Deterministically select the pilot cities.
// Criteria: tier === 3, population >= 75000, has research anchors, has region+county+localBlurb
// Dedupe: one city per region (highest pop), max 2 per stateSlug
// Sort: population descending, take top 30
const selectedCities: City[] = [];
const seenRegions = new Set<string>();
const stateCounts = new Map<string, number>();

// Filter and sort candidates first
const candidates = CITIES.filter(
  (c) =>
    c.tier === 3 &&
    c.population >= 60000 &&
    c.region &&
    c.county &&
    c.localBlurb &&
    (getResearchAnchors(c.region)?.length ?? 0) > 0
).sort((a, b) => b.population - a.population);

for (const city of candidates) {
  if (selectedCities.length >= 30) break;
  if (!city.region) continue;

  if (seenRegions.has(city.region)) continue;

  const count = stateCounts.get(city.stateSlug) || 0;
  if (count >= 3) continue;

  seenRegions.add(city.region);
  stateCounts.set(city.stateSlug, count + 1);
  selectedCities.push(city);
}

// Frozen Set of "{stateSlug}/{citySlug}" for fast lookup
export const PILOT_CITY_KEYS = new Set(selectedCities.map((c) => `${c.stateSlug}/${c.slug}`));
Object.freeze(PILOT_CITY_KEYS);

/** Returns true if the city is part of the tier-3 pilot */
export function isPilotCity(city: City): boolean {
  if (!PILOT_ENABLED) return false;
  return PILOT_CITY_KEYS.has(`${city.stateSlug}/${city.slug}`);
}

/** Returns true if the specific compound page for this city is un-noindexed by the pilot */
export function isPilotCompoundCity(city: City, compoundSlug: string): boolean {
  if (!isPilotCity(city)) return false;
  return PILOT_COMPOUND_SLUGS.includes(compoundSlug);
}

/** Generates the full HTTPS URLs for all 300 pilot pages */
export function getPilotCompoundCityUrls(): string[] {
  if (!PILOT_ENABLED) return [];
  const urls: string[] = [];
  for (const cityKey of PILOT_CITY_KEYS) {
    const [stateSlug, citySlug] = cityKey.split('/');
    for (const compoundSlug of PILOT_COMPOUND_SLUGS) {
      urls.push(`https://pepnationlab.com/peptides/${stateSlug}/${citySlug}/${compoundSlug}`);
    }
  }
  return urls;
}
