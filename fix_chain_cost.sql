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

  v_node := CASE WHEN v_is_sub THEN COALESCE(v_parent, p_agent) ELSE p_agent END;
  v_seen := '{}';
  v_depth := 0;
  v_factor := 1;
  
  LOOP
    SELECT parent_agent_id INTO v_parent FROM profiles WHERE id = v_node;
    EXIT WHEN v_parent IS NULL OR v_depth >= 6 OR v_node = ANY(v_seen);
    v_seen := v_seen || v_node;
    
    IF v_depth > 0 THEN
       v_factor := v_factor * (1 + public.fn_agent_effective_markup(v_node) / 100.0);
    END IF;
    
    v_node := v_parent;
    v_depth := v_depth + 1;
  END LOOP;

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
