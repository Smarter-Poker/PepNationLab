-- Insert pricing tiers
INSERT INTO public.pricing_tiers (tier_name, display_name, multiplier, description) VALUES
  ('tier_1', 'Level 1 — Rookie', 1.70, '70% House Markup'),
  ('tier_2', 'Level 2 — Established', 1.60, '60% House Markup'),
  ('tier_3', 'Level 3 — Pro', 1.50, '50% House Markup'),
  ('tier_4', 'Level 4 — Elite', 1.40, '40% House Markup'),
  ('tier_5', 'Level 5 — Apex', 1.30, '30% House Markup')
ON CONFLICT (tier_name) DO UPDATE SET 
  display_name = EXCLUDED.display_name,
  multiplier = EXCLUDED.multiplier,
  description = EXCLUDED.description;
