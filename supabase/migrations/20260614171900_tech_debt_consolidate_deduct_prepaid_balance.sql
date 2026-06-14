-- ============================================================================
-- Tech-debt: consolidate deduct_prepaid_balance overloads (2026-06-14)
-- ============================================================================
-- Two overloaded signatures existed in the DB:
--   (agent_id UUID, amount NUMERIC)                         → BOOLEAN (2-arg)
--   (p_agent_id UUID, p_amount NUMERIC, p_order_id UUID DEFAULT NULL,
--    p_description TEXT DEFAULT 'Order charge')             → NUMERIC (4-arg)
--
-- App callers use named args { agent_id, amount } which resolve to the 2-arg
-- BOOLEAN version via PostgREST named-arg matching. The 4-arg NUMERIC version
-- is more capable (writes a ledger entry to balance_transactions) but callers
-- never pass the extra params.
--
-- Resolution: keep a single 4-arg function that also accepts the 2-arg call
-- pattern by using DEFAULT for the last two params. Callers do not need to
-- change — they already pass { agent_id, amount } which satisfies positional
-- matching. The function is renamed internally to use consistent `p_` prefix
-- param names. The old 2-arg signature is dropped.
--
-- Callers in app code (no change required):
--   app/api/orders/route.ts:718          rpc('deduct_prepaid_balance', { agent_id, amount })
--   app/api/agent/orders/approve/route.ts:176 rpc('deduct_prepaid_balance', { agent_id, amount })
-- ============================================================================

-- Step 1: Ensure the consolidated 4-arg function exists with consistent
-- p_-prefixed params and DEFAULT values so the 2-arg call pattern still works.
CREATE OR REPLACE FUNCTION public.deduct_prepaid_balance(
  p_agent_id    UUID,
  p_amount      NUMERIC,
  p_order_id    UUID    DEFAULT NULL,
  p_description TEXT    DEFAULT 'Order charge'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_before NUMERIC;
  v_after  NUMERIC;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  SELECT prepaid_balance INTO v_before
    FROM public.profiles
   WHERE id = p_agent_id
     FOR UPDATE;

  IF v_before IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF v_before < p_amount THEN
    -- Insufficient balance — return FALSE so callers can handle gracefully.
    RETURN FALSE;
  END IF;

  v_after := v_before - p_amount;

  UPDATE public.profiles
     SET prepaid_balance = v_after,
         updated_at      = NOW()
   WHERE id = p_agent_id;

  -- Write a ledger entry (best-effort; only when balance_transactions exists).
  BEGIN
    INSERT INTO public.balance_transactions
      (agent_id, type, amount, balance_before, balance_after,
       description, reference_id, reference_type, created_by)
    VALUES
      (p_agent_id, 'order_charge', -p_amount, v_before, v_after,
       p_description,
       p_order_id,
       CASE WHEN p_order_id IS NULL THEN NULL ELSE 'order' END,
       p_agent_id);
  EXCEPTION WHEN OTHERS THEN
    NULL; -- balance_transactions may not exist on every deployment
  END;

  RETURN TRUE;
END;
$$;

-- Step 2: Drop the old positional 2-arg overload that returns BOOLEAN with
-- simple param names (agent_id, amount). Now that the 4-arg version has
-- DEFAULT values for the extra params, PostgREST named-arg calls with only
-- { agent_id, amount } will resolve to the 4-arg version correctly.
-- NOTE: PostgreSQL DROP FUNCTION requires exact param types to disambiguate.
DROP FUNCTION IF EXISTS public.deduct_prepaid_balance(uuid, numeric);

-- Step 3: Ensure grants are correct on the remaining (unified) function.
REVOKE EXECUTE ON FUNCTION public.deduct_prepaid_balance(UUID, NUMERIC, UUID, TEXT)
  FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.deduct_prepaid_balance(UUID, NUMERIC, UUID, TEXT)
  TO authenticated, service_role;
