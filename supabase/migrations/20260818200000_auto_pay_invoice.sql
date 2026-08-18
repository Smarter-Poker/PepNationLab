-- =============================================================================
-- AUTO-PAY + CREDIT-BASIS ALIGNMENT (2026-08-18)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. auto_pay_invoice: the atomic engine behind the wallet's Auto-Pay toggle.
--    Service-role only (the daily cron calls it); re-validates everything
--    under row locks so the cron's pre-filter is never the safety.
--    Unlike pay_invoice (which records an OFF-platform payment), this one
--    actually debits the payer's prepaid balance - that is the whole point.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auto_pay_invoice(p_target_type text, p_target_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_payer uuid;
  v_payee uuid;
  v_owed numeric;
  v_status text;
  v_payer_row public.profiles%ROWTYPE;
  v_payer_after numeric;
  v_payee_before numeric;
  v_payee_after numeric;
BEGIN
  IF p_target_type = 'statement' THEN
    SELECT agent_id, total_owed, status INTO v_payer, v_owed, v_status
    FROM weekly_statements WHERE id = p_target_id FOR UPDATE;
    SELECT id INTO v_payee FROM profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1;
  ELSIF p_target_type = 'agent_invoice' THEN
    SELECT agent_id, super_agent_id, total_owed, status
      INTO v_payer, v_payee, v_owed, v_status
    FROM agent_invoices WHERE id = p_target_id FOR UPDATE;
  ELSE
    RAISE EXCEPTION 'invalid_target_type';
  END IF;

  IF v_payer IS NULL THEN RETURN jsonb_build_object('ok', false, 'skipped', 'target_not_found'); END IF;
  IF v_status = 'paid' THEN RETURN jsonb_build_object('ok', false, 'skipped', 'already_paid'); END IF;
  IF v_owed IS NULL OR v_owed <= 0 THEN RETURN jsonb_build_object('ok', false, 'skipped', 'nothing_owed'); END IF;

  SELECT * INTO v_payer_row FROM profiles WHERE id = v_payer FOR UPDATE;
  IF v_payer_row.auto_pay_enabled IS DISTINCT FROM true THEN
    RETURN jsonb_build_object('ok', false, 'skipped', 'auto_pay_disabled');
  END IF;
  IF COALESCE(v_payer_row.prepaid_balance, 0) < v_owed THEN
    RETURN jsonb_build_object('ok', false, 'skipped', 'insufficient_balance');
  END IF;

  -- Debit the payer's prepaid balance.
  v_payer_after := round(COALESCE(v_payer_row.prepaid_balance, 0) - v_owed, 2);
  UPDATE profiles SET prepaid_balance = v_payer_after, updated_at = now() WHERE id = v_payer;
  INSERT INTO balance_transactions
    (agent_id, type, amount, balance_before, balance_after, description, reference_id, reference_type, created_by)
  VALUES
    (v_payer, 'statement_payment', v_owed,
     COALESCE(v_payer_row.prepaid_balance, 0), v_payer_after,
     format('Auto-Pay: %s Settled From Prepaid Balance', CASE WHEN p_target_type = 'statement' THEN 'Weekly Statement' ELSE 'Invoice' END),
     p_target_id,
     CASE WHEN p_target_type = 'statement' THEN 'statement' ELSE 'agent_invoice' END,
     NULL);

  -- Mark the bill paid.
  IF p_target_type = 'statement' THEN
    UPDATE weekly_statements
      SET status = 'paid', paid_at = now(), payment_method = 'auto_pay'
    WHERE id = p_target_id;
  ELSE
    UPDATE agent_invoices
      SET status = 'paid', paid_at = now(), payment_method = 'auto_pay', updated_at = now()
    WHERE id = p_target_id;
  END IF;

  -- Release the payer's credit line by the amount paid (credit accounts only),
  -- mirroring pay_invoice / admin_credit_account.
  IF v_payer_row.account_type = 'credit' THEN
    UPDATE profiles
      SET credit_used = GREATEST(0, round(COALESCE(credit_used, 0) - v_owed, 2)),
          updated_at = now()
    WHERE id = v_payer;
  END IF;

  -- Credit the payee's wallet.
  IF v_payee IS NOT NULL THEN
    SELECT COALESCE(prepaid_balance, 0) INTO v_payee_before FROM profiles WHERE id = v_payee FOR UPDATE;
    v_payee_after := round(v_payee_before + v_owed, 2);
    UPDATE profiles SET prepaid_balance = v_payee_after, updated_at = now() WHERE id = v_payee;
    INSERT INTO balance_transactions
      (agent_id, type, amount, balance_before, balance_after, description, reference_id, reference_type, created_by)
    VALUES
      (v_payee, 'invoice_payment_received', v_owed, v_payee_before, v_payee_after,
       format('Auto-Pay Received (%s)', p_target_type),
       p_target_id,
       CASE WHEN p_target_type = 'statement' THEN 'statement' ELSE 'agent_invoice' END,
       NULL);
  END IF;

  RETURN jsonb_build_object('ok', true, 'payer', v_payer, 'payee', v_payee, 'amount', v_owed);
END;
$function$;

-- Service-role only: this moves money with no caller identity.
REVOKE EXECUTE ON FUNCTION public.auto_pay_invoice(text, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_pay_invoice(text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.auto_pay_invoice(text, uuid) FROM public;

-- (A competing COGS-basis rewrite of charge_order_credit_line landed in
-- 20260818121800_admin_billing_fix.sql minutes before this migration and is
-- the live version; this file deliberately does not touch that function.)
