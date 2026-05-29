-- Per-researcher unique referral code (issued lazily on first request)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_referral_code_uniq_idx ON public.profiles (lower(referral_code)) WHERE referral_code IS NOT NULL;

-- Platform-wide settings: admin can adjust reward amounts + minimum spend
CREATE TABLE IF NOT EXISTS public.referral_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  referrer_reward NUMERIC NOT NULL DEFAULT 25 CHECK (referrer_reward >= 0),
  referee_reward NUMERIC NOT NULL DEFAULT 25 CHECK (referee_reward >= 0),
  min_order_total NUMERIC NOT NULL DEFAULT 100 CHECK (min_order_total >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);
INSERT INTO public.referral_settings (id, referrer_reward, referee_reward, min_order_total, is_active)
VALUES (1, 25, 25, 100, true)
ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.referral_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone reads referral settings" ON public.referral_settings;
CREATE POLICY "Anyone reads referral settings" ON public.referral_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin manages referral settings" ON public.referral_settings;
CREATE POLICY "Admin manages referral settings" ON public.referral_settings FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- One row per referrer/referee pair
CREATE TABLE IF NOT EXISTS public.researcher_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  referee_email TEXT,
  code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','applied','qualifying','rewarded','expired','revoked')),
  qualifying_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  referrer_reward_amount NUMERIC,
  referee_reward_amount NUMERIC,
  applied_at TIMESTAMPTZ,
  rewarded_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (referrer_id, referee_id)
);
CREATE INDEX IF NOT EXISTS researcher_referrals_referrer_idx ON public.researcher_referrals(referrer_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS researcher_referrals_referee_idx ON public.researcher_referrals(referee_id) WHERE referee_id IS NOT NULL;
ALTER TABLE public.researcher_referrals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Referrer reads own referrals" ON public.researcher_referrals;
CREATE POLICY "Referrer reads own referrals" ON public.researcher_referrals FOR SELECT
  USING (referrer_id = auth.uid());
DROP POLICY IF EXISTS "Referee reads own referral" ON public.researcher_referrals;
CREATE POLICY "Referee reads own referral" ON public.researcher_referrals FOR SELECT
  USING (referee_id = auth.uid());
DROP POLICY IF EXISTS "Admin reads all referrals" ON public.researcher_referrals;
CREATE POLICY "Admin reads all referrals" ON public.researcher_referrals FOR SELECT USING (public.is_admin());
DROP POLICY IF EXISTS "Admin manages referrals" ON public.researcher_referrals;
CREATE POLICY "Admin manages referrals" ON public.researcher_referrals FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Atomic code generator + idempotent fetch RPC.
-- Researcher requests their code; we lazily mint a 6-char base32 token if missing.
CREATE OR REPLACE FUNCTION public.get_or_create_referral_code(p_user_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code TEXT;
  v_attempt INTEGER := 0;
BEGIN
  SELECT referral_code INTO v_code FROM public.profiles WHERE id = p_user_id;
  IF v_code IS NOT NULL THEN RETURN v_code; END IF;

  LOOP
    v_attempt := v_attempt + 1;
    -- base32-ish 6-char code from random bytes
    v_code := upper(substring(encode(gen_random_bytes(8), 'base32') from 1 for 6));
    -- strip any ambiguous chars and ensure 6 length
    v_code := translate(v_code, '01', 'AB');
    BEGIN
      UPDATE public.profiles SET referral_code = v_code WHERE id = p_user_id AND referral_code IS NULL;
      IF FOUND THEN RETURN v_code; END IF;
      -- another writer beat us; refetch
      SELECT referral_code INTO v_code FROM public.profiles WHERE id = p_user_id;
      IF v_code IS NOT NULL THEN RETURN v_code; END IF;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempt > 10 THEN RAISE EXCEPTION 'Could not allocate referral code'; END IF;
    END;
  END LOOP;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_or_create_referral_code(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_referral_code(UUID) TO authenticated;

-- Apply a referral code at signup or first order: claims referee slot if open.
CREATE OR REPLACE FUNCTION public.apply_referral_code(p_referee_id UUID, p_code TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_referrer_id UUID;
  v_existing UUID;
  v_settings RECORD;
  v_referral_id UUID;
BEGIN
  IF p_code IS NULL OR length(trim(p_code)) = 0 THEN RAISE EXCEPTION 'Invalid Code'; END IF;
  SELECT id INTO v_referrer_id FROM public.profiles
    WHERE lower(referral_code) = lower(trim(p_code))
      AND role = 'researcher' AND id <> p_referee_id;
  IF v_referrer_id IS NULL THEN RAISE EXCEPTION 'Referral Code Not Found'; END IF;

  SELECT id INTO v_existing FROM public.researcher_referrals
    WHERE referee_id = p_referee_id AND status IN ('applied','qualifying','rewarded');
  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'You Have Already Used A Referral Code';
  END IF;

  SELECT * INTO v_settings FROM public.referral_settings WHERE id = 1;
  IF NOT v_settings.is_active THEN RAISE EXCEPTION 'Referral Program Is Currently Paused'; END IF;

  INSERT INTO public.researcher_referrals
    (referrer_id, referee_id, code, status, applied_at,
     referrer_reward_amount, referee_reward_amount,
     expires_at)
  VALUES
    (v_referrer_id, p_referee_id, upper(trim(p_code)), 'qualifying', NOW(),
     v_settings.referrer_reward, v_settings.referee_reward,
     NOW() + INTERVAL '180 days')
  RETURNING id INTO v_referral_id;

  RETURN v_referral_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.apply_referral_code(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_referral_code(UUID, TEXT) TO authenticated;

-- Mark a referral as rewarded after the referee completes a qualifying order.
-- Issues store credits to BOTH parties via the existing store_credits ledger.
CREATE OR REPLACE FUNCTION public.fulfil_referral_reward(p_referral_id UUID, p_qualifying_order_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ref RECORD;
  v_before NUMERIC; v_after NUMERIC;
BEGIN
  SELECT * INTO v_ref FROM public.researcher_referrals WHERE id = p_referral_id FOR UPDATE;
  IF v_ref.id IS NULL THEN RAISE EXCEPTION 'Referral not found'; END IF;
  IF v_ref.status <> 'qualifying' THEN RETURN false; END IF;

  -- Referrer credit
  IF v_ref.referrer_reward_amount > 0 THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_before FROM public.store_credits WHERE user_id = v_ref.referrer_id;
    v_after := v_before + v_ref.referrer_reward_amount;
    INSERT INTO public.store_credits (user_id, amount, balance_before, balance_after, type, source_order_id, description)
    VALUES (v_ref.referrer_id, v_ref.referrer_reward_amount, v_before, v_after, 'issue', p_qualifying_order_id,
            'Referral Reward (Referrer)');
  END IF;

  -- Referee credit
  IF v_ref.referee_reward_amount > 0 AND v_ref.referee_id IS NOT NULL THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_before FROM public.store_credits WHERE user_id = v_ref.referee_id;
    v_after := v_before + v_ref.referee_reward_amount;
    INSERT INTO public.store_credits (user_id, amount, balance_before, balance_after, type, source_order_id, description)
    VALUES (v_ref.referee_id, v_ref.referee_reward_amount, v_before, v_after, 'issue', p_qualifying_order_id,
            'Referral Reward (Referee)');
  END IF;

  UPDATE public.researcher_referrals
  SET status = 'rewarded', rewarded_at = NOW(), qualifying_order_id = p_qualifying_order_id
  WHERE id = p_referral_id;

  RETURN true;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.fulfil_referral_reward(UUID, UUID) FROM PUBLIC, anon, authenticated;
