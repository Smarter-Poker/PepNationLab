-- ============================================================
-- PO Restock: Set backorder_days for ordered products
-- Date: 2026-08-12
-- Purpose: Products on the Aug 2026 purchase order have been
--   ordered and are in-stock at the supplier. They are available
--   for shipment but NOT for same-day local pickup. Setting
--   backorder_days = 3 removes the red "Out Of Stock" badge and
--   shows "Ships In 3 Days" instead on all storefronts (PepNation
--   and Savage Brands). inventory_count stays at 0 so that the
--   "In Stock (Same-Day Pickup)" banner is NOT shown.
-- Scope: Only updates products that currently have
--   inventory_count = 0 AND backorder_days = 0.
-- ============================================================

UPDATE products
SET backorder_days = 3
WHERE
  backorder_days = 0
  AND inventory_count = 0
  AND is_active = TRUE
  AND LOWER(name) IN (
    'tirzepatide',
    'semaglutide',
    'bpc 157',
    'bpc-157',
    'tb500',
    'thymosin b4 acetate',
    'tb-500',
    'retatrutide',
    'tesamorelin',
    'cjc-1295 without dac',
    'cjc 1295 without dac',
    'ipamorelin',
    'aod9604',
    'aod 9604',
    'mots-c',
    'pt-141',
    'pt141',
    'ghk-cu',
    'ghk cu',
    'thymosin alpha-1',
    'thymosin alpha 1',
    'epithalon',
    'dsip',
    'kisspeptin-10',
    'kisspeptin 10',
    'selank',
    'semax',
    'gh synergy stack',
    'snap-8',
    'snap8',
    'mt-1',
    'mt1',
    'klow stack',
    'glow stack',
    'nad+',
    'nad',
    'vip',
    'cagrilintide',
    'l-carnitine',
    'l carnitine',
    'hgh fragment 176-191',
    'hgh fragment',
    'll-37',
    'll37',
    'kpv',
    'oxytocin',
    'foxo4-dri',
    'foxo4 dri',
    'ss-31',
    'ss31',
    'sermorelin',
    'bac water'
  );

-- Log: how many rows were updated
DO $$
DECLARE
  updated_count INT;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'PO restock migration: % product row(s) updated to backorder_days = 3', updated_count;
END $$;
