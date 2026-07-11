-- Promote billing-chain functions from a .bak into a real, tracked migration.
--
-- Provenance: these definitions were previously only present in
-- 20260603130000_invoice_v2_billing_chain_freeze_payinvoice.sql.bak, which
-- Supabase's migration runner ignores (the .bak suffix). That made the .bak the
-- ONLY repo source for four functions that are LIVE in production:
--   walk_billing_chain, check_credit_chain, is_chain_frozen, pay_invoice
-- Deleting the .bak would have erased the source of truth for live objects, so
-- their definitions are re-asserted here in a real migration.
--
-- SAFETY / non-regression notes:
--   * Every statement below is idempotent (ADD COLUMN IF NOT EXISTS,
--     CREATE OR REPLACE FUNCTION) and matches what is already live, so applying
--     this against production is a no-op that only re-affirms the schema.
--   * CREATE OR REPLACE FUNCTION preserves existing privileges, so the EXECUTE
--     revokes / autolock hardening added in 20260707121000,
--     20260707205711 and 20260708130000 are NOT undone by re-asserting these
--     bodies.
--   * freeze_account / unfreeze_account are intentionally NOT included here.
--     Their authoritative, depth-capped version lives in
--     20260603130002_invoice_v2_freeze_unfreeze_loop_cap.sql. Re-defining the
--     original uncapped bodies in this later-dated migration would regress that
--     fix, so they are deliberately omitted.

-- Supporting freeze-state columns on profiles (dependency of is_chain_frozen).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_transactions_frozen boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS frozen_at timestamptz,
  ADD COLUMN IF NOT EXISTS frozen_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS frozen_reason text;

-- walk_billing_chain — recursive CTE, 5-level depth cap.
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

-- check_credit_chain — sums open weekly_statements + agent_invoices per
-- credit-line tier and blocks if projected total exceeds limit.
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

-- is_chain_frozen — first frozen ancestor wins.
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

-- pay_invoice — unified Pay Now for weekly_statements + agent_invoices.
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
