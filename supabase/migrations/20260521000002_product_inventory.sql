-- ============================================
-- PRODUCT INVENTORY & MISSING COLUMNS
-- Adds all missing product fields:
-- sku, unit_size, unit_measure, in_stock,
-- inventory_count, low_stock_threshold, backorder_days
-- ============================================

-- Add all missing product columns
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS sku               TEXT,
  ADD COLUMN IF NOT EXISTS unit_size         TEXT,
  ADD COLUMN IF NOT EXISTS unit_measure      TEXT NOT NULL DEFAULT 'mg',
  ADD COLUMN IF NOT EXISTS in_stock          BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS inventory_count   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS backorder_days    INTEGER NOT NULL DEFAULT 14;

-- Sync in_stock from inventory_count via trigger
CREATE OR REPLACE FUNCTION sync_product_stock_status()
RETURNS TRIGGER AS $$
BEGIN
  NEW.in_stock := (NEW.inventory_count > 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_product_stock ON products;
CREATE TRIGGER trg_sync_product_stock
  BEFORE INSERT OR UPDATE OF inventory_count ON products
  FOR EACH ROW EXECUTE FUNCTION sync_product_stock_status();

-- Fast storefront inventory query index
CREATE INDEX IF NOT EXISTS idx_products_stock_active
  ON products (is_active, in_stock, inventory_count);

-- Unique SKU (when provided)
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_sku
  ON products (sku) WHERE sku IS NOT NULL;

-- Fix orders table: alias total as total_amount for compatibility
-- (schema uses 'total', adding computed alias via view)
CREATE OR REPLACE VIEW orders_view AS
  SELECT *, total AS total_amount FROM orders;

COMMENT ON COLUMN products.inventory_count IS
  'Exact units on hand. Trigger auto-sets in_stock. 0 = shows Ships In N Days on all storefronts.';
COMMENT ON COLUMN products.low_stock_threshold IS
  'Show Low Stock badge when inventory_count drops below this value.';
COMMENT ON COLUMN products.backorder_days IS
  'Days shown in Ships In N Days message when inventory_count = 0. Default 14.';
