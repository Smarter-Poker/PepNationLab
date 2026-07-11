-- Enrich the COA lookups with (a) the lot's UUID so QR codes can key on a
-- globally-unique id, and (b) the peptide's real chemical constants -- theoretical
-- mass and sequence -- joined from compounds on name = display_name. These are
-- deterministic per-peptide facts, not test results, so surfacing them auto-fills
-- correct, different values on every certificate without inventing anything.

DROP FUNCTION IF EXISTS public.lookup_coa_by_lot(text);

CREATE FUNCTION public.lookup_coa_by_lot(p_lot text)
RETURNS TABLE (
  lot_id                  uuid,
  lot_number              text,
  product_name            text,
  product_slug            text,
  supplier                text,
  manufactured_at         date,
  expires_at              date,
  test_date               date,
  purity_pct              numeric,
  purity_method           text,
  hplc_column             text,
  hplc_wavelength_nm      integer,
  ms_method               text,
  ms_observed_mass_da     numeric,
  ms_theoretical_mass_da  numeric,
  water_content_pct       numeric,
  net_peptide_content_pct numeric,
  appearance              text,
  testing_lab             text,
  lab_report_number       text,
  lab_is_third_party      boolean,
  lab_accreditation       text,
  coa_storage_key         text,
  chromatogram_storage_key text,
  coa_verified_at         timestamptz,
  approved_by_name        text,
  reference_mass_da       numeric,
  sequence_one_letter     text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
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
              AND c.sequence_one_letter IS NOT NULL LIMIT 1)
  FROM public.product_lots l
  JOIN public.products p ON p.id = l.product_id
  LEFT JOIN public.profiles pr ON pr.id = l.coa_verified_by
  WHERE lower(btrim(l.lot_number)) = lower(btrim(p_lot))
    AND l.coa_verified_at IS NOT NULL
    AND l.coa_retracted_at IS NULL
    AND l.superseded_by IS NULL
  LIMIT 1;
$fn$;

REVOKE ALL ON FUNCTION public.lookup_coa_by_lot(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_coa_by_lot(text) TO anon, authenticated;

-- Lookup by the lot's UUID. This is what a QR code targets: a globally-unique id
-- that resolves to exactly one certificate, so no two QR codes can collide and
-- each points only at its own COA.
CREATE FUNCTION public.lookup_coa_by_id(p_id uuid)
RETURNS TABLE (
  lot_id                  uuid,
  lot_number              text,
  product_name            text,
  product_slug            text,
  supplier                text,
  manufactured_at         date,
  expires_at              date,
  test_date               date,
  purity_pct              numeric,
  purity_method           text,
  hplc_column             text,
  hplc_wavelength_nm      integer,
  ms_method               text,
  ms_observed_mass_da     numeric,
  ms_theoretical_mass_da  numeric,
  water_content_pct       numeric,
  net_peptide_content_pct numeric,
  appearance              text,
  testing_lab             text,
  lab_report_number       text,
  lab_is_third_party      boolean,
  lab_accreditation       text,
  coa_storage_key         text,
  chromatogram_storage_key text,
  coa_verified_at         timestamptz,
  approved_by_name        text,
  reference_mass_da       numeric,
  sequence_one_letter     text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
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
              AND c.sequence_one_letter IS NOT NULL LIMIT 1)
  FROM public.product_lots l
  JOIN public.products p ON p.id = l.product_id
  LEFT JOIN public.profiles pr ON pr.id = l.coa_verified_by
  WHERE l.id = p_id
    AND l.coa_verified_at IS NOT NULL
    AND l.coa_retracted_at IS NULL
    AND l.superseded_by IS NULL
  LIMIT 1;
$fn$;

REVOKE ALL ON FUNCTION public.lookup_coa_by_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_coa_by_id(uuid) TO anon, authenticated;
