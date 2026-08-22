-- =============================================================================
-- PAYMENT CONFIRMATION CHAIN (2026-08-18)
--
-- Why: the platform had exactly ONE payment-confirmation column
-- (orders.payment_confirmed_at) shared by TWO different confirmations:
--   1. the direct agent confirming they received the BUYER's payment
--      (/api/agent/orders/mark-paid), and
--   2. the upline confirming they received the PREPAID DOWNLINE's settlement
--      (/api/agent/orders/confirm-downline-payment).
-- Whichever fired first blocked the other forever (the second caller 409'd on
-- "already confirmed"), and the buyer had no way at all to confirm they SENT
-- payment. This migration gives every party in the chain its own column:
--
--   buyer_payment_sent_at / _by          buyer:  "I Sent Payment"
--   payment_confirmed_at / _by           agent:  "I Received Payment"  (existing)
--   upline_payment_confirmed_at / _by    upline: "I Received The Downline's Payment"
--
-- Plus per-role 12-hour reminder clocks consumed by
-- /api/cron/payment-confirmations, so each unconfirmed party is nudged every
-- 12 hours until they confirm (never colliding with the buyer-facing
-- payment_reminder_count used by /api/cron/reminders).
-- =============================================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS buyer_payment_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS buyer_payment_sent_by uuid,
  ADD COLUMN IF NOT EXISTS upline_payment_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS upline_payment_confirmed_by uuid,
  ADD COLUMN IF NOT EXISTS buyer_sent_reminder_at timestamptz,
  ADD COLUMN IF NOT EXISTS agent_received_reminder_at timestamptz,
  ADD COLUMN IF NOT EXISTS upline_received_reminder_at timestamptz;

COMMENT ON COLUMN public.orders.buyer_payment_sent_at IS
  'Buyer tapped "I Sent Payment" (offline P2P payment to their agent). Separate from payment_confirmed_at, which is the agent acknowledging RECEIPT.';
COMMENT ON COLUMN public.orders.upline_payment_confirmed_at IS
  'Upline agent acknowledged receiving the prepaid downline agent''s per-order settlement. Was previously (incorrectly) crammed into payment_confirmed_at.';

-- =============================================================================
-- pay_invoice v2: paying a statement/invoice now RELEASES the payer's credit
-- line. charge_order_credit_line increments profiles.credit_used at order
-- approval, but nothing on the self-serve payment path ever decremented it,
-- so a credit-line agent who dutifully paid every bill still watched their
-- available credit shrink to zero forever. Mirrors admin_credit_account,
-- which already does exactly this on the admin-recorded-payment path.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.pay_invoice(
  p_target_type text, p_target_id uuid, p_handle text, p_amount numeric, p_proof_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_payer uuid;
  v_payee uuid;
  v_owed numeric;
  v_status text;
  v_payee_before numeric;
  v_payee_after numeric;
  v_payer_type text;
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

  -- Release the payer's credit line by the amount paid (credit accounts only).
  -- Row-locked; floored at zero because credit_used is charged at order retail
  -- while bills are COGS-based, so the two can legitimately differ.
  SELECT account_type INTO v_payer_type FROM profiles WHERE id = v_payer FOR UPDATE;
  IF v_payer_type = 'credit' THEN
    UPDATE profiles
      SET credit_used = GREATEST(0, round(COALESCE(credit_used, 0) - p_amount, 2)),
          updated_at = now()
    WHERE id = v_payer;
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

-- =============================================================================
-- Lock down the superseded pay_weekly_statement RPC. pay_invoice replaced it,
-- but it was still EXECUTE-granted to authenticated: a parallel self-mark-paid
-- path that skips pay_invoice's payee credit and credit_used release, and
-- writes fabricated balance snapshots on its no-debit path.
-- =============================================================================
REVOKE EXECUTE ON FUNCTION public.pay_weekly_statement(uuid, text, numeric, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.pay_weekly_statement(uuid, text, numeric, uuid) FROM anon;
