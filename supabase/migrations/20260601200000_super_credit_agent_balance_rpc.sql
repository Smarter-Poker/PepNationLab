-- Super-agent (or admin) crediting a downline agent's prepaid Lab Wallet.
-- Mirrors deduct_prepaid_balance's ledger-insert shape but ADDS funds and
-- records a 'bonus' balance_transactions row so the credit shows in history.
-- Authorization (downline ownership) is enforced in the API route; this fn is
-- a low-level atomic primitive and is REVOKEd from anon/authenticated.
--
-- Applied to production via Supabase MCP as super_credit_agent_balance_rpc.
CREATE OR REPLACE FUNCTION public.super_credit_agent_balance(
  p_agent_id uuid,
  p_amount numeric,
  p_created_by uuid,
  p_description text DEFAULT 'Credit From Super Agent'
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_before numeric;
  v_after  numeric;
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

  v_after := v_before + p_amount;

  UPDATE public.profiles
  SET prepaid_balance = v_after,
      updated_at = NOW()
  WHERE id = p_agent_id;

  INSERT INTO public.balance_transactions
    (agent_id, type, amount, balance_before, balance_after, description, created_by)
  VALUES
    (p_agent_id, 'bonus', p_amount, v_before, v_after, p_description, p_created_by);

  RETURN v_after;
END;
$function$;

REVOKE ALL ON FUNCTION public.super_credit_agent_balance(uuid, numeric, uuid, text) FROM anon, authenticated;
