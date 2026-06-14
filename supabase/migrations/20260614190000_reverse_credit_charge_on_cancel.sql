-- Reverse a cancelled credit order's credit-line charge so credit_used does not
-- permanently consume the agent's headroom. Credit-only (prepaid follows the
-- all-sales-final policy), idempotent, and a no-op for orders already settled in
-- a paid statement (the payment path already reduced credit_used for those).
--
-- Wired into cancel_order so every cancel path (dedicated /cancel route, bulk,
-- and the agent/admin order routes that call cancel_order) reverses the charge.

CREATE OR REPLACE FUNCTION public.reverse_order_credit_charge(p_order_id uuid, p_actor_id uuid DEFAULT NULL)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_billed uuid;
  v_amount numeric;
  v_acct text;
  v_already boolean;
  v_paid boolean;
BEGIN
  -- The credit charge written by charge_credit_line for this order (one row;
  -- guarded against duplicates there). Prepaid order_charge rows are filtered
  -- out by the account_type check below.
  SELECT agent_id, SUM(amount)
    INTO v_billed, v_amount
  FROM public.balance_transactions
  WHERE reference_id = p_order_id AND type = 'order_charge'
  GROUP BY agent_id
  ORDER BY SUM(amount) DESC
  LIMIT 1;

  IF v_billed IS NULL OR v_amount IS NULL OR v_amount <= 0 THEN
    RETURN NULL;
  END IF;

  SELECT account_type INTO v_acct FROM public.profiles WHERE id = v_billed;
  IF v_acct IS DISTINCT FROM 'credit' THEN
    RETURN NULL;  -- prepaid debits follow the all-sales-final policy
  END IF;

  -- Idempotent: never reverse the same order's charge twice.
  SELECT EXISTS(
    SELECT 1 FROM public.balance_transactions
    WHERE reference_id = p_order_id AND agent_id = v_billed
      AND type = 'adjustment' AND description LIKE 'Reversal Of Credit Charge%'
  ) INTO v_already;
  IF v_already THEN
    RETURN (SELECT credit_used FROM public.profiles WHERE id = v_billed);
  END IF;

  -- If already settled inside a PAID statement, admin_credit_account already
  -- reduced credit_used for it; reversing again would double-credit.
  SELECT EXISTS(
    SELECT 1 FROM public.statement_orders so
    JOIN public.weekly_statements ws ON ws.id = so.statement_id
    WHERE so.order_id = p_order_id AND ws.status = 'paid'
  ) INTO v_paid;
  IF v_paid THEN
    RETURN (SELECT credit_used FROM public.profiles WHERE id = v_billed);
  END IF;

  UPDATE public.profiles
  SET credit_used = GREATEST(0, ROUND(COALESCE(credit_used, 0) - v_amount, 2)),
      updated_at = NOW()
  WHERE id = v_billed;

  INSERT INTO public.balance_transactions
    (agent_id, type, amount, description, reference_id, reference_type, created_by)
  VALUES
    (v_billed, 'adjustment', ROUND(v_amount, 2),
     'Reversal Of Credit Charge For Cancelled Order ' || left(p_order_id::text, 8),
     p_order_id, 'order', p_actor_id);

  RETURN (SELECT credit_used FROM public.profiles WHERE id = v_billed);
END;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_order(p_order_id uuid, p_reason text, p_refund_type text, p_actor_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order public.orders%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', p_order_id;
  END IF;

  IF v_order.status = 'cancelled' THEN
    RAISE EXCEPTION 'Order % is already cancelled', p_order_id;
  END IF;

  -- Mark order cancelled
  UPDATE public.orders
  SET status = 'cancelled',
      updated_at = NOW(),
      cancellation_reason = p_reason
  WHERE id = p_order_id;

  -- Restore the coupon redemption slot if one was burned by this order.
  IF v_order.coupon_code IS NOT NULL AND v_order.agent_id IS NOT NULL THEN
    UPDATE public.coupons
       SET uses_count = GREATEST(0, uses_count - 1)
     WHERE agent_id = v_order.agent_id
       AND UPPER(code) = UPPER(v_order.coupon_code);
  END IF;

  -- Void any unsettled sub-agent commission accrued for this order.
  UPDATE public.sub_agent_commission_ledger
     SET status = 'voided',
         voided_at = NOW()
   WHERE order_id = p_order_id
     AND status = 'accrued';

  -- Reverse the credit-line charge (if any) so a cancelled credit order no
  -- longer consumes the agent's credit_used headroom. No-op for prepaid (all
  -- sales final), idempotent, and skipped for orders settled in a paid statement.
  PERFORM public.reverse_order_credit_charge(p_order_id, p_actor_id);

  RETURN NULL;
END;
$function$;
