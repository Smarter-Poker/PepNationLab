-- Audit 2026-06-02 — agent_products orphan cleanup
--
-- Background:
--   The FK on agent_products.product_id used ON DELETE SET NULL. Whenever a
--   master product was deleted, its agent_products rows survived with
--   product_id = NULL. 152 such rows had accumulated. The storefront query
--   doesn't filter product_id IS NULL, so these rows could leak into the
--   product grid via the .products JOIN returning NULL and producing broken
--   "Other" cards with no name and no image.
--
-- Fix:
--   1. Delete the 152 dead rows (they have no product to attach customizations to).
--   2. Re-create the FK with ON DELETE CASCADE so a future product delete
--      removes the agent_products row outright instead of nulling it.
--   3. Add NOT NULL so anything inserted from this point on must reference a
--      real product.

DELETE FROM public.agent_products WHERE product_id IS NULL;

ALTER TABLE public.agent_products
  DROP CONSTRAINT IF EXISTS agent_products_product_id_fkey;

ALTER TABLE public.agent_products
  ALTER COLUMN product_id SET NOT NULL,
  ADD CONSTRAINT agent_products_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
