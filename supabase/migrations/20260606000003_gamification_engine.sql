-- Phase 1 Gamification Engine Migration

-- 1. Extend the Tier ENUMs to support 5 tiers
ALTER TYPE agent_tier ADD VALUE IF NOT EXISTS 'tier_4';
ALTER TYPE agent_tier ADD VALUE IF NOT EXISTS 'tier_5';
ALTER TYPE tier_name ADD VALUE IF NOT EXISTS 'tier_4';
ALTER TYPE tier_name ADD VALUE IF NOT EXISTS 'tier_5';

-- 2. Add override to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gamification_override BOOLEAN DEFAULT false;

-- 3. Clear existing default pricing tiers and reseed 5 tiers
-- Wait, can't delete if referenced by product_tier_overrides.
-- Just UPSERT them!
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

-- 4. Add Sub-Agent Gamification columns to profiles 
-- (Note: commission_pct already exists)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS max_commission_pct NUMERIC(5,2);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS commission_ladder_config JSONB DEFAULT '[]'::jsonb;
