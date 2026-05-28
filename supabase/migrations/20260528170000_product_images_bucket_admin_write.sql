-- 20260528170000_product_images_bucket_admin_write.sql
--
-- Idempotent reaffirmation of the `product-images` storage bucket and the
-- admin-write + public-read policies that the bulk product image upload
-- route depends on. Earlier migrations (20260528000004, 20260528100001)
-- already create the bucket and policies; this migration guarantees they
-- exist regardless of whether the historical migrations were applied.

INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  DROP POLICY IF EXISTS "product-images admin write" ON storage.objects;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "product-images public read" ON storage.objects;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "product-images admin write" ON storage.objects
  FOR ALL
  USING (bucket_id = 'product-images' AND public.is_admin())
  WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

CREATE POLICY "product-images public read" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'product-images');
