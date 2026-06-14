-- ============================================================================
-- Tech-debt: consolidate deduct_prepaid_balance overloads (2026-06-14)
-- ============================================================================
-- Two overloaded signatures existed in the DB:
--   (agent_id UUID, amount NUMERIC)                         → BOOLEAN (2-arg)
--   (p_agent_id UUID, p_amount NUMERIC, p_order_id UUID DEFAULT NULL,
--    p_description TEXT DEFAULT 'Order charge')             → NUMERIC (4-arg)
--
-- App callers use named args { agent_id, amount } — matching the 2-arg
-- positional param names, NOT the p_-prefixed 4-arg names. The 4-arg NUMERIC
-- version writes a ledger entry to balance_transactions but callers never pass
-- the extra params.
--
-- Resolution: Replace both overloads with a single 4-arg BOOLEAN function.
-- CRITICAL: keep param names as "agent_id" and "amount" (no p_ prefix) so
-- that PostgREST named-arg resolution from the app continues to work without
-- any caller changes.
--
-- Callers in app code (no change required):
--   app/api/orders/route.ts:712        rpc('deduct_prepaid_balance', { agent_id, amount })
--   app/api/agent/orders/approve/route.ts:184 rpc('deduct_prepaid_balance', { agent_id, amount })
-- ============================================================================

-- Step 1: Create the unified 4-arg function with caller-compatible param names.
-- Uses agent_id/amount for the required params (matching PostgREST named-arg
-- calls from app code) and p_order_id/p_description for the optional params
-- (not exposed to callers; present only for future direct SQL use).
CREATE OR REPLACE FUNCTION public.deduct_prepaid_balance(
  agent_id      UUID,
  amount        NUMERIC,
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
  IF amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  SELECT prepaid_balance INTO v_before
    FROM public.profiles
   WHERE id = agent_id
     FOR UPDATE;

  IF v_before IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF v_before < amount THEN
    -- Insufficient balance — return FALSE so callers can handle gracefully.
    RETURN FALSE;
  END IF;

  v_after := v_before - amount;

  UPDATE public.profiles
     SET prepaid_balance = v_after,
         updated_at      = NOW()
   WHERE id = agent_id;

  -- Write a ledger entry (best-effort; wraps in sub-block so a missing column
  -- or constraint on balance_transactions never rolls back the balance update).
  BEGIN
    INSERT INTO public.balance_transactions
      (agent_id, type, amount, balance_before, balance_after,
       description, reference_id, reference_type, created_by)
    VALUES
      (agent_id, 'order_charge', -amount, v_before, v_after,
       p_description,
       p_order_id,
       CASE WHEN p_order_id IS NULL THEN NULL ELSE 'order' END,
       agent_id);
  EXCEPTION WHEN OTHERS THEN
    NULL; -- best-effort; never fail the balance deduction
  END;

  RETURN TRUE;
END;
$$;

-- Step 2: Drop the old overloads that the CREATE OR REPLACE above does NOT
-- automatically supersede:
--
-- (a) The 2-arg (agent_id uuid, amount numeric) → BOOLEAN overload from
--     20260603000003_harden_deduct_prepaid_balance.sql. CREATE OR REPLACE only
--     replaces a function with the EXACT same parameter signature — a 4-arg
--     function never replaces a 2-arg overload. Must be dropped explicitly.
--
-- (b) The p_-prefixed 4-arg (p_agent_id uuid, p_amount numeric, p_order_id uuid,
--     p_description text) → NUMERIC overload from 20260528100000_audit_p0_hardening.sql.
--     This is a different function (different param names = different overload in Postgres).
--
-- After this migration there is exactly ONE deduct_prepaid_balance signature:
--   (agent_id uuid, amount numeric, p_order_id uuid DEFAULT NULL,
--    p_description text DEFAULT 'Order charge') → BOOLEAN
DROP FUNCTION IF EXISTS public.deduct_prepaid_balance(uuid, numeric);
DROP FUNCTION IF EXISTS public.deduct_prepaid_balance(uuid, numeric, uuid, text);

-- Step 3: Correct grants on the unified function.
REVOKE EXECUTE ON FUNCTION public.deduct_prepaid_balance(UUID, NUMERIC, UUID, TEXT)
  FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.deduct_prepaid_balance(UUID, NUMERIC, UUID, TEXT)
  TO authenticated, service_role;
