-- ============================================================================
-- Retroactive agent_products.retail_price recalculation
-- Applies the new house tier markups (T1=150%, T2=200%, T3=250%) to every
-- existing agent_products row using the same resolution chain as computeAgentCostV2():
--
--   1. profiles.custom_markup_override  (flat % override, e.g. 1.50 = 150%)
--   2. fn_resolve_house_tier_level()    (fixed_scale_override lock OR volume bucket)
--   Fallback: level 3 markup (Rookie, most house-protective)
--
-- Formula: retail_price = ROUND(base_cost * (1 + effective_markup), 2)
-- ============================================================================

UPDATE public.agent_products
SET retail_price = ROUND(
  p.base_cost * (
    1 + COALESCE(
      prof.custom_markup_override,
      ht.markup
    )
  ),
  2
)
FROM public.products p,
     public.profiles prof,
     public.house_tiers ht
WHERE agent_products.product_id = p.id
  AND prof.id = agent_products.agent_id
  AND ht.level = public.fn_resolve_house_tier_level(agent_products.agent_id)
  AND p.is_banned = false;


