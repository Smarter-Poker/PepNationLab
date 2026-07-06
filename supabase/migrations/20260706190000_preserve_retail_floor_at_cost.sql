-- ============================================================================
-- Audit Fix (2026-07-06): The Price-Preserving Re-Derivation Could Leave A
-- Store Selling BELOW COST When An Agent's Cost Basis RISES (Tier Downgrade Or
-- A Flat Markup Override Being Removed) - Found Live: One Store At Exactly
-- -10% Margin On All 114 Products. Retail Is Still Preserved On Cost DROPS
-- (The Owner Decision Case: Upgrades = More Profit, Same Prices), But Retail
-- Now Floors At The New Wholesale Cost (Margin Never Below 0).
-- Applied To ydsaqnnuwyvtyxgvrnys Via Supabase MCP.
-- ============================================================================
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

    -- PRICE-PRESERVING RE-DERIVATION WITH A COST FLOOR:
    --   retail stays as-is when it still covers the new wholesale cost;
    --   otherwise retail is lifted to exactly the new cost (margin 0) so a
    --   cost increase can never leave a store selling at a loss.
    UPDATE public.agent_products ap
    SET retail_price = GREATEST(ap.retail_price, ROUND(p.base_cost * (1 + v_house_markup), 2)),
        margin_percent = GREATEST(
          ROUND(((ap.retail_price / NULLIF(p.base_cost * (1 + v_house_markup), 0)) - 1) * 100, 2),
          0
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
