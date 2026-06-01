-- Round 24 Wallet build (Phase 1+2)
-- Adds: statement payment metadata, sub-invoice payment metadata,
--       credit_increase_requests table, auto_pay + preferred handle on profiles,
--       and 3 SECURITY DEFINER RPCs for the Pay Now / Statement Detail / Forecast flows.
BEGIN;

ALTER TABLE public.weekly_statements
  ADD COLUMN IF NOT EXISTS due_date         DATE,
  ADD COLUMN IF NOT EXISTS payment_proof_id UUID,
  ADD COLUMN IF NOT EXISTS disputed_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispute_reason   TEXT;

ALTER TABLE public.sub_agent_invoices
  ADD COLUMN IF NOT EXISTS paid_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS due_date       DATE,
  ADD COLUMN IF NOT EXISTS disputed_at    TIMESTAMPTZ;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS auto_pay_enabled        BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS preferred_payout_handle TEXT;

CREATE TABLE IF NOT EXISTS public.credit_increase_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  current_limit   NUMERIC(10,2) NOT NULL,
  requested_limit NUMERIC(10,2) NOT NULL,
  reason          TEXT,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','denied','withdrawn')),
  decided_by      UUID REFERENCES public.profiles(id),
  decided_at      TIMESTAMPTZ,
  decision_note   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS credit_increase_requests_agent_idx
  ON public.credit_increase_requests (agent_id, status, created_at DESC);

ALTER TABLE public.credit_increase_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS credit_increase_self_select ON public.credit_increase_requests;
CREATE POLICY credit_increase_self_select ON public.credit_increase_requests
  FOR SELECT TO authenticated
  USING (agent_id = auth.uid() OR public.is_admin() OR public.is_agent_or_above());

DROP POLICY IF EXISTS credit_increase_self_insert ON public.credit_increase_requests;
CREATE POLICY credit_increase_self_insert ON public.credit_increase_requests
  FOR INSERT TO authenticated
  WITH CHECK (agent_id = auth.uid());

DROP POLICY IF EXISTS credit_increase_admin_update ON public.credit_increase_requests;
CREATE POLICY credit_increase_admin_update ON public.credit_increase_requests
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================================
-- RPC: pay_weekly_statement
-- Atomic Pay Now. Verifies ownership + amount, debits prepaid balance if
-- applicable, marks the statement paid, and writes one balance_transactions
-- row keyed to the statement.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.pay_weekly_statement(
  p_statement_id   UUID,
  p_handle         TEXT,
  p_amount         NUMERIC,
  p_proof_id       UUID DEFAULT NULL
)
RETURNS TABLE (new_balance NUMERIC, txn_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller        UUID := auth.uid();
  v_statement     RECORD;
  v_profile       RECORD;
  v_new_balance   NUMERIC(10,2);
  v_txn_id        UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_statement
    FROM public.weekly_statements
   WHERE id = p_statement_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'statement_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_statement.agent_id <> v_caller AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF v_statement.status NOT IN ('open','pending_payment') THEN
    RAISE EXCEPTION 'statement_not_payable' USING ERRCODE = '22023';
  END IF;

  IF ABS(p_amount - COALESCE(v_statement.total_owed, 0)) > 0.01 THEN
    RAISE EXCEPTION 'amount_mismatch' USING ERRCODE = '22023';
  END IF;

  IF p_handle IS NULL OR length(btrim(p_handle)) = 0 THEN
    RAISE EXCEPTION 'handle_required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_statement.agent_id FOR UPDATE;

  -- Prepaid balance debit (only if there is one)
  v_new_balance := COALESCE(v_profile.prepaid_balance, 0);
  IF v_profile.account_type = 'prepaid' AND v_new_balance >= p_amount THEN
    UPDATE public.profiles
       SET prepaid_balance = v_new_balance - p_amount
     WHERE id = v_statement.agent_id;
    v_new_balance := v_new_balance - p_amount;
  END IF;

  UPDATE public.weekly_statements
     SET status = 'paid',
         paid_at = NOW(),
         payment_method = p_handle,
         payment_proof_id = p_proof_id
   WHERE id = p_statement_id;

  INSERT INTO public.balance_transactions
    (agent_id, type, amount, balance_before, balance_after,
     description, reference_id, reference_type, created_by)
  VALUES
    (v_statement.agent_id, 'statement_payment', p_amount,
     COALESCE(v_profile.prepaid_balance, 0) + p_amount,
     v_new_balance,
     'Statement payoff via ' || p_handle,
     p_statement_id, 'statement', v_caller)
  RETURNING id INTO v_txn_id;

  RETURN QUERY SELECT v_new_balance, v_txn_id;
END;
$$;

REVOKE ALL ON FUNCTION public.pay_weekly_statement(UUID, TEXT, NUMERIC, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pay_weekly_statement(UUID, TEXT, NUMERIC, UUID)
  TO authenticated, service_role;

-- ============================================================================
-- RPC: get_statement_detail
-- Returns the orders rolled into a statement with line-item breakdown.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_statement_detail(p_statement_id UUID)
RETURNS TABLE (
  order_id            UUID,
  buyer_name          TEXT,
  buyer_email         TEXT,
  order_created_at    TIMESTAMPTZ,
  order_status        TEXT,
  subtotal            NUMERIC,
  shipping_cost       NUMERIC,
  total               NUMERIC,
  line_items          JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller    UUID := auth.uid();
  v_statement RECORD;
BEGIN
  SELECT * INTO v_statement FROM public.weekly_statements WHERE id = p_statement_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'statement_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_statement.agent_id <> v_caller AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    o.id::UUID AS order_id,
    COALESCE(o.buyer_name, p.full_name, p.email, 'Unknown')::TEXT AS buyer_name,
    COALESCE(o.buyer_email, p.email)::TEXT AS buyer_email,
    o.created_at AS order_created_at,
    o.status::TEXT AS order_status,
    COALESCE(o.subtotal, 0)::NUMERIC AS subtotal,
    COALESCE(o.shipping_cost, 0)::NUMERIC AS shipping_cost,
    COALESCE(o.total, 0)::NUMERIC AS total,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
         'product_id', oi.product_id,
         'product_name', oi.product_name,
         'quantity', oi.quantity,
         'unit_retail_price', oi.unit_retail_price,
         'unit_cost_price', oi.unit_cost_price,
         'line_total', (COALESCE(oi.unit_retail_price,0) * COALESCE(oi.quantity,0))
       ))
       FROM public.order_items oi WHERE oi.order_id = o.id),
      '[]'::jsonb
    ) AS line_items
  FROM public.statement_orders so
  JOIN public.orders o ON o.id = so.order_id
  LEFT JOIN public.profiles p ON p.id = o.buyer_id
  WHERE so.statement_id = p_statement_id
  ORDER BY o.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_statement_detail(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_statement_detail(UUID) TO authenticated, service_role;

-- ============================================================================
-- RPC: forecast_next_statement
-- Sums orders this calendar week that are not yet attached to a statement.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.forecast_next_statement(p_agent_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_total  NUMERIC;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501';
  END IF;
  IF v_caller <> p_agent_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(SUM(
    COALESCE(o.subtotal, 0) - COALESCE(o.shipping_cost, 0)
  ), 0)
    INTO v_total
    FROM public.orders o
   WHERE o.agent_id = p_agent_id
     AND o.created_at >= date_trunc('week', NOW())
     AND o.status NOT IN ('cancelled')
     AND NOT EXISTS (SELECT 1 FROM public.statement_orders so WHERE so.order_id = o.id);

  RETURN COALESCE(v_total, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.forecast_next_statement(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.forecast_next_statement(UUID) TO authenticated, service_role;

COMMIT;
