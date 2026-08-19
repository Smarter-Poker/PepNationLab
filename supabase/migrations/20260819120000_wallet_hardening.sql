-- Wallet hardening pass. Six defects, all verified against the live database
-- before this file was written.
--
--  1. weekly_statements.updated_at does not exist, but pay_invoice writes it.
--     Every self-serve statement payment has been failing with 42703.
--  2. charge_order_credit_line and admin_charge_order_billing silently lost
--     SECURITY DEFINER and their pinned search_path in the 2026-08-18 rewrite,
--     and admin_charge_order_billing is EXECUTE-granted to anon + authenticated.
--  3. Prepaid orders can be charged twice: the approve route's ledger row has a
--     NULL reference_id, so admin_charge_order_billing's "already charged?"
--     guard never matches and charges again on release. This has already
--     happened in production.
--  4. credit_used is charged COGS + shipping but released COGS-only, so the
--     shipping term is stuck in the agent's credit line permanently.
--  5. A frozen account can unfreeze itself: the freeze columns are not pinned
--     by protect_profile_columns and the RLS UPDATE policy has no WITH CHECK.
--  6. A paid statement can be silently reopened by a concurrent recompute.

-- ---------------------------------------------------------------------------
-- 1. The missing column. pay_invoice's statement branch has been dead on
--    arrival; agent_invoices already has this column, weekly_statements never
--    got it.
-- ---------------------------------------------------------------------------
ALTER TABLE public.weekly_statements
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ---------------------------------------------------------------------------
-- 2 + 3 + 4. charge_order_credit_line.
--
--    - SECURITY DEFINER + pinned search_path restored.
--    - Charges COGS ONLY. Shipping has been agent-owned since 2026-07-23 and
--      the weekly bill excludes it (lib/statements.ts forces totalShipping to
--      0), but this function kept adding it to credit_used while pay_invoice
--      released only the billed amount. Every order permanently consumed
--      `shipping_cost` of the agent's credit line. Charge and release now use
--      the same basis, which is what makes the GREATEST(0, ...) floor in
--      pay_invoice unnecessary rather than load-bearing.
--    - The chain gate now counts 'open' statements too. statement_status is
--      ('open','pending_payment','paid') and check_credit_chain - the other
--      implementation of this same rule - has always counted both. Counting
--      only 'pending_payment' let an agent exceed their limit by the value of
--      any statement still sitting in 'open'.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.charge_order_credit_line(p_order_id uuid, p_created_by uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_order public.orders%ROWTYPE;
  v_agent public.profiles%ROWTYPE;
  v_unbilled numeric := 0;
  v_inflight numeric := 0;
  v_chain_projected numeric;
  v_billed_agent_id uuid;
  v_total_cogs numeric := 0;
  v_total_owed numeric := 0;
  v_item record;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', p_order_id;
  END IF;

  IF v_order.agent_id IS NULL THEN
    RETURN;
  END IF;

  -- Already charged? Checked against the order reference, which every charge
  -- path now populates (see the NOT NULL-guarded unique index below).
  IF EXISTS (
    SELECT 1 FROM public.balance_transactions
    WHERE reference_id = p_order_id AND type = 'order_charge'
  ) THEN
    RETURN;
  END IF;

  SELECT * INTO v_agent FROM public.profiles WHERE id = v_order.agent_id;
  IF v_agent.role = 'super_agent' OR v_agent.is_super_agent = true THEN
    v_billed_agent_id := v_agent.id;
  ELSIF v_agent.parent_agent_id IS NOT NULL THEN
    v_billed_agent_id := v_agent.parent_agent_id;
  ELSE
    v_billed_agent_id := v_agent.id;
  END IF;

  FOR v_item IN SELECT * FROM public.order_items WHERE order_id = p_order_id LOOP
    IF v_billed_agent_id != v_order.agent_id THEN
      IF v_item.unit_super_agent_cost IS NOT NULL AND v_item.unit_super_agent_cost >= 0 THEN
        v_total_cogs := v_total_cogs + (v_item.unit_super_agent_cost * COALESCE(v_item.quantity, 0));
      ELSE
        v_total_cogs := v_total_cogs + (COALESCE(v_item.unit_cost_price, 0) * COALESCE(v_item.quantity, 0));
      END IF;
    ELSE
      v_total_cogs := v_total_cogs + (COALESCE(v_item.unit_cost_price, 0) * COALESCE(v_item.quantity, 0));
    END IF;
  END LOOP;

  -- COGS only - see header. Shipping is not billed, so it must not be charged.
  v_total_owed := round(v_total_cogs, 2);

  IF v_billed_agent_id IS NOT NULL THEN
    SELECT * INTO v_agent FROM public.profiles WHERE id = v_billed_agent_id FOR UPDATE;
    IF FOUND AND v_agent.account_type = 'credit' THEN
      SELECT COALESCE(SUM(total_owed), 0) INTO v_unbilled
      FROM public.weekly_statements
      WHERE agent_id = v_billed_agent_id AND status IN ('open', 'pending_payment');

      SELECT COALESCE(SUM(order_cost), 0) INTO v_inflight
      FROM (
        SELECT COALESCE((
          SELECT SUM(
            GREATEST(0,
              CASE
                WHEN o.agent_id <> v_billed_agent_id THEN
                  CASE WHEN oi.unit_super_agent_cost IS NOT NULL AND oi.unit_super_agent_cost > 0
                       THEN oi.unit_super_agent_cost ELSE COALESCE(oi.unit_cost_price, 0) END
                ELSE COALESCE(oi.unit_cost_price, 0)
              END
            ) * COALESCE(oi.quantity, 0)
          )
          FROM public.order_items oi WHERE oi.order_id = o.id
        ), 0) AS order_cost
        FROM public.orders o
        WHERE o.agent_id IN (
            SELECT id FROM public.profiles
            WHERE id = v_billed_agent_id OR parent_agent_id = v_billed_agent_id
          )
          AND COALESCE(o.is_wholesale_restock, false) = false
          AND o.status IN ('approved_ship', 'approved_pickup', 'in_fulfillment', 'shipped', 'delivered')
          AND NOT EXISTS (SELECT 1 FROM public.statement_orders so WHERE so.order_id = o.id)
      ) chain_orders;

      v_chain_projected := v_unbilled + v_inflight;
      IF v_chain_projected > COALESCE(v_agent.credit_limit, 0) THEN
        RAISE EXCEPTION 'Chain credit limit exceeded. Projected %, limit %',
          round(v_chain_projected, 2), COALESCE(v_agent.credit_limit, 0)
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;

  IF v_agent.account_type IS DISTINCT FROM 'credit' THEN
    RETURN;
  END IF;

  IF COALESCE(v_agent.credit_used, 0) + v_total_owed > COALESCE(v_agent.credit_limit, 0) THEN
    RAISE EXCEPTION 'Insufficient credit line limit. Required: %, Available: %',
      v_total_owed,
      COALESCE(v_agent.credit_limit, 0) - COALESCE(v_agent.credit_used, 0);
  END IF;

  UPDATE public.profiles
  SET credit_used = COALESCE(credit_used, 0) + v_total_owed,
      updated_at = NOW()
  WHERE id = v_billed_agent_id;

  -- balance_before/after describe credit_used here, not prepaid_balance.
  -- Previously both were omitted and defaulted to 0.00 -> 0.00, which made the
  -- ledger useless for reconstructing a credit line.
  INSERT INTO public.balance_transactions
    (agent_id, type, amount, balance_before, balance_after, description, reference_id, reference_type, created_by)
  VALUES
    (v_billed_agent_id, 'order_charge', v_total_owed,
     COALESCE(v_agent.credit_used, 0),
     round(COALESCE(v_agent.credit_used, 0) + v_total_owed, 2),
     'Credit Charge For Order ' || left(p_order_id::text, 8),
     p_order_id, 'order', p_created_by);
END;
$function$;

-- ---------------------------------------------------------------------------
-- 2 + 3 + 4. admin_charge_order_billing (the prepaid half).
--    Same restoration, same COGS-only basis, and the duplicate guard now runs
--    BEFORE any computation and is backed by a unique index.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_charge_order_billing(p_order_id uuid, p_created_by uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_order public.orders%ROWTYPE;
  v_agent public.profiles%ROWTYPE;
  v_billed_agent_id uuid;
  v_total_cogs numeric := 0;
  v_total_owed numeric := 0;
  v_before numeric;
  v_item record;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.agent_id IS NULL THEN RETURN; END IF;

  -- Guard first. This is the check that failed in production: it was placed
  -- after the COGS loop and keyed on a reference_id the approve path left NULL.
  IF EXISTS (
    SELECT 1 FROM public.balance_transactions
    WHERE reference_id = p_order_id AND type = 'order_charge'
  ) THEN
    RETURN;
  END IF;

  SELECT * INTO v_agent FROM public.profiles WHERE id = v_order.agent_id;
  IF v_agent.role = 'super_agent' OR v_agent.is_super_agent = true THEN
    v_billed_agent_id := v_agent.id;
  ELSIF v_agent.parent_agent_id IS NOT NULL THEN
    v_billed_agent_id := v_agent.parent_agent_id;
  ELSE
    v_billed_agent_id := v_agent.id;
  END IF;

  FOR v_item IN SELECT * FROM public.order_items WHERE order_id = p_order_id LOOP
    IF v_billed_agent_id != v_order.agent_id THEN
      IF v_item.unit_super_agent_cost IS NOT NULL AND v_item.unit_super_agent_cost >= 0 THEN
        v_total_cogs := v_total_cogs + (v_item.unit_super_agent_cost * COALESCE(v_item.quantity, 0));
      ELSE
        v_total_cogs := v_total_cogs + (COALESCE(v_item.unit_cost_price, 0) * COALESCE(v_item.quantity, 0));
      END IF;
    ELSE
      v_total_cogs := v_total_cogs + (COALESCE(v_item.unit_cost_price, 0) * COALESCE(v_item.quantity, 0));
    END IF;
  END LOOP;

  -- COGS only, matching charge_order_credit_line and the weekly bill.
  v_total_owed := round(v_total_cogs, 2);

  SELECT * INTO v_agent FROM public.profiles WHERE id = v_billed_agent_id FOR UPDATE;

  IF v_agent.account_type = 'prepaid' THEN
    IF COALESCE(v_agent.prepaid_balance, 0) < v_total_owed THEN
      RAISE EXCEPTION 'Insufficient prepaid balance for order %. Required: %, Available: %',
        p_order_id, v_total_owed, COALESCE(v_agent.prepaid_balance, 0);
    END IF;

    v_before := COALESCE(v_agent.prepaid_balance, 0);

    UPDATE public.profiles
    SET prepaid_balance = v_before - v_total_owed,
        updated_at = NOW()
    WHERE id = v_billed_agent_id;

    INSERT INTO public.balance_transactions
      (agent_id, type, amount, balance_before, balance_after, description, reference_id, reference_type, created_by)
    VALUES
      (v_billed_agent_id, 'order_charge', v_total_owed, v_before, round(v_before - v_total_owed, 2),
       'Order charge (' || left(p_order_id::text, 8) || ')', p_order_id, 'order', p_created_by);
  ELSE
    PERFORM public.charge_order_credit_line(p_order_id, p_created_by);
  END IF;
END;
$function$;

-- Neither function may be callable by a browser. admin_charge_order_billing
-- was created without any REVOKE, so it inherited EXECUTE for PUBLIC - i.e.
-- anon and authenticated could invoke a money-moving RPC directly.
REVOKE ALL ON FUNCTION public.charge_order_credit_line(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_charge_order_billing(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.charge_order_credit_line(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_charge_order_billing(uuid, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 3 (structural). One order_charge per order, enforced by the database rather
--    than by three separate application-level guards agreeing with each other.
--    Historical rows with a NULL reference_id are exempt so this can be
--    applied without rewriting history.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS balance_transactions_one_order_charge_per_order
  ON public.balance_transactions (reference_id)
  WHERE type = 'order_charge' AND reference_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 5. Freeze state is not self-service. protect_profile_columns pins 33 columns
--    against the `authenticated` role but never covered the freeze flags, and
--    the "Users can update own profile" RLS policy has no WITH CHECK - so a
--    frozen agent could PATCH their own row and lift their own freeze. That
--    now matters more than it did: freeze is what stops a deleted account's
--    storefront from taking orders at checkout.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  IF current_setting('role', true) = 'authenticated' THEN
    NEW.role := OLD.role;
    NEW.credit_limit := OLD.credit_limit;
    NEW.prepaid_balance := OLD.prepaid_balance;
    NEW.auto_approve_orders := OLD.auto_approve_orders;
    NEW.tier := OLD.tier;
    NEW.is_active := OLD.is_active;
    NEW.is_super_agent := OLD.is_super_agent;
    NEW.parent_agent_id := OLD.parent_agent_id;
    NEW.is_sub_agent := OLD.is_sub_agent;
    NEW.commission_pct := OLD.commission_pct;
    NEW.referring_sub_agent_id := OLD.referring_sub_agent_id;
    NEW.created_by_agent_id := OLD.created_by_agent_id;
    NEW.created_by_role := OLD.created_by_role;
    NEW.first_sign_in_at := OLD.first_sign_in_at;
    NEW.last_sign_in_at := OLD.last_sign_in_at;
    NEW.sign_in_count := OLD.sign_in_count;
    NEW.account_activated_at := OLD.account_activated_at;
    NEW.account_type := OLD.account_type;
    NEW.max_auto_approve_limit := OLD.max_auto_approve_limit;
    NEW.credit_used := OLD.credit_used;
    NEW.referring_agent_id := OLD.referring_agent_id;
    NEW.custom_markup_override := OLD.custom_markup_override;
    NEW.locked_tier_level := OLD.locked_tier_level;
    NEW.house_tier_level := OLD.house_tier_level;
    NEW.velocity_cap := OLD.velocity_cap;
    NEW.fixed_scale_override := OLD.fixed_scale_override;
    -- Agent-funded payouts audit 2026-07-12 (Exploit C1):
    NEW.referral_reward_enabled := OLD.referral_reward_enabled;
    NEW.referral_reward_amount := OLD.referral_reward_amount;
    -- Manufacturer accounts 2026-07-15: self-escalation blocked.
    NEW.is_manufacturer := OLD.is_manufacturer;
    NEW.manufacturer_commission_pct := OLD.manufacturer_commission_pct;
    -- Account deletion 2026-07-29: soft-delete state is RPC-only.
    NEW.deleted_at := OLD.deleted_at;
    NEW.deleted_by := OLD.deleted_by;
    NEW.deleted_reason := OLD.deleted_reason;
    NEW.deleted_identity := OLD.deleted_identity;
    -- Wallet hardening 2026-08-19: a frozen account cannot unfreeze itself,
    -- and cannot erase the reason it was frozen. Freezing is also how a
    -- deleted account is tombstoned, so this was a self-service undelete.
    NEW.is_transactions_frozen := OLD.is_transactions_frozen;
    NEW.frozen_at := OLD.frozen_at;
    NEW.frozen_by := OLD.frozen_by;
    NEW.frozen_reason := OLD.frozen_reason;
  END IF;
  RETURN NEW;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 6. pay_invoice.
--    - No longer writes weekly_statements.updated_at blindly (the column now
--      exists, but the statement branch is written explicitly either way).
--    - Persists p_proof_id, which the signature has always accepted and the
--      body has always discarded. weekly_statements.payment_proof_id already
--      existed; the payment was being recorded with no link to its evidence.
--    - Locks payer and payee in one id-ordered statement. Locking payer-then-
--      payee while wallet_transfer / agent_fund_credit / settle_sub_agent_week
--      all lock in ascending id order is a textbook deadlock, and the nightly
--      auto-pay cron contends on the same house payee row for every agent.
--    - The stale comment justifying GREATEST(0, ...) with "credit_used is
--      charged at order retail" is gone: the charge is COGS and so is the bill.
--      The floor stays as a guard, not as compensation for a known mismatch.
-- ---------------------------------------------------------------------------
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
SET search_path TO 'public', 'pg_temp'
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
  v_payer_used_before numeric;
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

  -- Canonical lock order: both participants in one ascending-id statement,
  -- before any mutation. Matches wallet_transfer.
  PERFORM 1 FROM public.profiles
   WHERE id IN (v_payer, v_payee)
   ORDER BY id
     FOR UPDATE;

  IF p_target_type = 'statement' THEN
    UPDATE weekly_statements
      SET status = 'paid',
          paid_at = now(),
          payment_method = p_handle,
          payment_proof_id = COALESCE(p_proof_id, payment_proof_id),
          updated_at = now()
    WHERE id = p_target_id;
  ELSE
    UPDATE agent_invoices
      SET status = 'paid',
          paid_at = now(),
          payment_method = p_handle,
          updated_at = now()
    WHERE id = p_target_id;
  END IF;

  -- Release the payer's credit line by the amount paid (credit accounts only).
  SELECT account_type, COALESCE(credit_used, 0)
    INTO v_payer_type, v_payer_used_before
  FROM profiles WHERE id = v_payer;

  IF v_payer_type = 'credit' THEN
    UPDATE profiles
      SET credit_used = GREATEST(0, round(v_payer_used_before - p_amount, 2)),
          updated_at = now()
    WHERE id = v_payer;

    -- credit_used moved; the ledger must say so. Previously the single most
    -- important number on a credit account changed with no ledger row at all.
    INSERT INTO balance_transactions
      (agent_id, type, amount, balance_before, balance_after, description, reference_id, reference_type, created_by)
    VALUES
      (v_payer, 'adjustment', p_amount,
       v_payer_used_before,
       GREATEST(0, round(v_payer_used_before - p_amount, 2)),
       format('Credit Line Released By %s Payment', p_target_type),
       p_target_id,
       CASE WHEN p_target_type = 'statement' THEN 'statement' ELSE 'agent_invoice' END,
       v_caller);
  END IF;

  IF v_payee IS NOT NULL THEN
    SELECT COALESCE(prepaid_balance, 0) INTO v_payee_before FROM profiles WHERE id = v_payee;
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

-- ---------------------------------------------------------------------------
-- 6b. A statement may never be un-paid by a recompute.
--
--     lib/statements.ts reads status, then upserts - two round trips with no
--     lock between them. pay_invoice can commit in that window, and the upsert
--     then flips a paid statement back to pending_payment at a lower total,
--     leaving paid_at populated and the payee already credited. The nightly
--     auto-pay cron would then collect it a second time.
--
--     agent_invoices already had exactly this protection
--     (upsert_agent_invoice_atomic ... WHERE status != 'paid'); statements did
--     not. Same shape, same guarantee.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_weekly_statement_atomic(
  p_agent_id uuid,
  p_week_start date,
  p_week_end date,
  p_total_cogs numeric,
  p_total_shipping numeric,
  p_total_owed numeric,
  p_status text,
  p_paid_at timestamptz DEFAULT NULL,
  p_payment_reference text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.weekly_statements
    (agent_id, week_start, week_end, total_cogs, total_shipping, total_owed, status, paid_at, payment_reference, updated_at)
  VALUES
    (p_agent_id, p_week_start, p_week_end, p_total_cogs, p_total_shipping, p_total_owed,
     p_status::statement_status, p_paid_at, p_payment_reference, now())
  ON CONFLICT (agent_id, week_start) DO UPDATE
    SET total_cogs        = EXCLUDED.total_cogs,
        total_shipping    = EXCLUDED.total_shipping,
        total_owed        = EXCLUDED.total_owed,
        status            = EXCLUDED.status,
        paid_at           = EXCLUDED.paid_at,
        payment_reference = EXCLUDED.payment_reference,
        updated_at        = now()
    -- The whole point: never touch a settled statement.
    WHERE public.weekly_statements.status <> 'paid'
  RETURNING id INTO v_id;

  -- Conflict hit a paid row: return its id so the caller can distinguish
  -- "skipped because settled" from "failed".
  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.weekly_statements
     WHERE agent_id = p_agent_id AND week_start = p_week_start;
  END IF;

  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.upsert_weekly_statement_atomic(uuid, date, date, numeric, numeric, numeric, text, timestamptz, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_weekly_statement_atomic(uuid, date, date, numeric, numeric, numeric, text, timestamptz, text) TO service_role;

-- ---------------------------------------------------------------------------
-- 6c. auto_pay_invoice: same canonical lock order, so the nightly cron cannot
--     deadlock against a concurrent wallet_transfer or credit send.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auto_pay_invoice(p_target_type text, p_target_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
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

  -- Canonical lock order: both participants in one ascending-id statement.
  -- This cron walks every unpaid bill on the platform against the SAME house
  -- payee row, so locking payer-then-payee here while wallet_transfer locks by
  -- id was a nightly deadlock waiting on one badly-timed credit send.
  PERFORM 1 FROM public.profiles
   WHERE id IN (v_payer, v_payee)
   ORDER BY id
     FOR UPDATE;

  SELECT * INTO v_payer_row FROM profiles WHERE id = v_payer;
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
      SET status = 'paid', paid_at = now(), payment_method = 'auto_pay', updated_at = now()
    WHERE id = p_target_id;
  ELSE
    UPDATE agent_invoices
      SET status = 'paid', paid_at = now(), payment_method = 'auto_pay', updated_at = now()
    WHERE id = p_target_id;
  END IF;

  -- Release the payer's credit line by the amount paid (credit accounts only).
  IF v_payer_row.account_type = 'credit' THEN
    UPDATE profiles
      SET credit_used = GREATEST(0, round(COALESCE(v_payer_row.credit_used, 0) - v_owed, 2)),
          updated_at = now()
    WHERE id = v_payer;

    INSERT INTO balance_transactions
      (agent_id, type, amount, balance_before, balance_after, description, reference_id, reference_type, created_by)
    VALUES
      (v_payer, 'adjustment', v_owed,
       COALESCE(v_payer_row.credit_used, 0),
       GREATEST(0, round(COALESCE(v_payer_row.credit_used, 0) - v_owed, 2)),
       'Credit Line Released By Auto-Pay',
       p_target_id,
       CASE WHEN p_target_type = 'statement' THEN 'statement' ELSE 'agent_invoice' END,
       NULL);
  END IF;

  -- Credit the payee's wallet.
  IF v_payee IS NOT NULL THEN
    SELECT COALESCE(prepaid_balance, 0) INTO v_payee_before FROM profiles WHERE id = v_payee;
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

COMMENT ON COLUMN public.weekly_statements.updated_at IS
  'Added 2026-08-19. pay_invoice had been writing this column since 2026-08-18 while it did not exist, so every self-serve statement payment failed with 42703.';
