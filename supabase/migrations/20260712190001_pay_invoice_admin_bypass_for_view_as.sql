-- Allow an admin (including during "View As" impersonation, where auth.uid() is
-- still the admin) to pay an agent's invoice/statement on their behalf. Non-admins
-- remain restricted to their own invoices (v_payer = v_caller). Admins are already
-- fully privileged via admin routes, so this adds no new capability -- it only fixes
-- the always-403 "Pay Now" during View-As.
CREATE OR REPLACE FUNCTION public.pay_invoice(p_target_type text, p_target_id uuid, p_handle text, p_amount numeric, p_proof_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_payer uuid;
  v_payee uuid;
  v_owed numeric;
  v_status text;
  v_payee_before numeric;
  v_payee_after numeric;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

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

  IF v_payer IS NULL THEN RAISE EXCEPTION 'target_not_found'; END IF;
  IF v_payer <> v_caller AND NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v_status = 'paid' THEN RAISE EXCEPTION 'already_paid'; END IF;
  IF round(p_amount, 2) <> round(v_owed, 2) THEN
    RAISE EXCEPTION 'amount_mismatch';
  END IF;

  IF p_target_type = 'statement' THEN
    UPDATE weekly_statements
      SET status = 'paid', paid_at = now(), payment_method = p_handle, updated_at = now()
    WHERE id = p_target_id;
  ELSE
    UPDATE agent_invoices
      SET status = 'paid', paid_at = now(), payment_method = p_handle, updated_at = now()
    WHERE id = p_target_id;
  END IF;

  IF v_payee IS NOT NULL THEN
    SELECT COALESCE(prepaid_balance, 0) INTO v_payee_before FROM profiles WHERE id = v_payee FOR UPDATE;
    v_payee_after := round(v_payee_before + p_amount, 2);
    UPDATE profiles SET prepaid_balance = v_payee_after, updated_at = now() WHERE id = v_payee;

    INSERT INTO balance_transactions
      (agent_id, type, amount, balance_before, balance_after, description, reference_id, reference_type, created_by)
    VALUES
      (v_payee, 'invoice_payment_received', p_amount, v_payee_before, v_payee_after,
       format('Invoice Payment Received (%s)', p_target_type),
       p_target_id,
       CASE WHEN p_target_type = 'statement' THEN 'statement' ELSE 'agent_invoice' END,
       v_caller);
  END IF;

  RETURN jsonb_build_object('ok', true, 'payee', v_payee, 'amount', p_amount);
END;
$function$;
