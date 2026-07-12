/**
 * Coupon contracts. The DB column and every route use `min_order_amount`;
 * the agent UI previously sent `min_subtotal`, which the server silently
 * dropped -- coupons were created with NO minimum and redeemable on any
 * order amount. Import these schemas on BOTH sides so the field names can
 * never drift again.
 */
import { z } from 'zod';
import { uuidString } from '@/lib/schemas/common';

export const CouponCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9-]{3,24}$/, 'Code Must Be 3 To 24 Characters Using Letters, Numbers, And Hyphens Only.');

/** Create / edit payload for POST /api/agent/coupons and PATCH /api/agent/coupons/[id]. */
export const CouponInputSchema = z
  .object({
    code: CouponCodeSchema,
    discount_type: z.enum(['percent', 'fixed']),
    discount_value: z.number().finite().positive(),
    min_order_amount: z.number().finite().nonnegative().nullable().optional(),
    max_uses: z.number().int().min(1).max(100_000).nullable().optional(),
    max_uses_per_user: z.number().int().min(1).nullable().optional(),
    starts_at: z.string().nullable().optional(),
    expires_at: z.string().nullable().optional(),
    new_customers_only: z.boolean().optional(),
    notes: z.string().max(500).nullable().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.discount_type === 'percent' && (val.discount_value < 1 || val.discount_value > 90)) {
      ctx.addIssue({ code: 'custom', path: ['discount_value'], message: 'Percent Discount Must Be Between 1% And 90%.' });
    }
    if (val.discount_type === 'fixed') {
      if (val.discount_value < 1 || val.discount_value > 500) {
        ctx.addIssue({ code: 'custom', path: ['discount_value'], message: 'Fixed Discount Must Be Between $1 And $500.' });
      }
      if (val.min_order_amount == null) {
        ctx.addIssue({ code: 'custom', path: ['min_order_amount'], message: 'A Fixed-Amount Discount Requires A Minimum Order.' });
      } else if (val.discount_value > val.min_order_amount) {
        ctx.addIssue({ code: 'custom', path: ['min_order_amount'], message: 'Fixed Discount Cannot Be Greater Than Minimum Order Amount.' });
      }
    }
  });
export type CouponInput = z.infer<typeof CouponInputSchema>;

/** A coupon row as returned by GET /api/agent/coupons (DB column names). */
export const CouponRowSchema = z.object({
  id: uuidString,
  code: z.string(),
  discount_type: z.enum(['percent', 'fixed']),
  discount_value: z.number(),
  min_order_amount: z.number().nullable(),
  max_uses: z.number().nullable(),
  max_uses_per_user: z.number().nullable().optional(),
  uses_count: z.number(),
  is_active: z.boolean(),
  starts_at: z.string().nullable().optional(),
  expires_at: z.string().nullable(),
  created_at: z.string(),
  new_customers_only: z.boolean().optional(),
  notes: z.string().nullable().optional(),
});
export type CouponRow = z.infer<typeof CouponRowSchema>;

/**
 * POST /api/coupons/validate response. Always HTTP 200 with { valid, ... }
 * for signed-in callers; order creation re-validates server-side.
 */
export const CouponValidateResponseSchema = z.union([
  z.object({
    valid: z.literal(true),
    code: z.string(),
    discount: z.number().finite().nonnegative(),
  }),
  z.object({
    valid: z.literal(false),
    error: z.string().optional(),
  }),
]);
export type CouponValidateResponse = z.infer<typeof CouponValidateResponseSchema>;
