-- Fix syntax error in protect_profile_columns where agent_tier was used instead of tier
CREATE OR REPLACE FUNCTION protect_profile_columns() RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('role') = 'authenticated' THEN
    NEW.role = OLD.role;
    NEW.credit_limit = OLD.credit_limit;
    NEW.prepaid_balance = OLD.prepaid_balance;
    NEW.auto_approve_orders = OLD.auto_approve_orders;
    NEW.tier = OLD.tier;
    NEW.agent_status = OLD.agent_status;
    NEW.is_super_agent = OLD.is_super_agent;
    NEW.parent_agent_id = OLD.parent_agent_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
