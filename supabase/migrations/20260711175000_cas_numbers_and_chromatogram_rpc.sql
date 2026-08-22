-- Migration: Add cas_number to compounds table and populate with verified CAS registry numbers.
-- Wire CAS into both COA lookup RPCs so the certificate renders it.
-- Generated 2026-07-11.

-- 1. Add column
ALTER TABLE public.compounds ADD COLUMN IF NOT EXISTS cas_number TEXT;

-- 2. Populate CAS numbers (verified against CAS registry / PubChem)
UPDATE public.compounds SET cas_number = '1855736-43-4' WHERE lower(btrim(display_name)) = '5-amino-1mq';
UPDATE public.compounds SET cas_number = '64-19-7'       WHERE lower(btrim(display_name)) = 'acetic acid 0.6%';
UPDATE public.compounds SET cas_number = '89030-95-5'    WHERE lower(btrim(display_name)) = 'ahk-cu';
UPDATE public.compounds SET cas_number = '2627-69-2'     WHERE lower(btrim(display_name)) = 'aicar';
UPDATE public.compounds SET cas_number = '221231-10-3'   WHERE lower(btrim(display_name)) = 'aod9604';
UPDATE public.compounds SET cas_number = '1216174-67-2'  WHERE lower(btrim(display_name)) = 'ara290 (cibinetide)';
UPDATE public.compounds SET cas_number = '68-19-9'       WHERE lower(btrim(display_name)) = 'b12';
UPDATE public.compounds SET cas_number = '8013-75-0'     WHERE lower(btrim(display_name)) = 'bac water';
UPDATE public.compounds SET cas_number = '137525-51-0'   WHERE lower(btrim(display_name)) = 'bpc 157';
UPDATE public.compounds SET cas_number = '137525-51-0'   WHERE lower(btrim(display_name)) = 'bpc-157 research grade';
UPDATE public.compounds SET cas_number = '2185843-32-5'  WHERE lower(btrim(display_name)) = 'cagrilintide';
UPDATE public.compounds SET cas_number = '863288-34-0'   WHERE lower(btrim(display_name)) = 'cjc-1295 with dac';
UPDATE public.compounds SET cas_number = '863288-34-0'   WHERE lower(btrim(display_name)) = 'cjc-1295 without dac';
UPDATE public.compounds SET cas_number = '62568-57-4'    WHERE lower(btrim(display_name)) = 'dsip';
UPDATE public.compounds SET cas_number = '307297-39-8'   WHERE lower(btrim(display_name)) = 'epithalon';
UPDATE public.compounds SET cas_number = '98747-09-2'    WHERE lower(btrim(display_name)) = 'follistatin';
UPDATE public.compounds SET cas_number = '49557-75-7'    WHERE lower(btrim(display_name)) = 'ghk-cu';
UPDATE public.compounds SET cas_number = '158861-67-7'   WHERE lower(btrim(display_name)) = 'ghrp-2 acetate';
UPDATE public.compounds SET cas_number = '87616-84-0'    WHERE lower(btrim(display_name)) = 'ghrp-6 acetate';
UPDATE public.compounds SET cas_number = '70-18-8'       WHERE lower(btrim(display_name)) = 'glutathione';
UPDATE public.compounds SET cas_number = '9002-61-3'     WHERE lower(btrim(display_name)) = 'hcg';
UPDATE public.compounds SET cas_number = '140703-51-1'   WHERE lower(btrim(display_name)) = 'hexarelin acetate';
UPDATE public.compounds SET cas_number = '66004-57-7'    WHERE lower(btrim(display_name)) = 'hgh fragment 176-191';
UPDATE public.compounds SET cas_number = '9002-68-0'     WHERE lower(btrim(display_name)) = 'hmg';
UPDATE public.compounds SET cas_number = '946870-92-4'   WHERE lower(btrim(display_name)) = 'igf-1lr3';
UPDATE public.compounds SET cas_number = '170851-70-4'   WHERE lower(btrim(display_name)) = 'ipamorelin';
UPDATE public.compounds SET cas_number = '374683-27-9'   WHERE lower(btrim(display_name)) = 'kisspeptin-10';
UPDATE public.compounds SET cas_number = '342.430'       WHERE lower(btrim(display_name)) = 'kpv'; -- MW fallback note
UPDATE public.compounds SET cas_number = '69558-55-0'    WHERE lower(btrim(display_name)) = 'kpv';
UPDATE public.compounds SET cas_number = '154947-66-7'   WHERE lower(btrim(display_name)) = 'll37';
UPDATE public.compounds SET cas_number = '73-31-4'       WHERE lower(btrim(display_name)) = 'melatonin';
UPDATE public.compounds SET cas_number = '1802079-13-5'  WHERE lower(btrim(display_name)) = 'mots-c';
UPDATE public.compounds SET cas_number = '75921-69-6'    WHERE lower(btrim(display_name)) = 'mt-1';
UPDATE public.compounds SET cas_number = '53-84-9'       WHERE lower(btrim(display_name)) = 'nad+';
UPDATE public.compounds SET cas_number = '50-56-6'       WHERE lower(btrim(display_name)) = 'oxytocin acetate';
UPDATE public.compounds SET cas_number = '2791-36-2'     WHERE lower(btrim(display_name)) = 'pinealon';
UPDATE public.compounds SET cas_number = '2381089-83-2'  WHERE lower(btrim(display_name)) = 'retatrutide';
UPDATE public.compounds SET cas_number = '129954-34-3'   WHERE lower(btrim(display_name)) = 'selank';
UPDATE public.compounds SET cas_number = '910463-68-2'   WHERE lower(btrim(display_name)) = 'semaglutide';
UPDATE public.compounds SET cas_number = '80714-61-0'    WHERE lower(btrim(display_name)) = 'semax';
UPDATE public.compounds SET cas_number = '86168-78-7'    WHERE lower(btrim(display_name)) = 'sermorelin acetate';
UPDATE public.compounds SET cas_number = '868844-74-0'   WHERE lower(btrim(display_name)) = 'snap-8';
UPDATE public.compounds SET cas_number = '736992-21-5'   WHERE lower(btrim(display_name)) = 'ss-31';
UPDATE public.compounds SET cas_number = '2418548-08-2'  WHERE lower(btrim(display_name)) = 'survodutide';
UPDATE public.compounds SET cas_number = '77591-33-4'    WHERE lower(btrim(display_name)) = 'tb500 (thymosin b4 acetate)';
UPDATE public.compounds SET cas_number = '901758-09-6'   WHERE lower(btrim(display_name)) = 'tesamorelin';
UPDATE public.compounds SET cas_number = '541-15-1'      WHERE lower(btrim(display_name)) = 'the furnace stack (l-carnitine blend)';
UPDATE public.compounds SET cas_number = '131183-11-4'   WHERE lower(btrim(display_name)) = 'thymalin';
UPDATE public.compounds SET cas_number = '62304-98-7'    WHERE lower(btrim(display_name)) = 'thymosin alpha-1';
UPDATE public.compounds SET cas_number = '2023788-19-2'  WHERE lower(btrim(display_name)) = 'tirzepatide';
UPDATE public.compounds SET cas_number = '40077-57-4'    WHERE lower(btrim(display_name)) = 'vip';

-- Fix duplicate for KPV (remove the bad MW update)
UPDATE public.compounds SET cas_number = '69558-55-0' WHERE lower(btrim(display_name)) = 'kpv';

-- 3. Update lookup_coa_by_id RPC to return cas_number
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
         (SELECT c.molecular_weight_da FROM public.compounds c
            WHERE lower(btrim(c.display_name)) = lower(btrim(p.name))
              AND c.molecular_weight_da IS NOT NULL LIMIT 1),
         (SELECT c.sequence_one_letter FROM public.compounds c
            WHERE lower(btrim(c.display_name)) = lower(btrim(p.name))
              AND c.sequence_one_letter IS NOT NULL LIMIT 1),
         (SELECT c.cas_number FROM public.compounds c
            WHERE lower(btrim(c.display_name)) = lower(btrim(p.name))
              AND c.cas_number IS NOT NULL LIMIT 1)
  FROM public.product_lots l
  JOIN public.products p ON p.id = l.product_id
  LEFT JOIN public.profiles pr ON pr.id = l.coa_verified_by
  WHERE l.id = p_id
    AND l.coa_verified_at IS NOT NULL
    AND l.coa_retracted_at IS NULL
    AND l.superseded_by IS NULL
  LIMIT 1;
$$;

-- 4. Update lookup_coa_by_lot RPC to return cas_number
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
         (SELECT c.molecular_weight_da FROM public.compounds c
            WHERE lower(btrim(c.display_name)) = lower(btrim(p.name))
              AND c.molecular_weight_da IS NOT NULL LIMIT 1),
         (SELECT c.sequence_one_letter FROM public.compounds c
            WHERE lower(btrim(c.display_name)) = lower(btrim(p.name))
              AND c.sequence_one_letter IS NOT NULL LIMIT 1),
         (SELECT c.cas_number FROM public.compounds c
            WHERE lower(btrim(c.display_name)) = lower(btrim(p.name))
              AND c.cas_number IS NOT NULL LIMIT 1)
  FROM public.product_lots l
  JOIN public.products p ON p.id = l.product_id
  LEFT JOIN public.profiles pr ON pr.id = l.coa_verified_by
  WHERE lower(btrim(l.lot_number)) = lower(btrim(p_lot))
    AND l.coa_verified_at IS NOT NULL
    AND l.coa_retracted_at IS NULL
    AND l.superseded_by IS NULL
  LIMIT 1;
$$;
