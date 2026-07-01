-- ============================================================================
-- Gamification Grace Periods & Price Audit Logs
-- ============================================================================

-- 1. 30-Day Demotion Grace Periods
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tier_grace_period_expires_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS grace_period_tier_level int;

-- Update tier resolution to honor active grace periods
CREATE OR REPLACE FUNCTION public.fn_resolve_house_tier_level(p_agent uuid)
RETURNS int LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE 
  v_override boolean; 
  v_locked int; 
  v_vol numeric; 
  v_level int;
  v_grace_expires timestamptz;
  v_grace_tier int;
BEGIN
  SELECT fixed_scale_override, locked_tier_level, tier_grace_period_expires_at, grace_period_tier_level
  INTO v_override, v_locked, v_grace_expires, v_grace_tier
  FROM public.profiles WHERE id = p_agent;
  
  -- Admin fixed lock overrides everything immediately
  IF COALESCE(v_override, false) AND v_locked IS NOT NULL THEN
    RETURN v_locked;
  END IF;
  
  -- Calculate actual earned level by 30-day volume
  v_vol := public.fn_agent_volume_30d(p_agent);
  SELECT level INTO v_level FROM public.house_tiers
   WHERE v_vol >= min_volume AND (max_volume IS NULL OR v_vol <= max_volume)
   ORDER BY level DESC LIMIT 1;
   
  v_level := COALESCE(v_level, 3); -- default rookie
  
  -- Check grace period: if active, and it protects a better tier (lower number) than they earned, use the grace tier
  IF v_grace_expires IS NOT NULL AND v_grace_expires > now() AND v_grace_tier IS NOT NULL THEN
    IF v_grace_tier < v_level THEN
      RETURN v_grace_tier;
    END IF;
  END IF;

  RETURN v_level;
END; $$;


-- 2. Price History Audit Logs
CREATE TABLE IF NOT EXISTS public.price_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  old_retail_price numeric,
  new_retail_price numeric NOT NULL,
  old_margin_percent numeric,
  new_margin_percent numeric,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Give admins read access
ALTER TABLE public.price_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS read_audit_logs ON public.price_audit_logs;
CREATE POLICY read_audit_logs ON public.price_audit_logs FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE OR REPLACE FUNCTION public.fn_audit_agent_product_price()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- If nothing changed, skip
  IF (OLD.retail_price = NEW.retail_price AND OLD.margin_percent = NEW.margin_percent) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.price_audit_logs (
    agent_id, product_id, old_retail_price, new_retail_price, old_margin_percent, new_margin_percent, reason
  ) VALUES (
    NEW.agent_id, NEW.product_id, OLD.retail_price, NEW.retail_price, OLD.margin_percent, NEW.margin_percent, 'System Update'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_agent_product_price ON public.agent_products;
CREATE TRIGGER trg_audit_agent_product_price
  AFTER UPDATE ON public.agent_products
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_audit_agent_product_price();
