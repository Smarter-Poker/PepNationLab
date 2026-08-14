import { describe, it, expect } from 'vitest';
import {
  buildOffer,
  getOfferWindow,
  getShippingDetailNodes,
  ORGANIZATION_ID,
} from '@/lib/structured-data/merchant';
import { calculateShippingCost } from '@/lib/shipping-cost';
import { US_STATES } from '@/lib/us-states';

/**
 * Google Search Console flagged `Missing field "validFrom" (in "offers")`
 * across the site (WNC-10030322). These tests pin the Offer contract so the
 * field cannot silently disappear again, and assert the shipping regions
 * published to Google match what checkout actually charges.
 */

const FIXED_NOW = new Date('2026-08-12T15:04:05.000Z');

describe('offer validity window', () => {
  it('emits validFrom — the field Search Console reported missing', () => {
    const offer = buildOffer({ price: 49.97, url: 'https://x/y', inStock: true, now: FIXED_NOW });
    expect(offer?.validFrom).toBe('2026-08-12');
  });

  it('emits date-only values, not timestamps', () => {
    const { validFrom, priceValidUntil } = getOfferWindow(FIXED_NOW);
    expect(validFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(priceValidUntil).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('opens the window today and closes it 30 days out', () => {
    const { validFrom, priceValidUntil } = getOfferWindow(FIXED_NOW);
    expect(validFrom).toBe('2026-08-12');
    expect(priceValidUntil).toBe('2026-09-11');
  });

  it('never closes the window before it opens', () => {
    const { validFrom, priceValidUntil } = getOfferWindow(FIXED_NOW);
    expect(new Date(priceValidUntil).getTime()).toBeGreaterThan(new Date(validFrom).getTime());
  });

  it('is stable across two calls in the same render', () => {
    expect(getOfferWindow(FIXED_NOW)).toEqual(getOfferWindow(FIXED_NOW));
  });
});

describe('offer required + recommended fields', () => {
  const offer = buildOffer({
    price: 29.97,
    url: 'https://pepnationlab.com/researchstore?product=abc',
    inStock: true,
    sku: 'abc',
    now: FIXED_NOW,
  })!;

  it('carries every field Merchant listings validates', () => {
    for (const field of [
      '@type', 'price', 'priceCurrency', 'validFrom', 'priceValidUntil',
      'itemCondition', 'availability', 'url', 'seller', 'shippingDetails',
    ]) {
      expect(offer, field).toHaveProperty(field);
    }
  });

  it('formats price as a 2-decimal string, not a float', () => {
    expect(offer.price).toBe('29.97');
    expect(buildOffer({ price: 30, url: 'u', inStock: true, now: FIXED_NOW })!.price).toBe('30.00');
  });

  it('maps stock state to the right schema.org URL', () => {
    expect(offer.availability).toBe('https://schema.org/InStock');
    expect(
      buildOffer({ price: 10, url: 'u', inStock: false, now: FIXED_NOW })!.availability,
    ).toBe('https://schema.org/OutOfStock');
  });

  it('points the seller at the site Organization node', () => {
    expect(offer.seller).toEqual({ '@id': ORGANIZATION_ID });
  });

  it('emits sku only when an identifier exists', () => {
    expect(offer.sku).toBe('abc');
    expect(buildOffer({ price: 10, url: 'u', inStock: true, now: FIXED_NOW })).not.toHaveProperty('sku');
    expect(buildOffer({ price: 10, url: 'u', inStock: true, sku: null, now: FIXED_NOW })).not.toHaveProperty('sku');
  });

  it('refuses to build an offer for a non-positive or bogus price', () => {
    for (const price of [0, -5, NaN, Infinity]) {
      expect(buildOffer({ price, url: 'u', inStock: true }), String(price)).toBeNull();
    }
  });

  it('omits fields the site has no real data for', () => {
    // Fabricating these violates Google's structured-data policy.
    expect(offer).not.toHaveProperty('aggregateRating');
    expect(offer).not.toHaveProperty('review');
    expect(offer).not.toHaveProperty('hasMerchantReturnPolicy');
  });
});

describe('shipping details', () => {
  const nodes = getShippingDetailNodes();

  it('publishes one node per rate zone', () => {
    expect(nodes).toHaveLength(3);
    for (const n of nodes) expect(n['@type']).toBe('OfferShippingDetails');
  });

  it('gives every node a unique @id for offers to reference', () => {
    const ids = nodes.map(n => n['@id']);
    expect(new Set(ids).size).toBe(3);
    for (const id of ids) expect(String(id)).toContain('#shipping');
  });

  it('references shipping by @id rather than inlining it per offer', () => {
    // A 250-product storefront must not repeat the shipping block 250 times.
    const offer = buildOffer({ price: 10, url: 'u', inStock: true, now: FIXED_NOW })!;
    const refs = offer.shippingDetails as Array<Record<string, unknown>>;
    expect(refs).toHaveLength(3);
    for (const ref of refs) expect(Object.keys(ref)).toEqual(['@id']);
    // Every reference resolves to a node the page actually emits.
    const emitted = new Set(nodes.map(n => n['@id']));
    for (const ref of refs) expect(emitted.has(ref['@id'])).toBe(true);
  });

  it('publishes the same rate checkout charges, for every listed region', () => {
    for (const node of nodes) {
      const rate = Number(
        ((node.shippingRate as Record<string, unknown>).value as string),
      );
      const regions = node.shippingDestination as Array<{ addressRegion: string }>;
      for (const { addressRegion } of regions) {
        expect(calculateShippingCost('standard', addressRegion), addressRegion).toBe(rate);
      }
    }
  });

  it('covers every US state and territory exactly once', () => {
    const listed = getShippingDetailNodes().flatMap(
      n => (n.shippingDestination as Array<{ addressRegion: string }>).map(d => d.addressRegion),
    );
    expect(new Set(listed).size, 'a region is listed in two zones').toBe(listed.length);
    expect([...listed].sort()).toEqual(US_STATES.map(s => s.code).sort());
  });

  it('declares US as the country on every destination', () => {
    for (const node of nodes) {
      for (const d of node.shippingDestination as Array<Record<string, unknown>>) {
        expect(d.addressCountry).toBe('US');
        expect(d['@type']).toBe('DefinedRegion');
      }
    }
  });
});
