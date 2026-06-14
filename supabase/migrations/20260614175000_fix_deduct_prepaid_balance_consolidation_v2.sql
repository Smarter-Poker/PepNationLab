-- ============================================================================
-- Fix: complete the deduct_prepaid_balance consolidation (2026-06-14 v2)
-- ============================================================================
-- Migration 20260614171900 attempted to consolidate two overloads into one
-- but the live DB still has both old signatures present. This migration
-- forcibly drops them and re-creates the single canonical 4-arg BOOLEAN.
--
-- Live DB state before this migration (confirmed 2026-06-14T17:47):
--   (a) deduct_prepaid_balance(agent_id uuid, amount numeric) → BOOLEAN
--       Created by: 20260603000003_harden_deduct_prepaid_balance.sql
--   (b) deduct_prepaid_balance(p_agent_id uuid, p_amount numeric,
--        p_order_id uuid DEFAULT NULL, p_description text DEFAULT 'Order charge')
--       → NUMERIC
--       Created by: 20260528100000_audit_p0_hardening.sql
--
-- Callers in app code use named args { agent_id, amount } which match (a).
-- (b) is unused by app code.
--
-- After this migration exactly one signature exists:
--   deduct_prepaid_balance(agent_id uuid, amount numeric,
--     p_order_id uuid DEFAULT NULL,
--     p_description text DEFAULT 'Order charge') → BOOLEAN
-- ============================================================================

-- Step 1: Force-drop both old overloads.
-- Cannot use CREATE OR REPLACE to remove an overload — must DROP explicitly.
DROP FUNCTION IF EXISTS public.deduct_prepaid_balance(uuid, numeric);
DROP FUNCTION IF EXISTS public.deduct_prepaid_balance(uuid, numeric, uuid, text);

-- Step 2: Create the single canonical 4-arg BOOLEAN function.
-- Param names match what app callers pass via PostgREST named-arg calls:
--   rpc('deduct_prepaid_balance', { agent_id: ..., amount: ... })
CREATE FUNCTION public.deduct_prepaid_balance(
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
$$;

-- Step 3: Grants.
REVOKE EXECUTE ON FUNCTION public.deduct_prepaid_balance(UUID, NUMERIC, UUID, TEXT)
  FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.deduct_prepaid_balance(UUID, NUMERIC, UUID, TEXT)
  TO authenticated, service_role;
