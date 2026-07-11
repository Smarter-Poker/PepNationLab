-- Custom Referral Promotions.
--
-- The researcher referral program already exists (researcher_referrals,
-- referral_settings, apply_referral_code, fulfil_researcher_referral, the
-- referrals-fulfil cron). Today reward amounts come from a single static
-- referral_settings row. This adds named, scheduled promotion campaigns
-- ("Double Rewards Week", "Holiday 2x", etc.) that temporarily override the
-- base reward amounts, and wires them into the existing flow by updating only
-- the apply_referral_code function -- no application code changes.

CREATE TABLE IF NOT EXISTS public.referral_promotions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  referrer_reward NUMERIC NOT NULL DEFAULT 0 CHECK (referrer_reward >= 0),
  referee_reward  NUMERIC NOT NULL DEFAULT 0 CHECK (referee_reward >= 0),
  -- Optional note surfaced to researchers ("Refer a friend, you both get $20").
  description     TEXT,
  starts_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at         TIMESTAMPTZ,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  -- Higher priority wins when multiple promotions are active at once.
  priority        INTEGER NOT NULL DEFAULT 0,
  created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at IS NULL OR ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS referral_promotions_active_idx
  ON public.referral_promotions (priority DESC, created_at DESC)
  WHERE is_active;

ALTER TABLE public.referral_promotions ENABLE ROW LEVEL SECURITY;

-- Admins manage everything; any authenticated user may read (promo terms are
-- not sensitive and the researcher referral page can advertise the active one).
DROP POLICY IF EXISTS "Admin manage referral promotions" ON public.referral_promotions;
CREATE POLICY "Admin manage referral promotions" ON public.referral_promotions
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Authenticated read referral promotions" ON public.referral_promotions;
CREATE POLICY "Authenticated read referral promotions" ON public.referral_promotions
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Returns the single highest-priority promotion active right now, or no row.
CREATE OR REPLACE FUNCTION public.active_referral_promotion()
RETURNS SETOF public.referral_promotions
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT *
  FROM public.referral_promotions
  WHERE is_active
    AND starts_at <= NOW()
    AND (ends_at IS NULL OR ends_at > NOW())
  ORDER BY priority DESC, created_at DESC
  LIMIT 1;
$$;

-- Re-create apply_referral_code so a live promotion overrides the base reward
-- amounts. Logic is otherwise byte-identical to the existing function.
CREATE OR REPLACE FUNCTION public.apply_referral_code(p_referee_id uuid, p_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_referrer_id UUID;
  v_existing UUID;
  v_settings RECORD;
  v_promo public.referral_promotions%ROWTYPE;
  v_referrer_reward NUMERIC;
  v_referee_reward NUMERIC;
  v_notes TEXT;
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

  -- Custom promotion override: a live promotion's amounts take precedence over
  -- the base settings. With no active promotion, behavior is unchanged.
  SELECT * INTO v_promo FROM public.active_referral_promotion();
  v_referrer_reward := COALESCE(v_promo.referrer_reward, v_settings.referrer_reward);
  v_referee_reward  := COALESCE(v_promo.referee_reward,  v_settings.referee_reward);
  v_notes := CASE WHEN v_promo.id IS NOT NULL THEN 'promo:' || v_promo.name ELSE NULL END;

  INSERT INTO public.researcher_referrals
    (referrer_id, referee_id, code, status, applied_at,
     referrer_reward_amount, referee_reward_amount,
     expires_at, notes)
  VALUES
    (v_referrer_id, p_referee_id, upper(trim(p_code)), 'qualifying', NOW(),
     v_referrer_reward, v_referee_reward,
     NOW() + INTERVAL '180 days', v_notes)
  RETURNING id INTO v_referral_id;

  RETURN v_referral_id;
END;
$function$;
