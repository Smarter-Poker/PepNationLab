// Per-Peptide Quantity Discounts -- Replaces The Old Small-Order Surcharge
// ("Dynamic Pricing") Scheme. Buying More Vials Of The SAME Peptide Earns A
// Discount On That Line. Separate Peptides Do Not Combine.
//
//   3-4 Vials  -> 10% Off
//   5-6 Vials  -> 15% Off
//   7+  Vials  -> 20% Off
//
// Applied To Researcher Retail Purchases Only. Wholesale/Restock Buys, Stack
// Bundle Items (Which Carry Their Own 10% Deal), And Diluents (BAC Water,
// Acetic Acid -- Accessories, Not Peptides) Are Excluded.

export const QUANTITY_DISCOUNT_TIERS = [
  { minQty: 7, pct: 20, label: '7+ Vials' },
  { minQty: 5, pct: 15, label: '5-6 Vials' },
  { minQty: 3, pct: 10, label: '3-4 Vials' },
] as const;

export function quantityDiscountPct(qty: number): number {
  for (const tier of QUANTITY_DISCOUNT_TIERS) {
    if (qty >= tier.minQty) return tier.pct;
  }
  return 0;
}

// Diluents And Accessories Are Not Peptides -- No Quantity Discount.
const EXCLUDED_NAME_RE = /bac\.?\s*water|bacteriostatic|acetic\s*acid/i;

export function isVolumeDiscountExcluded(name: string | null | undefined): boolean {
  return EXCLUDED_NAME_RE.test(name || '');
}

// Unit Price After The Quantity Discount, Rounded To Exact Cents.
// Mirrors The Server-Side Rounding In /api/orders So Client Estimates Match.
export function discountedUnitPrice(unitPrice: number, qty: number): number {
  const pct = quantityDiscountPct(qty);
  if (pct <= 0) return Math.round(unitPrice * 100) / 100;
  return Math.round(unitPrice * (1 - pct / 100) * 100) / 100;
}
