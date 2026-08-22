/**
 * Shared Zod primitives -- the single source of truth for cross-boundary
 * value types (money, quantities, ids, addresses).
 *
 * Client-safe: no server-only imports. Route handlers, client components,
 * and stores all import from here so the same rules apply on both sides of
 * every API contract.
 *
 * Conventions:
 *   - Money values are dollars unless a name says otherwise. NaN and
 *     Infinity are always rejected (`finite()`), because NaN comparisons
 *     silently pass every `<` guard and JSON.stringify turns NaN into null.
 *   - Quantities are integers with explicit bounds. Checkout enforces a
 *     10,000-per-line cap; the shared bound matches it.
 */
import { z } from 'zod';

/** Any finite number -- rejects NaN, Infinity, -Infinity. */
export const finiteNumber = z.number().finite();

/** Dollar amount that can never be negative (prices, totals, costs). */
export const moneyAmount = z.number().finite().nonnegative();

/** Dollar amount that must be strictly positive. */
export const positiveMoneyAmount = z.number().finite().positive();

/** Whole-number quantity of at least 1, capped to the checkout line maximum. */
export const lineQuantity = z.number().int().min(1).max(10_000);

export const positiveInt = z.number().int().positive();
export const nonNegativeInt = z.number().int().nonnegative();

export const uuidString = z.string().uuid();

/** Trimmed, non-empty, length-capped string. */
export const boundedString = (max: number) => z.string().trim().min(1).max(max);

/**
 * Shipping address as accepted by checkout (`POST /api/orders`).
 * Kept in lockstep with the orders route -- import this instead of
 * re-declaring the shape (there were previously three drifting copies).
 */
export const ShippingAddressSchema = z.object({
  fullName: z.string().min(1),
  street: z.string().min(1),
  suite: z.string().optional().default(''),
  city: z.string().min(1),
  state: z.string().min(2),
  zip: z.string().min(5),
  phone: z.string().optional().default(''),
});
export type ShippingAddress = z.infer<typeof ShippingAddressSchema>;

/**
 * The canonical API error envelope. Every route returns errors as
 * `{ error: string }` (see lib/api-error.ts safeError). Clients can parse
 * unknown failure bodies against this instead of reading `.error` blind.
 */
export const ApiErrorSchema = z.object({ error: z.string() });
export type ApiError = z.infer<typeof ApiErrorSchema>;
