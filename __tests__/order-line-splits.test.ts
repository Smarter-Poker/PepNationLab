import { describe, it, expect } from 'vitest';
import { computeLineSplit } from '@/lib/order-line-splits';

/**
 * Per-line fulfillment split tests.
 *
 * The order route splits each cart line between finite agent-local stock and the
 * infinite China supply, and keys the result by cart-line INDEX. These tests
 * lock the split rule; the index-keying (so the same product on two lines does
 * not collide) is covered by the route's loop structure.
 */

describe('computeLineSplit', () => {
  it('sends everything to China when local fulfillment does not apply', () => {
    // agent self-buy / pickup / non-ship -> useLocal=false
    expect(computeLineSplit(3, 999, false)).toEqual({ localQty: 0, chinaQty: 3 });
  });

  it('fills entirely from local when local stock covers the whole line', () => {
    expect(computeLineSplit(2, 5, true)).toEqual({ localQty: 2, chinaQty: 0 });
  });

  it('fills exactly from local when stock equals quantity', () => {
    expect(computeLineSplit(4, 4, true)).toEqual({ localQty: 4, chinaQty: 0 });
  });

  it('splits local + China when local stock partially covers the line', () => {
    expect(computeLineSplit(5, 2, true)).toEqual({ localQty: 2, chinaQty: 3 });
  });

  it('sends everything to China when there is no local stock', () => {
    expect(computeLineSplit(3, 0, true)).toEqual({ localQty: 0, chinaQty: 3 });
  });

  it('treats negative / NaN local stock as zero', () => {
    expect(computeLineSplit(3, -5, true)).toEqual({ localQty: 0, chinaQty: 3 });
    expect(computeLineSplit(3, NaN, true)).toEqual({ localQty: 0, chinaQty: 3 });
  });

  it('floors fractional quantities and stock', () => {
    expect(computeLineSplit(3.9, 1.9, true)).toEqual({ localQty: 1, chinaQty: 2 });
  });

  it('conserves quantity: localQty + chinaQty always equals the ordered qty', () => {
    for (const qty of [1, 2, 7, 50]) {
      for (const stock of [0, 1, 3, 100]) {
        for (const useLocal of [true, false]) {
          const { localQty, chinaQty } = computeLineSplit(qty, stock, useLocal);
          expect(localQty + chinaQty).toBe(qty);
          expect(localQty).toBeGreaterThanOrEqual(0);
          expect(chinaQty).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it('never allocates local beyond available stock', () => {
    expect(computeLineSplit(10, 3, true).localQty).toBe(3);
    expect(computeLineSplit(10, 3, false).localQty).toBe(0);
  });
});
