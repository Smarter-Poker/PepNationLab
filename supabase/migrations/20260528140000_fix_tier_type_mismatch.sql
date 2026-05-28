-- Fix type mismatch between agent_tier and tier_name enums in triggers
-- The profiles.tier column is agent_tier, pricing_tiers.tier_name is tier_name enum
-- Both have the same values ('tier_1','tier_2','tier_3') but are distinct types

CREATE OR REPLACE FUNCTION public.seed_agent_products_for_new_agent()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_multiplier NUMERIC; v_tier_text TEXT;
BEGIN
  IF NEW.role NOT IN ('agent', 'super_agent') THEN RETURN NEW; END IF;
  v_tier_text := COALESCE(NEW.tier::text, 'tier_3');
  SELECT multiplier INTO v_multiplier FROM public.pricing_tiers WHERE tier_name = v_tier_text::tier_name;
  IF v_multiplier IS NULL THEN v_multiplier := 7.0; END IF;
  INSERT INTO public.agent_products (agent_id, product_id, retail_price, is_visible, sort_order)
  SELECT NEW.id, p.id, ROUND(p.base_cost * v_multiplier, 2), true, 0
  FROM public.products p
  WHERE p.is_active = true AND COALESCE(p.is_banned, false) = false
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.seed_agent_products_for_new_agent() FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.seed_agent_products_for_new_product()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.is_active = false OR COALESCE(NEW.is_banned, false) THEN RETURN NEW; END IF;
  INSERT INTO public.agent_products (agent_id, product_id, retail_price, is_visible, sort_order)
  SELECT p.id, NEW.id,
    ROUND(NEW.base_cost * COALESCE(
      (SELECT custom_multiplier FROM public.product_tier_overrides
         WHERE product_id = NEW.id AND tier_name = COALESCE(p.tier::text, 'tier_3')::tier_name),
      (SELECT multiplier FROM public.pricing_tiers WHERE tier_name = COALESCE(p.tier::text, 'tier_3')::tier_name),
      7.0), 2),
    true, 0
  FROM public.profiles p
  WHERE p.role IN ('agent', 'super_agent')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.seed_agent_products_for_new_product() FROM anon, authenticated;
