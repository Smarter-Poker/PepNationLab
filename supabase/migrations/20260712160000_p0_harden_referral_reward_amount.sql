-- Phase 0 / Exploit C1: bound + pin profiles.referral_reward_amount & referral_reward_enabled.
-- Before: the $1000 cap lived ONLY in POST /api/agent/referral-reward. The column had
-- CHECK(>=0) with no upper bound, was NOT pinned by protect_profile_columns, and the RLS
-- policy "Users can update own profile" has an empty WITH CHECK — so any authenticated user
-- could set referral_reward_enabled=true / referral_reward_amount=<huge> straight from the
-- browser and later harvest it as house-funded prepaid credit.

-- 1. Role-agnostic DB upper bound (the validated route already clamps to 1000, so no conflict;
--    service-role/SECURITY DEFINER settlement paths never set this column).
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_referral_reward_amount_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_referral_reward_amount_check
  CHECK (referral_reward_amount >= 0 AND referral_reward_amount <= 1000);

-- 2. Pin both columns on AUTHENTICATED updates. Service-role (createServiceClient /
--    createAdminClient) and SECURITY DEFINER paths run as a non-'authenticated' role and are
--    unaffected, so POST /api/agent/referral-reward (service_role key) still works.
CREATE OR REPLACE FUNCTION public.protect_profile_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
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
    NEW.is_sub_agent := OLD.is_sub_agent;
    NEW.commission_pct := OLD.commission_pct;
    NEW.referring_sub_agent_id := OLD.referring_sub_agent_id;
    NEW.created_by_agent_id := OLD.created_by_agent_id;
    NEW.created_by_role := OLD.created_by_role;
    NEW.first_sign_in_at := OLD.first_sign_in_at;
    NEW.last_sign_in_at := OLD.last_sign_in_at;
    NEW.sign_in_count := OLD.sign_in_count;
    NEW.account_activated_at := OLD.account_activated_at;
    NEW.account_type := OLD.account_type;
    NEW.max_auto_approve_limit := OLD.max_auto_approve_limit;
    NEW.credit_used := OLD.credit_used;
    NEW.referring_agent_id := OLD.referring_agent_id;
    NEW.custom_markup_override := OLD.custom_markup_override;
    NEW.locked_tier_level := OLD.locked_tier_level;
    NEW.house_tier_level := OLD.house_tier_level;
    NEW.velocity_cap := OLD.velocity_cap;
    NEW.fixed_scale_override := OLD.fixed_scale_override;
    -- Agent-funded payouts audit 2026-07-12 (Exploit C1):
    NEW.referral_reward_enabled := OLD.referral_reward_enabled;
    NEW.referral_reward_amount := OLD.referral_reward_amount;
  END IF;
  RETURN NEW;
END;
$function$;
