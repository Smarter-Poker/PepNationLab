-- ============================================================================
-- Global Tier Pricing Alignment (2026-07-06)
--
-- Goal: Every Agent Assigned To Tier 1 / Tier 2 / Tier 3 Pricing Follows The
-- Admin-Configured Tier Multipliers (pricing_tiers: T1=2.5x, T2=3.0x, T3=3.5x)
-- For Wholesale Cost, And Their Store Retail Prices Auto-Adjust Whenever The
-- Admin Changes Pricing (Tier Multipliers, House Markups, Base Costs, Or The
-- Agent's Assigned Tier).
--
-- What This Migration Does:
--   1. Fixes recalculate_agent_product_prices() to price an agent from their
--      OWN tier context (parent context only for true is_sub_agent accounts),
--      matching computeAgentCostForAgent() in lib/pricing.ts. Previously it
--      used COALESCE(parent_agent_id, id), which priced any agent created by
--      a super agent at the SUPER AGENT'S tier - inconsistent with the cost
--      shown on their dashboard.
--   2. Adds a sync trigger: pricing_tiers.multiplier -> house_tiers.markup
--      (markup = multiplier - 1, tier_N maps to level N). The existing
--      house_tiers trigger then recomputes every store's retail prices.
--   3. Adds a BEFORE trigger on profiles.tier so ANY tier assignment locks the
--      agent to that house level (fixed_scale_override = true,
--      locked_tier_level = N, house_tier_level = N) and clears any stale
--      custom_markup_override - being "set to tier pricing" now always means
--      tier pricing governs.
--   4. Recreates the profiles AFTER-update recalc trigger to also fire on
--      tier changes (a BEFORE trigger's column edits do not satisfy
--      "AFTER UPDATE OF locked_tier_level" - the UPDATE statement itself must
--      name the column, so tier must be in the trigger's column list).
--   5. Retroactive data fix: aligns all existing tier-assigned agents
--      (clears grandfathered custom_markup_override values of 0.30 / 0.50,
--      locks their level to their tier), mirrors profiles.tier for agents that
--      were level-locked but had tier NULL, then recomputes every
--      agent_products.retail_price platform-wide.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. RPC: self-context pricing (parent context only for true sub-agents)
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.recalculate_agent_product_prices(uuid, uuid, text);

CREATE OR REPLACE FUNCTION public.recalculate_agent_product_prices(
  p_agent_id uuid DEFAULT NULL,
  p_product_id uuid DEFAULT NULL,
  p_category text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- retail_price = base_cost * (1 + effective_markup) * (1 + margin_percent/100)
  -- effective_markup resolution (same chain as computeAgentCostV2):
  --   1. custom_markup_override on the pricing context profile
  --   2. house_tiers.markup at fn_resolve_house_tier_level(context)
  --   3. Fallback: highest configured house markup (most house-protective)
  -- Pricing context = the agent themselves, EXCEPT true sub-agents
  -- (is_sub_agent = true), whose wholesale context is their parent agent.
  UPDATE public.agent_products ap
  SET retail_price = ROUND(
    p.base_cost
      * (1 + COALESCE(
          (SELECT custom_markup_override FROM public.profiles
            WHERE id = CASE WHEN COALESCE(prof.is_sub_agent, false)
                            THEN COALESCE(prof.parent_agent_id, prof.id)
                            ELSE prof.id END),
          (SELECT markup FROM public.house_tiers
            WHERE level = public.fn_resolve_house_tier_level(
              CASE WHEN COALESCE(prof.is_sub_agent, false)
                   THEN COALESCE(prof.parent_agent_id, prof.id)
                   ELSE prof.id END)),
          (SELECT MAX(markup) FROM public.house_tiers),
          2.50
        ))
      * (1 + COALESCE(ap.margin_percent, 50) / 100.0),
    2
  )
  FROM public.products p,
       public.profiles prof
  WHERE ap.product_id = p.id
    AND ap.agent_id = prof.id
    AND COALESCE(p.is_banned, false) = false
    AND (p_agent_id IS NULL OR ap.agent_id = p_agent_id OR prof.parent_agent_id = p_agent_id)
    AND (p_product_id IS NULL OR ap.product_id = p_product_id)
    AND (p_category IS NULL OR p.category = p_category);
END;
$$;

ALTER FUNCTION public.recalculate_agent_product_prices(uuid, uuid, text)
  SET search_path = public, pg_temp;

-- ----------------------------------------------------------------------------
-- 2. pricing_tiers -> house_tiers sync (admin edits tiers; stores follow)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_sync_house_tiers_from_pricing_tiers()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_level int;
BEGIN
  IF NEW.multiplier IS DISTINCT FROM OLD.multiplier THEN
    v_level := NULLIF(regexp_replace(NEW.tier_name::text, '\D', '', 'g'), '')::int;
    IF v_level IS NOT NULL THEN
      -- markup = multiplier - 1 (cost = base * multiplier = base * (1 + markup)).
      -- The existing trg_sync_retail_price_on_house_tier_change trigger on
      -- house_tiers then recomputes retail prices platform-wide.
      UPDATE public.house_tiers
        SET markup = NEW.multiplier - 1,
            updated_at = now()
      WHERE level = v_level
        AND markup IS DISTINCT FROM (NEW.multiplier - 1);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_house_tiers_from_pricing_tiers ON public.pricing_tiers;
CREATE TRIGGER trg_sync_house_tiers_from_pricing_tiers
  AFTER UPDATE OF multiplier ON public.pricing_tiers
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_house_tiers_from_pricing_tiers();

-- ----------------------------------------------------------------------------
-- 3. Tier assignment always locks the agent to that tier's pricing
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_sync_tier_lock_on_tier_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_level int;
BEGIN
  IF NEW.tier IS DISTINCT FROM OLD.tier AND NEW.tier IS NOT NULL THEN
    v_level := NULLIF(regexp_replace(NEW.tier::text, '\D', '', 'g'), '')::int;
    IF v_level IS NOT NULL THEN
      NEW.locked_tier_level := v_level;
      NEW.fixed_scale_override := true;
      NEW.house_tier_level := v_level;
      -- Assigned tier pricing supersedes any stale flat markup override.
      NEW.custom_markup_override := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_tier_lock_on_tier_change ON public.profiles;
CREATE TRIGGER trg_sync_tier_lock_on_tier_change
  BEFORE UPDATE OF tier ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_tier_lock_on_tier_change();

-- ----------------------------------------------------------------------------
-- 4. Recalc trigger on profiles must also fire on tier updates
--    (BEFORE-trigger column edits do not satisfy AFTER UPDATE OF <col>).
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_recalc_agent_products_on_markup_change ON public.profiles;
CREATE TRIGGER trg_recalc_agent_products_on_markup_change
  AFTER UPDATE OF tier, custom_markup_override, locked_tier_level, house_tier_level ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_recalc_agent_products_on_markup_change();

-- ----------------------------------------------------------------------------
-- 5. Retroactive data fix (idempotent)
-- ----------------------------------------------------------------------------
-- 5a. Keep house_tiers in lockstep with pricing_tiers (T1=2.5 -> markup 1.5, etc.)
UPDATE public.house_tiers ht
SET markup = pt.multiplier - 1,
    updated_at = now()
FROM public.pricing_tiers pt
WHERE ht.level = NULLIF(regexp_replace(pt.tier_name::text, '\D', '', 'g'), '')::int
  AND ht.markup IS DISTINCT FROM (pt.multiplier - 1);

-- 5b. Every tier-assigned agent: tier pricing governs. Clear grandfathered flat
--     overrides and lock their house level to their assigned tier.
--     (Plain column updates here; the BEFORE trigger above only fires when the
--     tier column itself changes, so set everything explicitly.)
UPDATE public.profiles
SET custom_markup_override = NULL,
    fixed_scale_override   = true,
    locked_tier_level      = NULLIF(regexp_replace(tier::text, '\D', '', 'g'), '')::int,
    house_tier_level       = NULLIF(regexp_replace(tier::text, '\D', '', 'g'), '')::int
WHERE role IN ('agent', 'super_agent')
  AND tier IS NOT NULL
  AND COALESCE(is_sub_agent, false) = false
  AND (custom_markup_override IS NOT NULL
       OR COALESCE(fixed_scale_override, false) = false
       OR locked_tier_level IS DISTINCT FROM NULLIF(regexp_replace(tier::text, '\D', '', 'g'), '')::int
       OR house_tier_level  IS DISTINCT FROM NULLIF(regexp_replace(tier::text, '\D', '', 'g'), '')::int);

-- 5c. Agents that were level-locked but never had profiles.tier set: mirror the
--     locked level into tier so the admin UI reflects the pricing they receive.
UPDATE public.profiles
SET tier = ('tier_' || locked_tier_level)::agent_tier,
    house_tier_level = locked_tier_level,
    custom_markup_override = NULL
WHERE role IN ('agent', 'super_agent')
  AND tier IS NULL
  AND COALESCE(fixed_scale_override, false) = true
  AND locked_tier_level BETWEEN 1 AND 3
  AND COALESCE(is_sub_agent, false) = false;

-- 5d. Recompute every store's retail prices under the corrected model.
SELECT public.recalculate_agent_product_prices(NULL, NULL, NULL);
