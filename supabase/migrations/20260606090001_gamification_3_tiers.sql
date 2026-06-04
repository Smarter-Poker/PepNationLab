-- 1. Truncate House Tiers back to 3 levels, with Level 1 as best and Level 3 as worst.
INSERT INTO public.house_tiers (level, name, min_volume, max_volume, markup) VALUES
  (1, 'Premium',     20000, NULL,   0.50),
  (2, 'Pro',         5000,  19999,  0.60),
  (3, 'Rookie',      0,     4999,   0.70)
ON CONFLICT (level) DO UPDATE SET
  name = EXCLUDED.name,
  min_volume = EXCLUDED.min_volume,
  max_volume = EXCLUDED.max_volume,
  markup = EXCLUDED.markup;

-- Clean up the old 4 and 5 levels
DELETE FROM public.house_tiers WHERE level IN (4, 5);

-- 2. Update the Legacy Pricing Tiers array
INSERT INTO public.pricing_tiers (tier_name, display_name, multiplier, description) VALUES
  ('tier_1', 'Tier 1 — Premium', 1.50, '50% House Markup'),
  ('tier_2', 'Tier 2 — Pro', 1.60, '60% House Markup'),
  ('tier_3', 'Tier 3 — Rookie', 1.70, '70% House Markup')
ON CONFLICT (tier_name) DO UPDATE SET 
  display_name = EXCLUDED.display_name,
  multiplier = EXCLUDED.multiplier,
  description = EXCLUDED.description;

-- Clean up any extra legacy tiers
DELETE FROM public.pricing_tiers WHERE tier_name IN ('tier_4', 'tier_5');
