/**
 * lib/structured-data/merchant.ts
 *
 * Single source of truth for the schema.org `Offer` nodes this site publishes.
 *
 * Google's Merchant listings validation reads every Offer in the page's JSON-LD
 * graph. Three separate pages used to build Offer objects inline, which is how
 * `validFrom` ended up missing everywhere at once (Search Console
 * WNC-10030322). Everything now goes through `buildOffer` so the emitted shape
 * can only change in one place.
 *
 * Only facts the application actually knows are emitted. Notably absent:
 *   - `hasMerchantReturnPolicy` -- the site publishes no return policy, and
 *     inventing one in structured data would misrepresent the merchant to
 *     Google. Add it here once a real policy exists (see RETURN_POLICY note).
 *   - `review` / `aggregateRating` -- there is no genuine review data, and
 *     fabricating ratings violates Google's structured-data policy.
 *   - `deliveryTime` on shipping -- transit estimates are not tracked.
 */

import { SHIPPING_RATES } from '@/lib/shipping-cost';

export const SITE_BASE = 'https://pepnationlab.com';
export const ORGANIZATION_ID = `${SITE_BASE}/#organization`;

/** How long a published price is asserted to remain valid. */
const PRICE_VALID_DAYS = 30;

/**
 * `validFrom` / `priceValidUntil` must be stable for a given day, not a
 * per-render timestamp: pages are statically generated and revalidated at
 * different moments, and a value that changes every render produces a churning
 * diff in the rendered HTML and inconsistent data across cached variants.
 * Both are therefore date-only (YYYY-MM-DD) and derived from the same instant.
 */
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export interface OfferWindow {
  validFrom: string;
  priceValidUntil: string;
}

/**
 * The validity window for a price published now. `validFrom` is today: the
 * price is live the moment the page is served. Callers may pass a fixed `now`
 * for deterministic tests.
 */
export function getOfferWindow(now: Date = new Date()): OfferWindow {
  const until = new Date(now.getTime() + PRICE_VALID_DAYS * 24 * 60 * 60 * 1000);
  return { validFrom: isoDate(now), priceValidUntil: isoDate(until) };
}

// ─── Shipping ────────────────────────────────────────────────────────────────
// Pep Nation ships every order at a flat rate keyed on the destination region
// (lib/shipping-cost.ts). These nodes are emitted ONCE per page in the graph
// and referenced by `@id` from each Offer, so a 250-product storefront does not
// repeat the same shipping block 250 times.

const SHIPPING_NODE_IDS = {
  midwest: `${SITE_BASE}/#shipping-inland`,
  coastal: `${SITE_BASE}/#shipping-coastal`,
  noncontiguous: `${SITE_BASE}/#shipping-noncontiguous`,
} as const;

/**
 * States per zone, as `addressRegion` values. Mirrors the sets in
 * lib/shipping-cost.ts -- kept as explicit literals here because structured
 * data needs the enumerated regions, whereas the rate table only needs
 * membership tests. `__tests__/structured-data-merchant.test.ts` asserts the
 * two never disagree.
 */
const COASTAL_REGIONS = [
  'ME', 'NH', 'VT', 'MA', 'RI', 'CT', 'NY', 'NJ', 'PA', 'DE', 'MD', 'DC',
  'VA', 'NC', 'SC', 'GA', 'FL', 'CA', 'OR', 'WA',
];

const NONCONTIGUOUS_REGIONS = ['AK', 'HI', 'PR', 'VI', 'GU', 'AS', 'MP'];

const INLAND_REGIONS = [
  'AL', 'AZ', 'AR', 'CO', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'MI',
  'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NM', 'ND', 'OH', 'OK', 'SD', 'TN',
  'TX', 'UT', 'WV', 'WI', 'WY',
];

function shippingNode(
  id: string,
  rate: number,
  regions: string[],
): Record<string, unknown> {
  return {
    '@type': 'OfferShippingDetails',
    '@id': id,
    shippingRate: {
      '@type': 'MonetaryAmount',
      value: rate.toFixed(2),
      currency: 'USD',
    },
    shippingDestination: regions.map((region) => ({
      '@type': 'DefinedRegion',
      addressCountry: 'US',
      addressRegion: region,
    })),
  };
}

/**
 * The shipping nodes to splice into a page's `@graph` exactly once, alongside
 * the Product nodes. Required for the `@id` references in `buildOffer` to
 * resolve.
 */
export function getShippingDetailNodes(): Record<string, unknown>[] {
  return [
    shippingNode(SHIPPING_NODE_IDS.midwest, SHIPPING_RATES.midwest, INLAND_REGIONS),
    shippingNode(SHIPPING_NODE_IDS.coastal, SHIPPING_RATES.coastal, COASTAL_REGIONS),
    shippingNode(SHIPPING_NODE_IDS.noncontiguous, SHIPPING_RATES.noncontiguous, NONCONTIGUOUS_REGIONS),
  ];
}

const SHIPPING_DETAIL_REFS = [
  { '@id': SHIPPING_NODE_IDS.midwest },
  { '@id': SHIPPING_NODE_IDS.coastal },
  { '@id': SHIPPING_NODE_IDS.noncontiguous },
];

// ─── Offer ───────────────────────────────────────────────────────────────────

export interface BuildOfferInput {
  /** Numeric price. A non-finite or non-positive value returns null. */
  price: number;
  /** Canonical URL for buying this specific item. */
  url: string;
  /** True when the item is purchasable now. */
  inStock: boolean;
  /** Stable merchant identifier, emitted as `sku` when present. */
  sku?: string | null;
  /** Fixed clock for deterministic tests. */
  now?: Date;
}

/**
 * Build a complete Merchant-listings-eligible Offer, or null when the price is
 * not a real positive number (a Product with a bogus offer is worse than a
 * Product the caller skips entirely).
 */
export function buildOffer(input: BuildOfferInput): Record<string, unknown> | null {
  const { price, url, inStock, sku, now } = input;
  if (!Number.isFinite(price) || !(price > 0)) return null;

  const { validFrom, priceValidUntil } = getOfferWindow(now);

  const offer: Record<string, unknown> = {
    '@type': 'Offer',
    price: price.toFixed(2),
    priceCurrency: 'USD',
    // validFrom was the field Search Console flagged as missing site-wide.
    validFrom,
    priceValidUntil,
    itemCondition: 'https://schema.org/NewCondition',
    availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    url,
    seller: { '@id': ORGANIZATION_ID },
    shippingDetails: SHIPPING_DETAIL_REFS,
  };

  if (sku) offer.sku = String(sku);

  return offer;
}
