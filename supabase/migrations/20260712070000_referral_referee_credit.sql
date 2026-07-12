-- Referral pipeline completion (2026-07-12 audit): the referrals UI promises
-- BOTH sides a reward ("They earn $X in store credit, and you earn $Y"), and
-- apply_referral_code records referee_reward_amount -- but
-- fulfil_researcher_referral only ever credited the referrer. Credit the
-- referee too, atomically in the same transaction.
--
-- CREATE OR REPLACE preserves the existing ACL (service_role only; EXECUTE was
-- revoked from anon/authenticated in 20260707000000_rpc_security_hardening).

CREATE OR REPLACE FUNCTION public.fulfil_researcher_referral(p_referral_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_referrer_id uuid;
  v_referee_id uuid;
  v_referrer_reward numeric;
  v_referee_reward numeric;
  v_status text;
BEGIN
  -- 1. Lock the referral row and read its data
  SELECT referrer_id, referee_id, referrer_reward_amount, referee_reward_amount, status
  INTO v_referrer_id, v_referee_id, v_referrer_reward, v_referee_reward, v_status
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

  -- 4. Credit the referrer's prepaid balance (if there is an amount)
  IF COALESCE(v_referrer_reward, 0) > 0 THEN
    PERFORM public.credit_prepaid_balance(
      v_referrer_id,
      v_referrer_reward,
      p_referral_id,
      'Referral Reward Credit'
    );
  END IF;

  -- 5. Credit the referee's promised store credit as well
  IF COALESCE(v_referee_reward, 0) > 0 AND v_referee_id IS NOT NULL THEN
    PERFORM public.credit_prepaid_balance(
      v_referee_id,
      v_referee_reward,
      p_referral_id,
      'Referral Welcome Credit'
    );
  END IF;
END;
$$;
