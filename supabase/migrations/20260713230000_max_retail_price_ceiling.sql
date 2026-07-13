-- ============================================================
-- MAX RETAIL PRICE CEILING
-- Admin store price = base_cost × tier1_multiplier
-- Agents may NEVER price ABOVE this. They may price below.
-- All existing agent_products.retail_price capped to admin price.
-- All future agent_products default to admin price.
-- ============================================================

-- 1. Add max_retail_price column to products
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS max_retail_price numeric(10,2) NULL;

-- 2. Populate max_retail_price from base_cost × tier1_multiplier
--    We resolve the multiplier inline. Fallback to 5 if table missing.
UPDATE products p
SET max_retail_price = ROUND(
  p.base_cost * COALESCE(
    (SELECT multiplier FROM pricing_tiers WHERE tier_name = 'tier_1' LIMIT 1),
    5
  ),
  2
)
WHERE p.base_cost IS NOT NULL AND p.base_cost > 0;

-- 3. Cap ALL existing agent_products.retail_price to max_retail_price
--    (some may have been set above via old margin cap loophole)
--    Exclude banned products to avoid triggering the banned-product guard.
UPDATE agent_products ap
SET
  retail_price = LEAST(ap.retail_price, p.max_retail_price),
  sale_price   = CASE
    WHEN ap.sale_price IS NOT NULL THEN LEAST(ap.sale_price, p.max_retail_price)
    ELSE ap.sale_price
  END,
  updated_at = NOW()
FROM products p
WHERE ap.product_id = p.id
  AND p.is_banned IS NOT TRUE
  AND p.is_active = TRUE
  AND p.max_retail_price IS NOT NULL
  AND (
    ap.retail_price > p.max_retail_price
    OR (ap.sale_price IS NOT NULL AND ap.sale_price > p.max_retail_price)
  );

-- 4. DB-level constraint: agent retail_price can never exceed product max_retail_price
--    This is a belt-and-suspenders guard behind the API validation.
--    We use a trigger (not a CHECK referencing another table, which Postgres disallows).
CREATE OR REPLACE FUNCTION enforce_agent_product_price_ceiling()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_max_retail_price numeric(10,2);
BEGIN
  -- Only enforce for non-admin agents (admin bypass handled in API)
  SELECT max_retail_price INTO v_max_retail_price
  FROM products
  WHERE id = NEW.product_id;

  IF v_max_retail_price IS NOT NULL THEN
    IF NEW.retail_price > v_max_retail_price THEN
      RAISE EXCEPTION 'retail_price (%) exceeds max_retail_price (%) for this product',
        NEW.retail_price, v_max_retail_price;
    END IF;
    IF NEW.sale_price IS NOT NULL AND NEW.sale_price > v_max_retail_price THEN
      RAISE EXCEPTION 'sale_price (%) exceeds max_retail_price (%) for this product',
        NEW.sale_price, v_max_retail_price;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_agent_product_price_ceiling ON agent_products;
CREATE TRIGGER trg_agent_product_price_ceiling
  BEFORE INSERT OR UPDATE OF retail_price, sale_price
  ON agent_products
  FOR EACH ROW
  EXECUTE FUNCTION enforce_agent_product_price_ceiling();

-- 5. Function: sync max_retail_price when admin updates base_cost or tier multiplier
--    Called via trigger on products.base_cost change
CREATE OR REPLACE FUNCTION sync_max_retail_price()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_multiplier numeric;
BEGIN
  SELECT multiplier INTO v_multiplier
  FROM pricing_tiers WHERE tier_name = 'tier_1' LIMIT 1;
  v_multiplier := COALESCE(v_multiplier, 5);

  NEW.max_retail_price := ROUND(NEW.base_cost * v_multiplier, 2);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_max_retail_price ON products;
CREATE TRIGGER trg_sync_max_retail_price
  BEFORE INSERT OR UPDATE OF base_cost
  ON products
  FOR EACH ROW
  EXECUTE FUNCTION sync_max_retail_price();

-- 6. Grant SELECT on max_retail_price to authenticated users
--    (already accessible via the products table RLS they have)

COMMENT ON COLUMN products.max_retail_price IS
  'Maximum price any agent may charge for this product (= base_cost × tier1 multiplier). Auto-updated when base_cost changes.';

