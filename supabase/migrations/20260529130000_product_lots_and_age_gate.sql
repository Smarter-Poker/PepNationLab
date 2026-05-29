-- product_lots: each lot/batch of a product has its own COA + expiry
CREATE TABLE IF NOT EXISTS public.product_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  lot_number TEXT NOT NULL,
  supplier TEXT,
  manufactured_at DATE,
  expires_at DATE,
  received_at DATE NOT NULL DEFAULT CURRENT_DATE,
  coa_storage_key TEXT,
  coa_mime_type TEXT,
  coa_file_size INTEGER,
  coa_uploaded_at TIMESTAMPTZ,
  coa_uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, lot_number)
);
CREATE INDEX IF NOT EXISTS product_lots_product_active_idx ON public.product_lots(product_id, is_active, received_at DESC);
CREATE INDEX IF NOT EXISTS product_lots_expires_idx ON public.product_lots(expires_at) WHERE is_active = true AND expires_at IS NOT NULL;
ALTER TABLE public.product_lots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage lots" ON public.product_lots;
CREATE POLICY "Admins manage lots" ON public.product_lots
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Public read active lots" ON public.product_lots;
CREATE POLICY "Public read active lots" ON public.product_lots
  FOR SELECT USING (is_active = true);

-- Age gate hardening: add an age_verified BOOL column to disclaimer_acceptances
ALTER TABLE public.disclaimer_acceptances ADD COLUMN IF NOT EXISTS age_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.disclaimer_acceptances ADD COLUMN IF NOT EXISTS verified_age INTEGER;

-- product-coas storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-coas', 'product-coas', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "product-coas admin write" ON storage.objects;
CREATE POLICY "product-coas admin write" ON storage.objects
  FOR ALL
  USING (bucket_id = 'product-coas' AND public.is_admin())
  WITH CHECK (bucket_id = 'product-coas' AND public.is_admin());

DROP POLICY IF EXISTS "product-coas public read" ON storage.objects;
CREATE POLICY "product-coas public read" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'product-coas');
