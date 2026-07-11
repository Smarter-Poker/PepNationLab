-- Allow admin balances to go negative for coupon redemptions and manual adjustments

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_prepaid_balance_nonneg;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_prepaid_balance_nonneg
  CHECK (prepaid_balance IS NULL OR prepaid_balance >= 0 OR role = 'admin');

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
  v_role TEXT;
BEGIN
  -- Lock the row to prevent concurrent deductions.
  SELECT prepaid_balance, role INTO current_balance, v_role
    FROM public.profiles
   WHERE id = agent_id
     FOR UPDATE;

  IF current_balance >= amount OR v_role = 'admin' THEN
    UPDATE public.profiles
       SET prepaid_balance = prepaid_balance - amount
     WHERE id = agent_id;
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$;
