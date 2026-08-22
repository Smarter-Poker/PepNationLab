-- Atomic manual balance adjustment for /api/admin/transactions.
--
-- WHY: The transactions POST handler currently reads prepaid_balance, computes
-- the new balance in JS, then writes it back with an unconditional UPDATE. A
-- concurrent order debit (deduct_prepaid_balance) or a second admin adjustment
-- between the read and the write is silently lost (last-writer-wins), and the
-- balance_transactions ledger can then disagree with profiles.prepaid_balance.
-- This RPC does the read + write + ledger insert in ONE transaction with a row
-- lock (FOR UPDATE), the same pattern as deduct_prepaid_balance /
-- charge_order_credit_line.
--
-- HOW TO ADOPT: apply this migration, then swap the read-modify-write block in
-- app/api/admin/transactions/route.ts for a single call:
--   const { data: adj, error } = await supabase.rpc('admin_adjust_prepaid_balance', {
--     p_agent_id: agent_id, p_type: type, p_amount: parsedAmount,
--     p_description: description.trim(), p_reference_id: reference_id ?? null,
--     p_reference_type: reference_type ?? null, p_created_by: gate.userId,
--   });
-- The audit-log insert added in the same hardening pass stays as-is.
--
-- Apply against PepNationLab Supabase project ydsaqnnuwyvtyxgvrnys ONLY.

CREATE OR REPLACE FUNCTION public.admin_adjust_prepaid_balance(
  p_agent_id       uuid,
  p_type           text,
  p_amount         numeric,
  p_description    text,
  p_reference_id   uuid DEFAULT NULL,
  p_reference_type text DEFAULT NULL,
  p_created_by     uuid DEFAULT NULL
)
RETURNS TABLE (transaction_id uuid, balance_before numeric, balance_after numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_dir     integer;
  v_before  numeric;
  v_after   numeric;
  v_id      uuid;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;
  IF p_type NOT IN ('commission','withdrawal','adjustment','order_charge','restock_charge',
                    'credit','debit','bonus','payout','deposit','manual_adjustment') THEN
    RAISE EXCEPTION 'invalid_type';
  END IF;

  -- Lock the profile row so a concurrent debit/credit cannot race us.
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_agent_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'agent_not_found';
  END IF;

  v_dir := CASE
    WHEN p_type IN ('credit','deposit','bonus','commission','adjustment','manual_adjustment')
    THEN 1 ELSE -1 END;
  v_before := COALESCE(v_profile.prepaid_balance, 0);
  v_after  := ROUND(v_before + v_dir * p_amount, 2);

  UPDATE public.profiles
  SET prepaid_balance = v_after, updated_at = NOW()
  WHERE id = p_agent_id;

  INSERT INTO public.balance_transactions
    (agent_id, type, amount, balance_before, balance_after, description,
     reference_id, reference_type, created_by)
  VALUES
    (p_agent_id, p_type, p_amount, v_before, v_after, p_description,
     p_reference_id, p_reference_type, p_created_by)
  RETURNING id INTO v_id;

  RETURN QUERY SELECT v_id, v_before, v_after;
END;
$$;

-- Privileged money RPC: only the service role (used by the admin route) may run it.
REVOKE ALL ON FUNCTION public.admin_adjust_prepaid_balance(uuid, text, numeric, text, uuid, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_prepaid_balance(uuid, text, numeric, text, uuid, text, uuid)
  TO service_role;
