import { describe, it, expect } from 'vitest';
import { resolveCartIdsToProductIds } from '@/lib/cart-ids';

/**
 * Cart-id resolution tests.
 *
 * Root cause of the mobile "Item Removed" / failed-checkout class: cart item
 * ids are polymorphic. The by-name / quick-add path (mobile, storefront grid
 * not mounted) keys items by `agent_products.id`; the storefront and reorder
 * paths key by `products.id`. Every endpoint that looks ids up in `products`
 * (orders, bac-water, recommendations, cart-warnings) must translate
 * agent_product ids to product ids first, or it silently returns nothing for
 * mobile-added items (and hard-fails checkout). This locks that translation.
 *
 * The helper takes a Supabase client and runs:
 *   supabase.from('agent_products').select('id, product_id').in('id', ids)
 * so we feed a minimal fake that filters a fixture rowset by the requested ids.
 */

type AgentProductRow = { id: string; product_id: string };

function fakeSupabase(rows: AgentProductRow[]) {
  let lastQueriedColumn = '';
  return {
    from(_table: string) {
      return {
        select(_cols: string) {
          return {
            in(column: string, ids: string[]) {
              lastQueriedColumn = column;
              // Mirror PostgREST: only agent_products rows whose id is in the
              // requested set come back.
              const data = rows.filter((r) => ids.includes(r.id));
              return Promise.resolve({ data, error: null });
            },
          };
        },
      };
    },
    _lastQueriedColumn: () => lastQueriedColumn,
  };
}

// Fixtures: two agent_products mapping to one shared product, plus a distinct one.
const AP1 = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'; // agent_product id
const AP2 = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb'; // agent_product id (different agent, SAME product)
const AP3 = 'cccccccc-cccc-4ccc-cccc-cccccccccccc'; // agent_product id
const PROD_X = 'dddddddd-dddd-4ddd-dddd-dddddddddddd'; // product id for AP1 + AP2
const PROD_Y = 'eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee'; // product id for AP3
const PROD_Z = 'ffffffff-ffff-4fff-ffff-ffffffffffff'; // a product id never carried as an agent_product

const ROWS: AgentProductRow[] = [
  { id: AP1, product_id: PROD_X },
  { id: AP2, product_id: PROD_X },
  { id: AP3, product_id: PROD_Y },
];

describe('resolveCartIdsToProductIds', () => {
  it('translates an agent_product id to its underlying product id (mobile by-name path)', async () => {
    const sb = fakeSupabase(ROWS);
    const { productIds, inputToProduct } = await resolveCartIdsToProductIds(sb as any, [AP1]);
    expect(productIds).toEqual([PROD_X]);
    expect(inputToProduct.get(AP1)).toBe(PROD_X);
  });

  it('passes a raw product id through unchanged (storefront / reorder path)', async () => {
    const sb = fakeSupabase(ROWS);
    const { productIds, inputToProduct } = await resolveCartIdsToProductIds(sb as any, [PROD_Z]);
    expect(productIds).toEqual([PROD_Z]);
    expect(inputToProduct.get(PROD_Z)).toBe(PROD_Z);
  });

  it('resolves a mixed cart (agent_product ids AND product ids together)', async () => {
    const sb = fakeSupabase(ROWS);
    const { productIds, inputToProduct } = await resolveCartIdsToProductIds(sb as any, [AP3, PROD_Z]);
    expect(inputToProduct.get(AP3)).toBe(PROD_Y);
    expect(inputToProduct.get(PROD_Z)).toBe(PROD_Z);
    expect(new Set(productIds)).toEqual(new Set([PROD_Y, PROD_Z]));
  });

  it('de-duplicates product ids when two agent_product ids share one product', async () => {
    const sb = fakeSupabase(ROWS);
    const { productIds, inputToProduct } = await resolveCartIdsToProductIds(sb as any, [AP1, AP2]);
    // Both inputs map to the same product...
    expect(inputToProduct.get(AP1)).toBe(PROD_X);
    expect(inputToProduct.get(AP2)).toBe(PROD_X);
    // ...but the product id list is de-duped.
    expect(productIds).toEqual([PROD_X]);
  });

  it('always queries the agent_products.id column (never product_id)', async () => {
    const sb = fakeSupabase(ROWS);
    await resolveCartIdsToProductIds(sb as any, [AP1, PROD_Z]);
    expect(sb._lastQueriedColumn()).toBe('id');
  });

  it('returns empty for empty input without hitting the DB', async () => {
    const sb = fakeSupabase(ROWS);
    const { productIds, inputToProduct } = await resolveCartIdsToProductIds(sb as any, []);
    expect(productIds).toEqual([]);
    expect(inputToProduct.size).toBe(0);
  });

  it('collapses duplicate input ids', async () => {
    const sb = fakeSupabase(ROWS);
    const { productIds } = await resolveCartIdsToProductIds(sb as any, [PROD_Z, PROD_Z, PROD_Z]);
    expect(productIds).toEqual([PROD_Z]);
  });

  it('ignores null / undefined / empty-string ids defensively', async () => {
    const sb = fakeSupabase(ROWS);
    const input = [AP1, '', null as unknown as string, undefined as unknown as string];
    const { productIds, inputToProduct } = await resolveCartIdsToProductIds(sb as any, input);
    expect(productIds).toEqual([PROD_X]);
    expect(inputToProduct.size).toBe(1);
  });
});
