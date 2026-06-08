-- ============================================================
-- PEP NATION LAB -- Repair custom_markup_override units
-- ============================================================
-- profiles.custom_markup_override is a DECIMAL FRACTION consumed by the pricing
-- engine as cost = base * (1 + custom_markup_override). The correct encoding is
-- 0.30 = 30%.
--
-- The admin/super-agent "Custom Pricing Override" control + its route
-- (app/api/admin/agents/tier-override) previously stored the WHOLE PERCENT
-- (e.g. 30) directly into this column. Under fraction semantics that yields a
-- 3000% markup (base * 31) -- a severe overcharge. The route + control are now
-- fixed to store/display the fraction; this migration repairs rows already
-- written with the raw-percent bug.
--
-- A legitimate fraction can never exceed 5.0 (the 500% cap enforced by the
-- onboarding flat-markup step and the override route). Any value > 5 is
-- therefore a raw-percent artifact and is divided by 100 to recover the intended
-- fraction (30 -> 0.30). Values <= 5 are already-correct fractions and untouched.
-- ============================================================

UPDATE public.profiles
SET custom_markup_override = ROUND((custom_markup_override / 100.0)::numeric, 4)
WHERE custom_markup_override IS NOT NULL
  AND custom_markup_override > 5;
