-- Add advanced comparison fields to compounds table
ALTER TABLE public.compounds 
  ADD COLUMN IF NOT EXISTS efficacy_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS best_stacked_with text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS typical_frequency text,
  ADD COLUMN IF NOT EXISTS purity_percentage numeric(5,2),
  ADD COLUMN IF NOT EXISTS coa_url text;

COMMENT ON COLUMN public.compounds.efficacy_scores IS 'Scores from 1-10 on attributes like Fat Loss, Muscle Growth, etc.';
COMMENT ON COLUMN public.compounds.best_stacked_with IS 'Slugs of complementary compounds for synergistic stacking';
COMMENT ON COLUMN public.compounds.typical_frequency IS 'Typical administration frequency protocol (e.g. Once Weekly)';
COMMENT ON COLUMN public.compounds.purity_percentage IS 'Latest verified third-party lab purity score (e.g. 99.8)';
COMMENT ON COLUMN public.compounds.coa_url IS 'Link to PDF or image of the certificate of analysis';
