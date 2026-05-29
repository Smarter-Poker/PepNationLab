-- tax_rules: simple state-level base rate. Future shape allows category/applies_to filters.
CREATE TABLE IF NOT EXISTS public.tax_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction TEXT NOT NULL,
  state_code TEXT NOT NULL,
  base_rate NUMERIC NOT NULL CHECK (base_rate >= 0 AND base_rate <= 0.5),
  applies_to TEXT NOT NULL DEFAULT 'subtotal' CHECK (applies_to IN ('subtotal','subtotal_plus_shipping','shipping_only')),
  shipping_taxable BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  UNIQUE (state_code)
);
CREATE INDEX IF NOT EXISTS tax_rules_state_idx ON public.tax_rules(state_code) WHERE is_active = true;
ALTER TABLE public.tax_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone reads active tax rules" ON public.tax_rules;
CREATE POLICY "Anyone reads active tax rules" ON public.tax_rules FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "Admin manages tax rules" ON public.tax_rules;
CREATE POLICY "Admin manages tax rules" ON public.tax_rules FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

INSERT INTO public.tax_rules (jurisdiction, state_code, base_rate, applies_to, shipping_taxable, is_active) VALUES
  ('US-AL','AL',0.04,    'subtotal',true,true),
  ('US-AK','AK',0.00,    'subtotal',false,true),
  ('US-AZ','AZ',0.056,   'subtotal',false,true),
  ('US-AR','AR',0.065,   'subtotal',true,true),
  ('US-CA','CA',0.0725,  'subtotal',false,true),
  ('US-CO','CO',0.029,   'subtotal',false,true),
  ('US-CT','CT',0.0635,  'subtotal',true,true),
  ('US-DE','DE',0.00,    'subtotal',false,true),
  ('US-FL','FL',0.06,    'subtotal',true,true),
  ('US-GA','GA',0.04,    'subtotal',true,true),
  ('US-HI','HI',0.04,    'subtotal',true,true),
  ('US-ID','ID',0.06,    'subtotal',false,true),
  ('US-IL','IL',0.0625,  'subtotal',true,true),
  ('US-IN','IN',0.07,    'subtotal',true,true),
  ('US-IA','IA',0.06,    'subtotal',true,true),
  ('US-KS','KS',0.065,   'subtotal',true,true),
  ('US-KY','KY',0.06,    'subtotal',true,true),
  ('US-LA','LA',0.0445,  'subtotal',true,true),
  ('US-ME','ME',0.055,   'subtotal',true,true),
  ('US-MD','MD',0.06,    'subtotal',false,true),
  ('US-MA','MA',0.0625,  'subtotal',false,true),
  ('US-MI','MI',0.06,    'subtotal',true,true),
  ('US-MN','MN',0.06875, 'subtotal',true,true),
  ('US-MS','MS',0.07,    'subtotal',true,true),
  ('US-MO','MO',0.04225, 'subtotal',true,true),
  ('US-MT','MT',0.00,    'subtotal',false,true),
  ('US-NE','NE',0.055,   'subtotal',true,true),
  ('US-NV','NV',0.0685,  'subtotal',false,true),
  ('US-NH','NH',0.00,    'subtotal',false,true),
  ('US-NJ','NJ',0.06625, 'subtotal',true,true),
  ('US-NM','NM',0.04875, 'subtotal',true,true),
  ('US-NY','NY',0.04,    'subtotal',true,true),
  ('US-NC','NC',0.0475,  'subtotal',true,true),
  ('US-ND','ND',0.05,    'subtotal',true,true),
  ('US-OH','OH',0.0575,  'subtotal',true,true),
  ('US-OK','OK',0.045,   'subtotal',false,true),
  ('US-OR','OR',0.00,    'subtotal',false,true),
  ('US-PA','PA',0.06,    'subtotal',false,true),
  ('US-RI','RI',0.07,    'subtotal',true,true),
  ('US-SC','SC',0.06,    'subtotal',true,true),
  ('US-SD','SD',0.042,   'subtotal',true,true),
  ('US-TN','TN',0.07,    'subtotal',true,true),
  ('US-TX','TX',0.0625,  'subtotal',true,true),
  ('US-UT','UT',0.0485,  'subtotal',true,true),
  ('US-VT','VT',0.06,    'subtotal',true,true),
  ('US-VA','VA',0.053,   'subtotal',false,true),
  ('US-WA','WA',0.065,   'subtotal',true,true),
  ('US-WV','WV',0.06,    'subtotal',true,true),
  ('US-WI','WI',0.05,    'subtotal',true,true),
  ('US-WY','WY',0.04,    'subtotal',true,true),
  ('US-DC','DC',0.06,    'subtotal',true,true),
  ('US-PR','PR',0.115,   'subtotal',true,true)
ON CONFLICT (state_code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.tax_exemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  state_code TEXT NOT NULL,
  organization_name TEXT NOT NULL,
  certificate_number TEXT,
  storage_key TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','expired')),
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejected_reason TEXT,
  expires_at DATE,
  notes TEXT,
  UNIQUE (user_id, state_code)
);
CREATE INDEX IF NOT EXISTS tax_exemptions_user_idx ON public.tax_exemptions(user_id);
CREATE INDEX IF NOT EXISTS tax_exemptions_pending_idx ON public.tax_exemptions(status) WHERE status = 'pending';
ALTER TABLE public.tax_exemptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "User reads own exemptions" ON public.tax_exemptions;
CREATE POLICY "User reads own exemptions" ON public.tax_exemptions FOR SELECT
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS "User inserts own exemptions" ON public.tax_exemptions;
CREATE POLICY "User inserts own exemptions" ON public.tax_exemptions FOR INSERT
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Admin manages exemptions" ON public.tax_exemptions;
CREATE POLICY "Admin manages exemptions" ON public.tax_exemptions FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tax_amount NUMERIC DEFAULT 0 CHECK (tax_amount >= 0);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tax_jurisdiction TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tax_exemption_id UUID REFERENCES public.tax_exemptions(id) ON DELETE SET NULL;

INSERT INTO storage.buckets (id, name, public)
VALUES ('tax-exemption-certs', 'tax-exemption-certs', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "tax_certs_user_insert" ON storage.objects;
CREATE POLICY "tax_certs_user_insert" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'tax-exemption-certs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "tax_certs_select" ON storage.objects;
CREATE POLICY "tax_certs_select" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'tax-exemption-certs'
    AND (public.is_admin() OR (storage.foldername(name))[1] = auth.uid()::text)
  );

DROP POLICY IF EXISTS "tax_certs_admin_delete" ON storage.objects;
CREATE POLICY "tax_certs_admin_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'tax-exemption-certs' AND public.is_admin());
