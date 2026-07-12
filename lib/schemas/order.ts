/**
 * Order contracts -- shared by checkout (client) and the order routes
 * (server). This is the highest-stakes boundary on the platform: payment is
 * a manual Zelle/Venmo/CashApp transfer of exactly the displayed amount, so
 * both the request AND the response of order creation are schema-locked.
 */
import { z } from 'zod';
import { ShippingAddressSchema, lineQuantity, uuidString } from '@/lib/schemas/common';
import { PaymentMethodEnum } from '@/lib/schemas/payment';

/**
 * POST /api/orders request body. Client sends only ids + quantities; every
 * price is recomputed server-side from the catalog.
 */
export const CheckoutSchema = z.object({
  items: z
    .array(
      z.object({
        id: uuidString,
        quantity: lineQuantity,
        bundleName: z.string().optional(),
      })
    )
    .min(1, 'Cart Cannot Be Empty.'),
  fulfillmentMethod: z.enum(['ship', 'agent_pickup']),
  shippingOption: z.enum(['fedex', 'usps', 'agent_pickup']).optional(),
  paymentMethod: PaymentMethodEnum,
  shippingAddress: ShippingAddressSchema.optional().nullable(),
  couponCode: z.string().optional().nullable(),
  idempotencyKey: uuidString.optional().nullable(),
  wholesale: z.boolean().optional(),

  /** Which agent storefront initiated this checkout - used for closed-loop catalog validation */
  agentSlug: z.string().regex(/^[a-zA-Z0-9_-]+$/).optional().nullable(),
});
export type CheckoutInput = z.infer<typeof CheckoutSchema>;

/**
 * POST /api/orders success body. Mirrors the three success returns in
 * app/api/orders/route.ts (fresh insert, idempotent replay, and the
 * lost-insert-race replay). The client MUST parse the response against this
 * before showing "Amount Due" -- a drifted or malformed response must never
 * fabricate a payment amount from client-side math.
 */
export const OrderCreateResponseSchema = z.object({
  success: z.literal(true),
  orderId: uuidString,
  total: z.number().finite().nonnegative(),
  replayed: z.boolean().optional(),
});
export type OrderCreateResponse = z.infer<typeof OrderCreateResponseSchema>;

/**
 * POST /api/agent/orders/new request body (agent manual order).
 * Prices are NOT accepted from the client -- the route recomputes the
 * subtotal from the agent's catalog. shippingCost is agent-entered but
 * clamped to [0, 1000] and rounded to cents.
 */
export const ManualOrderInputSchema = z.object({
  items: z
    .array(
      z.object({
        product_id: uuidString.optional(),
        agent_product_id: uuidString.optional(),
        quantity: lineQuantity,
      })
    )
    .min(1, 'Order Must Contain Items.')
    .max(100),
  buyerName: z.string().trim().max(200).optional(),
  buyerEmail: z.string().trim().max(320).optional(),
  street: z.string().trim().max(300).optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(60).optional(),
  zip: z.string().trim().max(20).optional(),
  /** Display-only echo of the client's subtotal; server recomputes and cross-checks. */
  subtotal: z.number().finite().nonnegative().optional().nullable(),
  shippingCost: z.number().finite().min(0).max(1000).optional(),
  paymentMethod: PaymentMethodEnum.optional(),
  fulfillmentMethod: z.enum(['ship', 'agent_pickup']).optional(),
});
export type ManualOrderInput = z.infer<typeof ManualOrderInputSchema>;

/** POST /api/shipping-preview success body (checkout live rate quote). */
export const ShippingPreviewResponseSchema = z.object({
  rate: z.number().finite().nonnegative(),
  estimated: z.boolean().optional().default(false),
  carrier: z.string().nullable().optional(),
});
export type ShippingPreviewResponse = z.infer<typeof ShippingPreviewResponseSchema>;
