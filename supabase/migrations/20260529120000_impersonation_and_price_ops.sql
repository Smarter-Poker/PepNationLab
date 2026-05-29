-- impersonation_sessions: short-lived audit + active-session marker
CREATE TABLE IF NOT EXISTS public.impersonation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  impersonator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  reason TEXT,
  ip_address TEXT,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS impersonation_active_idx
  ON public.impersonation_sessions(impersonator_id, ended_at)
  WHERE ended_at IS NULL;
ALTER TABLE public.impersonation_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manage impersonation" ON public.impersonation_sessions;
CREATE POLICY "Admin manage impersonation" ON public.impersonation_sessions
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- scheduled_price_changes: future effective_at OR immediate (=NOW())
CREATE TABLE IF NOT EXISTS public.scheduled_price_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL CHECK (scope IN ('master_base_cost','master_bulk_price','agent_retail','tier_multiplier','product_tier_override')),
  effective_at TIMESTAMPTZ NOT NULL,
  applied_at TIMESTAMPTZ,
  applied_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  agent_product_id UUID REFERENCES public.agent_products(id) ON DELETE CASCADE,
  tier_name TEXT,
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('set','percent_delta','flat_delta')),
  new_value NUMERIC NOT NULL,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS scheduled_price_changes_due_idx
  ON public.scheduled_price_changes(effective_at)
  WHERE applied_at IS NULL AND failed_at IS NULL;
ALTER TABLE public.scheduled_price_changes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manage scheduled price changes" ON public.scheduled_price_changes;
CREATE POLICY "Admin manage scheduled price changes" ON public.scheduled_price_changes
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Applier RPC: cron calls this. Runs all due rows in a single pass.
CREATE OR REPLACE FUNCTION public.apply_due_price_changes()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r RECORD;
  v_applied INT := 0;
  v_current NUMERIC;
  v_target NUMERIC;
BEGIN
  FOR r IN SELECT * FROM public.scheduled_price_changes
           WHERE applied_at IS NULL AND failed_at IS NULL AND effective_at <= NOW()
           ORDER BY effective_at LOOP
    BEGIN
      IF r.scope = 'master_base_cost' THEN
        SELECT base_cost INTO v_current FROM public.products WHERE id = r.product_id;
        v_target := CASE r.adjustment_type
                      WHEN 'set' THEN r.new_value
                      WHEN 'percent_delta' THEN v_current * (1 + r.new_value/100.0)
                      WHEN 'flat_delta' THEN v_current + r.new_value
                    END;
        UPDATE public.products SET base_cost = ROUND(v_target::numeric, 2), updated_at = NOW() WHERE id = r.product_id;
      ELSIF r.scope = 'master_bulk_price' THEN
        SELECT admin_bulk_price INTO v_current FROM public.products WHERE id = r.product_id;
        v_target := CASE r.adjustment_type
                      WHEN 'set' THEN r.new_value
                      WHEN 'percent_delta' THEN COALESCE(v_current,0) * (1 + r.new_value/100.0)
                      WHEN 'flat_delta' THEN COALESCE(v_current,0) + r.new_value
                    END;
        UPDATE public.products SET admin_bulk_price = ROUND(v_target::numeric, 2), updated_at = NOW() WHERE id = r.product_id;
      ELSIF r.scope = 'agent_retail' THEN
        SELECT retail_price INTO v_current FROM public.agent_products WHERE id = r.agent_product_id;
        v_target := CASE r.adjustment_type
                      WHEN 'set' THEN r.new_value
                      WHEN 'percent_delta' THEN v_current * (1 + r.new_value/100.0)
                      WHEN 'flat_delta' THEN v_current + r.new_value
                    END;
        UPDATE public.agent_products SET retail_price = ROUND(v_target::numeric, 2), updated_at = NOW() WHERE id = r.agent_product_id;
      ELSIF r.scope = 'tier_multiplier' THEN
        SELECT multiplier INTO v_current FROM public.pricing_tiers WHERE tier_name = r.tier_name::tier_name;
        v_target := CASE r.adjustment_type
                      WHEN 'set' THEN r.new_value
                      WHEN 'percent_delta' THEN v_current * (1 + r.new_value/100.0)
                      WHEN 'flat_delta' THEN v_current + r.new_value
                    END;
        UPDATE public.pricing_tiers SET multiplier = ROUND(v_target::numeric, 4), updated_at = NOW() WHERE tier_name = r.tier_name::tier_name;
      ELSIF r.scope = 'product_tier_override' THEN
        SELECT custom_multiplier INTO v_current FROM public.product_tier_overrides WHERE product_id = r.product_id AND tier_name = r.tier_name::tier_name;
        v_target := CASE r.adjustment_type
                      WHEN 'set' THEN r.new_value
                      WHEN 'percent_delta' THEN COALESCE(v_current,0) * (1 + r.new_value/100.0)
                      WHEN 'flat_delta' THEN COALESCE(v_current,0) + r.new_value
                    END;
        INSERT INTO public.product_tier_overrides (product_id, tier_name, custom_multiplier)
        VALUES (r.product_id, r.tier_name::tier_name, ROUND(v_target::numeric, 4))
        ON CONFLICT (product_id, tier_name) DO UPDATE SET custom_multiplier = EXCLUDED.custom_multiplier;
      END IF;

      UPDATE public.scheduled_price_changes SET applied_at = NOW() WHERE id = r.id;
      v_applied := v_applied + 1;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.scheduled_price_changes SET failed_at = NOW(), failure_reason = SQLERRM WHERE id = r.id;
    END;
  END LOOP;
  RETURN v_applied;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.apply_due_price_changes() FROM PUBLIC, anon, authenticated;
