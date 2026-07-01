-- ============================================================================
-- Deep Audit Fix: Global Sync Triggers for Gamification Pricing
-- ============================================================================

-- 1. Trigger for global product base cost or ban status changes
CREATE OR REPLACE FUNCTION public.fn_sync_retail_price_on_product_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (OLD.base_cost IS DISTINCT FROM NEW.base_cost) OR (OLD.is_banned IS DISTINCT FROM NEW.is_banned) THEN
    -- Recalculate ALL agent_products for this specific product ID
    PERFORM public.recalculate_agent_product_prices(NULL, NEW.id, NULL);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_retail_price_on_product_change ON public.products;
CREATE TRIGGER trg_sync_retail_price_on_product_change
  AFTER UPDATE OF base_cost, is_banned ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_retail_price_on_product_change();

-- 2. Trigger for global house_tiers markup changes
CREATE OR REPLACE FUNCTION public.fn_sync_retail_price_on_house_tier_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (OLD.markup IS DISTINCT FROM NEW.markup) THEN
    -- Recalculate ALL agent_products across the entire platform
    -- This uses the default NULL, NULL, NULL to hit everything
    PERFORM public.recalculate_agent_product_prices(NULL, NULL, NULL);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_retail_price_on_house_tier_change ON public.house_tiers;
CREATE TRIGGER trg_sync_retail_price_on_house_tier_change
  AFTER UPDATE OF markup ON public.house_tiers
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_retail_price_on_house_tier_change();
