-- Insert pricing tiers
INSERT INTO public.pricing_tiers (tier_name, display_name, multiplier, description) VALUES
  ('tier_1', 'Tier 1 — Premium', 1.30, '30% House Markup'),
  ('tier_2', 'Tier 2 — Pro', 1.50, '50% House Markup'),
  ('tier_3', 'Tier 3 — Rookie', 1.70, '70% House Markup')
ON CONFLICT (tier_name) DO UPDATE SET 
  display_name = EXCLUDED.display_name,
  multiplier = EXCLUDED.multiplier,
  description = EXCLUDED.description;

DELETE FROM public.pricing_tiers WHERE tier_name IN ('tier_4', 'tier_5');
