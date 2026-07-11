/**
 * near-me.ts
 * Pure helper for the "Peptides Near Me" section on city landing pages.
 *
 * Given a city, returns up to `limit` related cities from the static CITIES
 * dataset - no database access. Ordering strategy:
 *   1. Cities sharing the same region label (metro silo), which may cross
 *      state lines (e.g. Kansas City, the NYC tri-state area).
 *   2. Remaining cities in the same state.
 * Within each group, cities sort by tier (1 = highest priority) and then by
 * population descending, so the most significant nearby markets surface
 * first and every page's list stays deterministic for crawlers.
 */

import { CITIES } from './cities-data';
import type { City } from './cities-data';

const cityKey = (c: City): string => `${c.stateSlug}/${c.slug}`;

const byTierThenPopulation = (a: City, b: City): number =>
  a.tier !== b.tier ? a.tier - b.tier : b.population - a.population;

/**
 * Up to `limit` cities related to `city`: same region first (tier, then
 * population), then same state. Never includes the city itself.
 */
export function getNearMeCities(city: City, limit = 10): City[] {
  const selfKey = cityKey(city);

  const sameRegion = city.region
    ? CITIES.filter((c) => cityKey(c) !== selfKey && c.region === city.region).sort(
        byTierThenPopulation
      )
    : [];

  const taken = new Set<string>([selfKey, ...sameRegion.map(cityKey)]);

  const sameState = CITIES.filter(
    (c) => c.stateSlug === city.stateSlug && !taken.has(cityKey(c))
  ).sort(byTierThenPopulation);

  return [...sameRegion, ...sameState].slice(0, limit);
}
