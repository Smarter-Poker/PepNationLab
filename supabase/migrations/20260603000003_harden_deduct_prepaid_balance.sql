-- ============================================================
-- Sweep 17: Harden deduct_prepaid_balance SECURITY DEFINER
-- ============================================================
-- deduct_prepaid_balance was defined in 20260528033557 without
-- SET search_path = public, making it vulnerable to schema-path
-- injection attacks. Also adds public. prefix and revokes PUBLIC
-- execute so only authenticated users can call it via RPC.
-- ============================================================

CREATE OR REPLACE FUNCTION public.deduct_prepaid_balance(
  agent_id UUID,
  amount   NUMERIC
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_balance NUMERIC;
BEGIN
  -- Lock the row to prevent concurrent deductions.
  SELECT prepaid_balance INTO current_balance
    FROM public.profiles
   WHERE id = agent_id
     FOR UPDATE;

  IF current_balance >= amount THEN
    UPDATE public.profiles
       SET prepaid_balance = prepaid_balance - amount
     WHERE id = agent_id;
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.deduct_prepaid_balance(UUID, NUMERIC) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.deduct_prepaid_balance(UUID, NUMERIC) TO authenticated;
