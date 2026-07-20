-- Minimum-margin fail-safe (2026-07-19, per Dan): no agent may ever sell below
-- a 10% profit margin over their own cost (retail >= cost * 1.10).
-- Three layers ship together (this migration is the DB layer; the API price
-- editor and the checkout clamp are the app layers):
--  1. agent_products floor trigger: clamps retail_price / sale_price up to
--     cost * 1.10 on write (self-healing, never raises - automated seeding and
--     bulk writes cannot break). Cost basis = the v2 house-ladder cost
--     (custom_markup_override else house_tiers markup), same resolution as
--     fn_validate_pricing. Admin + manufacturer stores exempt (mirrors the
--     ceiling trigger). If the admin ceiling (max_retail_price) sits below the
--     floor, the clamp respects the ceiling and the daily audit flags the
--     conflict instead.
--  2. fn_validate_pricing gains a BELOW_MIN_MARGIN violation so the daily
--     integrity-audit cron catches anything that slips through.
-- Applied to production 2026-07-19.

-- 1. Floor trigger ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_agent_product_price_floor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role text;
  v_is_manufacturer boolean;
  v_is_sub boolean;
  v_parent uuid;
  v_ctx_agent uuid;
  v_base_cost numeric;
  v_max_retail numeric;
  v_markup numeric;
  v_cost numeric;
  v_floor numeric;
BEGIN
  SELECT role, COALESCE(is_manufacturer, false), COALESCE(is_sub_agent, false), parent_agent_id
    INTO v_role, v_is_manufacturer, v_is_sub, v_parent
  FROM profiles WHERE id = NEW.agent_id;
  IF v_role = 'admin' OR v_is_manufacturer THEN
    RETURN NEW;
  END IF;

  SELECT base_cost, max_retail_price INTO v_base_cost, v_max_retail
  FROM products WHERE id = NEW.product_id;
  IF v_base_cost IS NULL OR v_base_cost <= 0 THEN
    RETURN NEW;
  END IF;

  -- Same cost-context resolution as fn_validate_pricing: sub-agents price in
  -- their parent's context; custom_markup_override wins, else house ladder.
  v_ctx_agent := CASE WHEN v_is_sub THEN COALESCE(v_parent, NEW.agent_id) ELSE NEW.agent_id END;
  SELECT COALESCE(
    (SELECT pr2.custom_markup_override FROM public.profiles pr2 WHERE pr2.id = v_ctx_agent),
    (SELECT ht.markup FROM public.house_tiers ht
      WHERE ht.level = public.fn_resolve_house_tier_level(v_ctx_agent)),
    (SELECT MAX(ht2.markup) FROM public.house_tiers ht2),
    2.50
  ) INTO v_markup;

  v_cost  := ROUND(v_base_cost * (1 + v_markup), 2);
  v_floor := ROUND(v_cost * 1.10, 2);

  -- Never clamp above the admin ceiling: a floor-vs-ceiling conflict is an
  -- admin config problem the daily audit surfaces; the trigger must not make
  -- writes impossible.
  IF v_max_retail IS NOT NULL AND v_floor > v_max_retail THEN
    v_floor := v_max_retail;
  END IF;

  IF NEW.retail_price IS NOT NULL AND NEW.retail_price < v_floor THEN
    NEW.retail_price := v_floor;
  END IF;
  IF NEW.sale_price IS NOT NULL AND NEW.sale_price < v_floor THEN
    NEW.sale_price := v_floor;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_agent_product_price_floor ON public.agent_products;
CREATE TRIGGER trg_agent_product_price_floor
  BEFORE INSERT OR UPDATE OF retail_price, sale_price ON public.agent_products
  FOR EACH ROW EXECUTE FUNCTION public.enforce_agent_product_price_floor();

-- 2. Audit: add BELOW_MIN_MARGIN --------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_validate_pricing()
 RETURNS TABLE(violation text, agent_username text, product_name text, base_cost numeric, effective_markup numeric, margin_percent numeric, actual_retail numeric, expected_value numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH ctx AS (
    SELECT
      prof.username::text AS username,
      p.name::text        AS product_name,
      p.base_cost,
      ap.margin_percent,
      ap.retail_price,
      COALESCE(
        (SELECT pr2.custom_markup_override FROM public.profiles pr2
          WHERE pr2.id = CASE WHEN COALESCE(prof.is_sub_agent,false)
                              THEN COALESCE(prof.parent_agent_id, prof.id) ELSE prof.id END),
        (SELECT ht.markup FROM public.house_tiers ht
          WHERE ht.level = public.fn_resolve_house_tier_level(
            CASE WHEN COALESCE(prof.is_sub_agent,false)
                 THEN COALESCE(prof.parent_agent_id, prof.id) ELSE prof.id END)),
        (SELECT MAX(ht2.markup) FROM public.house_tiers ht2),
        2.50
      ) AS eff_markup
    FROM public.agent_products ap
    JOIN public.products  p    ON ap.product_id = p.id
    JOIN public.profiles  prof ON ap.agent_id   = prof.id
    WHERE COALESCE(p.is_banned, false) = false
      AND p.is_active
      AND p.base_cost > 0
      AND ap.retail_price IS NOT NULL
      AND prof.role <> 'admin'
      AND COALESCE(prof.is_manufacturer, false) = false
  ),
  calc AS (
    SELECT ctx.*,
           ROUND(base_cost * (1 + eff_markup), 2) AS agent_cost,
           ROUND(base_cost * (1 + eff_markup) * (1 + COALESCE(margin_percent, 50) / 100.0), 2) AS expected_retail
    FROM ctx
  )
  SELECT 'RETAIL_MISMATCH'::text, username, product_name, base_cost, eff_markup, margin_percent, retail_price, expected_retail
  FROM calc WHERE abs(retail_price - expected_retail) > 0.02
  UNION ALL
  SELECT 'AT_OR_BELOW_COST'::text, username, product_name, base_cost, eff_markup, margin_percent, retail_price, agent_cost
  FROM calc WHERE retail_price <= agent_cost
  UNION ALL
  SELECT 'BELOW_MIN_MARGIN'::text, username, product_name, base_cost, eff_markup, margin_percent, retail_price, ROUND(agent_cost * 1.10, 2)
  FROM calc WHERE retail_price > agent_cost AND retail_price < ROUND(agent_cost * 1.10, 2)
  UNION ALL
  SELECT 'TIER_MARKUP_LOCKSTEP_BROKEN'::text, NULL, pt.tier_name::text, NULL, pt.multiplier, NULL, ht.markup, (pt.multiplier - 1)
  FROM public.pricing_tiers pt
  LEFT JOIN public.house_tiers ht
    ON ht.level = NULLIF(regexp_replace(pt.tier_name::text, '\D', '', 'g'), '')::int
  WHERE ht.markup IS NULL OR abs(ht.markup - (pt.multiplier - 1)) > 0.0001;
$function$;
