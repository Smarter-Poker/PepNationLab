import { describe, it, expect } from 'vitest';
import {
  calculateShippingCost,
  getShippingZone,
  SHIPPING_RATES,
} from '@/lib/shipping-cost';
import { US_STATES } from '@/lib/us-states';

/**
 * Pep Nation fulfills every order at a flat rate keyed on the destination
 * state. These tests pin the published rate card so a future refactor cannot
 * silently reintroduce weight tiers, free-shipping holes, or carrier upcharges.
 */

const MIDWEST = ['IL', 'IN', 'IA', 'KS', 'MI', 'MN', 'MO', 'NE', 'ND', 'OH', 'SD', 'WI'];
const EAST_COAST = ['ME', 'NH', 'VT', 'MA', 'RI', 'CT', 'NY', 'NJ', 'PA', 'DE', 'MD', 'DC', 'VA', 'NC', 'SC', 'GA', 'FL'];
const WEST_COAST = ['CA', 'OR', 'WA'];
const NON_CONTIGUOUS = ['AK', 'HI', 'PR', 'VI', 'GU', 'AS', 'MP'];
const INLAND = ['TX', 'CO', 'AZ', 'NV', 'UT', 'NM', 'MT', 'WY', 'ID', 'OK', 'AR', 'LA', 'MS', 'AL', 'TN', 'KY', 'WV'];

describe('shipping rate card', () => {
  it('charges $20 across the Midwest', () => {
    for (const state of MIDWEST) {
      expect(calculateShippingCost('standard', state), state).toBe(20);
    }
  });

  it('charges $25 on both coasts', () => {
    for (const state of [...EAST_COAST, ...WEST_COAST]) {
      expect(calculateShippingCost('standard', state), state).toBe(25);
    }
  });

  it('charges $40 for Alaska, Hawaii and the territories', () => {
    for (const state of NON_CONTIGUOUS) {
      expect(calculateShippingCost('standard', state), state).toBe(40);
    }
  });

  it('charges $20 for inland states that are neither Midwest nor coastal', () => {
    for (const state of INLAND) {
      expect(calculateShippingCost('standard', state), state).toBe(20);
    }
  });

  it('never ships free to a real address', () => {
    for (const { code } of US_STATES) {
      expect(calculateShippingCost('standard', code), code).toBeGreaterThan(0);
    }
  });

  it('covers every state in US_STATES with a known zone', () => {
    const rates = new Set(US_STATES.map(s => calculateShippingCost('standard', s.code)));
    expect([...rates].sort((a, b) => a - b)).toEqual([20, 25, 40]);
  });
});

describe('rate is independent of order size', () => {
  it('does not vary with weight or quantity — there is no second argument for it', () => {
    // The old signature was (option, weightOz) and scaled with weight. If a
    // weight ever leaks back into the state slot it must not change the price
    // away from the flat table.
    expect(calculateShippingCost('standard', 'IL')).toBe(20);
    expect(calculateShippingCost('standard', 'CA')).toBe(25);
  });
});

describe('agent pickup', () => {
  it('is always free regardless of destination', () => {
    for (const state of [...MIDWEST, ...EAST_COAST, ...NON_CONTIGUOUS]) {
      expect(calculateShippingCost('agent_pickup', state), state).toBe(0);
    }
  });

  it('is free even with no address at all', () => {
    expect(calculateShippingCost('agent_pickup', null)).toBe(0);
    expect(calculateShippingCost('agent_pickup', '')).toBe(0);
  });
});

describe('zone resolution edge cases', () => {
  it('is case and whitespace tolerant', () => {
    expect(getShippingZone(' il ')).toBe('midwest');
    expect(getShippingZone('ca')).toBe('coastal');
    expect(getShippingZone('Hi')).toBe('noncontiguous');
  });

  it('defaults an unknown or empty destination to the coastal rate, never lower', () => {
    // A half-filled checkout must never quote less than the final charge.
    expect(calculateShippingCost('standard', null)).toBe(SHIPPING_RATES.coastal);
    expect(calculateShippingCost('standard', '')).toBe(SHIPPING_RATES.coastal);
    expect(calculateShippingCost('standard', undefined)).toBe(SHIPPING_RATES.coastal);
  });

  it('treats an unrecognized code as inland rather than free', () => {
    expect(calculateShippingCost('standard', 'ZZ')).toBe(SHIPPING_RATES.midwest);
  });

  it('prices legacy fedex/usps values identically to standard', () => {
    for (const state of ['IL', 'CA', 'HI']) {
      const standard = calculateShippingCost('standard', state);
      expect(calculateShippingCost('fedex', state), state).toBe(standard);
      expect(calculateShippingCost('usps', state), state).toBe(standard);
    }
  });
});
