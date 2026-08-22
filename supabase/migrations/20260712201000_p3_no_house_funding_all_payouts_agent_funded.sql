-- Phase 3: NOTHING is house-funded. Every referral bonus, signup promo, and super-agent credit
-- is funded by the responsible agent/super-agent via double-entry. Coupons/quantity/flash already
-- come out of agent margin. Applied to prod via Supabase MCP; see AGENT-FUNDED-PAYOUTS-AUDIT-2026-07-12.md.

CREATE OR REPLACE FUNCTION public.agent_fund_credit(
  p_funder uuid, p_recipient uuid, p_amount numeric,
  p_reference_id uuid, p_reference_type text, p_description text,
  p_allow_debt boolean DEFAULT true, p_recipient_type text DEFAULT 'credit')
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_amt numeric := round(p_amount, 2);
  f_role text; f_prepaid numeric; f_limit numeric; f_used numeric;
  f_from_prepaid numeric; f_from_credit numeric;
  r_before numeric; r_after numeric;
BEGIN
  IF v_amt IS NULL OR v_amt <= 0 THEN RETURN; END IF;
  IF p_funder IS NULL THEN
    RAISE EXCEPTION 'agent_fund_credit: no responsible funder resolved (refusing to house-fund)';
  END IF;
  IF p_funder = p_recipient THEN
    RAISE EXCEPTION 'agent_fund_credit: funder and recipient are the same account';
  END IF;

  PERFORM 1 FROM public.profiles WHERE id IN (p_funder, p_recipient) ORDER BY id FOR UPDATE;

  SELECT role::text, COALESCE(prepaid_balance,0), COALESCE(credit_limit,0), COALESCE(credit_used,0)
    INTO f_role, f_prepaid, f_limit, f_used
  FROM public.profiles WHERE id = p_funder;
  IF f_role IS NULL THEN RAISE EXCEPTION 'agent_fund_credit: funder % not found', p_funder; END IF;

  IF f_role = 'admin' THEN
    f_from_prepaid := v_amt; f_from_credit := 0;
  ELSE
    f_from_prepaid := LEAST(f_prepaid, v_amt);
    f_from_credit  := round(v_amt - f_from_prepaid, 2);
    IF f_from_credit > 0 AND NOT p_allow_debt
       AND (f_limit <= 0 OR (f_used + f_from_credit) > f_limit) THEN
      RAISE EXCEPTION 'Insufficient balance or credit to fund $% (need $% on credit).',
        v_amt, f_from_credit USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  UPDATE public.profiles
    SET prepaid_balance = round(f_prepaid - f_from_prepaid, 2),
        credit_used     = round(f_used + f_from_credit, 2),
        updated_at = NOW()
  WHERE id = p_funder;
  INSERT INTO public.balance_transactions
    (agent_id, type, amount, balance_before, balance_after, description, reference_id, reference_type, counterparty_id)
  VALUES (p_funder, 'payout', v_amt, f_prepaid, round(f_prepaid - f_from_prepaid, 2),
    p_description || CASE WHEN f_from_credit > 0 THEN ' ($' || f_from_credit::text || ' billed to credit line)' ELSE '' END,
    p_reference_id, p_reference_type, p_recipient);

  SELECT COALESCE(prepaid_balance,0) INTO r_before FROM public.profiles WHERE id = p_recipient;
  IF r_before IS NULL THEN RAISE EXCEPTION 'agent_fund_credit: recipient % not found', p_recipient; END IF;
  r_after := round(r_before + v_amt, 2);
  UPDATE public.profiles SET prepaid_balance = r_after, updated_at = NOW() WHERE id = p_recipient;
  INSERT INTO public.balance_transactions
    (agent_id, type, amount, balance_before, balance_after, description, reference_id, reference_type, counterparty_id)
  VALUES (p_recipient, p_recipient_type, v_amt, r_before, r_after, p_description, p_reference_id, p_reference_type, p_funder);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.agent_fund_credit(uuid,uuid,numeric,uuid,text,text,boolean,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_fund_credit(uuid,uuid,numeric,uuid,text,text,boolean,text) TO service_role;

CREATE OR REPLACE FUNCTION public.fulfil_researcher_referral(p_referral_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_referrer uuid; v_referee uuid; v_rref numeric; v_eref numeric; v_status text;
  v_is_sub boolean; v_parent uuid; v_ref_agent uuid; v_funder uuid; v_house uuid;
BEGIN
  SELECT referrer_id, referee_id, referrer_reward_amount, referee_reward_amount, status
    INTO v_referrer, v_referee, v_rref, v_eref, v_status
  FROM public.researcher_referrals WHERE id = p_referral_id FOR UPDATE;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Referral not found'; END IF;
  IF v_status <> 'pending' THEN RAISE EXCEPTION 'Referral is not pending'; END IF;

  SELECT COALESCE(is_sub_agent,false), parent_agent_id, referring_agent_id
    INTO v_is_sub, v_parent, v_ref_agent
  FROM public.profiles WHERE id = v_referrer;
  SELECT id INTO v_house FROM public.agent_profiles WHERE slug = 'researchstore' LIMIT 1;
  v_funder := COALESCE(CASE WHEN v_is_sub THEN v_parent ELSE v_ref_agent END, v_house);

  UPDATE public.researcher_referrals SET status = 'rewarded', rewarded_at = now() WHERE id = p_referral_id;

  IF COALESCE(v_rref,0) > 0 THEN
    PERFORM public.agent_fund_credit(v_funder, v_referrer, v_rref, p_referral_id, 'referral_reward', 'Referral Reward (Referrer)', true, 'credit');
  END IF;
  IF COALESCE(v_eref,0) > 0 AND v_referee IS NOT NULL THEN
    PERFORM public.agent_fund_credit(v_funder, v_referee, v_eref, p_referral_id, 'referral_reward', 'Referral Welcome Credit', true, 'credit');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.super_credit_agent_balance(
  p_agent_id uuid, p_amount numeric, p_created_by uuid, p_description text DEFAULT 'Credit From Super Agent')
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_after numeric;
BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  PERFORM public.agent_fund_credit(p_created_by, p_agent_id, p_amount, NULL, 'agent_credit',
    COALESCE(p_description, 'Credit From Super Agent'), false, 'bonus');
  SELECT prepaid_balance INTO v_after FROM public.profiles WHERE id = p_agent_id;
  RETURN v_after;
END;
$$;
