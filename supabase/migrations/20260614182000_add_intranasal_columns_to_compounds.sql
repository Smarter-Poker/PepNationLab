-- ============================================================================
-- Add intranasal columns to compounds table (2026-06-14)
-- ============================================================================
-- lib/compounds.ts exports intranasalDisplay() which reads three fields:
--   compounds.intranasal_status           TEXT  (enum: established | emerging | not_suitable)
--   compounds.intranasal_bioavailability_pct  NUMERIC(5,2)
--   compounds.intranasal_note             TEXT
--
-- These were referenced in the TypeScript Compound type and wired to
-- AgentStorefrontGrid, CompareTool, and StorefrontCompareDrawer but the
-- schema never had the columns. Without them the function always returns the
-- "injection only" fallback regardless of the compound's actual profile.
-- ============================================================================

ALTER TABLE public.compounds
  ADD COLUMN IF NOT EXISTS intranasal_status TEXT
    CHECK (intranasal_status IN ('established', 'emerging', 'not_suitable')),
  ADD COLUMN IF NOT EXISTS intranasal_bioavailability_pct NUMERIC(5, 2)
    CHECK (intranasal_bioavailability_pct >= 0 AND intranasal_bioavailability_pct <= 100),
  ADD COLUMN IF NOT EXISTS intranasal_note TEXT;

COMMENT ON COLUMN public.compounds.intranasal_status IS
  'Intranasal suitability: established = approved/solid clinical use; emerging = published research exists; not_suitable = injection-only.';
COMMENT ON COLUMN public.compounds.intranasal_bioavailability_pct IS
  'Estimated intranasal bioavailability (0–100). NULL when unknown.';
COMMENT ON COLUMN public.compounds.intranasal_note IS
  'Free-text caveat or citation supporting the intranasal_status classification.';

-- Seed known intranasal compounds with their status.
-- Sources: published pharmacokinetic literature; conservative classifications.
UPDATE public.compounds SET
  intranasal_status = 'established',
  intranasal_bioavailability_pct = 65,
  intranasal_note = 'Nasal spray is the standard research-use form; CSF penetration ~5% of plasma. Multiple RCTs.'
WHERE slug = 'oxytocin';

UPDATE public.compounds SET
  intranasal_status = 'emerging',
  intranasal_bioavailability_pct = NULL,
  intranasal_note = 'Several rodent and small human studies demonstrate CNS effects via nasal route; not yet standard clinical practice.'
WHERE slug = 'bpc-157';

UPDATE public.compounds SET
  intranasal_status = 'emerging',
  intranasal_bioavailability_pct = NULL,
  intranasal_note = 'Preliminary human data; nasal delivery studied for CNS neuroprotection models.'
WHERE slug = 'selank';

UPDATE public.compounds SET
  intranasal_status = 'emerging',
  intranasal_bioavailability_pct = NULL,
  intranasal_note = 'Intranasal administration studied in anxiety and cognitive research; peptidase-resistant analog.'
WHERE slug = 'semax';

UPDATE public.compounds SET
  intranasal_status = 'emerging',
  intranasal_bioavailability_pct = NULL,
  intranasal_note = 'Published rodent intranasal studies; human bioavailability data limited.'
WHERE slug = 'dihexa';

UPDATE public.compounds SET
  intranasal_status = 'emerging',
  intranasal_bioavailability_pct = NULL,
  intranasal_note = 'Intranasal insulin research demonstrates CNS uptake; IGF-1 pathway overlap studied.'
WHERE slug = 'igf-1-lr3';

-- All other compounds default to NULL (not_suitable fallback in app logic).
-- Admins can update individual rows via the admin compound editor.
