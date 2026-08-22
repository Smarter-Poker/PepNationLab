-- Phase 2a: commission void/clawback on cancel, retire orphan, reconciliation view.
-- See AGENT-FUNDED-PAYOUTS-AUDIT-2026-07-12.md. Applied to prod via Supabase MCP.

CREATE OR REPLACE FUNCTION public.reverse_sub_agent_commission_on_cancel(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  l RECORD;
  s_prepaid numeric; s_used numeric; s_from_prepaid numeric; s_from_credit numeric;
  p_prepaid numeric; p_used numeric; p_to_credit numeric; p_to_prepaid numeric;
BEGIN
  SELECT * INTO l FROM public.sub_agent_commission_ledger WHERE order_id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  IF l.status = 'pending' THEN
    UPDATE public.sub_agent_commission_ledger SET status='voided', voided_at=NOW() WHERE id = l.id;
    RETURN;
  END IF;

  IF l.status = 'settled' AND l.commission_amount > 0 THEN
    PERFORM 1 FROM public.profiles WHERE id IN (l.sub_agent_id, l.parent_agent_id) ORDER BY id FOR UPDATE;

    SELECT COALESCE(prepaid_balance,0), COALESCE(credit_used,0) INTO s_prepaid, s_used
      FROM public.profiles WHERE id = l.sub_agent_id;
    s_from_prepaid := LEAST(s_prepaid, l.commission_amount);
    s_from_credit  := round(l.commission_amount - s_from_prepaid, 2);
    UPDATE public.profiles
      SET prepaid_balance = round(s_prepaid - s_from_prepaid, 2), credit_used = round(s_used + s_from_credit, 2), updated_at=NOW()
      WHERE id = l.sub_agent_id;
    INSERT INTO public.balance_transactions
      (agent_id, type, amount, balance_before, balance_after, description, reference_id, reference_type, counterparty_id)
    VALUES (l.sub_agent_id, 'adjustment', l.commission_amount, s_prepaid, round(s_prepaid - s_from_prepaid, 2),
      'Sub-Agent Commission Clawback (order cancelled)', p_order_id, 'sub_agent_commission_clawback', l.parent_agent_id);

    SELECT COALESCE(prepaid_balance,0), COALESCE(credit_used,0) INTO p_prepaid, p_used
      FROM public.profiles WHERE id = l.parent_agent_id;
    p_to_credit  := LEAST(p_used, l.commission_amount);
    p_to_prepaid := round(l.commission_amount - p_to_credit, 2);
    UPDATE public.profiles
      SET credit_used = round(p_used - p_to_credit, 2), prepaid_balance = round(p_prepaid + p_to_prepaid, 2), updated_at=NOW()
      WHERE id = l.parent_agent_id;
    INSERT INTO public.balance_transactions
      (agent_id, type, amount, balance_before, balance_after, description, reference_id, reference_type, counterparty_id)
    VALUES (l.parent_agent_id, 'adjustment', l.commission_amount, p_prepaid, round(p_prepaid + p_to_prepaid, 2),
      'Sub-Agent Commission Clawback Refund (order cancelled)', p_order_id, 'sub_agent_commission_clawback', l.sub_agent_id);

    UPDATE public.sub_agent_commission_ledger SET status='voided', voided_at=NOW() WHERE id = l.id;
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reverse_sub_agent_commission_on_cancel(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_sub_agent_commission_on_cancel(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.cancel_order(p_order_id uuid, p_reason text, p_refund_type text, p_actor_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_order public.orders%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order % not found', p_order_id; END IF;
  IF v_order.status = 'cancelled' THEN RAISE EXCEPTION 'Order % is already cancelled', p_order_id; END IF;

  UPDATE public.orders
  SET status = 'cancelled', updated_at = NOW(), cancellation_reason = p_reason
  WHERE id = p_order_id;

  IF v_order.coupon_code IS NOT NULL AND v_order.agent_id IS NOT NULL THEN
    UPDATE public.coupons SET uses_count = GREATEST(0, uses_count - 1)
     WHERE agent_id = v_order.agent_id AND UPPER(code) = UPPER(v_order.coupon_code);
  END IF;

  PERFORM public.reverse_sub_agent_commission_on_cancel(p_order_id);
  PERFORM public.reverse_order_credit_charge(p_order_id, p_actor_id);
  RETURN NULL;
END;
$function$;

DROP FUNCTION IF EXISTS public.fulfil_referral_reward(uuid, uuid);

CREATE OR REPLACE VIEW public.agent_funded_payouts_summary
WITH (security_invoker = true) AS
SELECT
  a.id AS agent_id,
  a.username,
  COALESCE((SELECT SUM(o.discount_amount) FROM public.orders o
            WHERE o.agent_id = a.id AND o.discount_amount > 0 AND o.status <> 'cancelled'), 0) AS coupons_funded,
  COALESCE((SELECT SUM(bt.amount) FROM public.balance_transactions bt
            WHERE bt.agent_id = a.id AND bt.type = 'payout' AND bt.reference_type = 'sub_agent_settlements'), 0) AS subagent_commissions_paid,
  COALESCE((SELECT SUM(bt.amount) FROM public.balance_transactions bt
            WHERE bt.agent_id = a.id AND bt.type = 'payout' AND bt.reference_type = 'signup_promo'), 0) AS signup_promos_funded
FROM public.profiles a
WHERE a.role = 'agent' OR a.is_super_agent = true OR a.is_sub_agent = true;
