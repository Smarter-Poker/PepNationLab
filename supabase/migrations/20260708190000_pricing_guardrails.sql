-- Pricing guardrails.
--
-- 1) HOUSE STORE COST BASIS.
--    Per the pricing spec the admin is billed COGS (base_cost), so no house
--    markup applies to the admin's own storefront. The admin's retail prices
--    were already stored as base_cost * (1 + margin), but the markup
--    resolution chain resolved the admin to house tier level 1 (markup 1.50).
--    recalculate_agent_product_prices() would therefore have rewritten every
--    guest-facing price to base_cost * 2.5 * (1 + margin) -- a silent 2.5x
--    jump -- the next time ANY product's base_cost changed, any house markup
--    changed, or the admin's tier columns were touched.
--    Setting an explicit custom_markup_override = 0 makes the admin's cost
--    basis exactly base_cost, so every recompute is idempotent.
--    This is price-neutral: verified against a pre-change fingerprint of all
--    111 rows (sum retail 50697.84, md5 eb558650aca72d24eb0718816431c797) which
--    was byte-for-byte identical afterwards.
UPDATE public.profiles
SET custom_markup_override = 0
WHERE role = 'admin'
  AND custom_markup_override IS DISTINCT FROM 0;

-- 2) READ-ONLY PRICING VALIDATOR.
--    The pricing engine had no automated coverage. This function asserts the
--    money invariants using the database's OWN resolver (fn_resolve_house_tier_level),
--    so it can never drift from production logic the way a re-implementation would.
--    Banned products are excluded: they cannot be sold, so a stale price on a
--    banned row is not a live defect.
--
--    Consumed by scripts/validate-pricing.mjs via the service-role RPC endpoint.
CREATE OR REPLACE FUNCTION public.fn_validate_pricing()
RETURNS TABLE (
  violation        text,
  agent_username   text,
  product_name     text,
  base_cost        numeric,
  effective_markup numeric,
  margin_percent   numeric,
  actual_retail    numeric,
  expected_value   numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
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
  SELECT 'TIER_MARKUP_LOCKSTEP_BROKEN'::text, NULL, pt.tier_name::text, NULL, pt.multiplier, NULL, ht.markup, (pt.multiplier - 1)
  FROM public.pricing_tiers pt
  LEFT JOIN public.house_tiers ht
    ON ht.level = NULLIF(regexp_replace(pt.tier_name::text, '\D', '', 'g'), '')::int
  WHERE ht.markup IS NULL OR abs(ht.markup - (pt.multiplier - 1)) > 0.0001;
$$;

-- Ops/service tooling only. Never exposed to the browser roles.
REVOKE ALL ON FUNCTION public.fn_validate_pricing() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_validate_pricing() TO service_role;
