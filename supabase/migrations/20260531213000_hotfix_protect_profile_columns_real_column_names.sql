-- HOTFIX 2026-05-31 21:30 UTC: production outage
-- Root cause: migration 20260605000003_audit_phase2_fixes installed
-- protect_profile_columns() which references NEW.agent_tier and
-- NEW.agent_status. Neither column exists on public.profiles — the
-- real columns are `tier` and `is_active`. The trigger fires BEFORE
-- UPDATE for every authenticated session, so every profile UPDATE
-- (cart sync, disclaimer flag, sub-agent ops) crashed with
-- "record 'new' has no field 'agent_tier'" → 500 platform-wide.
-- Fix: rewrite the function using the actual column names. We keep
-- the protection semantics: an authenticated user cannot change their
-- own role, credit_limit, prepaid_balance, auto_approve_orders, tier,
-- is_active, is_super_agent, or parent_agent_id. Service role still
-- bypasses (current_setting('role') = 'service_role' for the admin
-- client, so the IF branch doesn't fire).
-- Also extends protection to the SACA columns added in earlier rounds:
-- is_sub_agent, commission_pct, referring_sub_agent_id — so an
-- authenticated user cannot self-elevate to sub-agent or change their
-- commission rate via the auth client.

CREATE OR REPLACE FUNCTION public.protect_profile_columns() RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('role', true) = 'authenticated' THEN
    NEW.role := OLD.role;
    NEW.credit_limit := OLD.credit_limit;
    NEW.prepaid_balance := OLD.prepaid_balance;
    NEW.auto_approve_orders := OLD.auto_approve_orders;
    NEW.tier := OLD.tier;
    NEW.is_active := OLD.is_active;
    NEW.is_super_agent := OLD.is_super_agent;
    NEW.parent_agent_id := OLD.parent_agent_id;
    -- SACA additions: also protect SACA columns from self-elevation
    NEW.is_sub_agent := OLD.is_sub_agent;
    NEW.commission_pct := OLD.commission_pct;
    NEW.referring_sub_agent_id := OLD.referring_sub_agent_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_catalog;
