-- Fix: BAC Water 3ml variant was incorrectly stocked by the PO load migration.
-- The purchase order (Aug 2026) ordered BAC Water 10ml only (x230).
-- The 3ml variant had 230 incorrectly added; reset to 0.
UPDATE products
SET inventory_count = 0
WHERE LOWER(name) LIKE '%bac water%'
  AND unit_size = '3'
  AND is_active = TRUE;
