/**
 * Shared Zod schema layer tests (lib/schemas/*).
 *
 * These lock the fail-closed behavior the 2026-07-12 type-safety sweep
 * introduced: NaN/Infinity money values must never pass a boundary, cart
 * sanitization must drop (not default) malformed lines, and password fields
 * must be real strings.
 */
import { describe, it, expect } from 'vitest';
import { sanitizeStoredCart, storedCartItemToClient, ResolvedCartItemSchema } from '@/lib/schemas/cart';
import { CheckoutSchema, OrderCreateResponseSchema, ManualOrderInputSchema } from '@/lib/schemas/order';
import { CouponInputSchema, CouponValidateResponseSchema } from '@/lib/schemas/coupon';
import { AgentProductPatchSchema, AdminProductPatchSchema, SubAgentPricingSchema } from '@/lib/schemas/product';
import { PasswordSchema, StorefrontRegisterSchema } from '@/lib/schemas/auth';
import { parsePositiveNumber } from '@/lib/schemas/calculator';
import { PaymentMethodEnum } from '@/lib/schemas/payment';

const UUID = '123e4567-e89b-42d3-a456-426614174000';

describe('sanitizeStoredCart', () => {
  const validLine = {
    id: UUID,
    productId: null,
    name: 'Test Peptide',
    sku: 'TP-1',
    quantity: 2,
    costPrice: 10,
    retailPrice: 25,
    bulkCostPrice: null,
    bulkThreshold: null,
    weightOz: 0.5,
    bundleName: null,
    agentSelfBuy: false,
  };

  it('keeps a valid line intact', () => {
    const out = sanitizeStoredCart([validLine]);
    expect(out).toHaveLength(1);
    expect(out[0].retailPrice).toBe(25);
  });

  it('drops lines without a UUID id instead of defaulting them', () => {
    expect(sanitizeStoredCart([{ ...validLine, id: 'not-a-uuid' }])).toHaveLength(0);
    expect(sanitizeStoredCart([null, 'junk', 42])).toHaveLength(0);
  });

  it('coerces NaN prices to 0, never NaN', () => {
    const out = sanitizeStoredCart([{ ...validLine, retailPrice: NaN, costPrice: 'abc' }]);
    expect(out).toHaveLength(1);
    expect(out[0].retailPrice).toBe(0);
    expect(out[0].costPrice).toBe(0);
  });

  it('clamps quantity to [1, 9999] and floors fractions', () => {
    expect(sanitizeStoredCart([{ ...validLine, quantity: -5 }])[0].quantity).toBe(1);
    expect(sanitizeStoredCart([{ ...validLine, quantity: 250000 }])[0].quantity).toBe(9999);
    expect(sanitizeStoredCart([{ ...validLine, quantity: 2.9 }])[0].quantity).toBe(2);
    expect(sanitizeStoredCart([{ ...validLine, quantity: NaN }])[0].quantity).toBe(1);
  });

  it('enforces the 50-line cap', () => {
    const big = Array.from({ length: 60 }, () => ({ ...validLine }));
    expect(sanitizeStoredCart(big)).toHaveLength(50);
  });

  it('returns [] for non-array payloads', () => {
    expect(sanitizeStoredCart('{"cart":true}')).toEqual([]);
    expect(sanitizeStoredCart(undefined)).toEqual([]);
  });

  it('round-trips to the client CartItem shape with nulls normalized', () => {
    const [stored] = sanitizeStoredCart([{ ...validLine, sku: null, weightOz: null }]);
    const client = storedCartItemToClient(stored);
    expect(client.sku).toBe('');
    expect(client.weightOz).toBe(0);
    expect(client.bundleName).toBeUndefined();
  });
});

describe('CheckoutSchema', () => {
  const base = {
    items: [{ id: UUID, quantity: 1 }],
    fulfillmentMethod: 'ship',
    paymentMethod: 'zelle',
    shippingAddress: { fullName: 'A B', street: '1 Main', city: 'Austin', state: 'TX', zip: '78701' },
  };

  it('accepts a valid checkout', () => {
    expect(CheckoutSchema.safeParse(base).success).toBe(true);
  });

  it('rejects zero, negative, fractional, and oversized quantities', () => {
    for (const quantity of [0, -1, 1.5, 10001, NaN]) {
      const r = CheckoutSchema.safeParse({ ...base, items: [{ id: UUID, quantity }] });
      expect(r.success).toBe(false);
    }
  });

  it('rejects unknown payment methods and accepts varo', () => {
    expect(CheckoutSchema.safeParse({ ...base, paymentMethod: 'bitcoin' }).success).toBe(false);
    expect(CheckoutSchema.safeParse({ ...base, paymentMethod: 'varo' }).success).toBe(true);
  });

  it('rejects an empty cart', () => {
    expect(CheckoutSchema.safeParse({ ...base, items: [] }).success).toBe(false);
  });
});

describe('OrderCreateResponseSchema', () => {
  it('accepts the real success shape', () => {
    const r = OrderCreateResponseSchema.safeParse({ success: true, orderId: UUID, total: 123.45 });
    expect(r.success).toBe(true);
  });

  it('rejects drifted shapes that would fabricate an Amount Due', () => {
    expect(OrderCreateResponseSchema.safeParse({ success: true, orderId: UUID }).success).toBe(false);
    expect(OrderCreateResponseSchema.safeParse({ success: true, orderId: UUID, total: NaN }).success).toBe(false);
    expect(OrderCreateResponseSchema.safeParse({ success: true, orderId: 'abc', total: 10 }).success).toBe(false);
    expect(OrderCreateResponseSchema.safeParse({ error: 'x' }).success).toBe(false);
  });
});

describe('ManualOrderInputSchema', () => {
  it('bounds shipping cost to [0, 1000] and requires finite values', () => {
    const base = { items: [{ agent_product_id: UUID, quantity: 1 }] };
    expect(ManualOrderInputSchema.safeParse({ ...base, shippingCost: 25 }).success).toBe(true);
    expect(ManualOrderInputSchema.safeParse({ ...base, shippingCost: -25 }).success).toBe(false);
    expect(ManualOrderInputSchema.safeParse({ ...base, shippingCost: 5000 }).success).toBe(false);
    expect(ManualOrderInputSchema.safeParse({ ...base, shippingCost: NaN }).success).toBe(false);
  });

  it('caps quantity at 10000 like checkout', () => {
    const r = ManualOrderInputSchema.safeParse({ items: [{ product_id: UUID, quantity: 999999 }] });
    expect(r.success).toBe(false);
  });
});

describe('CouponInputSchema', () => {
  it('uses min_order_amount (the DB column name), not min_subtotal', () => {
    const r = CouponInputSchema.safeParse({
      code: 'SAVE10',
      discount_type: 'percent',
      discount_value: 10,
      min_order_amount: 50,
    });
    expect(r.success).toBe(true);
    expect(r.success && r.data.min_order_amount).toBe(50);
  });

  it('requires a minimum order for fixed discounts and enforces value <= minimum', () => {
    const fixedNoMin = CouponInputSchema.safeParse({ code: 'TEN', discount_type: 'fixed', discount_value: 10 });
    expect(fixedNoMin.success).toBe(false);
    const fixedTooBig = CouponInputSchema.safeParse({ code: 'TEN', discount_type: 'fixed', discount_value: 100, min_order_amount: 50 });
    expect(fixedTooBig.success).toBe(false);
    const ok = CouponInputSchema.safeParse({ code: 'TEN', discount_type: 'fixed', discount_value: 10, min_order_amount: 50 });
    expect(ok.success).toBe(true);
  });

  it('bounds percent discounts to 1-90', () => {
    expect(CouponInputSchema.safeParse({ code: 'ALL', discount_type: 'percent', discount_value: 100 }).success).toBe(false);
  });
});

describe('CouponValidateResponseSchema', () => {
  it('parses both branches and rejects NaN discounts', () => {
    expect(CouponValidateResponseSchema.safeParse({ valid: true, code: 'X', discount: 5 }).success).toBe(true);
    expect(CouponValidateResponseSchema.safeParse({ valid: false, error: 'Nope' }).success).toBe(true);
    expect(CouponValidateResponseSchema.safeParse({ valid: true, code: 'X', discount: NaN }).success).toBe(false);
  });
});

describe('AgentProductPatchSchema', () => {
  it('rejects NaN and string sale prices that previously bypassed the MAP guards', () => {
    expect(AgentProductPatchSchema.safeParse({ id: UUID, sale_price: NaN }).success).toBe(false);
    expect(AgentProductPatchSchema.safeParse({ id: UUID, sale_price: 'abc' }).success).toBe(false);
    expect(AgentProductPatchSchema.safeParse({ id: UUID, sale_price: -5 }).success).toBe(false);
    expect(AgentProductPatchSchema.safeParse({ id: UUID, sale_price: null }).success).toBe(true);
    expect(AgentProductPatchSchema.safeParse({ id: UUID, sale_price: 250 }).success).toBe(true);
  });
});

describe('AdminProductPatchSchema', () => {
  it('validates every money/inventory field, not just base_cost', () => {
    expect(AdminProductPatchSchema.safeParse({ id: UUID, admin_bulk_price: 'free' }).success).toBe(false);
    expect(AdminProductPatchSchema.safeParse({ id: UUID, inventory_count: -10 }).success).toBe(false);
    expect(AdminProductPatchSchema.safeParse({ id: UUID, base_cost: 0 }).success).toBe(false);
    expect(AdminProductPatchSchema.safeParse({ id: UUID, base_cost: 12.5, inventory_count: 100 }).success).toBe(true);
  });
});

describe('SubAgentPricingSchema', () => {
  it('rejects NaN baselines (typeof NaN === "number" bypassed the old check)', () => {
    expect(SubAgentPricingSchema.safeParse({ product_id: UUID, baseline_cost: NaN }).success).toBe(false);
    expect(SubAgentPricingSchema.safeParse({ product_id: UUID, baseline_cost: 100, bulk_baseline_cost: NaN }).success).toBe(false);
    expect(SubAgentPricingSchema.safeParse({ product_id: UUID, baseline_cost: 100, bulk_baseline_cost: null, bulk_threshold: 100 }).success).toBe(true);
  });
});

describe('PasswordSchema', () => {
  it('rejects non-string values that previously bypassed .length checks', () => {
    expect(PasswordSchema.safeParse(12345678).success).toBe(false);
    expect(PasswordSchema.safeParse(null).success).toBe(false);
    expect(PasswordSchema.safeParse('short').success).toBe(false);
    expect(PasswordSchema.safeParse('a'.repeat(129)).success).toBe(false);
    expect(PasswordSchema.safeParse('correct-horse-battery').success).toBe(true);
  });
});

describe('StorefrontRegisterSchema', () => {
  it('requires all identity fields as strings', () => {
    const ok = StorefrontRegisterSchema.safeParse({
      agentSlug: 'midway', username: 'dan_1', password: 'longenough',
      firstName: 'Dan', lastName: 'B', email: 'dan@example.com',
    });
    expect(ok.success).toBe(true);
    const numericPassword = StorefrontRegisterSchema.safeParse({
      agentSlug: 'midway', username: 'dan_1', password: 12345678,
      firstName: 'Dan', lastName: 'B',
    });
    expect(numericPassword.success).toBe(false);
  });
});

describe('ResolvedCartItemSchema', () => {
  it('rejects items with NaN prices from the by-name add path', () => {
    const base = { id: UUID, name: 'BPC-157', retailPrice: 45, costPrice: 45 };
    expect(ResolvedCartItemSchema.safeParse(base).success).toBe(true);
    expect(ResolvedCartItemSchema.safeParse({ ...base, retailPrice: NaN }).success).toBe(false);
    expect(ResolvedCartItemSchema.safeParse({ ...base, retailPrice: -1 }).success).toBe(false);
  });
});

describe('parsePositiveNumber', () => {
  it('fails closed on NaN, negatives, zero, Infinity, and overlimit', () => {
    expect(parsePositiveNumber('abc')).toBeNull();
    expect(parsePositiveNumber('-5')).toBeNull();
    expect(parsePositiveNumber('0')).toBeNull();
    expect(parsePositiveNumber('Infinity')).toBeNull();
    expect(parsePositiveNumber('50', 10)).toBeNull();
    expect(parsePositiveNumber('2.5')).toBe(2.5);
    expect(parsePositiveNumber('')).toBeNull();
    expect(parsePositiveNumber(undefined)).toBeNull();
  });
});

describe('PaymentMethodEnum', () => {
  it('matches the canonical slug list including varo', () => {
    expect(PaymentMethodEnum.safeParse('varo').success).toBe(true);
    expect(PaymentMethodEnum.safeParse('zelle').success).toBe(true);
    expect(PaymentMethodEnum.safeParse('bitcoin').success).toBe(false);
  });
});
