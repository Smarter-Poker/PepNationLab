-- ============================================================================
-- Certificate Of Analysis: structured results, verification gate, public lookup.
--
-- The platform already models lots (product_lots) and can attach a COA PDF to
-- one (coa_storage_key). What it cannot do is (a) hold the analytical results in
-- queryable form, (b) distinguish a certificate an admin has actually checked
-- from one that was merely uploaded, or (c) let a researcher verify the lot
-- printed on a vial. This migration adds those three things.
--
-- Design rules encoded here:
--   1. Results live on the lot they describe. No parallel COA table.
--   2. Nothing is public until coa_verified_at is set by an admin who has
--      compared the entered values against the signed certificate. A mistyped
--      or half-finished upload cannot reach a product page.
--   3. purity_pct and friends are range-constrained. Nonsense is rejected at
--      the database, not at the form.
--   4. NO DEFAULTS on any result column. A test that was not run stays NULL and
--      renders as "Not Reported" -- never as a placeholder number. A COA states
--      what a lab measured; absence of a measurement is itself information.
--   5. Once verified, results are frozen. Correcting a published certificate
--      requires superseding the lot, which preserves the audit trail. A
--      certificate a researcher has already read must not change under them.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Structured analytical results on the lot.
-- ---------------------------------------------------------------------------
ALTER TABLE public.product_lots
  ADD COLUMN IF NOT EXISTS test_date               date,
  ADD COLUMN IF NOT EXISTS purity_pct              numeric(5,2),
  ADD COLUMN IF NOT EXISTS purity_method           text,
  ADD COLUMN IF NOT EXISTS hplc_column             text,
  ADD COLUMN IF NOT EXISTS hplc_wavelength_nm      integer,
  ADD COLUMN IF NOT EXISTS ms_method               text,
  ADD COLUMN IF NOT EXISTS ms_observed_mass_da     numeric(12,4),
  ADD COLUMN IF NOT EXISTS ms_theoretical_mass_da  numeric(12,4),
  ADD COLUMN IF NOT EXISTS water_content_pct       numeric(5,2),
  ADD COLUMN IF NOT EXISTS net_peptide_content_pct numeric(5,2),
  ADD COLUMN IF NOT EXISTS appearance              text,
  ADD COLUMN IF NOT EXISTS testing_lab             text,
  ADD COLUMN IF NOT EXISTS lab_report_number       text,
  ADD COLUMN IF NOT EXISTS lab_is_third_party      boolean,
  ADD COLUMN IF NOT EXISTS lab_accreditation       text,
  ADD COLUMN IF NOT EXISTS chromatogram_storage_key text,
  ADD COLUMN IF NOT EXISTS coa_verified_at         timestamptz,
  ADD COLUMN IF NOT EXISTS coa_verified_by         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS superseded_by           uuid REFERENCES public.product_lots(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.product_lots.purity_pct IS
  'Purity as reported by the testing lab. Never generated, defaulted, or inferred. NULL means not tested.';
COMMENT ON COLUMN public.product_lots.coa_verified_at IS
  'Set only after an admin compares the entered values against the signed certificate. Public COA rendering is gated on this.';

-- ---------------------------------------------------------------------------
-- 2) Integrity constraints. Added NOT VALID then validated so the migration
--    cannot fail on pre-existing rows, all of which have NULL results.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'coa_purity_range') THEN
    ALTER TABLE public.product_lots ADD CONSTRAINT coa_purity_range
      CHECK (purity_pct IS NULL OR (purity_pct > 0 AND purity_pct <= 100)) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'coa_water_range') THEN
    ALTER TABLE public.product_lots ADD CONSTRAINT coa_water_range
      CHECK (water_content_pct IS NULL OR (water_content_pct >= 0 AND water_content_pct <= 100)) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'coa_net_peptide_range') THEN
    ALTER TABLE public.product_lots ADD CONSTRAINT coa_net_peptide_range
      CHECK (net_peptide_content_pct IS NULL OR (net_peptide_content_pct > 0 AND net_peptide_content_pct <= 100)) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'coa_mass_positive') THEN
    ALTER TABLE public.product_lots ADD CONSTRAINT coa_mass_positive
      CHECK ((ms_observed_mass_da IS NULL OR ms_observed_mass_da > 0)
         AND (ms_theoretical_mass_da IS NULL OR ms_theoretical_mass_da > 0)) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'coa_wavelength_range') THEN
    ALTER TABLE public.product_lots ADD CONSTRAINT coa_wavelength_range
      CHECK (hplc_wavelength_nm IS NULL OR (hplc_wavelength_nm BETWEEN 180 AND 800)) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'coa_test_date_not_future') THEN
    ALTER TABLE public.product_lots ADD CONSTRAINT coa_test_date_not_future
      CHECK (test_date IS NULL OR test_date <= CURRENT_DATE) NOT VALID;
  END IF;

  -- A certificate cannot be marked verified without the things that make it
  -- verifiable: an issuing lab, the signed document, a test date, and a result.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'coa_verified_requires_provenance') THEN
    ALTER TABLE public.product_lots ADD CONSTRAINT coa_verified_requires_provenance
      CHECK (
        coa_verified_at IS NULL
        OR (testing_lab IS NOT NULL AND length(btrim(testing_lab)) > 0
            AND coa_storage_key IS NOT NULL AND length(btrim(coa_storage_key)) > 0
            AND test_date IS NOT NULL
            AND purity_pct IS NOT NULL
            AND coa_verified_by IS NOT NULL)
      ) NOT VALID;
  END IF;
END $$;

ALTER TABLE public.product_lots VALIDATE CONSTRAINT coa_purity_range;
ALTER TABLE public.product_lots VALIDATE CONSTRAINT coa_water_range;
ALTER TABLE public.product_lots VALIDATE CONSTRAINT coa_net_peptide_range;
ALTER TABLE public.product_lots VALIDATE CONSTRAINT coa_mass_positive;
ALTER TABLE public.product_lots VALIDATE CONSTRAINT coa_wavelength_range;
ALTER TABLE public.product_lots VALIDATE CONSTRAINT coa_test_date_not_future;
ALTER TABLE public.product_lots VALIDATE CONSTRAINT coa_verified_requires_provenance;

-- ---------------------------------------------------------------------------
-- 3) Indexes for the lookup and coverage paths.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS product_lots_coa_lot_lookup_idx
  ON public.product_lots (lower(btrim(lot_number)))
  WHERE coa_verified_at IS NOT NULL AND superseded_by IS NULL;

CREATE INDEX IF NOT EXISTS product_lots_coa_verified_idx
  ON public.product_lots (product_id, test_date DESC)
  WHERE coa_verified_at IS NOT NULL AND superseded_by IS NULL;

CREATE INDEX IF NOT EXISTS product_lots_coa_pending_idx
  ON public.product_lots (created_at DESC)
  WHERE coa_verified_at IS NULL;

-- ---------------------------------------------------------------------------
-- 4) Immutability of verified results.
--
-- Once verified, the analytical values are frozen. Only supersession, notes,
-- stock flags and expiry may change. This is what makes a published certificate
-- mean anything: it cannot be quietly edited after a researcher has read it.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.coa_freeze_verified_results()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $fn$
BEGIN
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
      RAISE EXCEPTION 'A Verified Certificate Of Analysis Is Immutable. Supersede The Lot With A New Record Instead.';
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_coa_freeze_verified ON public.product_lots;
CREATE TRIGGER trg_coa_freeze_verified
  BEFORE UPDATE ON public.product_lots
  FOR EACH ROW EXECUTE FUNCTION public.coa_freeze_verified_results();

-- Deleting a verified lot erases the audit trail behind a claim already shown to
-- researchers, and behind orders that shipped referencing that lot.
CREATE OR REPLACE FUNCTION public.coa_block_verified_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF OLD.coa_verified_at IS NOT NULL THEN
    RAISE EXCEPTION 'A Lot With A Verified Certificate Of Analysis Cannot Be Deleted. Deactivate Or Supersede It Instead.';
  END IF;
  RETURN OLD;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_coa_block_verified_delete ON public.product_lots;
CREATE TRIGGER trg_coa_block_verified_delete
  BEFORE DELETE ON public.product_lots
  FOR EACH ROW EXECUTE FUNCTION public.coa_block_verified_delete();

-- ---------------------------------------------------------------------------
-- 5) Public lookup by lot number.
--
-- SECURITY DEFINER so it can join products, but it returns only verified,
-- non-superseded rows and only public-safe columns. A researcher types the lot
-- printed on the vial. If no verified certificate exists, they get nothing --
-- which is the honest answer, and the one this whole system exists to give.
-- ---------------------------------------------------------------------------
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
    AND l.superseded_by IS NULL
  LIMIT 1;
$fn$;

REVOKE ALL ON FUNCTION public.lookup_coa_by_lot(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_coa_by_lot(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6) Coverage audit -- what the scheduled job calls.
--
-- Reports which in-stock, active products have NO verified certificate, and
-- which have only stale ones. It reports gaps. It does not fill them.
-- ---------------------------------------------------------------------------
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
             WHERE l.coa_verified_at IS NOT NULL AND l.superseded_by IS NULL
           ) AS verified_count,
           max(l.test_date) FILTER (
             WHERE l.coa_verified_at IS NOT NULL AND l.superseded_by IS NULL
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

COMMENT ON FUNCTION public.coa_coverage_gaps(integer) IS
  'Audits COA coverage across active products and reports gaps for the admin queue. Reports missing certificates; never creates them.';
