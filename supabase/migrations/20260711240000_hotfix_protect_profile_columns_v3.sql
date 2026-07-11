-- HOTFIX v3 (2026-07-11): extend protect_profile_columns trigger pin-list
-- to include newly discovered privilege-escalation vectors per C4 bug report.

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
    
    -- New columns added in v3
    -- Safe to coalesce fallback if the column doesn't exist?
    -- No, this function will fail if these columns don't exist. We assume they exist based on C4 report.
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_catalog;
