-- Fix: Recalculate agent_products.retail_price for BAC water after base_cost changed to $3.00
-- Convention: retail_price stored as per-10-pack = base_cost * 10 * (1 + markup)
-- Displayed as per-vial by dividing by 10 at read time.
-- Clamps to max_retail_price ceiling (or 1.5x for super-agents) to satisfy the
-- enforce_agent_product_price_ceiling trigger.

DO $$
DECLARE
  tier3_multiplier NUMERIC;
BEGIN
  SELECT COALESCE(multiplier, 1.7) INTO tier3_multiplier
  FROM pricing_tiers WHERE tier_name = 'tier_3' LIMIT 1;
  IF tier3_multiplier IS NULL THEN tier3_multiplier := 1.7; END IF;

  UPDATE agent_products
  SET retail_price = LEAST(
    -- computed per-10-pack price from live base_cost + agent markup
    ROUND(
      p.base_cost * 10 * (1 + COALESCE(pr.custom_markup_override, tier3_multiplier - 1)),
      2
    ),
    -- hard ceiling: honour the super-agent 1.5x multiplier where applicable
    CASE
      WHEN pr.role = 'super_agent' OR pr.is_super_agent = true THEN
        COALESCE(p.max_retail_price * 1.5, 9999.99)
      ELSE
        COALESCE(p.max_retail_price, 9999.99)
    END
  )
  FROM products p, profiles pr
  WHERE agent_products.product_id = p.id
    AND agent_products.agent_id = pr.id
    AND (
      p.compound_slug = 'bac-water'
      OR p.name ILIKE '%bacteriostatic water%'
      OR p.name ILIKE '%bac%water%'
    );

  RAISE NOTICE 'BAC water retail_price recalculation complete.';
END;
$$;
