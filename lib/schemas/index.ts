/**
 * Shared Zod schema layer -- single source of truth for every critical
 * data boundary (client <-> API <-> database).
 *
 * Client-safe barrel: everything re-exported here can be imported from
 * components and stores. The server-only request helper lives in
 * lib/schemas/http.ts and must be imported directly by route handlers.
 */
export * from '@/lib/schemas/common';
export * from '@/lib/schemas/payment';
export * from '@/lib/schemas/cart';
export * from '@/lib/schemas/order';
export * from '@/lib/schemas/coupon';
export * from '@/lib/schemas/product';
export * from '@/lib/schemas/auth';
export * from '@/lib/schemas/calculator';
