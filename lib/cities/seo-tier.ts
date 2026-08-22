/**
 * lib/cities/seo-tier.ts
 *
 * Which city pages are allowed into Google's index.
 *
 * The 2026-08-14 SEO audit found the 2,445-page city footprint targets
 * queries with effectively zero search demand outside major metros: the one
 * long-tail page Google had indexed (/peptides/florida/delray-beach) ranked
 * ~#5 for its target query and never produced a single click. Competitors'
 * programmatic city pages DO rank — but only for "buy peptides <major metro>"
 * class queries. Meanwhile a 2,400-page templated long tail on a low-authority
 * domain is a scaled-content liability that drags sitewide quality signals.
 *
 * Policy: only major metros are indexable. Everything else stays live for
 * users (and keeps its internal-link mesh — noindex,FOLLOW) but is excluded
 * from the sitemap and from Google's index, concentrating crawl budget and
 * PageRank on pages that can actually earn clicks.
 *
 * The cutoff is population-based rather than the hand-set wealth `tier`
 * field because search demand tracks metro size, not median income:
 * >= 150,000 keeps 190 cities (audit target band was 100-200).
 */

import { CITIES, getCity, type City } from '@/lib/cities/cities-data';

/** Minimum population for a city page to be indexable. */
export const SEO_INDEX_MIN_POPULATION = 150_000;

/**
 * Cities kept indexable regardless of population.
 * delray-beach: the ONLY city page Google had indexed as of the 2026-08-14
 * audit (ranking ~#5 for its query) — never throw away an existing index
 * signal on a domain that has almost none.
 */
const ALWAYS_INDEXABLE = new Set(['florida/delray-beach']);

export function isSeoIndexableCity(city: City): boolean {
  if (ALWAYS_INDEXABLE.has(`${city.stateSlug}/${city.slug}`)) return true;
  return city.population >= SEO_INDEX_MIN_POPULATION;
}

/** Convenience for callers holding only slugs (e.g. generateMetadata). */
export function isSeoIndexableCitySlug(stateSlug: string, citySlug: string): boolean {
  const city = getCity(stateSlug, citySlug);
  return !!city && isSeoIndexableCity(city);
}

/** The retained set, for the sitemap and indexing-request tooling. */
export function getSeoIndexableCities(): City[] {
  return CITIES.filter(isSeoIndexableCity);
}
