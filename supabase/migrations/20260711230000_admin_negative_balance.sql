-- Allow admin balances to go negative for coupon redemptions and manual adjustments.
--
-- Two parts:
--   1. Relax the non-negative CHECK so only NON-admin roles are constrained.
--   2. Replace the REAL deduct_prepaid_balance (the 4-arg overload the checkout
--      path actually calls) so an admin deduction may overdraw. The prior version
--      of this migration did CREATE OR REPLACE on a 2-arg signature, which
--      Postgres treats as a NEW function -- leaving the canonical 4-arg function
--      (with its balance_transactions ledger write, FOR UPDATE lock, and
--      positive-amount guard) untouched, so the admin-negative behavior never
--      took effect and a ledger-less/guard-less overload was introduced. This
--      version replaces the exact 4-arg signature and preserves the ledger
--      insert, row lock, and positive-amount guard, changing ONLY the overdraw
--      check for admins. Non-admin behavior is identical to before.

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_prepaid_balance_nonneg;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_prepaid_balance_nonneg
  CHECK (prepaid_balance IS NULL OR prepaid_balance >= 0 OR role = 'admin');

CREATE OR REPLACE FUNCTION public.deduct_prepaid_balance(
  agent_id uuid,
  amount numeric,
  p_order_id uuid DEFAULT NULL::uuid,
  p_description text DEFAULT 'Order charge'::text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_before NUMERIC;
  v_after  NUMERIC;
  v_role   TEXT;
BEGIN
  IF amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  SELECT prepaid_balance, role::text INTO v_before, v_role
    FROM public.profiles
   WHERE id = agent_id
     FOR UPDATE;

  IF v_before IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  -- Non-admins must have sufficient funds; admins may overdraw into a negative
  -- balance (owner decision 2026-07-11).
  IF v_before < amount AND v_role <> 'admin' THEN
    RETURN FALSE;
  END IF;

  v_after := v_before - amount;

  UPDATE public.profiles
     SET prepaid_balance = v_after,
         updated_at      = NOW()
   WHERE id = agent_id;

  -- Best-effort ledger entry. amount stored as positive; type='order_charge'
  -- indicates a deduction (schema contract: "Always positive, direction in type").
  BEGIN
    INSERT INTO public.balance_transactions
      (agent_id, type, amount, balance_before, balance_after,
       description, reference_id, reference_type, created_by)
    VALUES
      (agent_id, 'order_charge', amount, v_before, v_after,
       p_description,
       p_order_id,
       CASE WHEN p_order_id IS NULL THEN NULL ELSE 'order' END,
       agent_id);
  EXCEPTION WHEN OTHERS THEN
    NULL; -- never fail the balance deduction due to a ledger issue
  END;

  RETURN TRUE;
END;
$function$;
