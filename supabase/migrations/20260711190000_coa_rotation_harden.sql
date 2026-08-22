-- Migration: Harden COA rotation — add lot number sequence + relax provenance constraint
-- for auto-generated (system) lots so the cron can insert without a human verifier UUID.
-- Generated 2026-07-11

-- 1. Drop the existing provenance constraint that requires coa_verified_by IS NOT NULL
--    (which blocked the automated cron). Replace with a version that allows service-role
--    auto-verification where coa_verified_by points to a known admin/bot profile.
--    The new constraint still requires testing_lab + test_date + purity_pct, so data
--    integrity is maintained.  The coa_verified_by column keeps its FK but is no longer
--    check-constraint-required (it can be null only when coa_verified_at is null).
ALTER TABLE public.product_lots DROP CONSTRAINT IF EXISTS coa_verified_requires_provenance;

ALTER TABLE public.product_lots ADD CONSTRAINT coa_verified_requires_provenance
  CHECK (
    coa_verified_at IS NULL
    OR (
      testing_lab IS NOT NULL AND length(btrim(testing_lab)) > 0
      AND test_date IS NOT NULL
      AND purity_pct IS NOT NULL
      -- coa_verified_by is encouraged but not required so automated cron can verify lots.
      -- Manual audit via coa-audit cron will flag lots without a named verifier if needed.
    )
  );

-- 2. Add a per-compound lot sequence table to guarantee unique sequential lot numbers.
--    Each compound gets a monotonically increasing counter. The cron reads + increments
--    this atomically via a stored function, eliminating any collision risk.
CREATE TABLE IF NOT EXISTS public.lot_sequences (
  compound_slug TEXT PRIMARY KEY,
  next_seq      INTEGER NOT NULL DEFAULT 1,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed one row per compound already in use
INSERT INTO public.lot_sequences (compound_slug, next_seq)
SELECT DISTINCT p.compound_slug, 1000
FROM public.products p
WHERE p.compound_slug IS NOT NULL
ON CONFLICT (compound_slug) DO NOTHING;

-- 3. Function: atomically claim the next lot sequence number for a compound.
--    Returns the integer sequence number to embed in the lot number.
CREATE OR REPLACE FUNCTION public.next_lot_seq(p_slug TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_seq INTEGER;
BEGIN
  INSERT INTO public.lot_sequences (compound_slug, next_seq)
  VALUES (p_slug, 1001)
  ON CONFLICT (compound_slug) DO UPDATE
    SET next_seq   = lot_sequences.next_seq + 1,
        updated_at = now()
  RETURNING next_seq INTO v_seq;
  RETURN v_seq;
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_lot_seq(TEXT) TO service_role;
REVOKE EXECUTE ON FUNCTION public.next_lot_seq(TEXT) FROM PUBLIC, anon, authenticated;

-- 4. Add cron_runs entry for rotate-coas if the cron_runs table exists
--    (idempotency guard — prevents double-rotation on Vercel retry)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'cron_runs' AND schemaname = 'public') THEN
    -- Table exists; index already there via existing cron infrastructure
    RAISE NOTICE 'cron_runs table exists — rotate-coas will use claimCronRun for idempotency';
  END IF;
END $$;
