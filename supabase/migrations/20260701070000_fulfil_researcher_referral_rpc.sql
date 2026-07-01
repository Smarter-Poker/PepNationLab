-- 20260701070000_fulfil_researcher_referral_rpc.sql
-- Atomically fulfills a researcher referral by marking it rewarded and crediting the referrer's balance.

CREATE OR REPLACE FUNCTION public.fulfil_researcher_referral(p_referral_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_referrer_id uuid;
  v_reward_amount numeric;
  v_status text;
BEGIN
  -- 1. Lock the referral row and read its data
  SELECT referrer_id, referrer_reward_amount, status
  INTO v_referrer_id, v_reward_amount, v_status
  FROM public.researcher_referrals
  WHERE id = p_referral_id
  FOR UPDATE;

  -- 2. Validate state
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Referral not found';
  END IF;

  IF v_status != 'pending' THEN
    RAISE EXCEPTION 'Referral is not pending';
  END IF;

  -- 3. Mark as rewarded
  UPDATE public.researcher_referrals
  SET 
    status = 'rewarded',
    rewarded_at = now()
  WHERE id = p_referral_id;

  -- 4. Credit the prepaid balance (if there is an amount)
  IF COALESCE(v_reward_amount, 0) > 0 THEN
    PERFORM public.credit_prepaid_balance(
      v_referrer_id,
      v_reward_amount,
      p_referral_id::text,
      'Referral Reward Credit'
    );
  END IF;
END;
$$;
