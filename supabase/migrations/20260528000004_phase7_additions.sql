-- ============================================
-- PEP NATION LAB — Phase 7 Migrations
-- Migration: 20260528000004_phase7_additions
-- ============================================

-- 1. Add Live Carts State to Profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS cart_state JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS cart_updated_at TIMESTAMP WITH TIME ZONE;

-- 2. Storage Bucket for Product Images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
-- Allow public read access to images
CREATE POLICY "Public product images" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'product-images');

-- Allow admins to upload/modify images
CREATE POLICY "Admin product images upload" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'product-images' AND 
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'shipping')
);

CREATE POLICY "Admin product images update" 
ON storage.objects FOR UPDATE 
USING (
  bucket_id = 'product-images' AND 
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'shipping')
);

CREATE POLICY "Admin product images delete" 
ON storage.objects FOR DELETE 
USING (
  bucket_id = 'product-images' AND 
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'shipping')
);
