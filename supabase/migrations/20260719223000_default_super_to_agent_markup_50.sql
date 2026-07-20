-- Default super-to-agent markup (2026-07-19, per Dan): a downline agent with
-- NO assigned markup (profiles.commission_pct IS NULL, reused as base_markup)
-- now defaults to 50% over their super agent's cost, instead of 0%. Agents
-- with an explicitly assigned markup (including an explicit 0) are untouched.
-- Top-level agents (no parent_agent_id) keep returning 0 - the super-to-agent
-- markup concept does not apply to them. The volume gamification ladder and
-- the commission_max_pct floor continue to apply on top of the default.
-- Applied to production 2026-07-19.
CREATE OR REPLACE FUNCTION public.fn_agent_effective_markup(p_agent uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_base numeric; v_min numeric; v_super uuid; v_vol numeric;
  v_steps jsonb; v_bonus numeric := 0; v_eff numeric; v_step jsonb;
BEGIN
  -- We reuse commission_pct as base_markup, and commission_max_pct as min_markup.
  SELECT commission_pct, commission_max_pct, parent_agent_id
    INTO v_base, v_min, v_super
  FROM profiles WHERE id = p_agent AND is_sub_agent = false;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Platform default (2026-07-19): unassigned downline agents pay
  -- super cost + 50% until an explicit markup is assigned.
  IF v_base IS NULL THEN
    IF v_super IS NULL THEN
      RETURN 0;
    END IF;
    v_base := 50;
  END IF;

  v_vol := public.fn_agent_own_wholesale_30d(p_agent);

  SELECT steps INTO v_steps FROM sub_agent_commission_plan WHERE sub_agent_id = p_agent;
  IF v_steps IS NULL OR jsonb_array_length(v_steps) = 0 THEN
    v_steps := public.fn_house_default_commission_steps();
  END IF;

  FOR v_step IN SELECT * FROM jsonb_array_elements(v_steps) LOOP
    IF v_vol >= (v_step->>'min_volume')::numeric THEN
      v_bonus := GREATEST(v_bonus, (v_step->>'bonus_pct')::numeric);
    END IF;
  END LOOP;

  -- Gamification Lowers the Markup!
  v_eff := v_base - v_bonus;
  IF v_min IS NOT NULL THEN
    v_eff := GREATEST(v_eff, v_min);
  END IF;

  -- Ensure markup never goes below 0 (Super Agent can't sell at a loss)
  RETURN GREATEST(v_eff, 0);
END; $function$;
