-- Invoice v2 — billing chain, transactions freeze, and unified Pay flow
--
-- Adds the foundational Invoice v2 surface area:
--   1. profiles.is_transactions_frozen / frozen_at / frozen_by / frozen_reason
--      — per-account freeze state that cascades down the billing chain.
--   2. walk_billing_chain(agent) — recursive CTE walking parent_agent_id
--      UP to 5 levels. Returns one row per tier with credit + freeze fields.
--   3. check_credit_chain(billed_agent, additional_owed) — sums open
--      weekly_statements + agent_invoices per tier and refuses if the
--      projected total would exceed credit_limit - credit_used at any level.
--   4. is_chain_frozen(agent) — returns the FIRST frozen ancestor in
--      walk_billing_chain (or { frozen: false } if none).
--   5. pay_invoice(target_type, target_id, handle, amount, proof_id) — the
--      unified payment RPC. Validates caller == payer, exact-amount match,
--      not-already-paid; atomically marks invoice paid and credits the
--      payee's prepaid_balance + writes balance_transactions.
--   6. freeze_account / unfreeze_account — admin OR transitive ancestor
--      authorization, atomic update + admin_audit_log write.
--
-- NOTE: the depth cap on freeze/unfreeze's WHILE-loop was added in a
-- follow-up migration (20260603130002_invoice_v2_freeze_unfreeze_loop_cap)
-- after a fourth-sweep audit found the original loop unbounded.

-- 1. profiles freeze columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_transactions_frozen boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS frozen_at timestamptz,
  ADD COLUMN IF NOT EXISTS frozen_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS frozen_reason text;

-- 2. walk_billing_chain — recursive CTE, 5-level depth cap.
CREATE OR REPLACE FUNCTION public.walk_billing_chain(p_agent_id uuid)
  RETURNS TABLE(
    level integer,
    profile_id uuid,
    role text,
    parent_agent_id uuid,
    is_super_agent boolean,
    is_sub_agent boolean,
    is_transactions_frozen boolean,
    credit_limit numeric,
    credit_used numeric,
    account_type text
  )
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
  WITH RECURSIVE chain AS (
    SELECT 0 AS lvl, p.id, p.role::text, p.parent_agent_id, p.is_super_agent,
           p.is_sub_agent, p.is_transactions_frozen,
           p.credit_limit, p.credit_used, p.account_type::text
    FROM profiles p WHERE p.id = p_agent_id
    UNION ALL
    SELECT c.lvl + 1, p.id, p.role::text, p.parent_agent_id, p.is_super_agent,
           p.is_sub_agent, p.is_transactions_frozen,
           p.credit_limit, p.credit_used, p.account_type::text
    FROM chain c
    JOIN profiles p ON p.id = c.parent_agent_id
    WHERE c.lvl < 5
  )
  SELECT lvl, id, role, parent_agent_id, is_super_agent, is_sub_agent,
         is_transactions_frozen, credit_limit, credit_used, account_type
  FROM chain ORDER BY lvl;
$function$;

-- 3. check_credit_chain — sums open weekly_statements + agent_invoices
--    per credit-line tier and blocks if projected total exceeds limit.
CREATE OR REPLACE FUNCTION public.check_credit_chain(
  p_billed_agent_id uuid,
  p_additional_owed numeric
)
  RETURNS TABLE(
    blocked boolean,
    blocked_level integer,
    blocked_profile_id uuid,
    blocked_reason text,
    projected_total numeric,
    available_credit numeric
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  r RECORD;
  v_open_invoices numeric;
  v_credit_avail numeric;
  v_projected numeric;
BEGIN
  FOR r IN SELECT * FROM walk_billing_chain(p_billed_agent_id) LOOP
    IF r.account_type IS DISTINCT FROM 'credit' THEN
      CONTINUE;
    END IF;

    v_open_invoices := 0;

    SELECT COALESCE(SUM(total_owed), 0) INTO v_open_invoices
    FROM weekly_statements
    WHERE agent_id = r.profile_id
      AND status IN ('open', 'pending_payment');

    v_open_invoices := v_open_invoices + COALESCE((
      SELECT SUM(total_owed) FROM agent_invoices
      WHERE agent_id = r.profile_id AND status = 'open'
    ), 0);

    v_credit_avail := COALESCE(r.credit_limit, 0) - COALESCE(r.credit_used, 0);
    v_projected := v_open_invoices + p_additional_owed;

    IF v_projected > v_credit_avail THEN
      blocked := true;
      blocked_level := r.level;
      blocked_profile_id := r.profile_id;
      blocked_reason := format(
        'Credit Limit Exceeded At Tier %s. Projected $%s, Available $%s.',
        r.level, round(v_projected, 2), round(v_credit_avail, 2)
      );
      projected_total := v_projected;
      available_credit := v_credit_avail;
      RETURN NEXT;
      RETURN;
    END IF;
  END LOOP;

  blocked := false;
  blocked_level := NULL;
  blocked_profile_id := NULL;
  blocked_reason := NULL;
  projected_total := NULL;
  available_credit := NULL;
  RETURN NEXT;
END;
$function$;

-- 4. is_chain_frozen — first frozen ancestor wins.
CREATE OR REPLACE FUNCTION public.is_chain_frozen(p_agent_id uuid)
  RETURNS TABLE(
    frozen boolean,
    frozen_at_level integer,
    frozen_at_id uuid,
    reason text
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT level, profile_id, is_transactions_frozen
    FROM walk_billing_chain(p_agent_id)
  LOOP
    IF r.is_transactions_frozen THEN
      frozen := true;
      frozen_at_level := r.level;
      frozen_at_id := r.profile_id;
      SELECT frozen_reason INTO reason FROM profiles WHERE id = r.profile_id;
      RETURN NEXT;
      RETURN;
    END IF;
  END LOOP;
  frozen := false; frozen_at_level := NULL; frozen_at_id := NULL; reason := NULL;
  RETURN NEXT;
END;
$function$;

-- 5. pay_invoice — unified Pay Now for weekly_statements + agent_invoices.
CREATE OR REPLACE FUNCTION public.pay_invoice(
  p_target_type text,
  p_target_id uuid,
  p_handle text,
  p_amount numeric,
  p_proof_id uuid
)
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
  IF v_payer <> v_caller THEN RAISE EXCEPTION 'forbidden'; END IF;
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

-- 6. freeze_account / unfreeze_account — original (no depth cap).
--    Depth cap was added in the follow-up sweep-4 migration.
CREATE OR REPLACE FUNCTION public.freeze_account(p_target_id uuid, p_reason text)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_role text;
  v_authorized boolean := false;
  v_walker uuid;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT role::text INTO v_caller_role FROM profiles WHERE id = v_caller;
  IF v_caller_role = 'admin' THEN
    v_authorized := true;
  ELSE
    v_walker := (SELECT parent_agent_id FROM profiles WHERE id = p_target_id);
    WHILE v_walker IS NOT NULL LOOP
      IF v_walker = v_caller THEN v_authorized := true; EXIT; END IF;
      v_walker := (SELECT parent_agent_id FROM profiles WHERE id = v_walker);
    END LOOP;
  END IF;
  IF NOT v_authorized THEN RAISE EXCEPTION 'forbidden'; END IF;

  UPDATE profiles
    SET is_transactions_frozen = true,
        frozen_at = now(),
        frozen_by = v_caller,
        frozen_reason = NULLIF(trim(p_reason), '')
  WHERE id = p_target_id;

  INSERT INTO admin_audit_log(actor_id, action, target_id, target_type, notes)
    VALUES (v_caller, 'freeze_account', p_target_id, 'profile', p_reason);

  RETURN jsonb_build_object('ok', true, 'target', p_target_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.unfreeze_account(p_target_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_role text;
  v_authorized boolean := false;
  v_walker uuid;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT role::text INTO v_caller_role FROM profiles WHERE id = v_caller;
  IF v_caller_role = 'admin' THEN
    v_authorized := true;
  ELSE
    v_walker := (SELECT parent_agent_id FROM profiles WHERE id = p_target_id);
    WHILE v_walker IS NOT NULL LOOP
      IF v_walker = v_caller THEN v_authorized := true; EXIT; END IF;
      v_walker := (SELECT parent_agent_id FROM profiles WHERE id = v_walker);
    END LOOP;
  END IF;
  IF NOT v_authorized THEN RAISE EXCEPTION 'forbidden'; END IF;

  UPDATE profiles
    SET is_transactions_frozen = false,
        frozen_at = NULL,
        frozen_by = NULL,
        frozen_reason = NULL
  WHERE id = p_target_id;

  INSERT INTO admin_audit_log(actor_id, action, target_id, target_type, notes)
    VALUES (v_caller, 'unfreeze_account', p_target_id, 'profile', NULL);

  RETURN jsonb_build_object('ok', true, 'target', p_target_id);
END;
$function$;
