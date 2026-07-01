-- ============================================================================
-- Fix 2 agents with orphaned locked_tier_level = 5 (Melissa Bekavac, Savage Brands)
-- These agents were grandfathered at "level 5" (the old best/cheapest tier) which
-- no longer exists after the 3-tier consolidation. They were silently skipped by
-- the retroactive recalc migration because fn_resolve_house_tier_level returned 5
-- which matched no house_tiers row, causing the JOIN to drop their rows.
--
-- Resolution: Apply Tier 1 / Premium pricing (level 1, 150% markup = 2.50x)
-- as they were originally the top-tier accounts.
-- Also reset their locked_tier_level to 1 so fn_resolve_house_tier_level
-- works correctly going forward.
-- ============================================================================

-- Step 1: Reset their locked_tier_level to 1 (Premium) so future pricing works
UPDATE public.profiles
SET locked_tier_level = 1
WHERE id IN (
  'e5321661-7426-43f3-922e-9c422e284ca2', -- Melissa Bekavac
  '844dca4b-6f01-4779-bc95-bfa1e0809c0c'  -- Savage Brands
);

-- Step 2: Update their agent_products retail_price at Premium (level 1) markup
-- Formula: base_cost * (1 + 1.50) = base_cost * 2.50
UPDATE public.agent_products
SET retail_price = ROUND(p.base_cost * (1 + ht.markup), 2)
FROM public.products p,
     public.house_tiers ht
WHERE agent_products.product_id = p.id
  AND agent_products.agent_id IN (
    'e5321661-7426-43f3-922e-9c422e284ca2',
    '844dca4b-6f01-4779-bc95-bfa1e0809c0c'
  )
  AND p.is_banned = false
  AND ht.level = 1;
