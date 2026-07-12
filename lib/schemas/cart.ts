/**
 * Cart contracts -- the single source of truth for what a cart line looks
 * like everywhere it crosses a boundary:
 *
 *   - POST /api/cart/sync   (client -> profiles.cart_state JSONB)
 *   - GET  /api/cart/sync   (profiles.cart_state -> client restore)
 *   - POST /api/cart/resolve-name  (server-resolved item -> client cart)
 *   - POST /api/cart/refresh       (server-repriced items -> client cart)
 *   - localStorage cart hydration on the client
 *
 * The stored shape is DISPLAY DATA ONLY: checkout (`POST /api/orders`)
 * recomputes every price from the catalog server-side and only trusts
 * `id` + `quantity` + `bundleName` from the cart. Sanitizing here still
 * matters because a NaN/absurd stored price renders a wrong "Amount Due"
 * preview and corrupts the abandoned-cart reminder emails.
 */
import { z } from 'zod';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** A cart line as persisted in profiles.cart_state and restored to clients. */
export const StoredCartItemSchema = z.object({
  id: z.string().regex(UUID_REGEX),
  productId: z.string().regex(UUID_REGEX).nullable(),
  name: z.string().max(100),
  sku: z.string().max(50).nullable(),
  quantity: z.number().int().min(1).max(9999),
  costPrice: z.number().finite().nonnegative(),
  retailPrice: z.number().finite().nonnegative(),
  bulkCostPrice: z.number().finite().nonnegative().nullable(),
  bulkThreshold: z.number().int().min(1).nullable(),
  weightOz: z.number().finite().nonnegative().nullable(),
  bundleName: z.string().max(100).nullable(),
  agentSelfBuy: z.boolean(),
});
export type StoredCartItem = z.infer<typeof StoredCartItemSchema>;

/**
 * Lenient, fail-closed sanitizer for untrusted cart payloads (client POST
 * bodies, JSONB round-trips, localStorage). Lines that cannot be coerced to
 * a valid StoredCartItem are DROPPED (never defaulted into a "free" or
 * NaN-priced line). Used identically by the sync route (write side) and the
 * client restore path (read side) so the round-trip cannot drift.
 */
export function sanitizeStoredCart(raw: unknown, maxItems = 50): StoredCartItem[] {
  if (!Array.isArray(raw)) return [];
  const out: StoredCartItem[] = [];
  for (const entry of raw.slice(0, maxItems)) {
    if (!entry || typeof entry !== 'object') continue;
    const item = entry as Record<string, unknown>;
    if (typeof item.id !== 'string' || !UUID_REGEX.test(item.id)) continue;

    const qtyNum = Number(item.quantity);
    const quantity = Number.isFinite(qtyNum)
      ? Math.max(1, Math.min(9999, Math.floor(qtyNum)))
      : 1;

    const money = (v: unknown): number => {
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 ? n : 0;
    };
    const moneyOrNull = (v: unknown): number | null => {
      if (v == null || v === '') return null;
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 ? n : null;
    };

    let bulkThreshold: number | null = null;
    if (item.bulkThreshold != null && item.bulkThreshold !== '') {
      const n = Number(item.bulkThreshold);
      bulkThreshold = Number.isFinite(n) && n >= 1 ? Math.floor(n) : null;
    }

    const candidate: StoredCartItem = {
      id: item.id,
      productId:
        typeof item.productId === 'string' && UUID_REGEX.test(item.productId)
          ? item.productId
          : null,
      name: String(item.name ?? '').slice(0, 100),
      sku: item.sku ? String(item.sku).slice(0, 50) : null,
      quantity,
      costPrice: money(item.costPrice),
      retailPrice: money(item.retailPrice),
      bulkCostPrice: moneyOrNull(item.bulkCostPrice),
      bulkThreshold,
      weightOz: moneyOrNull(item.weightOz),
      bundleName:
        typeof item.bundleName === 'string' && item.bundleName.trim()
          ? item.bundleName.slice(0, 100)
          : null,
      agentSelfBuy: item.agentSelfBuy === true,
    };

    const parsed = StoredCartItemSchema.safeParse(candidate);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

/**
 * Convert a sanitized stored line to the client CartItem shape
 * (components/CartContext.tsx): nulls become the client's expected
 * empty-string / undefined forms. Structurally compatible with CartItem so
 * the two modules stay decoupled.
 */
export function storedCartItemToClient(item: StoredCartItem): {
  id: string;
  productId: string | null;
  name: string;
  sku: string;
  quantity: number;
  retailPrice: number;
  costPrice: number;
  bulkCostPrice: number | null;
  bulkThreshold: number | undefined;
  weightOz: number;
  agentSelfBuy: boolean | undefined;
  bundleName: string | undefined;
} {
  return {
    id: item.id,
    productId: item.productId,
    name: item.name,
    sku: item.sku ?? '',
    quantity: item.quantity,
    retailPrice: item.retailPrice,
    costPrice: item.costPrice,
    bulkCostPrice: item.bulkCostPrice,
    bulkThreshold: item.bulkThreshold ?? undefined,
    weightOz: item.weightOz ?? 0,
    agentSelfBuy: item.agentSelfBuy || undefined,
    bundleName: item.bundleName ?? undefined,
  };
}

/**
 * The item shape /api/cart/resolve-name returns for the by-name add path.
 * The client previously inserted `data.item` into the cart with zero
 * validation; parse against this first.
 */
export const ResolvedCartItemSchema = z.object({
  id: z.string().regex(UUID_REGEX),
  productId: z.string().regex(UUID_REGEX).nullable().optional(),
  name: z.string().min(1).max(200),
  sku: z.string().max(50).nullable().optional().default(''),
  retailPrice: z.number().finite().nonnegative(),
  costPrice: z.number().finite().nonnegative(),
  bulkCostPrice: z.number().finite().nonnegative().nullable().optional(),
  bulkThreshold: z.number().int().min(1).nullable().optional(),
  weightOz: z.number().finite().nonnegative().optional().default(0),
  agentSelfBuy: z.boolean().optional(),
});
export type ResolvedCartItem = z.infer<typeof ResolvedCartItemSchema>;

/** One repriced line from POST /api/cart/refresh. */
export const CartRefreshItemSchema = z.object({
  productId: z.string().regex(UUID_REGEX).nullable().optional(),
  available: z.boolean(),
  retailPrice: z.number().finite().nonnegative().nullable().optional(),
  bulkCostPrice: z.number().finite().nonnegative().nullable().optional(),
  bulkThreshold: z.number().int().min(1).nullable().optional(),
});
export type CartRefreshItem = z.infer<typeof CartRefreshItemSchema>;
