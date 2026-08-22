-- Fixed agent markup (2026-07-20, per Dan): the markup an upline assigns to a
-- downline agent is a FIXED percent. The previous version warped it in both
-- directions - a 30-day-volume "gamification" bonus lowered it (40% assigned
-- resolved to 34.23%) and the commission_max_pct floor raised it (10-20%
-- assigned resolved to 30%). Effective markup is now exactly:
--   assigned commission_pct, or the platform default 50 when unassigned,
--   clamped at >= 0. Nothing else.
-- Applied to production 2026-07-20.
CREATE OR REPLACE FUNCTION public.fn_agent_effective_markup(p_agent uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_base numeric; v_super uuid;
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

  -- FIXED markup: exactly what the upline assigned. No volume ladder, no floor.
  RETURN GREATEST(v_base, 0);
END; $function$;
