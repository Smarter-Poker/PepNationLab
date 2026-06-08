-- ============================================================
-- PEP NATION LAB -- Super-agent agent-markup METHOD
-- ============================================================
-- A super agent chooses HOW their agents are priced, as a default applied to
-- every new agent they create (overridable per-agent later):
--
--   'flat'     -- a fixed markup percent across the board. The new agent's
--                 custom_markup_override is set to default_agent_markup_pct/100,
--                 so cost = house_base * (1 + markup) regardless of volume.
--   'gamified' -- the new agent rides the platform's volume ladder
--                 (house_tiers via fn_resolve_house_tier_level): custom_markup_override
--                 is left NULL so the markup improves as the agent's volume grows.
--
-- Pairs with default_agent_markup_pct (migration 20260608000060).
-- Applied to ydsaqnnuwyvtyxgvrnys via Supabase MCP.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS default_agent_pricing_mode TEXT NOT NULL DEFAULT 'flat';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_default_agent_pricing_mode_check') THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_default_agent_pricing_mode_check
      CHECK (default_agent_pricing_mode IN ('flat', 'gamified'));
  END IF;
END $$;

COMMENT ON COLUMN public.profiles.default_agent_pricing_mode IS
  'Super-agent default pricing method for NEW agents: flat (fixed custom_markup_override from default_agent_markup_pct) or gamified (NULL override; agent rides the house volume ladder). Onboarding downstream step; overridable per-agent.';
