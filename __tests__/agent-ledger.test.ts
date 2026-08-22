import { describe, it, expect } from 'vitest';
import { computeOwnOrderLedger, computeUplineLedger } from '../lib/agent-ledger';

const REAL_ORDER = { total: 199.85, shipping_cost: 0, discount_amount: 22.21 };
const REAL_ITEMS = [{ quantity: 3, unit_retail_price: 74.02, unit_cost_price: 27.42, unit_super_agent_cost: 13.71 }];

describe('agent ledger logic', () => {
  it('1. Real-world Eddie fixture — own order ledger', () => {
    const res = computeOwnOrderLedger(REAL_ORDER, REAL_ITEMS);
    expect(res.grossCustomerPmt).toBeCloseTo(222.06, 2);
    expect(res.netYouCollect).toBeCloseTo(199.85, 2);
    expect(res.discount).toBeCloseTo(22.21, 2);
    expect(res.youOweSB).toBeCloseTo(82.26, 2);
    expect(res.sbCostTotal).toBeCloseTo(41.13, 2);
    expect(res.markupSpread).toBeCloseTo(41.13, 2);
    expect(res.shippingCost).toBeCloseTo(0, 2);
    expect(res.ownProfit).toBeCloseTo(117.59, 2);
    expect(res.hasSbCost).toBe(true);
  });

  it('2. Real-world Eddie fixture — upline ledger', () => {
    const res = computeUplineLedger(REAL_ORDER, REAL_ITEMS);
    expect(res.grossCustomerPmt).toBeCloseTo(222.06, 2);
    expect(res.netYouCollect).toBeCloseTo(199.85, 2);
    expect(res.discount).toBeCloseTo(22.21, 2);
    expect(res.dlOwesYou).toBeCloseTo(82.26, 2);
    expect(res.youOwePepNation).toBeCloseTo(41.13, 2);
    expect(res.uplProfit).toBeCloseTo(41.13, 2);
    expect(res.shippingCost).toBeCloseTo(0, 2);
  });

  it('3. No upline cost', () => {
    const order = { ...REAL_ORDER, shipping_cost: 10 };
    const items = [{ quantity: 3, unit_retail_price: 74.02, unit_cost_price: 27.42, unit_super_agent_cost: 0 }];
    const resOwn = computeOwnOrderLedger(order, items);
    const resUpline = computeUplineLedger(order, items);
    
    expect(resOwn.hasSbCost).toBe(false);
    expect(resOwn.markupSpread).toBeNull();
    
    expect(resUpline.youOwePepNation).toBeCloseTo(10, 2); // just shipping
    expect(resUpline.uplProfit).toBeCloseTo(82.26, 2); // 27.42 * 3 - 0
  });

  it('4. Multi-item order sums correctly', () => {
    const items = [
      { quantity: 1, unit_retail_price: 10, unit_cost_price: 5, unit_super_agent_cost: 2 },
      { quantity: 2, unit_retail_price: 20, unit_cost_price: 10, unit_super_agent_cost: 4 } // 40, 20, 8
    ];
    const order = { total: 50, shipping_cost: 0, discount_amount: 0 };
    const res = computeOwnOrderLedger(order, items);
    expect(res.grossCustomerPmt).toBeCloseTo(50, 2);
    expect(res.youOweSB).toBeCloseTo(25, 2);
    expect(res.sbCostTotal).toBeCloseTo(10, 2);
    expect(res.markupSpread).toBeCloseTo(15, 2);
    expect(res.ownProfit).toBeCloseTo(25, 2);
  });

  it('5. Zero-quantity items are skipped', () => {
    const items = [
      { quantity: 0, unit_retail_price: 100, unit_cost_price: 50, unit_super_agent_cost: 20 },
      { quantity: -1, unit_retail_price: 100, unit_cost_price: 50, unit_super_agent_cost: 20 }
    ];
    const res = computeOwnOrderLedger(REAL_ORDER, items);
    expect(res.grossCustomerPmt).toBeCloseTo(0, 2);
    expect(res.youOweSB).toBeCloseTo(0, 2);
    expect(res.sbCostTotal).toBeCloseTo(0, 2);
  });

  it('6. Null/undefined item fields coerce to 0 without crashing', () => {
    const items = [
      { quantity: 2, unit_retail_price: null, unit_cost_price: undefined, unit_super_agent_cost: null } as any
    ];
    const order = { total: null, shipping_cost: undefined, discount_amount: null } as any;
    const res = computeOwnOrderLedger(order, items);
    expect(res.grossCustomerPmt).toBeCloseTo(0, 2);
    expect(res.youOweSB).toBeCloseTo(0, 2);
    expect(res.sbCostTotal).toBeCloseTo(0, 2);
    expect(res.ownProfit).toBeCloseTo(0, 2);
  });

  it('7. Shipping cost passes through correctly', () => {
    const resOwn = computeOwnOrderLedger({ ...REAL_ORDER, shipping_cost: 15.50 }, []);
    const resUp = computeUplineLedger({ ...REAL_ORDER, shipping_cost: 15.50 }, []);
    
    expect(resOwn.shippingCost).toBeCloseTo(15.50, 2);
    expect(resOwn.youOweSB).toBeCloseTo(15.50, 2);
    
    expect(resUp.shippingCost).toBeCloseTo(15.50, 2);
    expect(resUp.youOwePepNation).toBeCloseTo(15.50, 2);
  });

  it('8. Discount is pass-through from order.total', () => {
    const res = computeOwnOrderLedger({ total: 100, shipping_cost: 0, discount_amount: 50 }, []);
    expect(res.discount).toBeCloseTo(50, 2);
    // Not recalculated in our logic, just returned
  });

  it('9. String number inputs coerce correctly', () => {
    const items = [
      { quantity: '3', unit_retail_price: '74.02', unit_cost_price: '27.42', unit_super_agent_cost: '13.71' }
    ];
    const order = { total: '199.85', shipping_cost: '0', discount_amount: '22.21' };
    const res = computeOwnOrderLedger(order, items);
    expect(res.grossCustomerPmt).toBeCloseTo(222.06, 2);
    expect(res.youOweSB).toBeCloseTo(82.26, 2);
    expect(res.ownProfit).toBeCloseTo(117.59, 2);
  });

  it('10. Profit can go negative', () => {
    // netYouCollect = 10, youOweSB = 25
    const order = { total: 10, shipping_cost: 0, discount_amount: 0 };
    const items = [{ quantity: 1, unit_retail_price: 10, unit_cost_price: 25, unit_super_agent_cost: 10 }];
    const res = computeOwnOrderLedger(order, items);
    expect(res.ownProfit).toBeCloseTo(-15, 2);
  });
});
