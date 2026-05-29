-- refunds: full or partial refunds against an order
CREATE TABLE IF NOT EXISTS public.refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL,
  refund_type TEXT NOT NULL DEFAULT 'agent_balance' CHECK (refund_type IN ('agent_balance','store_credit','original_payment','admin_manual')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed','reversed')),
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failure_reason TEXT,
  is_partial BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS refunds_order_idx ON public.refunds(order_id);
CREATE INDEX IF NOT EXISTS refunds_status_idx ON public.refunds(status, created_at DESC);
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage refunds" ON public.refunds;
CREATE POLICY "Admins manage refunds" ON public.refunds FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Agents view own order refunds" ON public.refunds;
CREATE POLICY "Agents view own order refunds" ON public.refunds FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = refunds.order_id AND o.agent_id = auth.uid()));

DROP POLICY IF EXISTS "Buyers view own order refunds" ON public.refunds;
CREATE POLICY "Buyers view own order refunds" ON public.refunds FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = refunds.order_id AND o.buyer_id = auth.uid()));

-- store_credits: per-user balance ledger
CREATE TABLE IF NOT EXISTS public.store_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  balance_before NUMERIC NOT NULL,
  balance_after NUMERIC NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('issue','redeem','expire','adjustment')),
  source_refund_id UUID REFERENCES public.refunds(id) ON DELETE SET NULL,
  source_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  description TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS store_credits_user_idx ON public.store_credits(user_id, created_at DESC);
ALTER TABLE public.store_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage credits" ON public.store_credits;
CREATE POLICY "Admins manage credits" ON public.store_credits FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Users view own credits" ON public.store_credits;
CREATE POLICY "Users view own credits" ON public.store_credits FOR SELECT
  USING (user_id = auth.uid());

-- helper view: current store credit balance per user (sum)
CREATE OR REPLACE VIEW public.store_credit_balances WITH (security_invoker = true) AS
SELECT user_id, COALESCE(SUM(amount), 0) AS balance
FROM public.store_credits
GROUP BY user_id;

-- orders columns
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS credits_redeemed NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS refunded_amount NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- atomic store credit redemption RPC
CREATE OR REPLACE FUNCTION public.redeem_store_credit(p_user_id UUID, p_amount NUMERIC, p_order_id UUID, p_description TEXT DEFAULT 'Order Credit Redemption')
RETURNS NUMERIC LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_before NUMERIC; v_after NUMERIC;
BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  SELECT COALESCE(SUM(amount), 0) INTO v_before FROM public.store_credits WHERE user_id = p_user_id;
  IF v_before < p_amount THEN
    RAISE EXCEPTION 'Insufficient store credit (have %, need %)', v_before, p_amount USING ERRCODE = 'check_violation';
  END IF;
  v_after := v_before - p_amount;
  INSERT INTO public.store_credits (user_id, amount, balance_before, balance_after, type, source_order_id, description, created_by)
  VALUES (p_user_id, -p_amount, v_before, v_after, 'redeem', p_order_id, p_description, p_user_id);
  RETURN v_after;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.redeem_store_credit(UUID, NUMERIC, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_store_credit(UUID, NUMERIC, UUID, TEXT) TO authenticated;

-- atomic refund issuance RPC
CREATE OR REPLACE FUNCTION public.issue_refund(p_order_id UUID, p_amount NUMERIC, p_reason TEXT, p_refund_type TEXT, p_is_partial BOOLEAN, p_notes TEXT, p_actor_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order RECORD; v_refund_id UUID;
  v_before NUMERIC; v_after NUMERIC;
BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Refund amount must be positive'; END IF;
  IF p_refund_type NOT IN ('agent_balance','store_credit','original_payment','admin_manual') THEN
    RAISE EXCEPTION 'Invalid refund type %', p_refund_type;
  END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.id IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF (COALESCE(v_order.refunded_amount,0) + p_amount) > v_order.total THEN
    RAISE EXCEPTION 'Refund would exceed order total (already refunded %, plus % > total %)',
      COALESCE(v_order.refunded_amount,0), p_amount, v_order.total USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.refunds (order_id, amount, reason, refund_type, status, approved_by, approved_at, completed_at, is_partial, notes)
  VALUES (p_order_id, p_amount, p_reason, p_refund_type, 'completed', p_actor_id, NOW(), NOW(), p_is_partial, p_notes)
  RETURNING id INTO v_refund_id;

  UPDATE public.orders SET refunded_amount = COALESCE(refunded_amount,0) + p_amount, updated_at = NOW()
  WHERE id = p_order_id;

  IF p_refund_type = 'agent_balance' AND v_order.agent_id IS NOT NULL THEN
    SELECT prepaid_balance INTO v_before FROM public.profiles WHERE id = v_order.agent_id FOR UPDATE;
    IF v_before IS NULL THEN v_before := 0; END IF;
    v_after := v_before + p_amount;
    UPDATE public.profiles SET prepaid_balance = v_after, updated_at = NOW() WHERE id = v_order.agent_id;
    INSERT INTO public.balance_transactions (agent_id, type, amount, balance_before, balance_after, description, reference_id, reference_type, created_by)
    VALUES (v_order.agent_id, 'credit', p_amount, v_before, v_after, 'Refund: ' || p_reason, v_refund_id, 'refund', p_actor_id);
  ELSIF p_refund_type = 'store_credit' AND v_order.buyer_id IS NOT NULL THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_before FROM public.store_credits WHERE user_id = v_order.buyer_id;
    v_after := v_before + p_amount;
    INSERT INTO public.store_credits (user_id, amount, balance_before, balance_after, type, source_refund_id, source_order_id, description, created_by)
    VALUES (v_order.buyer_id, p_amount, v_before, v_after, 'issue', v_refund_id, p_order_id, 'Refund: ' || p_reason, p_actor_id);
  END IF;

  RETURN v_refund_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.issue_refund(UUID, NUMERIC, TEXT, TEXT, BOOLEAN, TEXT, UUID) FROM PUBLIC, anon, authenticated;

-- cancel + auto-refund RPC for "cancel and refund the whole thing"
CREATE OR REPLACE FUNCTION public.cancel_order(p_order_id UUID, p_reason TEXT, p_refund_type TEXT, p_actor_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_order RECORD; v_refund_id UUID := NULL; v_remaining NUMERIC;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.id IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.status = 'cancelled' THEN RAISE EXCEPTION 'Order already cancelled'; END IF;

  v_remaining := v_order.total - COALESCE(v_order.refunded_amount, 0);
  IF v_remaining > 0 AND p_refund_type IS NOT NULL AND p_refund_type <> 'none' THEN
    v_refund_id := public.issue_refund(p_order_id, v_remaining, COALESCE(p_reason,'Order Cancelled'), p_refund_type, false, NULL, p_actor_id);
  END IF;

  UPDATE public.orders
  SET status = 'cancelled', cancellation_reason = p_reason, cancelled_by = p_actor_id, updated_at = NOW()
  WHERE id = p_order_id;

  RETURN v_refund_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.cancel_order(UUID, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
