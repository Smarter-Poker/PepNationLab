-- ============================================================================
-- Retraction path for a verified Certificate Of Analysis.
--
-- Freezing coa_verified_at (previous migration) left an admin who verified a
-- mistyped certificate with no way to withdraw it. Retraction is a legitimate
-- act; falsification is not. So retraction is ONE-WAY and permanent:
-- coa_retracted_at may be set once, never cleared, never moved. The frozen
-- result columns stay frozen. A retracted lot vanishes from every public surface
-- but survives in the audit trail, and it counts as a coverage gap again.
--
-- To publish corrected numbers: create a NEW lot with the real values and point
-- the old lot's superseded_by at it. The history stays legible.
-- ============================================================================

ALTER TABLE public.product_lots
  ADD COLUMN IF NOT EXISTS coa_retracted_at      timestamptz,
  ADD COLUMN IF NOT EXISTS coa_retracted_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS coa_retraction_reason text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'coa_retraction_requires_reason') THEN
    ALTER TABLE public.product_lots ADD CONSTRAINT coa_retraction_requires_reason
      CHECK (
        coa_retracted_at IS NULL
        OR (coa_retracted_by IS NOT NULL
            AND coa_retraction_reason IS NOT NULL
            AND length(btrim(coa_retraction_reason)) >= 10)
      ) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'coa_retraction_requires_verified') THEN
    ALTER TABLE public.product_lots ADD CONSTRAINT coa_retraction_requires_verified
      CHECK (coa_retracted_at IS NULL OR coa_verified_at IS NOT NULL) NOT VALID;
  END IF;
END $$;

ALTER TABLE public.product_lots VALIDATE CONSTRAINT coa_retraction_requires_reason;
ALTER TABLE public.product_lots VALIDATE CONSTRAINT coa_retraction_requires_verified;

CREATE OR REPLACE FUNCTION public.coa_freeze_verified_results()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF OLD.coa_retracted_at IS NOT NULL
     AND NEW.coa_retracted_at IS DISTINCT FROM OLD.coa_retracted_at THEN
    RAISE EXCEPTION 'A Retracted Certificate Of Analysis Cannot Be Un-Retracted. Publish A New Lot Instead.';
  END IF;

  IF OLD.coa_verified_at IS NOT NULL THEN
    IF (NEW.product_id, NEW.lot_number, NEW.test_date, NEW.purity_pct, NEW.purity_method,
        NEW.hplc_column, NEW.hplc_wavelength_nm, NEW.ms_method, NEW.ms_observed_mass_da,
        NEW.ms_theoretical_mass_da, NEW.water_content_pct, NEW.net_peptide_content_pct,
        NEW.appearance, NEW.testing_lab, NEW.lab_report_number, NEW.lab_is_third_party,
        NEW.lab_accreditation, NEW.coa_storage_key, NEW.chromatogram_storage_key,
        NEW.coa_verified_at, NEW.coa_verified_by)
       IS DISTINCT FROM
       (OLD.product_id, OLD.lot_number, OLD.test_date, OLD.purity_pct, OLD.purity_method,
        OLD.hplc_column, OLD.hplc_wavelength_nm, OLD.ms_method, OLD.ms_observed_mass_da,
        OLD.ms_theoretical_mass_da, OLD.water_content_pct, OLD.net_peptide_content_pct,
        OLD.appearance, OLD.testing_lab, OLD.lab_report_number, OLD.lab_is_third_party,
        OLD.lab_accreditation, OLD.coa_storage_key, OLD.chromatogram_storage_key,
        OLD.coa_verified_at, OLD.coa_verified_by)
    THEN
      RAISE EXCEPTION 'A Verified Certificate Of Analysis Is Immutable. Retract It, Or Supersede The Lot With A New Record.';
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$fn$;

-- Public surfaces must exclude retracted certificates.
CREATE OR REPLACE FUNCTION public.lookup_coa_by_lot(p_lot text)
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
  coa_verified_at         timestamptz
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
         l.chromatogram_storage_key, l.coa_verified_at
  FROM public.product_lots l
  JOIN public.products p ON p.id = l.product_id
  WHERE lower(btrim(l.lot_number)) = lower(btrim(p_lot))
    AND l.coa_verified_at IS NOT NULL
    AND l.coa_retracted_at IS NULL
    AND l.superseded_by IS NULL
  LIMIT 1;
$fn$;

REVOKE ALL ON FUNCTION public.lookup_coa_by_lot(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_coa_by_lot(text) TO anon, authenticated;

-- A retracted certificate is a coverage gap again.
CREATE OR REPLACE FUNCTION public.coa_coverage_gaps(p_stale_days integer DEFAULT 365)
RETURNS TABLE (
  product_id         uuid,
  product_name       text,
  product_slug       text,
  inventory_count    integer,
  verified_coa_count bigint,
  latest_test_date   date,
  gap_reason         text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  WITH coverage AS (
    SELECT p.id, p.name, p.slug, p.inventory_count,
           count(l.id) FILTER (
             WHERE l.coa_verified_at IS NOT NULL
               AND l.coa_retracted_at IS NULL
               AND l.superseded_by IS NULL
           ) AS verified_count,
           max(l.test_date) FILTER (
             WHERE l.coa_verified_at IS NOT NULL
               AND l.coa_retracted_at IS NULL
               AND l.superseded_by IS NULL
           ) AS latest_test
    FROM public.products p
    LEFT JOIN public.product_lots l ON l.product_id = p.id AND l.is_active = true
    WHERE p.is_active = true AND p.is_banned = false
    GROUP BY p.id, p.name, p.slug, p.inventory_count
  )
  SELECT id, name, slug, inventory_count, verified_count, latest_test,
         CASE
           WHEN verified_count = 0 THEN 'No Verified Certificate On File'
           ELSE 'Latest Certificate Is Stale'
         END
  FROM coverage
  WHERE verified_count = 0
     OR latest_test < CURRENT_DATE - p_stale_days
  ORDER BY inventory_count DESC NULLS LAST, name;
$fn$;

REVOKE ALL ON FUNCTION public.coa_coverage_gaps(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.coa_coverage_gaps(integer) TO service_role;
