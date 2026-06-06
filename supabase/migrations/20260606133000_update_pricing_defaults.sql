-- Change the default minimum overall order quantity to 3 for new agent profiles
ALTER TABLE public.agent_profiles ALTER COLUMN min_overall_qty SET DEFAULT 3;

-- Change the default enable_bulk_discounts to true for new agent profiles
ALTER TABLE public.agent_profiles ALTER COLUMN enable_bulk_discounts SET DEFAULT true;
