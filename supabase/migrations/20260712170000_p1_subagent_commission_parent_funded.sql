-- Phase 1A: sub-agent commissions come out of the PARENT's pocket (double-entry).
-- Before: settle_sub_agent_week only CREDITED the sub-agent and inserted a one-sided
-- balance_transactions row typed 'sub_agent_commission_settlement' -- a type NOT in the
-- balance_transactions_type_check whitelist, so it would have FAILED if it ran. The parent was
-- never debited; the house silently funded every commission.
-- After: parent funds it (prepaid first, shortfall to credit line, mirroring wallet_transfer),
-- sub-agent credited, both rows carry counterparty_id; if the parent can't cover it the whole
-- settlement rolls back and rows stay pending for a later run (nothing lost). Sweeps all pending
-- eligible rows accrued before week_end so nothing is stranded.

ALTER TABLE public.balance_transactions
  ADD COLUMN IF NOT EXISTS counterparty_id uuid REFERENCES public.profiles(id);
COMMENT ON COLUMN public.balance_transactions.counterparty_id IS
  'The other party in a two-sided money movement (e.g. sub-agent commission: parent<->sub-agent). NULL = house/platform-funded one-sided entry.';
CREATE INDEX IF NOT EXISTS idx_balance_transactions_counterparty
  ON public.balance_transactions (counterparty_id) WHERE counterparty_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.settle_sub_agent_week(
  p_sub_agent_id uuid, p_week_start timestamptz, p_week_end timestamptz)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_settlement_id uuid;
  v_total numeric(10,2) := 0;
  v_count integer := 0;
  v_parent_id uuid;
  p_role text; p_acct text; p_prepaid numeric; p_limit numeric; p_used numeric;
  v_from_prepaid numeric; v_from_credit numeric;
  p_prepaid_after numeric; p_used_after numeric;
  s_prepaid_before numeric; s_prepaid_after numeric;
BEGIN
  SELECT parent_agent_id INTO v_parent_id
  FROM public.profiles WHERE id = p_sub_agent_id AND is_sub_agent = true;
  IF v_parent_id IS NULL THEN
    RAISE EXCEPTION 'Sub-agent % not found or no parent', p_sub_agent_id;
  END IF;

  SELECT COALESCE(SUM(l.commission_amount),0), COUNT(*)
    INTO v_total, v_count
  FROM public.sub_agent_commission_ledger l
  JOIN public.orders o ON o.id = l.order_id
  WHERE l.sub_agent_id = p_sub_agent_id
    AND l.status = 'pending'
    AND l.accrued_at < p_week_end
    AND o.status IN ('approved_ship','approved_pickup','in_fulfillment','shipped','delivered');

  IF v_count = 0 OR v_total <= 0 THEN
    RETURN NULL;
  END IF;

  PERFORM 1 FROM public.profiles WHERE id IN (v_parent_id, p_sub_agent_id) ORDER BY id FOR UPDATE;

  SELECT role::text, account_type, COALESCE(prepaid_balance,0), COALESCE(credit_limit,0), COALESCE(credit_used,0)
    INTO p_role, p_acct, p_prepaid, p_limit, p_used
  FROM public.profiles WHERE id = v_parent_id;

  IF p_role = 'admin' THEN
    v_from_prepaid := v_total; v_from_credit := 0;
  ELSE
    v_from_prepaid := LEAST(p_prepaid, v_total);
    v_from_credit  := round(v_total - v_from_prepaid, 2);
    IF v_from_credit > 0 AND (p_acct = 'prepaid' OR p_limit <= 0 OR (p_used + v_from_credit) > p_limit) THEN
      RAISE EXCEPTION 'Parent % has insufficient balance/credit to settle $% of sub-agent commission (needs $% on credit).',
        v_parent_id, v_total, v_from_credit USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  p_prepaid_after := round(p_prepaid - v_from_prepaid, 2);
  p_used_after    := round(p_used + v_from_credit, 2);

  INSERT INTO public.sub_agent_settlements
    (sub_agent_id, parent_agent_id, week_start, week_end, total_commission, orders_count)
  VALUES (p_sub_agent_id, v_parent_id, p_week_start, p_week_end, v_total, v_count)
  ON CONFLICT (sub_agent_id, week_start) DO NOTHING
  RETURNING id INTO v_settlement_id;
  IF v_settlement_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.sub_agent_commission_ledger l
  SET status='settled', settled_at=NOW(), settlement_id=v_settlement_id
  FROM public.orders o
  WHERE l.order_id=o.id AND l.sub_agent_id=p_sub_agent_id AND l.status='pending'
    AND l.accrued_at < p_week_end
    AND o.status IN ('approved_ship','approved_pickup','in_fulfillment','shipped','delivered');

  UPDATE public.profiles
  SET prepaid_balance = p_prepaid_after, credit_used = p_used_after, updated_at = NOW()
  WHERE id = v_parent_id;
  INSERT INTO public.balance_transactions
    (agent_id, type, amount, balance_before, balance_after, description, reference_id, reference_type, counterparty_id)
  VALUES (v_parent_id, 'payout', v_total, p_prepaid, p_prepaid_after,
    'Sub-Agent Commission Payout' || CASE WHEN v_from_credit > 0 THEN ' ($' || v_from_credit::text || ' billed to credit line)' ELSE '' END,
    v_settlement_id, 'sub_agent_settlements', p_sub_agent_id);

  SELECT COALESCE(prepaid_balance,0) INTO s_prepaid_before FROM public.profiles WHERE id = p_sub_agent_id;
  s_prepaid_after := round(s_prepaid_before + v_total, 2);
  UPDATE public.profiles SET prepaid_balance = s_prepaid_after, updated_at = NOW() WHERE id = p_sub_agent_id;
  INSERT INTO public.balance_transactions
    (agent_id, type, amount, balance_before, balance_after, description, reference_id, reference_type, counterparty_id)
  VALUES (p_sub_agent_id, 'commission', v_total, s_prepaid_before, s_prepaid_after,
    'Weekly Sub-Agent Commission Settlement', v_settlement_id, 'sub_agent_settlements', v_parent_id);

  INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id, changes)
  VALUES (p_sub_agent_id, 'sub_agent_weekly_settlement', 'sub_agent_settlements', v_settlement_id::text,
    jsonb_build_object('sub_agent_id',p_sub_agent_id,'parent_agent_id',v_parent_id,
      'week_start',p_week_start,'week_end',p_week_end,'total_commission',v_total,'orders_count',v_count,
      'parent_from_prepaid',v_from_prepaid,'parent_from_credit',v_from_credit,'sub_agent_balance_after',s_prepaid_after));

  RETURN v_settlement_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.settle_sub_agent_week(uuid,timestamptz,timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.settle_sub_agent_week(uuid,timestamptz,timestamptz) TO service_role;
