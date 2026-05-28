-- =============================================================================
-- PepNationLab P1 Cleanup - 2026-05-28
-- Drops legacy messages table (2.13), hardens storage buckets (3.8 + advisor),
-- removes SECURITY DEFINER on orders_view, adds monetary CHECK constraints.
-- =============================================================================

DROP TABLE IF EXISTS public.messages CASCADE;

DROP VIEW IF EXISTS public.orders_view CASCADE;
CREATE VIEW public.orders_view WITH (security_invoker = true) AS
SELECT
  id, buyer_id, agent_id, status, fulfillment_method, payment_method,
  shipping_address, shipping_cost, subtotal, total, tracking_number,
  agent_approved_at, agent_approval_notes, created_at, updated_at,
  total AS total_amount
FROM public.orders;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Public message attachments" ON storage.objects;
  DROP POLICY IF EXISTS "Public product images" ON storage.objects;
  DROP POLICY IF EXISTS "Public storefront assets" ON storage.objects;

  CREATE POLICY "product-images admin write" ON storage.objects
    FOR ALL
    USING (bucket_id = 'product-images' AND public.is_admin())
    WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

  CREATE POLICY "storefront-assets agent write" ON storage.objects
    FOR INSERT
    WITH CHECK (
      bucket_id = 'storefront-assets'
      AND (public.is_admin() OR (storage.foldername(name))[1] = auth.uid()::text)
    );
  CREATE POLICY "storefront-assets agent delete" ON storage.objects
    FOR DELETE
    USING (
      bucket_id = 'storefront-assets'
      AND (public.is_admin() OR (storage.foldername(name))[1] = auth.uid()::text)
    );
  CREATE POLICY "storefront-assets agent update" ON storage.objects
    FOR UPDATE
    USING (
      bucket_id = 'storefront-assets'
      AND (public.is_admin() OR (storage.foldername(name))[1] = auth.uid()::text)
    );

  CREATE POLICY "message-attachments sender write" ON storage.objects
    FOR INSERT
    WITH CHECK (
      bucket_id = 'message-attachments'
      AND (public.is_admin() OR (storage.foldername(name))[1] = auth.uid()::text)
    );
  CREATE POLICY "message-attachments sender delete" ON storage.objects
    FOR DELETE
    USING (
      bucket_id = 'message-attachments'
      AND (public.is_admin() OR (storage.foldername(name))[1] = auth.uid()::text)
    );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'storage policy update partial: %', SQLERRM;
END $$;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_prepaid_balance_nonneg;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_prepaid_balance_nonneg
  CHECK (prepaid_balance IS NULL OR prepaid_balance >= 0);
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_credit_limit_nonneg;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_credit_limit_nonneg
  CHECK (credit_limit IS NULL OR credit_limit >= 0);

ALTER TABLE public.agent_inventory DROP CONSTRAINT IF EXISTS agent_inventory_stock_nonneg;
ALTER TABLE public.agent_inventory ADD CONSTRAINT agent_inventory_stock_nonneg
  CHECK (stock_count >= 0);
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_base_cost_nonneg;
ALTER TABLE public.products ADD CONSTRAINT products_base_cost_nonneg
  CHECK (base_cost >= 0);
ALTER TABLE public.agent_products DROP CONSTRAINT IF EXISTS agent_products_retail_nonneg;
ALTER TABLE public.agent_products ADD CONSTRAINT agent_products_retail_nonneg
  CHECK (retail_price >= 0);
ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_quantity_pos;
ALTER TABLE public.order_items ADD CONSTRAINT order_items_quantity_pos
  CHECK (quantity > 0);

ALTER TABLE public.agent_profiles ADD COLUMN IF NOT EXISTS qr_code_data TEXT;
