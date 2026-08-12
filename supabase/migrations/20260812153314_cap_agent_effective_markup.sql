-- Enforce Super Agent markup caps (2026-08-12): downlines are never allowed to 
-- charge a markup percentage higher than their top ancestor's custom_markup_override.
CREATE OR REPLACE FUNCTION public.fn_agent_effective_markup(p_agent uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_base numeric; v_super uuid; v_top_override numeric; v_current uuid; v_parent uuid;
BEGIN
  -- commission_pct is reused as the downline agent's base_markup (whole percent).
  SELECT commission_pct, parent_agent_id
    INTO v_base, v_super
  FROM profiles WHERE id = p_agent AND is_sub_agent = false;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Platform default: unassigned downline agents pay super cost + 50%.
  IF v_base IS NULL THEN
    IF v_super IS NULL THEN
      RETURN 0;
    END IF;
    v_base := 50;
  END IF;

  v_base := GREATEST(v_base, 0);

  -- Walk the chain to find the TOP ancestor's custom_markup_override
  v_current := p_agent;
  FOR i IN 1..6 LOOP
    SELECT parent_agent_id, custom_markup_override 
      INTO v_parent, v_top_override
    FROM profiles WHERE id = v_current;
    
    IF v_parent IS NULL THEN
      EXIT;
    END IF;
    v_current := v_parent;
  END LOOP;

  IF v_top_override IS NOT NULL THEN
    -- v_top_override is stored as decimal (e.g. 0.49), v_base is whole (e.g. 100)
    v_base := LEAST(v_base, v_top_override * 100);
  END IF;

  RETURN v_base;
END; $function$;
