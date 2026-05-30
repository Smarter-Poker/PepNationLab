-- ============================================================
-- Audit 15: Security Hardening — apply_referral_code caller guard
--           + redeem_store_credit double-spend advisory lock
-- ============================================================

-- ── Fix H1: apply_referral_code — enforce caller is p_referee_id ────────────
-- The function accepted p_referee_id as a parameter with no validation that
-- the caller IS that user. Any authenticated user could call:
--   apply_referral_code('victim-uuid', 'CODE')
-- to bind another user's account to their referral, stealing the $25 referee reward.
--
-- Fix: validate p_referee_id = auth.uid() at the top of the function.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.apply_referral_code(
  p_referee_id UUID,
  p_code TEXT
) RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ref RECORD;
BEGIN
  -- ── Audit15: Caller guard — only the referee can apply a code on their own behalf ──
  IF p_referee_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: caller is not p_referee_id';
  END IF;

  -- Resolve the referral row by code (case-insensitive).
  SELECT * INTO v_ref
  FROM public.researcher_referrals
  WHERE upper(code) = upper(p_code)
  LIMIT 1;

  IF v_ref.id IS NULL THEN RETURN 'not_found'; END IF;

  -- Expired?
  IF v_ref.expires_at IS NOT NULL AND v_ref.expires_at < NOW() THEN
    RETURN 'expired';
  END IF;

  -- Self-referral?
  IF v_ref.referrer_id = p_referee_id THEN RETURN 'self_referral'; END IF;

  -- Already applied by this user?
  IF EXISTS (
    SELECT 1 FROM public.researcher_referrals
    WHERE referee_id = p_referee_id AND status NOT IN ('expired', 'revoked')
  ) THEN
    RETURN 'already_applied';
  END IF;

  -- Bind the referee to this referral.
  UPDATE public.researcher_referrals
  SET referee_id = p_referee_id, status = 'applied', applied_at = NOW()
  WHERE id = v_ref.id AND referee_id IS NULL;

  IF NOT FOUND THEN RETURN 'already_applied'; END IF;

  RETURN 'ok';
END;
$$;

-- Revoke broad access; only authenticated users (the referee themselves) may call.
REVOKE EXECUTE ON FUNCTION public.apply_referral_code(UUID, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.apply_referral_code(UUID, TEXT) TO authenticated;


-- ── Fix M1: redeem_store_credit — advisory lock prevents double-spend ────────
-- The original function computed balance as SUM(amount) with no row-level lock.
-- Two concurrent requests (e.g. two browser tabs pressing "Pay" simultaneously)
-- could both read the same SUM, both pass the >= p_amount check, and both insert
-- debit rows — driving the balance negative (unauthorized free credit).
--
-- Fix: acquire a session-level advisory transaction lock keyed on the user_id
-- before reading the balance. Postgres releases advisory transaction locks at
-- the end of the enclosing transaction, so there is no risk of a stale lock.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.redeem_store_credit(
  p_user_id    UUID,
  p_amount     NUMERIC,
  p_order_id   UUID
) RETURNS NUMERIC LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_balance_before NUMERIC;
  v_balance_after  NUMERIC;
  v_redeemed       NUMERIC;
BEGIN
  -- ── Audit15: advisory transaction lock — prevents concurrent double-spend ──
  -- hashtext() maps the UUID to a 32-bit int in a deterministic way; abs()
  -- keeps the lock id positive (advisory locks use bigint, so no overflow risk).
  PERFORM pg_advisory_xact_lock(abs(hashtext(p_user_id::text)));

  -- Caller must be the user themselves or service_role.
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_balance_before
  FROM public.store_credits
  WHERE user_id = p_user_id;

  IF v_balance_before < p_amount THEN
    RAISE EXCEPTION 'Insufficient store credit (balance=%, requested=%)',
                    v_balance_before, p_amount;
  END IF;

  v_redeemed      := LEAST(p_amount, v_balance_before);
  v_balance_after := v_balance_before - v_redeemed;

  INSERT INTO public.store_credits
    (user_id, amount, balance_before, balance_after, type, source_order_id, description)
  VALUES
    (p_user_id, -v_redeemed, v_balance_before, v_balance_after,
     'redeem', p_order_id, 'Applied at checkout');

  RETURN v_redeemed;
END;
$$;

-- Only authenticated users and service_role may call this.
REVOKE EXECUTE ON FUNCTION public.redeem_store_credit(UUID, NUMERIC, UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.redeem_store_credit(UUID, NUMERIC, UUID) TO authenticated, service_role;


-- ── Fix M2: Add pg_temp to search_path for 4 SECURITY DEFINER RLS helpers ───
-- Supabase best-practice: include pg_temp at the end to prevent temp-schema
-- shadowing attacks on SECURITY DEFINER functions.
ALTER FUNCTION public.is_admin()          SET search_path = public, pg_temp;
ALTER FUNCTION public.is_agent_or_above() SET search_path = public, pg_temp;

-- is_super_agent may not exist as a standalone function if it's inlined in RLS.
-- Use DO block to apply only if it exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'is_super_agent'
      AND p.pronargs = 0
  ) THEN
    EXECUTE 'ALTER FUNCTION public.is_super_agent() SET search_path = public, pg_temp';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'get_user_role'
      AND p.pronargs = 0
  ) THEN
    EXECUTE 'ALTER FUNCTION public.get_user_role() SET search_path = public, pg_temp';
  END IF;
END $$;
