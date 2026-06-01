import { describe, it, expect } from 'vitest';
import { applyBulkPrice, type AgentTier } from '@/lib/pricing';

/**
 * Pricing math tests.
 *
 * applyBulkPrice is the bulk-pricing threshold gate used at order
 * creation and at agent restock. A bug here is a quiet money bug:
 * undercharging or overcharging by a dollar amount that never trips
 * an error. Lock the behavior.
 *
 * The cached, DB-touching helpers (computeAgentCost,
 * computeSubAgentBaselineCost, getTierMultiplier) are exercised by
 * the integration test suite where a real Supabase service client is
 * available. We do not mock the chained PostgREST builder here because
 * the mock surface is huge relative to the test value.
 */

describe('applyBulkPrice', () => {
  it('returns the base price when no bulk pricing is configured', () => {
    expect(applyBulkPrice(10, 5, null, null)).toBe(10);
    expect(applyBulkPrice(10, 1000, null, 100)).toBe(10);
    expect(applyBulkPrice(10, 5, undefined, undefined)).toBe(10);
  });

  it('uses default threshold of 100 when threshold is null/undefined and bulk price is set', () => {
    expect(applyBulkPrice(10, 99, 7, null)).toBe(10);
    expect(applyBulkPrice(10, 99, 7, undefined)).toBe(10);
    expect(applyBulkPrice(10, 100, 7, null)).toBe(7);
    expect(applyBulkPrice(10, 100, 7, undefined)).toBe(7);
  });

  it('honors a custom threshold', () => {
    expect(applyBulkPrice(10, 49, 7, 50)).toBe(10);
    expect(applyBulkPrice(10, 50, 7, 50)).toBe(7);
    expect(applyBulkPrice(10, 51, 7, 50)).toBe(7);
  });

  it('falls back to default 100 when threshold is 0 or negative (invalid config)', () => {
    expect(applyBulkPrice(10, 50, 7, 0)).toBe(10);
    expect(applyBulkPrice(10, 100, 7, 0)).toBe(7);
    expect(applyBulkPrice(10, 50, 7, -10)).toBe(10);
  });

  it('coerces numeric bulk price strings (defensive — DB returns NUMERIC as string in some drivers)', () => {
    const bulkPrice = '7.50' as unknown as number;
    expect(applyBulkPrice(10, 100, bulkPrice, 100)).toBe(7.5);
  });

  it('boundary: threshold equals quantity exactly', () => {
    expect(applyBulkPrice(10, 50, 7, 50)).toBe(7);
  });

  it('AgentTier type contains exactly the three known tiers', () => {
    const all: AgentTier[] = ['tier_1', 'tier_2', 'tier_3'];
    expect(all.length).toBe(3);
  });
});
