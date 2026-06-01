-- HOTFIX v2 (2026-05-31 21:35 UTC): another session reverted the fix.
-- Migration 20260605000006_fix_protect_profile_columns_trigger reapplied
-- the buggy version still using NEW.agent_status — column does NOT exist.
-- Re-pin with the correct columns. Includes runtime assert that fails
-- the migration immediately if a future drift reintroduces the bad names.

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
    -- SACA columns
    NEW.is_sub_agent := OLD.is_sub_agent;
    NEW.commission_pct := OLD.commission_pct;
    NEW.referring_sub_agent_id := OLD.referring_sub_agent_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_catalog;

DO $$
DECLARE
  v_src TEXT;
BEGIN
  SELECT prosrc INTO v_src FROM pg_proc
  WHERE proname='protect_profile_columns' AND pronamespace='public'::regnamespace;
  IF v_src LIKE '%agent_status%' OR v_src LIKE '%agent_tier%' THEN
    RAISE EXCEPTION 'protect_profile_columns still references nonexistent agent_status/agent_tier: %', v_src;
  END IF;
END $$;
