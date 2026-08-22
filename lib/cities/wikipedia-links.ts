/**
 * wikipedia-links.ts
 *
 * The city Service schema derives each city's Wikipedia `sameAs` from the
 * standard "City, State" title, which Wikipedia resolves (directly or via
 * redirect) for the overwhelming majority of U.S. municipalities. Validation
 * against the MediaWiki API (2026-07-13, all 2,445 cities) found only three
 * exceptions, captured here so the schema never emits a `sameAs` that points
 * at a dead or wrong Wikipedia page:
 *
 *   - OVERRIDE: the city name carries a typographic apostrophe, so the
 *     auto-built URL misses the straight-quote article title.
 *   - OMIT: the place has no standalone municipal article (a neighborhood or
 *     former installation), so no honest entity link exists.
 *
 * Keyed by `${stateSlug}/${citySlug}`.
 */

// Cities with a corrected canonical Wikipedia URL.
export const WIKIPEDIA_OVERRIDE: Record<string, string> = {
  "tennessee/thompsons-station": "https://en.wikipedia.org/wiki/Thompson's_Station,_Tennessee",
};

// Cities with no real standalone article - emit no sameAs at all.
export const WIKIPEDIA_OMIT = new Set<string>([
  "indiana/fort-ben",             // area of Lawrence, IN (former Fort Benjamin Harrison); no municipal article
  "south-carolina/daniel-island", // Charleston neighborhood; no standalone municipal article
]);

/**
 * Returns a validated Wikipedia URL for the city, or null when none resolves.
 * Non-exceptional cities use the standard "City, State" title (which Wikipedia
 * redirects to the canonical article).
 */
export function getCityWikipediaUrl(
  key: string,
  cityName: string,
  stateName: string
): string | null {
  if (WIKIPEDIA_OMIT.has(key)) return null;
  const override = WIKIPEDIA_OVERRIDE[key];
  if (override) return override;
  return encodeURI(
    `https://en.wikipedia.org/wiki/${cityName.replace(/ /g, '_')},_${stateName.replace(/ /g, '_')}`
  );
}
