/**
 * Product contracts for the two mutation surfaces that write money columns:
 *
 *   - Admin master catalog (POST/PATCH /api/admin/products) -- writes
 *     products.base_cost / admin_bulk_price / inventory_count, which feed
 *     ALL downstream pricing.
 *   - Agent storefront catalog (PATCH /api/agent/products) -- writes
 *     agent_products.retail_price / sale_price / margin_percent, read
 *     directly by checkout pricing.
 *
 * IMPORTANT UNIT NOTE: agent_products.retail_price and sale_price are stored
 * in per-10-vial-pack units ("tenths"); the UI shows per-vial dollars
 * (value / 10). These schemas validate the RAW stored unit.
 */
import { z } from 'zod';
import { uuidString, moneyAmount } from '@/lib/schemas/common';

const productName = z.string().trim().min(1).max(200);

/** POST /api/admin/products -- create a master catalog product. */
export const AdminProductCreateSchema = z.object({
  name: productName,
  sku: z.string().max(100).nullable().optional(),
  category: z.string().max(80).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  image_url: z.string().max(500).nullable().optional(),
  base_cost: z.number().finite().positive(),
  unit_size: z.string().max(50).nullable().optional(),
  unit_measure: z.string().max(20).nullable().optional(),
  is_active: z.boolean().optional(),
  inventory_count: z.number().int().min(0).max(10_000_000).optional(),
  low_stock_threshold: z.number().int().min(0).max(1_000_000).optional(),
  backorder_days: z.number().int().min(0).max(365).optional(),
  admin_bulk_price: z.number().finite().positive().nullable().optional(),
  admin_bulk_threshold: z.number().int().min(1).max(1_000_000).nullable().optional(),
});
export type AdminProductCreateInput = z.infer<typeof AdminProductCreateSchema>;

/** PATCH /api/admin/products -- partial update; every field optional but strictly typed. */
export const AdminProductPatchSchema = z.object({
  id: uuidString,
  name: productName.optional(),
  sku: z.string().max(100).nullable().optional(),
  category: z.string().max(80).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  image_url: z.string().max(500).nullable().optional(),
  base_cost: z.number().finite().positive().optional(),
  unit_size: z.string().max(50).nullable().optional(),
  unit_measure: z.string().max(20).nullable().optional(),
  is_active: z.boolean().optional(),
  inventory_count: z.number().int().min(0).max(10_000_000).optional(),
  low_stock_threshold: z.number().int().min(0).max(1_000_000).optional(),
  backorder_days: z.number().int().min(0).max(365).optional(),
  admin_bulk_price: z.number().finite().positive().nullable().optional(),
  admin_bulk_threshold: z.number().int().min(1).max(1_000_000).nullable().optional(),
});
export type AdminProductPatchInput = z.infer<typeof AdminProductPatchSchema>;

/**
 * PATCH /api/agent/products -- agent storefront pricing update.
 * sale_price / retail_price are the RAW per-10-pack values. NaN, Infinity,
 * strings, and negatives are rejected at the boundary so the MAP/cost-floor
 * guards downstream always compare real numbers.
 */
export const AgentProductPatchSchema = z.object({
  id: uuidString,
  custom_name: z.string().max(200).nullable().optional(),
  custom_description: z.string().max(5000).nullable().optional(),
  custom_image_url: z.string().max(500).nullable().optional(),
  retail_price: moneyAmount.optional(),
  margin_percent: z.number().finite().min(-100).max(100_000).optional(),
  is_visible: z.boolean().optional(),
  is_on_sale: z.boolean().optional(),
  sale_price: moneyAmount.nullable().optional(),
  /** Manufacturer accounts only: their private production cost per 10-pack. */
  manufacturer_cost: moneyAmount.nullable().optional(),
});
export type AgentProductPatchInput = z.infer<typeof AgentProductPatchSchema>;

/**
 * POST /api/agent/super-agent/pricing -- super-agent -> sub-agent billing
 * baselines (RAW per-10-pack units). NaN previously passed the route's
 * `typeof x === 'number'` checks (typeof NaN is 'number') and every floor
 * comparison; schema-typing with finite() closes that.
 */
export const SubAgentPricingSchema = z.object({
  product_id: uuidString,
  baseline_cost: moneyAmount,
  bulk_baseline_cost: moneyAmount.nullable().optional(),
  bulk_threshold: z.number().int().min(1).max(1_000_000).optional(),
});
export type SubAgentPricingInput = z.infer<typeof SubAgentPricingSchema>;
