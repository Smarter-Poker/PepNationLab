-- =============================================================================
-- Agent creation was failing with "An Unexpected Error Occurred".
--
-- Root cause: creating an agent provisions a storefront (trg_profiles_provision
-- _storefront -> provision_agent_storefront -> INSERT agent_profiles), which
-- fires seed_agent_products_for_new_agent. That seeded every product at
-- base_cost * tier_multiplier * 1.5. Since max_retail_price is now pinned to the
-- admin/house retail price (the platform ceiling), the seeded default overshot
-- the ceiling for many products (7 at tier_1, 27 at tier_2, 53 at tier_3), and
-- enforce_agent_product_price_ceiling raised, aborting the whole insert and thus
-- agent creation at EVERY tier.
--
-- Fix: clamp the seeded retail_price to the product's max_retail_price (the
-- admin price is the cap, so a default that would exceed it simply starts at the
-- cap). Applied to both seed functions (new-agent and new-product paths).
-- Manufacturer stores are unchanged (they seed at base_cost and are ceiling-exempt).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.seed_agent_products_for_new_agent()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_multiplier NUMERIC; v_tier_text TEXT; v_role TEXT; v_is_manufacturer BOOLEAN;
BEGIN
  SELECT role::text, COALESCE(tier::text, 'tier_3'), COALESCE(is_manufacturer, false)
    INTO v_role, v_tier_text, v_is_manufacturer
    FROM public.profiles
    WHERE id = NEW.id;

  IF v_role NOT IN ('agent', 'super_agent') THEN RETURN NEW; END IF;

  IF v_is_manufacturer THEN
    INSERT INTO public.agent_products (agent_id, product_id, retail_price, margin_percent, is_visible, sort_order)
    SELECT NEW.id, p.id, ROUND(p.base_cost, 2), 0.0, true, 0
    FROM public.products p
    WHERE p.is_active = true AND COALESCE(p.is_banned, false) = false
    ON CONFLICT DO NOTHING;
    RETURN NEW;
  END IF;

  SELECT multiplier INTO v_multiplier FROM public.pricing_tiers WHERE tier_name = v_tier_text::tier_name;
  IF v_multiplier IS NULL THEN v_multiplier := 1.7; END IF;

  -- Clamp the default to the ceiling: never seed above max_retail_price.
  INSERT INTO public.agent_products (agent_id, product_id, retail_price, margin_percent, is_visible, sort_order)
  SELECT
    NEW.id,
    p.id,
    LEAST(
      ROUND(p.base_cost * v_multiplier * 1.5, 2),
      COALESCE(p.max_retail_price, ROUND(p.base_cost * v_multiplier * 1.5, 2))
    ),
    50.0,
    true,
    0
  FROM public.products p
  WHERE p.is_active = true AND COALESCE(p.is_banned, false) = false
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.seed_agent_products_for_new_product()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.is_active = false OR COALESCE(NEW.is_banned, false) THEN RETURN NEW; END IF;

  INSERT INTO public.agent_products (agent_id, product_id, retail_price, margin_percent, is_visible, sort_order)
  SELECT
    p.id,
    NEW.id,
    CASE
      WHEN COALESCE(p.is_manufacturer, false) THEN ROUND(NEW.base_cost, 2)
      ELSE LEAST(
        ROUND(
          NEW.base_cost
          * COALESCE(
              (SELECT custom_multiplier FROM public.product_tier_overrides
                 WHERE product_id = NEW.id AND tier_name = COALESCE(p.tier::text, 'tier_3')::tier_name),
              (SELECT multiplier FROM public.pricing_tiers
                 WHERE tier_name = COALESCE(p.tier::text, 'tier_3')::tier_name),
              1.7)
          * 1.5,
          2),
        COALESCE(
          NEW.max_retail_price,
          ROUND(
            NEW.base_cost
            * COALESCE(
                (SELECT custom_multiplier FROM public.product_tier_overrides
                   WHERE product_id = NEW.id AND tier_name = COALESCE(p.tier::text, 'tier_3')::tier_name),
                (SELECT multiplier FROM public.pricing_tiers
                   WHERE tier_name = COALESCE(p.tier::text, 'tier_3')::tier_name),
                1.7)
            * 1.5,
            2))
      )
    END,
    CASE WHEN COALESCE(p.is_manufacturer, false) THEN 0.0 ELSE 50.0 END,
    true,
    0
  FROM public.profiles p
  WHERE p.role IN ('agent', 'super_agent')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;
