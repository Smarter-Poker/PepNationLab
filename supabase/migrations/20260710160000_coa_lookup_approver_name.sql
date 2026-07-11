-- Add the approving analyst's name to the public COA lookup so the rendered
-- certificate can carry a real signatory. The QA approver's name is public
-- information on a certificate; this exposes only the display name of the admin
-- who verified the batch, joined from profiles via coa_verified_by.
--
-- Return type changes, so the function is dropped and recreated.

DROP FUNCTION IF EXISTS public.lookup_coa_by_lot(text);

CREATE FUNCTION public.lookup_coa_by_lot(p_lot text)
RETURNS TABLE (
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
  approved_by_name        text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT l.lot_number, p.name, p.slug, l.supplier, l.manufactured_at, l.expires_at,
         l.test_date, l.purity_pct, l.purity_method, l.hplc_column, l.hplc_wavelength_nm,
         l.ms_method, l.ms_observed_mass_da, l.ms_theoretical_mass_da, l.water_content_pct,
         l.net_peptide_content_pct, l.appearance, l.testing_lab, l.lab_report_number,
         l.lab_is_third_party, l.lab_accreditation, l.coa_storage_key,
         l.chromatogram_storage_key, l.coa_verified_at,
         nullif(btrim(coalesce(pr.full_name, concat_ws(' ', pr.first_name, pr.last_name), pr.username)), '')
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
