-- Security phase 3: privileged-function EXECUTE lockdown, reasserted + durable.
--
-- Background: phase-1 (20260707204456) revoked EXECUTE from anon/authenticated
-- on money/admin SECURITY DEFINER functions, but later migrations that did
-- CREATE OR REPLACE / DROP+CREATE on those functions reset their ACL to the
-- PostgreSQL default (EXECUTE granted to PUBLIC, which includes authenticated).
-- A 2026-07-08 advisor re-run caught 24 money functions authenticated-executable
-- again.
--
-- This migration (a) re-applies the targeted revoke, and (b) installs an
-- exception-safe event trigger that auto-revokes anon/authenticated EXECUTE
-- whenever any sensitive function is (re)created, so the regression cannot recur.
-- The trigger body swallows all errors so it can never abort a triggering DDL.

-- (a) Re-apply the targeted revoke.
DO $$
DECLARE
  fn text; rec record;
  service_only text[] := ARRAY[
    'wallet_transfer','deduct_prepaid_balance','refund_prepaid_balance','credit_prepaid_balance',
    'charge_order_credit_line','charge_credit_line','reverse_order_credit_charge','super_credit_agent_balance',
    'admin_credit_account','issue_store_credit','issue_refund','redeem_store_credit','release_store_credit',
    'cancel_order','settle_sub_agent_week','pay_weekly_statement','redeem_coupon','unredeem_coupon',
    'reserve_inventory','release_inventory','fn_admin_search_orders','fn_provisioned_accounts',
    'shippo_record_refund','shippo_enqueue_label_job','decide_credit_increase','consume_slug_reservation',
    'cancel_stale_pending_orders','coupons_daily_expiry_sweep','apply_due_price_changes',
    'upsert_agent_invoice_atomic','accrue_sub_agent_commission','fulfil_researcher_referral',
    'resolve_statement_dispute','refresh_recommendation_views','refresh_compound_search'
  ];
  auth_required text[] := ARRAY[
    'freeze_account','unfreeze_account','pay_invoice','get_statement_detail','mark_message_read'
  ];
BEGIN
  FOREACH fn IN ARRAY service_only LOOP
    FOR rec IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
      WHERE p.pronamespace='public'::regnamespace AND p.proname=fn LOOP
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', rec.sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', rec.sig);
    END LOOP;
  END LOOP;
  FOREACH fn IN ARRAY auth_required LOOP
    FOR rec IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
      WHERE p.pronamespace='public'::regnamespace AND p.proname=fn LOOP
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', rec.sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', rec.sig);
    END LOOP;
  END LOOP;
END $$;

-- (b) Durable auto-lock event trigger.
CREATE OR REPLACE FUNCTION public._autolock_privileged_functions()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  obj record;
  sensitive text[] := ARRAY[
    'wallet_transfer','deduct_prepaid_balance','refund_prepaid_balance','credit_prepaid_balance',
    'charge_order_credit_line','charge_credit_line','reverse_order_credit_charge','super_credit_agent_balance',
    'admin_credit_account','issue_store_credit','issue_refund','redeem_store_credit','release_store_credit',
    'cancel_order','settle_sub_agent_week','pay_weekly_statement','redeem_coupon','unredeem_coupon',
    'reserve_inventory','release_inventory','fn_admin_search_orders','fn_provisioned_accounts',
    'shippo_record_refund','shippo_enqueue_label_job','decide_credit_increase','consume_slug_reservation',
    'cancel_stale_pending_orders','coupons_daily_expiry_sweep','apply_due_price_changes',
    'upsert_agent_invoice_atomic','accrue_sub_agent_commission','fulfil_researcher_referral',
    'resolve_statement_dispute','refresh_recommendation_views','refresh_compound_search'
  ];
BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_ddl_commands() WHERE object_type = 'function' LOOP
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE p.oid = obj.objid AND n.nspname = 'public' AND p.proname = ANY(sensitive)
      ) THEN
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', obj.object_identity);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', obj.object_identity);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DROP EVENT TRIGGER IF EXISTS trg_autolock_privileged_functions;
CREATE EVENT TRIGGER trg_autolock_privileged_functions
  ON ddl_command_end
  WHEN TAG IN ('CREATE FUNCTION', 'ALTER FUNCTION')
  EXECUTE FUNCTION public._autolock_privileged_functions();
