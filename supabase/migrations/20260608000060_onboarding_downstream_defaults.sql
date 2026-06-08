-- ============================================================
-- PEP NATION LAB -- Onboarding: inline downstream default pricing
-- ============================================================
-- Lets a super agent set a DEFAULT markup to apply to agents they create,
-- and a regular agent set a DEFAULT commission to apply to sub-agents they
-- promote. Captured during the onboarding wizard's downstream step and
-- auto-applied at downstream account create/promote time when an explicit
-- value is not supplied.
--
-- Applied to ydsaqnnuwyvtyxgvrnys via Supabase MCP.
--
-- Semantics:
--   default_sub_commission_pct  -- agent's default cut of sales for NEW
--                                  sub-agents (0-40, same range as the
--                                  per-sub-agent commission_pct cap).
--   default_agent_markup_pct    -- super agent's default markup percent for
--                                  NEW agents (0-500). Stored here as a whole
--                                  percent; applied as a decimal fraction to
--                                  the new agent's custom_markup_override
--                                  (50 -> 0.50), the column lib/pricing.ts
--                                  consumes under the active tier-ladder-v2.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS default_sub_commission_pct NUMERIC(5,2);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS default_agent_markup_pct NUMERIC(6,2);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_default_sub_commission_range') THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_default_sub_commission_range
      CHECK (default_sub_commission_pct IS NULL OR (default_sub_commission_pct >= 0 AND default_sub_commission_pct <= 40));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_default_agent_markup_range') THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_default_agent_markup_range
      CHECK (default_agent_markup_pct IS NULL OR (default_agent_markup_pct >= 0 AND default_agent_markup_pct <= 500));
  END IF;
END $$;

COMMENT ON COLUMN public.profiles.default_sub_commission_pct IS
  'Agent default commission percent (0-40) applied to NEW sub-agents at promote time when not explicitly provided. Onboarding downstream step.';
COMMENT ON COLUMN public.profiles.default_agent_markup_pct IS
  'Super-agent default markup percent (0-500) applied to NEW agents (as custom_markup_override fraction) at create/promote time when not explicitly provided. Onboarding downstream step.';
