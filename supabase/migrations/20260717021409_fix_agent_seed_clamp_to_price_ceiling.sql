-- Bug: creating a new agent / super-agent failed with
--   "retail_price (...) exceeds max_retail_price (...) for this product"
-- The new-agent catalog seeder (seed_agent_products_for_new_agent) set every
-- store product's retail_price to ROUND(base_cost * tier_multiplier * 1.5, 2)
-- with no regard for each product's max_retail_price ceiling. The BEFORE trigger
-- enforce_agent_product_price_ceiling then rejected any seeded row above the cap,
-- which aborted the whole multi-row INSERT and rolled back account creation.
-- At tier_1 this hit 13 products, tier_2 74, tier_3 101 of 110 -> creation broke
-- for effectively every tier.
--
-- Fix: seed at the tier default but clamp retail_price to the product's
-- max_retail_price, and keep margin_percent consistent with the (possibly
-- clamped) price. Manufacturer stores are unchanged (separate branch, and the
-- ceiling trigger already exempts them). Admin stores are exempt in the guard.
CREATE OR REPLACE FUNCTION public.seed_agent_products_for_new_agent()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_multiplier NUMERIC; v_tier_text TEXT; v_role TEXT; v_is_manufacturer BOOLEAN;
BEGIN
  -- Look up role and tier from the profiles table (they aren't on agent_profiles)
  SELECT role::text, COALESCE(tier::text, 'tier_3'), COALESCE(is_manufacturer, false)
    INTO v_role, v_tier_text, v_is_manufacturer
    FROM public.profiles
    WHERE id = NEW.id;

  IF v_role NOT IN ('agent', 'super_agent') THEN RETURN NEW; END IF;

  -- Manufacturer stores launch at the platform base cost per 10-pack --
  -- their own wholesale number -- with no default margin applied.
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

  -- Seed at the tier default (base x tier_mult x 1.5 = +50% markup), but never
  -- above the product's retail ceiling; otherwise the price-ceiling trigger
  -- aborts the entire seed and new-agent creation fails.
  INSERT INTO public.agent_products (agent_id, product_id, retail_price, margin_percent, is_visible, sort_order)
  SELECT
    NEW.id,
    p.id,
    LEAST(
      ROUND(p.base_cost * v_multiplier * 1.5, 2),
      COALESCE(p.max_retail_price, ROUND(p.base_cost * v_multiplier * 1.5, 2))
    ),
    -- Keep the stored markup consistent with the price actually charged: when
    -- the default overshoots the ceiling, derive the margin the clamped retail
    -- represents over the tier wholesale (floored at 0); else the 50% default.
    CASE
      WHEN p.max_retail_price IS NOT NULL
       AND ROUND(p.base_cost * v_multiplier * 1.5, 2) > p.max_retail_price
       AND p.base_cost * v_multiplier > 0
      THEN GREATEST(ROUND((p.max_retail_price / (p.base_cost * v_multiplier) - 1) * 100, 2), 0)
      ELSE 50.0
    END,
    true,
    0
  FROM public.products p
  WHERE p.is_active = true AND COALESCE(p.is_banned, false) = false
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;
