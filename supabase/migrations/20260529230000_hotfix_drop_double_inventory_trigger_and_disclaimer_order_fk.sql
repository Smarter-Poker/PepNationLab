-- =============================================================================
-- Hotfix 2026-05-29
-- P0.2  : drop one of the two AFTER UPDATE triggers on public.orders that both
--         fire deduct_inventory_on_order_approval(). The duplicate has been
--         silently double-deducting stock on every approval. Keep the more
--         descriptive name; drop the shorter alias.
-- P0.18 : pull the SQL from the orphaned 20260530500000_disclaimer_order_fk_qty_cap.sql
--         into a uniquely-versioned migration to resolve the on-disk timestamp
--         collision with 20260530500000_recommendations.sql.
-- Applied to ydsaqnnuwyvtyxgvrnys via Supabase MCP on 2026-05-29.
-- =============================================================================

DROP TRIGGER IF EXISTS trg_deduct_inventory_on_approval ON public.orders;

ALTER TABLE public.disclaimer_acceptances
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_disclaimer_order
  ON public.disclaimer_acceptances(order_id) WHERE order_id IS NOT NULL;

ALTER TABLE public.order_items
  DROP CONSTRAINT IF EXISTS order_items_quantity_cap;
ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_quantity_cap CHECK (quantity > 0 AND quantity <= 10000);
