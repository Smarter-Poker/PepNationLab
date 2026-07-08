-- Enrich research_match_analytics with the budget preference and the number of
-- results returned, for better aggregate business intelligence on the Match
-- engine. Additive and idempotent; existing rows keep NULL for the new columns.

ALTER TABLE public.research_match_analytics
  ADD COLUMN IF NOT EXISTS budget text,
  ADD COLUMN IF NOT EXISTS result_count integer;
