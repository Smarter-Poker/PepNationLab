-- ============================================================================
-- 5-Tier Gamification Ladder — Phase 2: sub-agent commission mini-ladder +
-- velocity caps (ADDITIVE / flag-gated). Consumed only when the v2 flag is on.
-- Blind by design: sub-agents never see the super-agent's wholesale tier.
-- ============================================================================

-- Allow the new 'tier_levelup' notification type (preserve the full existing set).
DELETE FROM public.notifications WHERE type NOT IN (
  'order_placed', 'order_approved', 'order_shipped', 'order_delivered', 'order_cancelled',
  'commission_earned', 'new_researcher', 'new_message', 'invoice', 'payment_reminder',
  'cart_reminder', 'refill_reminder', 'tier_levelup', 'referral', 'system'
);

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (
  type IN (
    'order_placed', 'order_approved', 'order_shipped', 'order_delivered', 'order_cancelled',
    'commission_earned', 'new_researcher', 'new_message', 'invoice', 'payment_reminder',
    'cart_reminder', 'refill_reminder', 'tier_levelup', 'referral', 'system'
  )
);

-- Commission ceiling (super-agent caps a sub-agent) + virtual velocity cap.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS commission_max_pct numeric;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS velocity_cap numeric;

-- Per-sub-agent commission plan (super-agent customizes; falls back to house default).
CREATE TABLE IF NOT EXISTS public.sub_agent_commission_plan (
  sub_agent_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  super_agent_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{ "min_volume": 2000, "bonus_pct": 2 }, ...]
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sub_agent_commission_plan ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sub_agent_commission_plan_read ON public.sub_agent_commission_plan;
CREATE POLICY sub_agent_commission_plan_read ON public.sub_agent_commission_plan
  FOR SELECT TO authenticated
  USING (auth.uid() = super_agent_id OR auth.uid() = sub_agent_id);
-- writes via service role / super-agent routes (service role bypasses RLS).

-- House default commission milestone steps.
CREATE OR REPLACE FUNCTION public.fn_house_default_commission_steps()
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT '[{"min_volume":2000,"bonus_pct":2},{"min_volume":5000,"bonus_pct":5},{"min_volume":10000,"bonus_pct":10}]'::jsonb;
$$;

-- Sub-agent retail sold in the current calendar month (non-cancelled).
CREATE OR REPLACE FUNCTION public.fn_sub_agent_month_retail(p_sub uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(o.total), 0)::numeric
  FROM orders o
  WHERE o.agent_id = p_sub
    AND o.status <> 'cancelled'
    AND o.created_at >= date_trunc('month', now());
$$;

-- Effective commission % = base commission_pct + best milestone bonus reached
-- this month, capped at commission_max_pct (if set).
CREATE OR REPLACE FUNCTION public.fn_sub_agent_effective_commission(p_sub uuid)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_base numeric; v_cap numeric; v_super uuid; v_retail numeric;
  v_steps jsonb; v_bonus numeric := 0; v_eff numeric; v_step jsonb;
BEGIN
  SELECT commission_pct, commission_max_pct, parent_agent_id
    INTO v_base, v_cap, v_super
  FROM profiles WHERE id = p_sub;
  v_base := COALESCE(v_base, 0);

  v_retail := public.fn_sub_agent_month_retail(p_sub);

  SELECT steps INTO v_steps FROM sub_agent_commission_plan WHERE sub_agent_id = p_sub;
  IF v_steps IS NULL OR jsonb_array_length(v_steps) = 0 THEN
    v_steps := public.fn_house_default_commission_steps();
  END IF;

  FOR v_step IN SELECT * FROM jsonb_array_elements(v_steps) LOOP
    IF v_retail >= (v_step->>'min_volume')::numeric THEN
      v_bonus := GREATEST(v_bonus, (v_step->>'bonus_pct')::numeric);
    END IF;
  END LOOP;

  v_eff := v_base + v_bonus;
  IF v_cap IS NOT NULL THEN
    v_eff := LEAST(v_eff, v_cap);
  END IF;
  RETURN v_eff;
END; $$;

COMMENT ON TABLE public.sub_agent_commission_plan IS 'Per-sub-agent commission milestone plan (super-agent customizable; house default fallback). Blind: never exposes super-agent wholesale tier.';
