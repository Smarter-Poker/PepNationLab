-- ============================================================
-- PEP NATION LAB — SACA Phase 1
-- Sub-Agent Commission Architecture (Phase 1: DB foundation)
-- ============================================================
-- Replaces the old per-storefront sub-agent model with a referral
-- seat that sells on the parent's storefront and earns a commission
-- percentage on gross product sales. See product spec 2026-05-30.
-- Applied to ydsaqnnuwyvtyxgvrnys via Supabase MCP on 2026-05-30.
-- ============================================================

-- ── 1. profiles: sub-agent fields ────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_sub_agent BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS commission_pct NUMERIC(5,2);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS commission_active_since TIMESTAMPTZ;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS created_by_agent_id UUID REFERENCES public.profiles(id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_commission_pct_range') THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_commission_pct_range
      CHECK (commission_pct IS NULL OR (commission_pct >= 0 AND commission_pct <= 40));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_sub_agent_must_have_parent') THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_sub_agent_must_have_parent
      CHECK (NOT is_sub_agent OR parent_agent_id IS NOT NULL);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_sub_agent_must_have_commission') THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_sub_agent_must_have_commission
      CHECK (NOT is_sub_agent OR (commission_pct IS NOT NULL AND commission_active_since IS NOT NULL));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_is_sub_agent
  ON public.profiles (parent_agent_id)
  WHERE is_sub_agent = true;

-- ── 2. Trigger: prevent nested sub-agents ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_no_nested_sub_agents()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_parent_is_sub BOOLEAN;
BEGIN
  IF NEW.is_sub_agent = true AND NEW.parent_agent_id IS NOT NULL THEN
    SELECT is_sub_agent INTO v_parent_is_sub
    FROM public.profiles
    WHERE id = NEW.parent_agent_id;

    IF v_parent_is_sub = true THEN
      RAISE EXCEPTION 'Sub-agents cannot have sub-agents. Parent % is itself a sub-agent.', NEW.parent_agent_id
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_no_nested_sub_agents() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_enforce_no_nested_sub_agents ON public.profiles;
CREATE TRIGGER trg_enforce_no_nested_sub_agents
  BEFORE INSERT OR UPDATE OF is_sub_agent, parent_agent_id ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_no_nested_sub_agents();

-- ── 3. orders: sub-agent attribution + commission snapshot ───────────────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS referring_sub_agent_id UUID REFERENCES public.profiles(id);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS sub_agent_commission_pct NUMERIC(5,2);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS sub_agent_commission_amount NUMERIC(10,2);

CREATE INDEX IF NOT EXISTS idx_orders_referring_sub_agent_id
  ON public.orders (referring_sub_agent_id)
  WHERE referring_sub_agent_id IS NOT NULL;

-- ── 4. sub_agent_settlements (weekly close) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sub_agent_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_agent_id UUID NOT NULL REFERENCES public.profiles(id),
  parent_agent_id UUID NOT NULL REFERENCES public.profiles(id),
  week_start TIMESTAMPTZ NOT NULL,
  week_end TIMESTAMPTZ NOT NULL,
  total_commission NUMERIC(10,2) NOT NULL,
  orders_count INTEGER NOT NULL,
  settled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sub_agent_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_sas_sub_agent
  ON public.sub_agent_settlements (sub_agent_id, week_start DESC);

CREATE INDEX IF NOT EXISTS idx_sas_parent
  ON public.sub_agent_settlements (parent_agent_id, week_start DESC);

-- ── 5. sub_agent_commission_ledger ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sub_agent_commission_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  sub_agent_id UUID NOT NULL REFERENCES public.profiles(id),
  parent_agent_id UUID NOT NULL REFERENCES public.profiles(id),
  commission_pct NUMERIC(5,2) NOT NULL,
  gross_product_subtotal NUMERIC(10,2) NOT NULL,
  commission_amount NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'settled', 'voided')),
  accrued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ,
  settlement_id UUID REFERENCES public.sub_agent_settlements(id),
  UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS idx_sacl_sub_agent_status
  ON public.sub_agent_commission_ledger (sub_agent_id, status);

CREATE INDEX IF NOT EXISTS idx_sacl_parent_status
  ON public.sub_agent_commission_ledger (parent_agent_id, status);

CREATE INDEX IF NOT EXISTS idx_sacl_settlement_id
  ON public.sub_agent_commission_ledger (settlement_id)
  WHERE settlement_id IS NOT NULL;

-- ── 6. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE public.sub_agent_commission_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sub_agent_settlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sacl_select_self ON public.sub_agent_commission_ledger;
CREATE POLICY sacl_select_self
  ON public.sub_agent_commission_ledger FOR SELECT
  USING (auth.uid() = sub_agent_id OR auth.uid() = parent_agent_id OR public.is_admin());

DROP POLICY IF EXISTS sacl_no_user_writes ON public.sub_agent_commission_ledger;
CREATE POLICY sacl_no_user_writes
  ON public.sub_agent_commission_ledger FOR INSERT
  WITH CHECK (false);

DROP POLICY IF EXISTS sacl_no_user_updates ON public.sub_agent_commission_ledger;
CREATE POLICY sacl_no_user_updates
  ON public.sub_agent_commission_ledger FOR UPDATE
  USING (false);

DROP POLICY IF EXISTS sacl_no_user_deletes ON public.sub_agent_commission_ledger;
CREATE POLICY sacl_no_user_deletes
  ON public.sub_agent_commission_ledger FOR DELETE
  USING (false);

DROP POLICY IF EXISTS sas_select_self ON public.sub_agent_settlements;
CREATE POLICY sas_select_self
  ON public.sub_agent_settlements FOR SELECT
  USING (auth.uid() = sub_agent_id OR auth.uid() = parent_agent_id OR public.is_admin());

DROP POLICY IF EXISTS sas_no_user_writes ON public.sub_agent_settlements;
CREATE POLICY sas_no_user_writes
  ON public.sub_agent_settlements FOR INSERT
  WITH CHECK (false);

DROP POLICY IF EXISTS sas_no_user_updates ON public.sub_agent_settlements;
CREATE POLICY sas_no_user_updates
  ON public.sub_agent_settlements FOR UPDATE
  USING (false);

DROP POLICY IF EXISTS sas_no_user_deletes ON public.sub_agent_settlements;
CREATE POLICY sas_no_user_deletes
  ON public.sub_agent_settlements FOR DELETE
  USING (false);

-- ── 7. RPC: accrue_sub_agent_commission ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.accrue_sub_agent_commission(p_order_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order RECORD;
  v_sub_agent RECORD;
  v_amount NUMERIC(10,2);
  v_ledger_id UUID;
BEGIN
  SELECT id, referring_sub_agent_id, subtotal
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', p_order_id USING ERRCODE = 'no_data_found';
  END IF;

  IF v_order.referring_sub_agent_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id, commission_pct, parent_agent_id
  INTO v_sub_agent
  FROM public.profiles
  WHERE id = v_order.referring_sub_agent_id
    AND is_sub_agent = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sub-agent % not found or not flagged is_sub_agent', v_order.referring_sub_agent_id;
  END IF;

  v_amount := ROUND((v_order.subtotal * v_sub_agent.commission_pct / 100.0)::numeric, 2);

  UPDATE public.orders
  SET sub_agent_commission_pct = v_sub_agent.commission_pct,
      sub_agent_commission_amount = v_amount,
      updated_at = NOW()
  WHERE id = v_order.id;

  INSERT INTO public.sub_agent_commission_ledger (
    order_id, sub_agent_id, parent_agent_id, commission_pct,
    gross_product_subtotal, commission_amount, status
  ) VALUES (
    v_order.id, v_sub_agent.id, v_sub_agent.parent_agent_id, v_sub_agent.commission_pct,
    v_order.subtotal, v_amount, 'pending'
  )
  ON CONFLICT (order_id) DO NOTHING
  RETURNING id INTO v_ledger_id;

  RETURN v_ledger_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.accrue_sub_agent_commission(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accrue_sub_agent_commission(UUID) TO service_role;

-- ── 8. RPC: void_sub_agent_commission ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.void_sub_agent_commission(p_order_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rows INTEGER;
BEGIN
  UPDATE public.sub_agent_commission_ledger
  SET status = 'voided',
      voided_at = NOW()
  WHERE order_id = p_order_id
    AND status = 'pending';

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.void_sub_agent_commission(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.void_sub_agent_commission(UUID) TO service_role;

-- ── 9. RPC: settle_sub_agent_week ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.settle_sub_agent_week(
  p_sub_agent_id UUID,
  p_week_start TIMESTAMPTZ,
  p_week_end TIMESTAMPTZ
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_settlement_id UUID;
  v_total NUMERIC(10,2) := 0;
  v_count INTEGER := 0;
  v_parent_id UUID;
  v_balance_before NUMERIC(10,2);
  v_balance_after NUMERIC(10,2);
BEGIN
  SELECT parent_agent_id INTO v_parent_id
  FROM public.profiles
  WHERE id = p_sub_agent_id AND is_sub_agent = true;

  IF v_parent_id IS NULL THEN
    RAISE EXCEPTION 'Sub-agent % not found or no parent', p_sub_agent_id;
  END IF;

  SELECT COALESCE(SUM(l.commission_amount), 0), COUNT(*)
  INTO v_total, v_count
  FROM public.sub_agent_commission_ledger l
  JOIN public.orders o ON o.id = l.order_id
  WHERE l.sub_agent_id = p_sub_agent_id
    AND l.status = 'pending'
    AND l.accrued_at >= p_week_start
    AND l.accrued_at < p_week_end
    AND o.status IN ('approved_ship', 'approved_pickup', 'in_fulfillment', 'shipped', 'delivered');

  IF v_count = 0 THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.sub_agent_settlements (
    sub_agent_id, parent_agent_id, week_start, week_end,
    total_commission, orders_count
  ) VALUES (
    p_sub_agent_id, v_parent_id, p_week_start, p_week_end, v_total, v_count
  )
  ON CONFLICT (sub_agent_id, week_start) DO NOTHING
  RETURNING id INTO v_settlement_id;

  IF v_settlement_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.sub_agent_commission_ledger l
  SET status = 'settled',
      settled_at = NOW(),
      settlement_id = v_settlement_id
  FROM public.orders o
  WHERE l.order_id = o.id
    AND l.sub_agent_id = p_sub_agent_id
    AND l.status = 'pending'
    AND l.accrued_at >= p_week_start
    AND l.accrued_at < p_week_end
    AND o.status IN ('approved_ship', 'approved_pickup', 'in_fulfillment', 'shipped', 'delivered');

  SELECT COALESCE(prepaid_balance, 0) INTO v_balance_before
  FROM public.profiles WHERE id = p_sub_agent_id FOR UPDATE;

  v_balance_after := v_balance_before + v_total;

  UPDATE public.profiles
  SET prepaid_balance = v_balance_after,
      updated_at = NOW()
  WHERE id = p_sub_agent_id;

  INSERT INTO public.balance_transactions (
    agent_id, type, amount, balance_before, balance_after,
    description, reference_id, reference_type
  ) VALUES (
    p_sub_agent_id,
    'sub_agent_commission_settlement',
    v_total,
    v_balance_before,
    v_balance_after,
    'Weekly Sub-Agent Commission Settlement',
    v_settlement_id,
    'sub_agent_settlements'
  );

  INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id, changes)
  VALUES (
    p_sub_agent_id,
    'sub_agent_weekly_settlement',
    'sub_agent_settlements',
    v_settlement_id::text,
    jsonb_build_object(
      'sub_agent_id', p_sub_agent_id,
      'parent_agent_id', v_parent_id,
      'week_start', p_week_start,
      'week_end', p_week_end,
      'total_commission', v_total,
      'orders_count', v_count,
      'balance_before', v_balance_before,
      'balance_after', v_balance_after
    )
  );

  RETURN v_settlement_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.settle_sub_agent_week(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.settle_sub_agent_week(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;

-- ── 10. Helper: is_sub_agent() ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_sub_agent()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result BOOLEAN;
BEGIN
  SELECT is_sub_agent INTO v_result FROM public.profiles WHERE id = auth.uid();
  RETURN COALESCE(v_result, false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_sub_agent() TO authenticated;
