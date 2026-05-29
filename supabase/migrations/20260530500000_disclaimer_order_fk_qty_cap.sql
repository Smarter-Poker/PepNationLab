-- Add order_id FK to disclaimer_acceptances so every checkout-layer disclaimer
-- row is permanently linked to the order it gated. Orphaned rows (no order yet)
-- are allowed (NULL) so the pre-order insert still works.
-- Also adds a per-item quantity cap to orders for safety.

ALTER TABLE public.disclaimer_acceptances
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_disclaimer_order
  ON public.disclaimer_acceptances(order_id) WHERE order_id IS NOT NULL;

-- Per-item quantity safety cap on order_items (max 10,000 vials per line item).
ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_quantity_cap CHECK (quantity > 0 AND quantity <= 10000);
