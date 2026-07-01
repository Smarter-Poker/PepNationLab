-- ============================================================================
-- MAP and Margin Ceilings Guardrails
-- ============================================================================

-- 1. Add new columns to products
ALTER TABLE public.products
  ADD COLUMN min_retail_price NUMERIC(10,2),
  ADD COLUMN max_margin_percent NUMERIC(6,2) DEFAULT 300.00;

-- 2. Backfill min_retail_price with base_cost for existing products
UPDATE public.products
SET min_retail_price = base_cost
WHERE min_retail_price IS NULL;

-- 3. Make min_retail_price NOT NULL now that it's backfilled
ALTER TABLE public.products
  ALTER COLUMN min_retail_price SET NOT NULL;
