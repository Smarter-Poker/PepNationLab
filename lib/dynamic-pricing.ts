/**
 * Dynamic Pricing Engine
 * 
 * Handles two types of quantity-based pricing:
 * 1. Small-order surcharges (fewer than 10 vials cost more)
 * 2. Bulk volume discounts (100+ vials get discounts)
 */

// ── Small-Order Dynamic Pricing ─────────────────────────────────────

export interface DynamicPricingTier {
  min_qty: number;
  max_qty: number;
  surcharge_percent: number; // 0 = no surcharge (base price)
}

export const DEFAULT_DYNAMIC_TIERS: DynamicPricingTier[] = [
  { min_qty: 1, max_qty: 2, surcharge_percent: 20 },
  { min_qty: 3, max_qty: 5, surcharge_percent: 15 },
  { min_qty: 6, max_qty: 9, surcharge_percent: 10 },
  { min_qty: 10, max_qty: 999999, surcharge_percent: 0 },
];

/**
 * Compute the per-unit price after applying small-order surcharges.
 * Base price is the price for 10+ vials. Fewer vials get a surcharge.
 */
export function computeDynamicUnitPrice(
  baseUnitPrice: number,
  quantity: number,
  tiers: DynamicPricingTier[] = DEFAULT_DYNAMIC_TIERS,
): number {
  const tier = tiers.find(t => quantity >= t.min_qty && quantity <= t.max_qty);
  if (!tier) return baseUnitPrice;
  return parseFloat((baseUnitPrice * (1 + tier.surcharge_percent / 100)).toFixed(2));
}

/**
 * Get the surcharge label for a given quantity, e.g. "+20%"
 */
export function getDynamicSurchargeLabel(
  quantity: number,
  tiers: DynamicPricingTier[] = DEFAULT_DYNAMIC_TIERS,
): string | null {
  const tier = tiers.find(t => quantity >= t.min_qty && quantity <= t.max_qty);
  if (!tier || tier.surcharge_percent === 0) return null;
  return `+${tier.surcharge_percent}%`;
}

// ── Bulk Volume Discounts ───────────────────────────────────────────

export interface BulkDiscountTier {
  min_qty: number;
  discount_percent: number;
}

export const DEFAULT_BULK_TIERS: BulkDiscountTier[] = [
  { min_qty: 100, discount_percent: 5 },
  { min_qty: 300, discount_percent: 10 },
  { min_qty: 500, discount_percent: 15 },
];

/**
 * Compute the per-unit price after applying bulk volume discounts.
 * Returns the base price if quantity doesn't qualify for any tier.
 * Picks the highest applicable tier (most discount).
 */
export function computeBulkUnitPrice(
  baseUnitPrice: number,
  totalVials: number,
  tiers: BulkDiscountTier[] = DEFAULT_BULK_TIERS,
): number {
  const sorted = [...tiers].sort((a, b) => b.min_qty - a.min_qty);
  const tier = sorted.find(t => totalVials >= t.min_qty);
  if (!tier) return baseUnitPrice;
  return parseFloat((baseUnitPrice * (1 - tier.discount_percent / 100)).toFixed(2));
}

/**
 * Get the active bulk discount label, e.g. "10% off"
 */
export function getBulkDiscountLabel(
  totalVials: number,
  tiers: BulkDiscountTier[] = DEFAULT_BULK_TIERS,
): string | null {
  const sorted = [...tiers].sort((a, b) => b.min_qty - a.min_qty);
  const tier = sorted.find(t => totalVials >= t.min_qty);
  if (!tier) return null;
  return `${tier.discount_percent}% off`;
}

/**
 * Format a price to 2 decimal places for display.
 */
export function formatPrice(price: number): string {
  return price.toFixed(2);
}
