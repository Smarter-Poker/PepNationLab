-- Phase 1 Gamification Engine Migration

-- 1. Extend the Tier ENUMs to support 5 tiers
-- (Removed tier_4 and tier_5 as we are back to 3 tiers)

-- 2. Add override to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gamification_override BOOLEAN DEFAULT false;

-- 3. Clear existing default pricing tiers and reseed 5 tiers
-- Wait, can't delete if referenced by product_tier_overrides.
-- Just UPSERT them in the next migration file.


-- 4. Add Sub-Agent Gamification columns to profiles 
-- (Note: commission_pct already exists)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS max_commission_pct NUMERIC(5,2);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS commission_ladder_config JSONB DEFAULT '[]'::jsonb;
