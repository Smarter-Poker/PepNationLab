-- ============================================================================
-- Tier Changes Preserve Store Retail Prices (2026-07-06)
-- ============================================================================
-- Owner Decision: When An Agent Earns A Better Tier (Tier 3 -> 2, Tier 2 -> 1)
-- Their Storefront Retail Prices MUST NOT Change. The Agent Simply Makes More
-- Profit Per Sale Because Their Wholesale Cost Dropped.
--
-- Previous Behavior: fn_recalc_agent_products_on_markup_change() Recomputed
-- retail_price = base_cost * (1 + markup) * (1 + margin_percent/100) On Any
-- Tier / Markup / Level Change, Which Moved Storefront Prices Whenever An
-- Agent Was Upgraded Or Downgraded.
--
-- New Behavior: On Any Cost-Basis Change (tier Assignment, locked_tier_level,
-- house_tier_level, custom_markup_override) The Trigger Keeps retail_price
-- EXACTLY As-Is And Re-Derives margin_percent From The New Wholesale Cost:
--   margin_percent = ((retail_price / (base_cost * (1 + markup))) - 1) * 100
-- This Keeps Future Cost Cascades (Product base_cost Edits, Admin Multiplier
-- Edits) Mathematically Consistent: They Reprice From A Margin That Reflects
-- The Price The Store Actually Charges Today.
--
-- Deliberate Repricing Paths Are Untouched: Admin Edits To
-- pricing_tiers.multiplier / house_tiers.markup And Product base_cost Changes
-- Still Cascade Retail Recomputes Platform-Wide.

CREATE OR REPLACE FUNCTION public.fn_recalc_agent_products_on_markup_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_house_markup numeric;
BEGIN
  IF (OLD.custom_markup_override IS DISTINCT FROM NEW.custom_markup_override)
     OR (OLD.locked_tier_level IS DISTINCT FROM NEW.locked_tier_level)
     OR (OLD.house_tier_level IS DISTINCT FROM NEW.house_tier_level)
  THEN
    -- Resolve The Agent's New Effective House Markup.
    IF NEW.custom_markup_override IS NOT NULL THEN
      v_house_markup := NEW.custom_markup_override;
    ELSE
      SELECT markup INTO v_house_markup
      FROM public.house_tiers
      WHERE level = public.fn_resolve_house_tier_level(NEW.id);
    END IF;

    IF v_house_markup IS NULL THEN
      v_house_markup := 2.50; -- Failsafe: Most House-Protective Fallback.
    END IF;

    -- PRICE-PRESERVING RE-DERIVATION: Retail Stays Fixed, Margin Absorbs The
    -- Cost Change. Applies To The Agent And All Of Their Sub-Agents (Whose
    -- Wholesale Context Is This Parent).
    UPDATE public.agent_products ap
    SET margin_percent = ROUND(
      ((ap.retail_price / NULLIF(p.base_cost * (1 + v_house_markup), 0)) - 1) * 100,
      2
    )
    FROM public.products p
    WHERE ap.product_id = p.id
      AND ap.agent_id IN (
        SELECT id FROM public.profiles WHERE id = NEW.id OR parent_agent_id = NEW.id
      )
      AND COALESCE(p.is_banned, false) = false
      AND ap.retail_price IS NOT NULL
      AND p.base_cost > 0;
  END IF;
  RETURN NEW;
END;
$$;
