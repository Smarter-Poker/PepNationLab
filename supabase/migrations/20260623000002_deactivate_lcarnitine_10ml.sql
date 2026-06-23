-- Deactivate the 10ml L-Carnitine variant (The Furnace Stack).
-- Per admin instruction 2026-06-23: this product should only be sold as 600mg.
-- Using is_active = false (soft-delete) to preserve historical order references.
-- The 600mg variant (slug: l-carnitine-lc600) remains active and unchanged.

UPDATE products
SET
  is_active  = false,
  updated_at = now()
WHERE id = 'cb7cdc39-39c1-44f9-92e4-8bd3fd7488a1'
  AND slug   = 'l-carnitine-blend-multi-ingredient-lc216'
  AND unit_size    = '10'
  AND unit_measure = 'ml';
