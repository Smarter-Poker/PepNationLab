-- ============================================================================
-- Auto-Recalculate Agent Prices on Markup Change (with sub-agent cascade)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_recalc_agent_products_on_markup_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_house_markup numeric;
BEGIN
  -- When custom_markup_override or locked_tier_level changes, recalculate retail_price
  -- for this agent AND all of their sub-agents (cascading 100%).
  IF (OLD.custom_markup_override IS DISTINCT FROM NEW.custom_markup_override)
     OR (OLD.locked_tier_level IS DISTINCT FROM NEW.locked_tier_level)
  THEN
    -- Resolve effective house markup
    IF NEW.custom_markup_override IS NOT NULL THEN
      v_house_markup := NEW.custom_markup_override;
    ELSE
      -- Resolve from house_tiers
      SELECT markup INTO v_house_markup
      FROM public.house_tiers
      WHERE level = public.fn_resolve_house_tier_level(NEW.id);
    END IF;

    -- Failsafe (should never happen)
    IF v_house_markup IS NULL THEN
      v_house_markup := 2.50; -- Rookie tier fallback
    END IF;

    -- Update retail prices: base * (1 + house_markup) * (1 + margin_percent)
    -- This hits the agent + all their sub-agents, preserving each agent's individual margin_percent
    UPDATE public.agent_products ap
    SET retail_price = ROUND(
      p.base_cost
        * (1 + v_house_markup)
        * (1 + COALESCE(ap.margin_percent, 50) / 100.0),
      2
    )
    FROM public.products p
    WHERE ap.product_id = p.id
      AND ap.agent_id IN (
        SELECT id FROM public.profiles WHERE id = NEW.id OR parent_agent_id = NEW.id
      )
      AND COALESCE(p.is_banned, false) = false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_agent_products_on_markup_change ON public.profiles;
CREATE TRIGGER trg_recalc_agent_products_on_markup_change
  AFTER UPDATE OF custom_markup_override, locked_tier_level ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_recalc_agent_products_on_markup_change();
