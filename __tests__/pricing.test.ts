import { describe, it, expect } from 'vitest';
import {
  applyBulkPrice,
  computeAgentCostV2,
  verifyCommissionSafeguard,
  type AgentTier,
} from '@/lib/pricing';

/**
 * Minimal in-memory stand-in for the Supabase service client, sufficient for
 * the two pricing helpers under test. It answers:
 *   - from('products').select('base_cost')...maybeSingle()      -> { base_cost }
 *   - from('profiles').select(...)...maybeSingle()              -> { custom_markup_override, tier }
 *   - from('house_tiers').select(...).order('level')            -> tier rows (awaited via .order)
 *   - from('agent_products').select(...).eq().eq()  (awaited)   -> product rows
 *   - rpc('fn_resolve_house_tier_level', ...)                   -> { data: level }
 * The query builder is also thenable so `await supabase.from(t).select().eq().eq()`
 * resolves to the list payload for that table.
 */
function makeClient(opts: {
  baseCost?: number;
  override?: number | null;
  level?: number;
  tier?: AgentTier;
  tiers?: { level: number; markup: number }[];
  products?: { product_id: string; retail_price: number }[];
}) {
  const tiers = opts.tiers ?? [
    { level: 1, markup: 0.5 },
    { level: 2, markup: 0.6 },
    { level: 3, markup: 0.7 },
  ];
  const listFor = (table: string) => {
    if (table === 'house_tiers') {
      return tiers.map((t) => ({ level: t.level, name: `T${t.level}`, min_volume: 0, max_volume: null, markup: t.markup }));
    }
    if (table === 'agent_products') return opts.products ?? [];
    return [];
  };
  const singleFor = (table: string) => {
    if (table === 'products') return { base_cost: opts.baseCost ?? 0 };
    if (table === 'profiles') return { custom_markup_override: opts.override ?? null, tier: opts.tier ?? 'tier_3' };
    return null;
  };
  const from = (table: string) => {
    const chain: Record<string, unknown> = {};
    const settleList = () => Promise.resolve({ data: listFor(table), error: null });
    Object.assign(chain, {
      select: () => chain,
      eq: () => chain,
      order: () => settleList(),
      maybeSingle: () => Promise.resolve({ data: singleFor(table), error: null }),
      // thenable: awaiting the builder directly resolves to the list payload
      then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) => settleList().then(onF, onR),
    });
    return chain;
  };
  return {
    from,
    rpc: () => Promise.resolve({ data: opts.level ?? 1, error: null }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

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

/**
 * UNIT CONVENTION LOCK: profiles.custom_markup_override is a DECIMAL FRACTION.
 *
 * computeAgentCostV2 computes cost = base * (1 + custom_markup_override). So a
 * 30% markup MUST be stored as 0.30, never 30. Storing the raw percent (the
 * tier-override bug fixed in migration 20260608000080) yields base * 31. These
 * tests fail loudly if the column is ever reinterpreted as a whole percent.
 *
 * Use a UNIQUE productId per case: getProductBaseCost caches base cost by
 * productId for 60s within the module.
 */
describe('computeAgentCostV2 — custom_markup_override is a fraction', () => {
  it('flat override 0.30 on a $10 base yields $13.00 (base * 1.30)', async () => {
    const client = makeClient({ baseCost: 10, override: 0.30 });
    const cost = await computeAgentCostV2(client, 'p-frac-030', 'agent-a');
    expect(cost).toBe(13);
  });

  it('flat override 0.50 on a $20 base yields $30.00 (base * 1.50)', async () => {
    const client = makeClient({ baseCost: 20, override: 0.50 });
    const cost = await computeAgentCostV2(client, 'p-frac-050', 'agent-b');
    expect(cost).toBe(30);
  });

  it('a raw-percent value (30) would be catastrophic: base * 31 — proves why the fraction convention matters', async () => {
    const client = makeClient({ baseCost: 10, override: 30 });
    const cost = await computeAgentCostV2(client, 'p-rawpct-30', 'agent-c');
    // 10 * (1 + 30) = 310. This is the bug the convention prevents; a sane
    // 30% markup is 0.30 -> 13.00 (asserted above).
    expect(cost).toBe(310);
  });

  it('gamified (NULL override) rides the volume ladder markup, not a flat percent', async () => {
    // level 1 -> markup 0.5
    const lvl1 = makeClient({ baseCost: 10, override: null, level: 1 });
    expect(await computeAgentCostV2(lvl1, 'p-gam-l1', 'agent-d')).toBe(15);
    // level 3 -> markup 0.7
    const lvl3 = makeClient({ baseCost: 20, override: null, level: 3 });
    expect(await computeAgentCostV2(lvl3, 'p-gam-l3', 'agent-e')).toBe(34);
  });
});

/**
 * UNIT CONVENTION LOCK: profiles.commission_pct is a WHOLE PERCENT (0-40).
 *
 * verifyCommissionSafeguard treats the commission as a percentage subtracted
 * from gross-margin percent and enforces a >=10% net floor. With a $100 retail
 * and $13 cost (override 0.30), gross margin is 87%:
 *   - 30% commission -> net 57% -> safe
 *   - 80% commission -> net  7% -> unsafe (below the 10% floor)
 * The 80% boundary only makes sense if commission is a whole percent; a
 * fractional 0.80 here would be nonsensical. This locks the opposite-of-markup
 * convention in place.
 */
describe('verifyCommissionSafeguard — commission_pct is a whole percent', () => {
  it('30% commission on a healthy margin is safe', async () => {
    const client = makeClient({
      baseCost: 10,
      override: 0.30, // cost = 13, retail 100 -> gross 87%
      tier: 'tier_3',
      products: [{ product_id: 'p-comm-ok', retail_price: 100 }],
    });
    const res = await verifyCommissionSafeguard(client, 'agent-comm-a', 30);
    expect(res.safe).toBe(true);
  });

  it('80% commission breaks the 10% net-profit floor and is rejected', async () => {
    const client = makeClient({
      baseCost: 10,
      override: 0.30, // cost = 13, retail 100 -> gross 87%, net at 80% = 7% < 10%
      tier: 'tier_3',
      products: [{ product_id: 'p-comm-bad', retail_price: 100 }],
    });
    const res = await verifyCommissionSafeguard(client, 'agent-comm-b', 80);
    expect(res.safe).toBe(false);
  });
});
