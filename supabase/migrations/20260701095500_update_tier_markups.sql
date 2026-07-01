-- Update house_tiers (V2 engine - currently active)
-- New markups: Tier 1 = 150%, Tier 2 = 200%, Tier 3 = 250%
UPDATE public.house_tiers SET markup = 1.50 WHERE level = 1; -- Premium: was 0.50 (50%)
UPDATE public.house_tiers SET markup = 2.00 WHERE level = 2; -- Pro:     was 0.60 (60%)
UPDATE public.house_tiers SET markup = 2.50 WHERE level = 3; -- Rookie:  was 0.70 (70%)

-- Keep legacy pricing_tiers in sync (fallback / V1 path)
-- multiplier = 1 + markup
UPDATE public.pricing_tiers SET multiplier = 2.50, description = '150% House Markup' WHERE tier_name = 'tier_1';
UPDATE public.pricing_tiers SET multiplier = 3.00, description = '200% House Markup' WHERE tier_name = 'tier_2';
UPDATE public.pricing_tiers SET multiplier = 3.50, description = '250% House Markup' WHERE tier_name = 'tier_3';
