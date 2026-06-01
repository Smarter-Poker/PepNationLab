-- Atomic issuance of store credit to a recipient's Lab Wallet.
-- Mirrors redeem_store_credit / release_store_credit (append-only signed ledger).
-- p_created_by records WHO funded the credit (issuing agent / super-agent / admin)
-- so the future checkout-redemption settlement can charge the right party.
--
-- Applied to production via Supabase MCP as issue_store_credit_rpc (+ _fix).
CREATE OR REPLACE FUNCTION public.issue_store_credit(
  p_user_id uuid,
  p_amount numeric,
  p_created_by uuid,
  p_description text DEFAULT 'Credit Issued'
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

  -- NOTE: no FOR UPDATE — it is illegal with an aggregate (SUM), and the
  -- sibling redeem/release RPCs sum the same way. The append-only ledger
  -- tolerates the tiny race identically.
  SELECT COALESCE(SUM(amount), 0) INTO v_before
  FROM public.store_credits
  WHERE user_id = p_user_id;

  v_after := v_before + p_amount;

  INSERT INTO public.store_credits (
    user_id, amount, balance_before, balance_after,
    type, source_order_id, description, created_by
  )
  VALUES (
    p_user_id, p_amount, v_before, v_after,
    'issue', NULL, p_description, p_created_by
  );

  RETURN v_after;
END;
$function$;

REVOKE ALL ON FUNCTION public.issue_store_credit(uuid, numeric, uuid, text) FROM anon, authenticated;
