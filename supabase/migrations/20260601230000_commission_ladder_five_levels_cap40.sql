-- 5-level gamification commission ladder (house default).
-- Effective commission = base + best bonus reached by monthly retail, capped at
-- commission_max_pct (which the app now caps at 40%). Base is Level 1; the four
-- steps below add Levels 2-5. Replaces the prior 3-step (+2/+5/+10) default.
CREATE OR REPLACE FUNCTION public.fn_house_default_commission_steps()
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT '[
    {"min_volume":2500,"bonus_pct":3},
    {"min_volume":7500,"bonus_pct":7},
    {"min_volume":20000,"bonus_pct":12},
    {"min_volume":50000,"bonus_pct":20}
  ]'::jsonb;
$$;

COMMENT ON FUNCTION public.fn_house_default_commission_steps() IS
  '5-level commission ladder default. Level 1 = base (under $2,500/mo retail). Steps add: L2 +3% at $2,500, L3 +7% at $7,500, L4 +12% at $20,000, L5 +20% at $50,000. Effective = LEAST(base + bonus, commission_max_pct). App enforces cap <= 40%.';
