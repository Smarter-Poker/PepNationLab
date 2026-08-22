-- redeem_signup_promo's WELCOME coupon generator was broken in two ways:
-- (1) gen_random_bytes lives in the extensions schema, which is NOT on the
--     function's pinned search_path ('public','pg_temp'), and
-- (2) encode(bytea,'base32') is not a supported encoding in Postgres at all.
-- Every first_order_coupon promo redemption therefore threw at runtime.
-- Use gen_random_uuid() (pg_catalog, always available) + md5 for the suffix.

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
  v_funder UUID;
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
  -- max_uses NULL or <= 0 means unlimited (a literal 0 used to brick the code)
  IF v_promo.max_uses IS NOT NULL AND v_promo.max_uses > 0 AND v_promo.uses_count >= v_promo.max_uses THEN
    RAISE EXCEPTION 'This Promo Code Has Reached Its Usage Limit.';
  END IF;
  SELECT * INTO v_cat FROM public.signup_promo_reward_catalog WHERE key = v_promo.reward_key;
  IF v_cat.key IS NULL OR v_cat.is_active IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Promo Reward Is No Longer Available.';
  END IF;

  v_value := COALESCE(v_cat.default_value, 0);

  IF v_cat.grant_kind = 'store_credit' THEN
    IF v_promo.scope = 'agent' THEN
      v_funder := v_promo.owner_agent_id;
    ELSE
      SELECT referring_agent_id INTO v_funder FROM public.profiles WHERE id = p_user_id;
    END IF;
    IF v_funder IS NULL THEN
      SELECT id INTO v_funder FROM public.agent_profiles WHERE slug = 'researchstore' LIMIT 1;
    END IF;
    PERFORM public.agent_fund_credit(v_funder, p_user_id, v_value, v_promo.id, 'signup_promo',
      'Signup Promo: ' || v_promo.name, true, 'credit');

  ELSIF v_cat.grant_kind = 'first_order_coupon' THEN
    SELECT referring_agent_id INTO v_agent FROM public.profiles WHERE id = p_user_id;
    IF v_agent IS NULL THEN
      SELECT id INTO v_agent FROM public.agent_profiles WHERE slug = 'researchstore' LIMIT 1;
    END IF;
    -- gen_random_uuid() is pg_catalog (PG13+): immune to search_path pinning.
    v_coupon_code := 'WELCOME-' || upper(substring(md5(gen_random_uuid()::text) from 1 for 8));
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
    (v_promo.id, p_user_id, v_promo.reward_key, v_value, v_cat.grant_kind, v_coupon_code, 'granted');
  UPDATE public.signup_promo_codes SET uses_count = uses_count + 1 WHERE id = v_promo.id;
  RETURN jsonb_build_object('redeemed', true, 'reward_key', v_promo.reward_key,
    'grant_kind', v_cat.grant_kind, 'reward_value', v_value,
    'label', v_cat.label, 'coupon_code', v_coupon_code);
END;
$function$;
