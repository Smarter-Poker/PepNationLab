-- Phase 1B: an agent/super-agent-created signup promo comes out of THAT agent's pocket.
-- store_credit promos with scope='agent' DEBIT the owning agent (prepaid first, shortfall to
-- credit line) and CREDIT the new user, both rows carrying counterparty_id +
-- reference_type='signup_promo'. Platform/admin promos stay house-funded (owner_agent_id NULL).
-- Payout value is the catalog default (P0/C2 clamp retained). first_order_coupon unchanged.

CREATE OR REPLACE FUNCTION public.redeem_signup_promo(p_user_id uuid, p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_code   TEXT := NULLIF(trim(p_code), '');
  v_promo  RECORD;
  v_cat    RECORD;
  v_agent  UUID;
  v_coupon_code TEXT;
  v_value  NUMERIC;
  v_user_before NUMERIC; v_user_after NUMERIC;
  v_owner_prepaid NUMERIC; v_owner_used NUMERIC;
  v_from_prepaid NUMERIC; v_from_credit NUMERIC;
BEGIN
  IF v_code IS NULL THEN
    RETURN jsonb_build_object('redeemed', false, 'reason', 'empty');
  END IF;
  IF EXISTS (SELECT 1 FROM public.signup_promo_redemptions WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION 'A Signup Promo Has Already Been Applied To This Account.';
  END IF;
  SELECT * INTO v_promo FROM public.signup_promo_codes
  WHERE lower(code) = lower(v_code) AND is_active
    AND starts_at <= NOW() AND (ends_at IS NULL OR ends_at > NOW())
  FOR UPDATE;
  IF v_promo.id IS NULL THEN
    RAISE EXCEPTION 'Promo Code Not Valid.';
  END IF;
  IF v_promo.max_uses IS NOT NULL AND v_promo.uses_count >= v_promo.max_uses THEN
    RAISE EXCEPTION 'This Promo Code Has Reached Its Usage Limit.';
  END IF;
  SELECT * INTO v_cat FROM public.signup_promo_reward_catalog WHERE key = v_promo.reward_key;
  IF v_cat.key IS NULL OR v_cat.is_active IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Promo Reward Is No Longer Available.';
  END IF;

  -- SECURITY (P0/C2): payout value is the fixed catalog default, never the stored reward_value.
  v_value := COALESCE(v_cat.default_value, 0);

  IF v_cat.grant_kind = 'store_credit' THEN
    SELECT COALESCE(prepaid_balance,0) INTO v_user_before FROM public.profiles WHERE id = p_user_id FOR UPDATE;
    v_user_after := round(v_user_before + v_value, 2);
    UPDATE public.profiles SET prepaid_balance = v_user_after WHERE id = p_user_id;
    INSERT INTO public.balance_transactions
      (agent_id, type, amount, balance_before, balance_after, description, reference_id, reference_type, counterparty_id)
    VALUES (p_user_id, 'credit', v_value, v_user_before, v_user_after,
      'Signup Promo: ' || v_promo.name, v_promo.id, 'signup_promo',
      CASE WHEN v_promo.scope = 'agent' THEN v_promo.owner_agent_id ELSE NULL END);

    IF v_promo.scope = 'agent' AND v_promo.owner_agent_id IS NOT NULL AND v_value > 0 THEN
      SELECT COALESCE(prepaid_balance,0), COALESCE(credit_used,0)
        INTO v_owner_prepaid, v_owner_used
      FROM public.profiles WHERE id = v_promo.owner_agent_id FOR UPDATE;
      v_from_prepaid := LEAST(v_owner_prepaid, v_value);
      v_from_credit  := round(v_value - v_from_prepaid, 2);
      UPDATE public.profiles
        SET prepaid_balance = round(v_owner_prepaid - v_from_prepaid, 2),
            credit_used     = round(v_owner_used + v_from_credit, 2)
      WHERE id = v_promo.owner_agent_id;
      INSERT INTO public.balance_transactions
        (agent_id, type, amount, balance_before, balance_after, description, reference_id, reference_type, counterparty_id)
      VALUES (v_promo.owner_agent_id, 'payout', v_value, v_owner_prepaid, round(v_owner_prepaid - v_from_prepaid, 2),
        'Signup Promo Funding: ' || v_promo.name
          || CASE WHEN v_from_credit > 0 THEN ' ($' || v_from_credit::text || ' billed to credit line)' ELSE '' END,
        v_promo.id, 'signup_promo', p_user_id);
    END IF;

  ELSIF v_cat.grant_kind = 'first_order_coupon' THEN
    SELECT referring_agent_id INTO v_agent FROM public.profiles WHERE id = p_user_id;
    IF v_agent IS NULL THEN
      SELECT id INTO v_agent FROM public.agent_profiles WHERE slug = 'researchstore' LIMIT 1;
    END IF;
    v_coupon_code := 'WELCOME-' || upper(substring(encode(gen_random_bytes(6),'base32') from 1 for 8));
    IF v_agent IS NOT NULL THEN
      INSERT INTO public.coupons
        (agent_id, code, discount_type, discount_value, max_uses, max_uses_per_user,
         new_customers_only, expires_at, is_active, notes)
      VALUES
        (v_agent, v_coupon_code, v_cat.coupon_discount_type::public.discount_type,
         v_value, 1, 1, true, NOW() + INTERVAL '60 days', true,
         'Signup promo ' || v_promo.code);
    END IF;
  END IF;

  INSERT INTO public.signup_promo_redemptions
    (promo_code_id, user_id, reward_key, reward_value, grant_kind, coupon_code, status)
  VALUES
    (v_promo.id, p_user_id, v_promo.reward_key, v_value,
     v_cat.grant_kind, v_coupon_code, 'granted');
  UPDATE public.signup_promo_codes SET uses_count = uses_count + 1 WHERE id = v_promo.id;
  RETURN jsonb_build_object('redeemed', true, 'reward_key', v_promo.reward_key,
    'grant_kind', v_cat.grant_kind, 'reward_value', v_value,
    'label', v_cat.label, 'coupon_code', v_coupon_code);
END;
$function$;
