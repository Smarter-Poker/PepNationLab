-- Migration: Fix CAS lookups (slug join) + add next_rotation_at for automated COA rotation
-- Generated 2026-07-11

-- 1. Fix BPC-157 CAS (display_name was 'BPC-157' not 'BPC 157', so previous UPDATE missed it)
UPDATE public.compounds SET cas_number = '137525-51-0' WHERE slug = 'bpc-157';

-- 2. Patch any other CAS gaps that display_name matching missed — use slug directly
UPDATE public.compounds SET cas_number = '1216174-67-2'  WHERE slug = 'ara290' AND cas_number IS NULL;
UPDATE public.compounds SET cas_number = '68-19-9'       WHERE slug = 'b12' AND cas_number IS NULL;
UPDATE public.compounds SET cas_number = '8013-75-0'     WHERE slug = 'bac-water' AND cas_number IS NULL;
UPDATE public.compounds SET cas_number = '137525-51-0'   WHERE slug = 'bpc-157' AND cas_number IS NULL;
UPDATE public.compounds SET cas_number = '2185843-32-5'  WHERE slug = 'cagrilintide' AND cas_number IS NULL;
UPDATE public.compounds SET cas_number = '862368-43-2'   WHERE slug = 'cjc-1295-no-dac' AND cas_number IS NULL;
UPDATE public.compounds SET cas_number = '863288-34-0'   WHERE slug = 'cjc-1295-dac' AND cas_number IS NULL;
UPDATE public.compounds SET cas_number = '62568-57-4'    WHERE slug = 'dsip' AND cas_number IS NULL;
UPDATE public.compounds SET cas_number = '307297-39-8'   WHERE slug = 'epithalon' AND cas_number IS NULL;
UPDATE public.compounds SET cas_number = '98747-09-2'    WHERE slug = 'follistatin' AND cas_number IS NULL;
UPDATE public.compounds SET cas_number = '9002-61-3'     WHERE slug = 'hcg' AND cas_number IS NULL;
UPDATE public.compounds SET cas_number = '9002-68-0'     WHERE slug = 'hmg' AND cas_number IS NULL;
UPDATE public.compounds SET cas_number = '946870-92-4'   WHERE slug = 'igf-1-lr3' AND cas_number IS NULL;
UPDATE public.compounds SET cas_number = '374683-27-9'   WHERE slug = 'kisspeptin-10' AND cas_number IS NULL;
UPDATE public.compounds SET cas_number = '73-31-4'       WHERE slug = 'melatonin' AND cas_number IS NULL;
UPDATE public.compounds SET cas_number = '50-56-6'       WHERE slug = 'oxytocin' AND cas_number IS NULL;
UPDATE public.compounds SET cas_number = '2791-36-2'     WHERE slug = 'pinealon' AND cas_number IS NULL;
UPDATE public.compounds SET cas_number = '75921-69-6'    WHERE slug = 'mt-1' AND cas_number IS NULL;
UPDATE public.compounds SET cas_number = '53-84-9'       WHERE slug = 'nad-plus' AND cas_number IS NULL;
UPDATE public.compounds SET cas_number = '736992-21-5'   WHERE slug = 'ss-31' AND cas_number IS NULL;
UPDATE public.compounds SET cas_number = '40077-57-4'    WHERE slug = 'vip' AND cas_number IS NULL;
UPDATE public.compounds SET cas_number = '221231-10-3'   WHERE slug = 'aod-9604' AND cas_number IS NULL;
UPDATE public.compounds SET cas_number = '66004-57-7'    WHERE slug = 'hgh-fragment-176-191' AND cas_number IS NULL;
UPDATE public.compounds SET cas_number = '70-18-8'       WHERE slug = 'glutathione' AND cas_number IS NULL;
UPDATE public.compounds SET cas_number = '154947-66-7'   WHERE slug = 'll-37' AND cas_number IS NULL;

-- 3. Drop old display_name-based RPCs, replace with slug-based join (faster + correct)
DROP FUNCTION IF EXISTS public.lookup_coa_by_id(uuid);
DROP FUNCTION IF EXISTS public.lookup_coa_by_lot(text);

CREATE OR REPLACE FUNCTION public.lookup_coa_by_id(p_id uuid)
RETURNS TABLE(
  lot_id uuid, lot_number text, product_name text, product_slug text,
  supplier text, manufactured_at date, expires_at date, test_date date,
  purity_pct numeric, purity_method text, hplc_column text, hplc_wavelength_nm integer,
  ms_method text, ms_observed_mass_da numeric, ms_theoretical_mass_da numeric,
  water_content_pct numeric, net_peptide_content_pct numeric,
  appearance text, testing_lab text, lab_report_number text,
  lab_is_third_party boolean, lab_accreditation text,
  coa_storage_key text, chromatogram_storage_key text,
  coa_verified_at timestamptz, approved_by_name text,
  reference_mass_da numeric, sequence_one_letter text,
  cas_number text
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT l.id, l.lot_number, p.name, p.slug, l.supplier, l.manufactured_at, l.expires_at,
         l.test_date, l.purity_pct, l.purity_method, l.hplc_column, l.hplc_wavelength_nm,
         l.ms_method, l.ms_observed_mass_da, l.ms_theoretical_mass_da, l.water_content_pct,
         l.net_peptide_content_pct, l.appearance, l.testing_lab, l.lab_report_number,
         l.lab_is_third_party, l.lab_accreditation, l.coa_storage_key,
         l.chromatogram_storage_key, l.coa_verified_at,
         nullif(btrim(coalesce(pr.full_name, concat_ws(' ', pr.first_name, pr.last_name), pr.username)), ''),
         c.molecular_weight_da,
         c.sequence_one_letter,
         c.cas_number
  FROM public.product_lots l
  JOIN public.products p ON p.id = l.product_id
  LEFT JOIN public.compounds c ON c.slug = p.compound_slug
  LEFT JOIN public.profiles pr ON pr.id = l.coa_verified_by
  WHERE l.id = p_id
    AND l.coa_verified_at IS NOT NULL
    AND l.coa_retracted_at IS NULL
    AND l.superseded_by IS NULL
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.lookup_coa_by_lot(p_lot text)
RETURNS TABLE(
  lot_id uuid, lot_number text, product_name text, product_slug text,
  supplier text, manufactured_at date, expires_at date, test_date date,
  purity_pct numeric, purity_method text, hplc_column text, hplc_wavelength_nm integer,
  ms_method text, ms_observed_mass_da numeric, ms_theoretical_mass_da numeric,
  water_content_pct numeric, net_peptide_content_pct numeric,
  appearance text, testing_lab text, lab_report_number text,
  lab_is_third_party boolean, lab_accreditation text,
  coa_storage_key text, chromatogram_storage_key text,
  coa_verified_at timestamptz, approved_by_name text,
  reference_mass_da numeric, sequence_one_letter text,
  cas_number text
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT l.id, l.lot_number, p.name, p.slug, l.supplier, l.manufactured_at, l.expires_at,
         l.test_date, l.purity_pct, l.purity_method, l.hplc_column, l.hplc_wavelength_nm,
         l.ms_method, l.ms_observed_mass_da, l.ms_theoretical_mass_da, l.water_content_pct,
         l.net_peptide_content_pct, l.appearance, l.testing_lab, l.lab_report_number,
         l.lab_is_third_party, l.lab_accreditation, l.coa_storage_key,
         l.chromatogram_storage_key, l.coa_verified_at,
         nullif(btrim(coalesce(pr.full_name, concat_ws(' ', pr.first_name, pr.last_name), pr.username)), ''),
         c.molecular_weight_da,
         c.sequence_one_letter,
         c.cas_number
  FROM public.product_lots l
  JOIN public.products p ON p.id = l.product_id
  LEFT JOIN public.compounds c ON c.slug = p.compound_slug
  LEFT JOIN public.profiles pr ON pr.id = l.coa_verified_by
  WHERE lower(btrim(l.lot_number)) = lower(btrim(p_lot))
    AND l.coa_verified_at IS NOT NULL
    AND l.coa_retracted_at IS NULL
    AND l.superseded_by IS NULL
  LIMIT 1;
$$;

-- 4. Add next_rotation_at column for automated COA rotation scheduling
ALTER TABLE public.product_lots ADD COLUMN IF NOT EXISTS next_rotation_at TIMESTAMPTZ;

-- 5. Seed initial rotation schedule: stagger all 60 lots randomly between 3-12 days from now
--    so they don't all fire at once on first cron run.
UPDATE public.product_lots
SET next_rotation_at = now() + (floor(random() * 10 + 3)::int * INTERVAL '1 day')
WHERE coa_verified_at IS NOT NULL
  AND superseded_by IS NULL
  AND coa_retracted_at IS NULL
  AND next_rotation_at IS NULL;

-- 6. Add index for efficient cron queries
CREATE INDEX IF NOT EXISTS idx_product_lots_next_rotation
  ON public.product_lots(next_rotation_at)
  WHERE next_rotation_at IS NOT NULL AND superseded_by IS NULL AND coa_retracted_at IS NULL;
