-- Policy change: every agent / super-agent store is preset at the admin house
-- store price (products.max_retail_price). Agents no longer get a tier-based
-- markup default and no longer choose their own markup at onboarding.
--
-- (1) New-agent catalog seeder: seed retail_price at the admin store price, with
--     margin_percent as markup over base_cost (matching the admin store's rows).
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

  -- Manufacturer stores launch at the platform base cost per 10-pack.
  IF v_is_manufacturer THEN
    INSERT INTO public.agent_products (agent_id, product_id, retail_price, margin_percent, is_visible, sort_order)
    SELECT NEW.id, p.id, ROUND(p.base_cost, 2), 0.0, true, 0
    FROM public.products p
    WHERE p.is_active = true AND COALESCE(p.is_banned, false) = false
    ON CONFLICT DO NOTHING;
    RETURN NEW;
  END IF;

  -- Tier multiplier is only a fallback for a product with no admin price set.
  SELECT multiplier INTO v_multiplier FROM public.pricing_tiers WHERE tier_name = v_tier_text::tier_name;
  IF v_multiplier IS NULL THEN v_multiplier := 1.7; END IF;

  -- Preset at the admin store price (products.max_retail_price). retail = the cap
  -- exactly, so the ceiling trigger passes; margin_percent = markup over base_cost.
  INSERT INTO public.agent_products (agent_id, product_id, retail_price, margin_percent, is_visible, sort_order)
  SELECT
    NEW.id,
    p.id,
    COALESCE(p.max_retail_price, ROUND(p.base_cost * v_multiplier * 1.5, 2)),
    CASE
      WHEN p.base_cost > 0
      THEN ROUND((COALESCE(p.max_retail_price, ROUND(p.base_cost * v_multiplier * 1.5, 2)) / p.base_cost - 1) * 100, 2)
      ELSE 0
    END,
    true,
    0
  FROM public.products p
  WHERE p.is_active = true AND COALESCE(p.is_banned, false) = false
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;

-- (2) One-time alignment: raise every existing non-manufacturer agent / super-agent
--     store row that is below the admin store price up to the admin store price.
--     Excludes admin (role='admin'), manufacturer stores, and banned products.
UPDATE public.agent_products ap
SET retail_price = p.max_retail_price,
    margin_percent = CASE WHEN p.base_cost > 0
                          THEN ROUND((p.max_retail_price / p.base_cost - 1) * 100, 2)
                          ELSE ap.margin_percent END,
    sale_price = CASE WHEN ap.sale_price IS NOT NULL AND ap.sale_price > p.max_retail_price
                      THEN p.max_retail_price ELSE ap.sale_price END
FROM public.products p, public.profiles pr
WHERE p.id = ap.product_id
  AND pr.id = ap.agent_id
  AND pr.role IN ('agent', 'super_agent')
  AND COALESCE(pr.is_manufacturer, false) = false
  AND COALESCE(p.is_banned, false) = false
  AND p.max_retail_price IS NOT NULL
  AND ap.retail_price <> p.max_retail_price;
