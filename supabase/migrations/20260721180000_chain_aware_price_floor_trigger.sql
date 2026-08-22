-- Make the DATABASE layer of the 10%-margin fail-safe chain-aware.
--
-- enforce_agent_product_price_floor (the last-resort BEFORE trigger on
-- agent_products) and fn_validate_pricing (the pricing audit report) both
-- computed an agent's cost from the agent's OWN ladder/custom override,
-- ignoring upline chain markups entirely. For a parented (chain-priced)
-- agent that UNDERSTATES cost, so the trigger's floor was too low and the
-- audit report could miss below-margin prices. Checkout and the price
-- editor already use the chain-aware cost; this closes the third layer.
--
-- fn_agent_chain_cost mirrors lib/pricing resolveChainAwareV2Markup exactly:
--   cost = ROUND(base_cost * (1 + topLadderMarkup)
--                 * PRODUCT over parented hops of
--                   (1 + fn_agent_effective_markup(hop)/100), 2)   [per-pack]
-- Sub-agents (recruiters) price in their parent's context, matching the
-- previous trigger behavior. Depth cap 6 + cycle guard match lib/pricing.

CREATE OR REPLACE FUNCTION public.fn_agent_chain_cost(p_agent uuid, p_product uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_base numeric;
  v_is_sub boolean;
  v_parent uuid;
  v_node uuid;
  v_factor numeric := 1;
  v_depth int := 0;
  v_seen uuid[] := '{}';
  v_top_markup numeric;
BEGIN
  SELECT base_cost INTO v_base FROM products WHERE id = p_product;
  IF v_base IS NULL OR v_base <= 0 THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(is_sub_agent, false), parent_agent_id
    INTO v_is_sub, v_parent
  FROM profiles WHERE id = p_agent;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Sub-agents (recruiters) price in their parent's context.
  v_node := CASE WHEN v_is_sub THEN COALESCE(v_parent, p_agent) ELSE p_agent END;

  -- Walk UP the chain, compounding each parented hop's fixed markup.
  LOOP
    SELECT parent_agent_id INTO v_parent FROM profiles WHERE id = v_node;
    EXIT WHEN v_parent IS NULL OR v_depth >= 6 OR v_node = ANY(v_seen);
    v_seen := v_seen || v_node;
    v_factor := v_factor * (1 + public.fn_agent_effective_markup(v_node) / 100.0);
    v_node := v_parent;
    v_depth := v_depth + 1;
  END LOOP;

  -- v_node is now the top-of-chain account: ladder / custom override applies.
  SELECT COALESCE(
    (SELECT pr2.custom_markup_override FROM public.profiles pr2 WHERE pr2.id = v_node),
    (SELECT ht.markup FROM public.house_tiers ht
      WHERE ht.level = public.fn_resolve_house_tier_level(v_node)),
    (SELECT MAX(ht2.markup) FROM public.house_tiers ht2),
    2.50
  ) INTO v_top_markup;

  RETURN ROUND(v_base * (1 + v_top_markup) * v_factor, 2);
END;
$$;

-- Trigger: same exemptions (admin, manufacturer), same never-clamp-above-
-- ceiling rule; only the cost basis changes to the chain-aware helper.
CREATE OR REPLACE FUNCTION public.enforce_agent_product_price_floor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_role text;
  v_is_manufacturer boolean;
  v_max_retail numeric;
  v_cost numeric;
  v_floor numeric;
BEGIN
  SELECT role, COALESCE(is_manufacturer, false)
    INTO v_role, v_is_manufacturer
  FROM profiles WHERE id = NEW.agent_id;
  IF v_role = 'admin' OR v_is_manufacturer THEN
    RETURN NEW;
  END IF;

  v_cost := public.fn_agent_chain_cost(NEW.agent_id, NEW.product_id);
  IF v_cost IS NULL OR v_cost <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT max_retail_price INTO v_max_retail FROM products WHERE id = NEW.product_id;

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
$$;

-- Audit report: agent_cost is now the chain-aware cost, so AT_OR_BELOW_COST
-- and BELOW_MIN_MARGIN catch chain-priced agents too. RETAIL_MISMATCH keeps
-- its meaning (retail vs cost x (1 + margin_percent)) on the new basis.
CREATE OR REPLACE FUNCTION public.fn_validate_pricing()
RETURNS TABLE(violation text, agent_username text, product_name text, base_cost numeric, effective_markup numeric, margin_percent numeric, actual_retail numeric, expected_value numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  WITH ctx AS (
    SELECT
      prof.username::text AS username,
      p.name::text        AS product_name,
      p.base_cost,
      ap.margin_percent,
      ap.retail_price,
      public.fn_agent_chain_cost(prof.id, p.id) AS agent_cost
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
           CASE WHEN base_cost > 0 AND agent_cost IS NOT NULL
                THEN ROUND(agent_cost / base_cost - 1, 4) END AS eff_markup,
           ROUND(agent_cost * (1 + COALESCE(margin_percent, 50) / 100.0), 2) AS expected_retail
    FROM ctx
    WHERE agent_cost IS NOT NULL
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
$$;
