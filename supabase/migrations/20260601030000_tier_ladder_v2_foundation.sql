-- ============================================================================
-- 5-Tier Gamification Ladder — Phase 1 foundation (ADDITIVE / flag-gated).
-- Nothing here changes live pricing: lib/pricing.ts only consults these objects
-- when NEXT_PUBLIC_TIER_LADDER_V2 is enabled. Until then the legacy 3-tier
-- multiplier path is untouched.
-- ============================================================================

-- House tier ladder config (admin-editable; never hardcode prices in app code).
CREATE TABLE IF NOT EXISTS public.house_tiers (
  level int PRIMARY KEY CHECK (level BETWEEN 1 AND 5),
  name text NOT NULL,
  min_volume numeric NOT NULL DEFAULT 0,
  max_volume numeric,                       -- NULL = no upper bound (top tier)
  markup numeric NOT NULL CHECK (markup >= 0),  -- house markup as a fraction; cost = base*(1+markup)
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.house_tiers (level, name, min_volume, max_volume, markup) VALUES
  (1, 'Rookie',      0,     999,    0.70),
  (2, 'Established', 1000,  4999,   0.60),
  (3, 'Pro',         5000,  14999,  0.50),
  (4, 'Elite',       15000, 39999,  0.40),
  (5, 'Apex',        40000, NULL,   0.30)
ON CONFLICT (level) DO NOTHING;

ALTER TABLE public.house_tiers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS house_tiers_read ON public.house_tiers;
CREATE POLICY house_tiers_read ON public.house_tiers FOR SELECT TO authenticated USING (true);
-- writes only via service role / admin routes (service role bypasses RLS).

-- Admin "Fixed Scale Override": lock an agent to a specific level regardless of volume.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS fixed_scale_override boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS locked_tier_level int CHECK (locked_tier_level BETWEEN 1 AND 5);
-- Persisted current level (refreshed by recompute); used for level-up detection + UI.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS house_tier_level int CHECK (house_tier_level BETWEEN 1 AND 5);

-- Agent's OWN trailing-30-day wholesale spend (what they pay the House),
-- counted on every non-cancelled order via order_items.unit_cost_price.
CREATE OR REPLACE FUNCTION public.fn_agent_own_wholesale_30d(p_agent uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(oi.unit_cost_price * oi.quantity), 0)::numeric
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  WHERE o.agent_id = p_agent
    AND o.status <> 'cancelled'
    AND o.created_at >= now() - interval '30 days';
$$;

-- Tier-driving volume = own + roll-up of direct sub-agents' own spend (single hop).
CREATE OR REPLACE FUNCTION public.fn_agent_volume_30d(p_agent uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.fn_agent_own_wholesale_30d(p_agent)
       + COALESCE((
           SELECT SUM(public.fn_agent_own_wholesale_30d(c.id))
           FROM profiles c
           WHERE c.parent_agent_id = p_agent AND c.is_sub_agent = true
         ), 0)::numeric;
$$;

-- Resolve the effective house tier level: admin override wins, else volume bucket.
CREATE OR REPLACE FUNCTION public.fn_resolve_house_tier_level(p_agent uuid)
RETURNS int LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_override boolean; v_locked int; v_vol numeric; v_level int;
BEGIN
  SELECT fixed_scale_override, locked_tier_level INTO v_override, v_locked
  FROM profiles WHERE id = p_agent;
  IF COALESCE(v_override, false) AND v_locked IS NOT NULL THEN
    RETURN v_locked;
  END IF;
  v_vol := public.fn_agent_volume_30d(p_agent);
  SELECT level INTO v_level FROM house_tiers
   WHERE v_vol >= min_volume AND (max_volume IS NULL OR v_vol <= max_volume)
   ORDER BY level DESC LIMIT 1;
  RETURN COALESCE(v_level, 1);
END; $$;

COMMENT ON TABLE public.house_tiers IS '5-tier gamification ladder config (admin-editable). cost = base*(1+markup). Consumed only when tier ladder v2 flag is enabled.';
