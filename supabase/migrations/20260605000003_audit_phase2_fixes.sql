-- Migration: 20260605000003_audit_phase2_fixes.sql

-- 1. Secure `profiles` table restricted columns
CREATE OR REPLACE FUNCTION protect_profile_columns() RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('role') = 'authenticated' THEN
    NEW.role = OLD.role;
    NEW.credit_limit = OLD.credit_limit;
    NEW.prepaid_balance = OLD.prepaid_balance;
    NEW.auto_approve_orders = OLD.auto_approve_orders;
    NEW.agent_tier = OLD.agent_tier;
    NEW.agent_status = OLD.agent_status;
    NEW.is_super_agent = OLD.is_super_agent;
    NEW.parent_agent_id = OLD.parent_agent_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_profile_columns ON profiles;
CREATE TRIGGER trg_protect_profile_columns
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION protect_profile_columns();

-- 2. Drop the missing Pricing Triggers functions
DROP FUNCTION IF EXISTS public._trg_recalc_on_agent_tier() CASCADE;
DROP FUNCTION IF EXISTS public._trg_recalc_on_margin() CASCADE;
DROP FUNCTION IF EXISTS public._trg_recalc_on_override() CASCADE;
DROP FUNCTION IF EXISTS public._trg_recalc_on_product_base_cost() CASCADE;
DROP FUNCTION IF EXISTS public._trg_recalc_on_tier_multiplier() CASCADE;

-- 3. Fix data leak on `order_items`. We revoke SELECT on `unit_cost_price` and `unit_super_agent_cost` for `authenticated` role.
REVOKE SELECT(unit_cost_price) ON order_items FROM authenticated;
REVOKE SELECT(unit_super_agent_cost) ON order_items FROM authenticated;
REVOKE SELECT(unit_cost_price) ON order_items FROM anon;
REVOKE SELECT(unit_super_agent_cost) ON order_items FROM anon;
