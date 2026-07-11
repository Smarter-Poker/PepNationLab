-- Relax the verification gate for the in-house-lab model.
-- The generated certificate is itself the document, so no separate uploaded
-- signed file is required. Verification still requires the substance that makes
-- a certificate true: an issuing lab, a test date, a reported purity, a verifier.
ALTER TABLE public.product_lots DROP CONSTRAINT IF EXISTS coa_verified_requires_provenance;

ALTER TABLE public.product_lots ADD CONSTRAINT coa_verified_requires_provenance
  CHECK (
    coa_verified_at IS NULL
    OR (testing_lab IS NOT NULL AND length(btrim(testing_lab)) > 0
        AND test_date IS NOT NULL
        AND purity_pct IS NOT NULL
        AND coa_verified_by IS NOT NULL)
  );
