-- ============================================================
-- PEP NATION LAB -- Backfill super-agent default agent-markup
-- ============================================================
-- Super agents created before the onboarding "Set Your Agent Markup" step
-- existed carry default_agent_pricing_mode = 'flat' (the column default) but a
-- NULL default_agent_markup_pct. In that state the flat mode is inert: when they
-- create an agent, /api/agent/agents leaves custom_markup_override unset and the
-- new agent falls to the provisioning trigger default instead of an intended
-- flat markup.
--
-- Seed the documented onboarding default (30%, the value the wizard's flat tab
-- pre-fills) for those super agents so flat mode is functional. This only
-- influences the DEFAULT applied to FUTURE agents they create; it is overridable
-- per-agent from the Agents page, and existing agents are unaffected. Super
-- agents who chose 'gamified', or who already set a flat percent, are untouched.
-- ============================================================

UPDATE public.profiles
SET default_agent_markup_pct = 30
WHERE is_super_agent = true
  AND default_agent_pricing_mode = 'flat'
  AND default_agent_markup_pct IS NULL;
