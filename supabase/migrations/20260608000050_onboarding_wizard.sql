-- ============================================================
-- PEP NATION LAB -- Guided Onboarding Wizard (data layer)
-- ============================================================
-- Adds the persistence the role-tailored onboarding wizard needs for
-- super agents, agents, and sub-agents. Most steps are DERIVED from
-- existing data (must_change_password, profile fields, warehouse_address,
-- storefront slug, downstream pricing rows). This migration only adds the
-- pieces that cannot be derived: per-step acknowledgment flags for the
-- device-bound or read-only steps (install + notifications, tutorials), and
-- a single completion timestamp that the dashboard gate keys off.
--
-- Applied to ydsaqnnuwyvtyxgvrnys via Supabase MCP.
--
-- Pricing note: the super-agent default markup (50%) is stored in the
-- existing uncapped profiles.custom_markup_override column (a decimal
-- fraction, 0.50 = 50%), which lib/pricing.ts already consumes as
-- cost = base * (1 + markup). The 0-40 cap on commission_pct is left
-- untouched -- that remains the sub-agent commission cap.
-- ============================================================

-- 1. onboarding_progress: JSONB bag of acknowledgment flags for the
--    non-derivable steps. Shape (all optional booleans):
--      {
--        "notifications_ack": true,        -- saw + actioned install/notify step
--        "product_tutorial_ack": true,     -- completed product/markup tutorial
--        "downstream_tutorial_ack": true   -- completed pricing/commission tutorial
--      }
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_progress JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 2. onboarding_completed_at: set once when the wizard's final step is
--    confirmed. NULL = wizard not finished -> dashboard gate redirects to
--    /onboarding. The gate treats a NULL as "needs onboarding" only for
--    agent / super_agent / sub-agent roles; researchers and admins are never
--    gated.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- 3. Defensive index for the gate's hot-path lookups (pending onboarding).
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_pending
  ON public.profiles (role)
  WHERE onboarding_completed_at IS NULL;

-- 4. Guard: ensure the protect_profile_columns trigger is NOT silently
--    reverting our new columns. It only pins role/pricing/SACA columns, so
--    onboarding_progress + onboarding_completed_at remain self-updatable by
--    the owning authenticated user (writes still go through an API route with
--    a same-origin CSRF check + own-row enforcement).
DO $$
DECLARE
  v_src TEXT;
BEGIN
  SELECT prosrc INTO v_src FROM pg_proc
  WHERE proname = 'protect_profile_columns' AND pronamespace = 'public'::regnamespace;
  IF v_src IS NOT NULL
     AND (v_src LIKE '%onboarding_progress%' OR v_src LIKE '%onboarding_completed_at%') THEN
    RAISE EXCEPTION 'protect_profile_columns unexpectedly pins onboarding columns; wizard writes would be reverted';
  END IF;
END $$;

COMMENT ON COLUMN public.profiles.onboarding_progress IS
  'Acknowledgment flags for non-derivable onboarding wizard steps (install/notifications, tutorials). See migration 20260608000050.';
COMMENT ON COLUMN public.profiles.onboarding_completed_at IS
  'Timestamp the role-tailored onboarding wizard was finished. NULL = pending; dashboard gate redirects agents/sub-agents to /onboarding while NULL.';
