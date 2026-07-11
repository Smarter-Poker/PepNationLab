-- PR 1: storefront catalog performance index
-- Safe anytime: CONCURRENTLY never takes a row-level lock on reads.
-- Covers the hottest storefront query:
--   SELECT ... FROM agent_products
--   WHERE agent_id = $1 AND is_visible = true
--   ORDER BY sort_order
-- The partial WHERE clause (is_visible = true) keeps the index lean.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_products_agent_visible_sort
  ON agent_products (agent_id, sort_order)
  WHERE is_visible = true;
