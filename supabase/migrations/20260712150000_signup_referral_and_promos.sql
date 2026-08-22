-- ============================================================================
-- Signup Referral (by username, all roles) + Signup Promo Codes  (2026-07-12)
-- ----------------------------------------------------------------------------
--   1. Referral code / QR resolves a REFERRER by username (or referral_code)
--      across every role. Role decides the effect:
--        - researcher        -> researcher referral credit program (existing)
--        - sub-agent          -> new user joins downline + (opt-in) credit
--        - agent/super_agent  -> new user joins downline (no credit)
--   2. Sub-agents opt in to a referral reward amount (default OFF / 0).
--   3. Admin & Super-Agent signup promo codes: custom code + reward chosen from
--      a fixed 10-item catalog, granting a perk on first-time signup.
-- Sub-agent credits reuse researcher_referrals + the referrals-fulfil cron:
-- they pay out on the referred user's FIRST qualifying order (anti-fraud).
-- Idempotent (IF NOT EXISTS / CREATE OR REPLACE).
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_reward_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_reward_amount NUMERIC NOT NULL DEFAULT 0
    CHECK (referral_reward_amount >= 0);

CREATE TABLE IF NOT EXISTS public.signup_promo_reward_catalog (
  key           TEXT PRIMARY KEY,
  label         TEXT NOT NULL,
  description   TEXT,
  grant_kind    TEXT NOT NULL CHECK (grant_kind IN ('store_credit','first_order_coupon')),
  default_value NUMERIC NOT NULL DEFAULT 0 CHECK (default_value >= 0),
  coupon_discount_type TEXT CHECK (coupon_discount_type IN ('percent','fixed')),
  sort_order    INTEGER NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO public.signup_promo_reward_catalog
  (key, label, description, grant_kind, default_value, coupon_discount_type, sort_order)
VALUES
  ('welcome_credit_10',  '$10 Store Credit',   'New account is granted $10 in store credit at signup.',          'store_credit',       10,  NULL,      10),
  ('welcome_credit_20',  '$20 Store Credit',   'New account is granted $20 in store credit at signup.',          'store_credit',       20,  NULL,      20),
  ('welcome_credit_25',  '$25 Store Credit',   'New account is granted $25 in store credit at signup.',          'store_credit',       25,  NULL,      30),
  ('welcome_credit_50',  '$50 Store Credit',   'New account is granted $50 in store credit at signup.',          'store_credit',       50,  NULL,      40),
  ('welcome_credit_75',  '$75 Store Credit',   'New account is granted $75 in store credit at signup.',          'store_credit',       75,  NULL,      50),
  ('welcome_credit_100', '$100 Store Credit',  'New account is granted $100 in store credit at signup.',         'store_credit',      100,  NULL,      60),
  ('first_order_10pct',  '10% Off First Order','Single-use coupon for 10% off the new account''s first order.',  'first_order_coupon', 10,  'percent',  70),
  ('first_order_15pct',  '15% Off First Order','Single-use coupon for 15% off the new account''s first order.',  'first_order_coupon', 15,  'percent',  80),
  ('first_order_20pct',  '20% Off First Order','Single-use coupon for 20% off the new account''s first order.',  'first_order_coupon', 20,  'percent',  90),
  ('first_order_25off',  '$25 Off First Order','Single-use coupon for $25 off the new account''s first order.',  'first_order_coupon', 25,  'fixed',   100)
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label, description = EXCLUDED.description, grant_kind = EXCLUDED.grant_kind,
  default_value = EXCLUDED.default_value, coupon_discount_type = EXCLUDED.coupon_discount_type,
  sort_order = EXCLUDED.sort_order;

ALTER TABLE public.signup_promo_reward_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read reward catalog" ON public.signup_promo_reward_catalog;
CREATE POLICY "Authenticated read reward catalog" ON public.signup_promo_reward_catalog
  FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Admin manage reward catalog" ON public.signup_promo_reward_catalog;
CREATE POLICY "Admin manage reward catalog" ON public.signup_promo_reward_catalog
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE IF NOT EXISTS public.signup_promo_codes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT NOT NULL,
  name          TEXT NOT NULL,
  reward_key    TEXT NOT NULL REFERENCES public.signup_promo_reward_catalog(key),
  reward_value  NUMERIC NOT NULL DEFAULT 0 CHECK (reward_value >= 0),
  scope         TEXT NOT NULL DEFAULT 'platform' CHECK (scope IN ('platform','agent')),
  owner_agent_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  max_uses      INTEGER CHECK (max_uses IS NULL OR max_uses >= 0),
  uses_count    INTEGER NOT NULL DEFAULT 0,
  starts_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at       TIMESTAMPTZ,
  created_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at IS NULL OR ends_at > starts_at),
  CHECK (scope = 'platform' OR owner_agent_id IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS signup_promo_codes_code_uniq
  ON public.signup_promo_codes (lower(code));
CREATE INDEX IF NOT EXISTS signup_promo_codes_owner_idx
  ON public.signup_promo_codes (owner_agent_id) WHERE owner_agent_id IS NOT NULL;

ALTER TABLE public.signup_promo_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manage signup promos" ON public.signup_promo_codes;
CREATE POLICY "Admin manage signup promos" ON public.signup_promo_codes
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Owner manage own signup promos" ON public.signup_promo_codes;
CREATE POLICY "Owner manage own signup promos" ON public.signup_promo_codes
  FOR ALL USING (scope = 'agent' AND owner_agent_id = auth.uid())
  WITH CHECK (scope = 'agent' AND owner_agent_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.signup_promo_redemptions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id  UUID NOT NULL REFERENCES public.signup_promo_codes(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reward_key     TEXT NOT NULL,
  reward_value   NUMERIC NOT NULL DEFAULT 0,
  grant_kind     TEXT NOT NULL,
  coupon_code    TEXT,
  status         TEXT NOT NULL DEFAULT 'granted' CHECK (status IN ('granted','consumed','void')),
  granted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);
CREATE INDEX IF NOT EXISTS signup_promo_redemptions_promo_idx
  ON public.signup_promo_redemptions (promo_code_id);

ALTER TABLE public.signup_promo_redemptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "User reads own redemption" ON public.signup_promo_redemptions;
CREATE POLICY "User reads own redemption" ON public.signup_promo_redemptions
  FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Admin reads redemptions" ON public.signup_promo_redemptions;
CREATE POLICY "Admin reads redemptions" ON public.signup_promo_redemptions
  FOR SELECT USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.apply_signup_referral(p_referee_id uuid, p_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  v_code TEXT := NULLIF(trim(p_code), '');
  v_ref RECORD; v_settings RECORD; v_promo public.referral_promotions%ROWTYPE;
  v_existing UUID; v_referrer_reward NUMERIC; v_referee_reward NUMERIC;
  v_referral_id UUID; v_kind TEXT; v_credit BOOLEAN := false;
BEGIN
  PERFORM set_config('app.allow_researcher_reassign', 'on', true);
  IF v_code IS NULL THEN RETURN jsonb_build_object('applied', false, 'reason', 'empty'); END IF;
  SELECT id, role::text AS role, is_sub_agent, is_super_agent, username,
         referring_agent_id, referral_reward_enabled, referral_reward_amount
    INTO v_ref
  FROM public.profiles
  WHERE is_active IS DISTINCT FROM false AND id <> p_referee_id
    AND (lower(username) = lower(v_code) OR lower(referral_code) = lower(v_code))
  ORDER BY (lower(username) = lower(v_code)) DESC LIMIT 1;
  IF v_ref.id IS NULL THEN RETURN jsonb_build_object('applied', false, 'reason', 'not_found'); END IF;

  IF v_ref.role = 'researcher' AND NOT COALESCE(v_ref.is_sub_agent,false)
     AND NOT COALESCE(v_ref.is_super_agent,false) THEN
    v_kind := 'researcher_referral';
    SELECT id INTO v_existing FROM public.researcher_referrals
      WHERE referee_id = p_referee_id AND status IN ('applied','qualifying','rewarded');
    IF v_existing IS NOT NULL THEN
      RETURN jsonb_build_object('applied', false, 'reason', 'already_referred', 'kind', v_kind);
    END IF;
    SELECT * INTO v_settings FROM public.referral_settings WHERE id = 1;
    IF v_settings.is_active IS DISTINCT FROM false THEN
      SELECT * INTO v_promo FROM public.active_referral_promotion();
      v_referrer_reward := COALESCE(v_promo.referrer_reward, v_settings.referrer_reward, 0);
      v_referee_reward  := COALESCE(v_promo.referee_reward,  v_settings.referee_reward, 0);
      INSERT INTO public.researcher_referrals
        (referrer_id, referee_id, code, status, applied_at,
         referrer_reward_amount, referee_reward_amount, expires_at, notes)
      VALUES
        (v_ref.id, p_referee_id, upper(v_code), 'qualifying', NOW(),
         v_referrer_reward, v_referee_reward, NOW() + INTERVAL '180 days',
         CASE WHEN v_promo.id IS NOT NULL THEN 'promo:'||v_promo.name ELSE NULL END)
      RETURNING id INTO v_referral_id;
      v_credit := true;
    END IF;
    IF v_ref.referring_agent_id IS NOT NULL THEN
      UPDATE public.profiles SET referring_agent_id = v_ref.referring_agent_id, updated_at = NOW()
      WHERE id = p_referee_id;
    END IF;
    RETURN jsonb_build_object('applied', true, 'kind', v_kind, 'referrer_id', v_ref.id,
      'referrer_username', v_ref.username, 'credit_recorded', v_credit, 'referral_id', v_referral_id);
  END IF;

  IF COALESCE(v_ref.is_sub_agent, false) THEN
    v_kind := 'sub_agent_downline';
    UPDATE public.profiles SET referring_agent_id = v_ref.id, updated_at = NOW() WHERE id = p_referee_id;
    IF COALESCE(v_ref.referral_reward_enabled,false) AND COALESCE(v_ref.referral_reward_amount,0) > 0 THEN
      SELECT id INTO v_existing FROM public.researcher_referrals
        WHERE referee_id = p_referee_id AND status IN ('applied','qualifying','rewarded');
      IF v_existing IS NULL THEN
        INSERT INTO public.researcher_referrals
          (referrer_id, referee_id, code, status, applied_at,
           referrer_reward_amount, referee_reward_amount, expires_at, notes)
        VALUES
          (v_ref.id, p_referee_id, upper(v_code), 'qualifying', NOW(),
           v_ref.referral_reward_amount, 0, NOW() + INTERVAL '180 days', 'sub_agent_referral')
        RETURNING id INTO v_referral_id;
        v_credit := true;
      END IF;
    END IF;
    RETURN jsonb_build_object('applied', true, 'kind', v_kind, 'referrer_id', v_ref.id,
      'referrer_username', v_ref.username, 'credit_recorded', v_credit, 'referral_id', v_referral_id);
  END IF;

  v_kind := CASE WHEN COALESCE(v_ref.is_super_agent,false) OR v_ref.role = 'super_agent'
                 THEN 'super_agent_downline' ELSE 'agent_downline' END;
  UPDATE public.profiles SET referring_agent_id = v_ref.id, updated_at = NOW() WHERE id = p_referee_id;
  RETURN jsonb_build_object('applied', true, 'kind', v_kind, 'referrer_id', v_ref.id,
    'referrer_username', v_ref.username, 'credit_recorded', false);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.apply_signup_referral(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.redeem_signup_promo(p_user_id uuid, p_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  v_code TEXT := NULLIF(trim(p_code), '');
  v_promo RECORD; v_cat RECORD; v_agent UUID; v_coupon_code TEXT;
BEGIN
  IF v_code IS NULL THEN RETURN jsonb_build_object('redeemed', false, 'reason', 'empty'); END IF;
  IF EXISTS (SELECT 1 FROM public.signup_promo_redemptions WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION 'A Signup Promo Has Already Been Applied To This Account.';
  END IF;
  SELECT * INTO v_promo FROM public.signup_promo_codes
  WHERE lower(code) = lower(v_code) AND is_active
    AND starts_at <= NOW() AND (ends_at IS NULL OR ends_at > NOW()) FOR UPDATE;
  IF v_promo.id IS NULL THEN RAISE EXCEPTION 'Promo Code Not Valid.'; END IF;
  IF v_promo.max_uses IS NOT NULL AND v_promo.uses_count >= v_promo.max_uses THEN
    RAISE EXCEPTION 'This Promo Code Has Reached Its Usage Limit.';
  END IF;
  SELECT * INTO v_cat FROM public.signup_promo_reward_catalog WHERE key = v_promo.reward_key;
  IF v_cat.key IS NULL THEN RAISE EXCEPTION 'Promo Reward Is No Longer Available.'; END IF;
  IF v_cat.grant_kind = 'store_credit' THEN
    PERFORM public.credit_prepaid_balance(p_user_id, v_promo.reward_value, v_promo.id,
      'Signup Promo: ' || v_promo.name);
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
         v_promo.reward_value, 1, 1, true, NOW() + INTERVAL '60 days', true,
         'Signup promo ' || v_promo.code);
    END IF;
  END IF;
  INSERT INTO public.signup_promo_redemptions
    (promo_code_id, user_id, reward_key, reward_value, grant_kind, coupon_code, status)
  VALUES
    (v_promo.id, p_user_id, v_promo.reward_key, v_promo.reward_value,
     v_cat.grant_kind, v_coupon_code, 'granted');
  UPDATE public.signup_promo_codes SET uses_count = uses_count + 1 WHERE id = v_promo.id;
  RETURN jsonb_build_object('redeemed', true, 'reward_key', v_promo.reward_key,
    'grant_kind', v_cat.grant_kind, 'reward_value', v_promo.reward_value,
    'label', v_cat.label, 'coupon_code', v_coupon_code);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.redeem_signup_promo(uuid, text) FROM PUBLIC, anon, authenticated;
