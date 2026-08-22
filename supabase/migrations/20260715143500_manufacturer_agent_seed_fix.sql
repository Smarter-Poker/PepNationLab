-- ============================================================
-- MANUFACTURER AGENT-CREATION SEED FIX (2026-07-15, follow-up)
--
-- seed_agent_products_for_new_agent (fires when an agent_profiles row is
-- provisioned) seeded manufacturer stores with the tier-3 x 1.5 default
-- formula. Manufacturer stores must launch at the platform base cost per
-- 10-pack instead. Also reprices existing manufacturer-store rows that
-- were created by the old formula (one-time data fix -- manufacturers
-- launched today; none have hand-set prices yet).
--
-- Idempotent: safe to re-run (the data fix only touches rows still at
-- the old default-formula price).
-- ============================================================

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

  -- FIX: include margin_percent = 50.0 (default) and compute retail_price
  --      with the margin applied so it matches the formula used by the cascade triggers.
  INSERT INTO public.agent_products (agent_id, product_id, retail_price, margin_percent, is_visible, sort_order)
  SELECT
    NEW.id,
    p.id,
    ROUND(p.base_cost * v_multiplier * 1.5, 2),   -- retail = base x tier_mult x (1 + 50%)
    50.0,                                           -- default markup
    true,
    0
  FROM public.products p
  WHERE p.is_active = true AND COALESCE(p.is_banned, false) = false
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;

-- One-time data fix: reprice manufacturer-store rows still sitting at the
-- old default-formula price down to the base cost per 10-pack, zero the
-- default margin marker, and clear any test manufacturer_cost values.
UPDATE public.agent_products ap
SET retail_price = ROUND(p.base_cost, 2),
    margin_percent = 0.0,
    manufacturer_cost = NULL,
    updated_at = now()
FROM public.products p, public.profiles pr
WHERE p.id = ap.product_id
  AND pr.id = ap.agent_id
  AND pr.is_manufacturer = true
  AND COALESCE(p.is_banned, false) = false
  AND ap.retail_price = ROUND(p.base_cost * 3.5 * 1.5, 2);
