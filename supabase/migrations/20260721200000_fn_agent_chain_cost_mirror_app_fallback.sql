-- Audit fix (2026-07-21): fn_agent_chain_cost's depth-cap / cycle FALLBACK must
-- mirror lib/pricing resolveChain exactly, or the DB price floor diverges from
-- what checkout charges on a >=6-deep chain or a cyclic parent_agent_id chain.
--
-- App resolveChain on breach (seen.size >= MAX_CHAIN_DEPTH=6 OR cycle):
--   returns { topId: agentId (the ORIGINAL agent), hopMarkups: [] }
--   => cost = base * (1 + resolveV2Markup(agentId)), NO compounding.
-- The prior version (migration 20260721180000) instead used whatever mid-chain
-- node it stopped on with a partial 6-hop factor. This rewrite matches
-- resolveChain node-for-node:
--   - sub-agent start redirects to its parent before walking
--   - guard checked BEFORE processing each node (matches seen.size>=6)
--   - per-hop markup = raw commission_pct (or 50) for each PARENTED node,
--     exactly the value the app pushes (GREATEST(...,0) is a harmless clamp;
--     commission_pct is CHECK-constrained >= 0)
--   - unresolvable profile (no row) or NULL parent => that node is the top
--   - on breach: top = the ORIGINAL p_agent, factor reset to 1
--   - terminal empty-house_tiers fallback is 0.7 (matches resolveV2Markup /
--     applyHouseMarkup), not 2.50
-- No live chain is >=6 deep (max is 3 levels) and there are no cycles, so this
-- changes no current price; it makes the floor provably match checkout for any
-- future deep/nested chain. Verified: 0/4894 cost mismatches vs the app formula,
-- 0 audit violations, and a rolled-back 2-cycle test returns the agent's own
-- ladder cost (base*(1+ownMarkup)) exactly like the app.
CREATE OR REPLACE FUNCTION public.fn_agent_chain_cost(p_agent uuid, p_product uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_base numeric;
  v_is_sub boolean;
  v_start_parent uuid;
  v_current uuid;
  v_node_parent uuid;
  v_node_commission numeric;
  v_found boolean;
  v_factor numeric := 1;
  v_seen uuid[] := '{}';
  v_top uuid;
  v_top_markup numeric;
BEGIN
  SELECT base_cost INTO v_base FROM products WHERE id = p_product;
  IF v_base IS NULL OR v_base <= 0 THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(is_sub_agent, false), parent_agent_id
    INTO v_is_sub, v_start_parent
  FROM profiles WHERE id = p_agent;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Mirror resolveChain: a sub-agent redirects to its parent's chain before
  -- walking (its commission_pct is a recruiter payout, not a cost markup).
  v_current := CASE WHEN v_is_sub AND v_start_parent IS NOT NULL THEN v_start_parent ELSE p_agent END;

  LOOP
    -- Guard BEFORE processing (mirrors app: seen.size >= MAX_CHAIN_DEPTH or cycle).
    -- array_length on an empty array is NULL, so the first iterations pass.
    IF v_current = ANY(v_seen) OR COALESCE(array_length(v_seen, 1), 0) >= 6 THEN
      -- Breach: fall back to the ORIGINAL agent's own ladder markup, no compounding.
      v_factor := 1;
      v_top := p_agent;
      EXIT;
    END IF;
    v_seen := v_seen || v_current;

    SELECT parent_agent_id, commission_pct
      INTO v_node_parent, v_node_commission
    FROM profiles WHERE id = v_current;
    v_found := FOUND;

    IF NOT v_found OR v_node_parent IS NULL THEN
      -- Top of chain (or an unresolvable profile treated as top).
      v_top := v_current;
      EXIT;
    END IF;

    -- Parented node: compound this hop's markup (raw commission_pct or 50),
    -- exactly the value app resolveChain pushes; keep walking to the top.
    v_factor := v_factor * (1 + GREATEST(COALESCE(v_node_commission, 50), 0) / 100.0);
    v_current := v_node_parent;
  END LOOP;

  -- Top-of-chain ladder markup: custom override, else house tier, else the
  -- highest configured markup, else 0.7 (empty house_tiers) — same COALESCE
  -- order and terminal constant as resolveV2Markup.
  SELECT COALESCE(
    (SELECT pr2.custom_markup_override FROM public.profiles pr2 WHERE pr2.id = v_top),
    (SELECT ht.markup FROM public.house_tiers ht
      WHERE ht.level = public.fn_resolve_house_tier_level(v_top)),
    (SELECT MAX(ht2.markup) FROM public.house_tiers ht2),
    0.7
  ) INTO v_top_markup;

  RETURN ROUND(v_base * (1 + v_top_markup) * v_factor, 2);
END;
$$;
